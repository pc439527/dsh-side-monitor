/**
 * dsh-side-monitor — Host collectors (read-only).
 *
 * Pulls CPU / memory / load / uptime / network / disk / processes, and Docker
 * state from the local Engine API. Everything is read-only: no control
 * operations, no arbitrary command execution, no arbitrary Docker API proxy.
 *
 * v0.2 additions:
 *   - Root abstraction (procRoot / sysRoot / fsRoot) with automatic Host Mount
 *     Mode detection: when /host/proc, /host/sys or /host/root are mounted
 *     read-only, metrics come from the HOST instead of the DSH container.
 *   - MonitorEnvironment (mode / systemSource / processSource / dockerSource /
 *     hostname) so the UI can label exactly where each metric originates.
 *   - Disk collection via /proc/mounts + statfs (no df subprocess), multi-mount
 *     with same-device dedup.
 *   - Host-side process search/sort/pagination with PPID and source.
 *   - Structured Docker ports (hostIp / hostPort / containerPort / protocol)
 *     and health status.
 *
 * v0.2.1 — Host metrics accuracy:
 *   - Load / uptime / cpuinfo / osrelease / os-release all read from the
 *     resolved host roots instead of os.* (os.loadavg/os.uptime/os.cpus/
 *     os.type/os.release). Host OS comes from /etc/os-release.
 *   - Network interfaces no longer use os.networkInterfaces(): IPv4 addresses
 *     come from /proc/net/fib_trie (local /32) mapped to interfaces via
 *     /proc/net/route connected subnets; IPv6 from /proc/net/if_inet6.
 *   - Disk same-device dedup now keys on mountinfo major:minor (not total|used).
 *   - Process elapsed/uptime uses the host /proc/uptime.
 *   - Docker stats return an explicit status/error, and per-container stats
 *     failures are surfaced (statsError) instead of silently skipped.
 *   - Environment now carries concrete per-item sources and a host/container
 *     consistency self-check (read-only mount + PID-namespace isolation).
 * @module dsh-side-monitor/collectors
 */
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { execFile as execFileCb, execFileSync } from 'node:child_process'
import {
  parseProcStatCpus, parseProcStatAggregate, cpuPercent, cpuTimesPercent,
  parseDiskstats, rateBetween, parseLoadavgTasks, normalizeThermal,
  parseVmstat, pageRate, dfUsagePercent,
} from './metrics.js'
import { createSampler } from './sampler.js'

// Linux USER_HZ (clock ticks per second) used by /proc/<pid>/stat.
const CLK_TCK = 100
// Default page size of process rows returned to the client.
const DEFAULT_PROCESS_LIMIT = 50
// Hard cap on the process page size (a single RPC response).
const MAX_PROCESS_LIMIT = 200
// Process scan snapshot cache window (ms).
const PROCESS_SCAN_CACHE_MS = 1500
// Disk collection cache window (ms).
const DISK_CACHE_MS = 10_000
// Docker container-list cache window (ms).
const DOCKER_LIST_CACHE_MS = 5_000
// Background Docker stats cadence while a browser is on the Docker view (ms).
const DOCKER_STATS_REFRESH_MS = 5_000
// How long after the last Docker-view request stats keep refreshing (ms).
const DOCKER_STATS_VIEW_MS = 30_000
// Fixed metrics cadence (ms) — the sampler's single clock (v0.7).
const SAMPLE_INTERVAL_MS = 2_000
// Docker socket path.
const DOCKER_SOCKET = '/var/run/docker.sock'

// Host Mount Mode network: /proc/net is net-namespace scoped, so even a
// /host/proc bind still shows the DSH container's interfaces. Read the real
// host netns through a short-lived read-only container that shares the host
// network namespace (cat of /proc/net files only — no ports, --rm).
//
// v0.3 perf: the probe is expensive (docker run), so it runs at most every
// NET_NS_CACHE_MS (3× less often than before) and NEVER blocks the overview
// poll — a stale snapshot is returned while the refresh happens in the
// background; network() diffs only against a genuinely new snapshot.
const NET_NS_CACHE_MS = 15_000
const NET_PROBE_IMAGE = 'curlimages/curl:8.11.1'
const NET_PROBE_NAME = 'dsh-netprobe'
let netNsCache = null // { files, ts }
let netNsInflight = null

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFileCb(cmd, args, { timeout: 8_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

/** Map Linux statfs magic numbers to friendly names for the disk panel. */
const FS_TYPE_NAMES = { 0xef53: 'ext4', 0x9123683e: 'btrfs', 0x58465342: 'xfs', 0x1021994: 'tmpfs', 0x2fc12fc1: 'zfs', 0x6969: 'nfs' }
function fsTypeName(t) { return FS_TYPE_NAMES[t] || 'fs' }

/**
 * Snapshot of the host netns proc files ({dev, route, trie, v6}) — cached and
 * coalesced so concurrent polls share a single probe. Returns null when the
 * probe fails (image missing, docker busy) — callers then fall back to
 * /host/proc (the container's own netns view).
 */
async function refreshHostNetNs() {
  const now = Date.now()
  if (netNsCache && now - netNsCache.ts < NET_NS_CACHE_MS) return netNsCache.files
  if (!netNsInflight) {
    netNsInflight = (async () => {
      try {
        const out = await execFileP('docker', [
          'run', '--rm', '--pull=never', '--net=host', '--name', NET_PROBE_NAME,
          '--entrypoint', 'sh', NET_PROBE_IMAGE, '-c',
          'cat /proc/net/dev; echo ===ROUTE===; cat /proc/net/route; echo ===TRIE===; cat /proc/net/fib_trie; echo ===V6===; cat /proc/net/if_inet6',
        ])
        netNsCache = { files: splitNetSnapshot(out), ts: Date.now() }
        return netNsCache.files
      } catch (e) {
        netNsCache = { files: null, ts: Date.now() }
        return null
      } finally {
        netNsInflight = null
      }
    })()
  }
  return netNsInflight
}

/**
 * v0.3: current netns snapshot WITHOUT blocking the overview poll — fresh cache
 * is returned as-is; a stale/absent cache triggers a background refresh and the
 * previous snapshot is returned (network() keeps the last rates, so a slightly
 * stale snapshot never zeroes the counters). Returns null only before the very
 * first probe has completed (callers fall back to the container's own netns).
 */
function netNsSnapshot() {
  const now = Date.now()
  if (netNsCache && now - netNsCache.ts < NET_NS_CACHE_MS) return netNsCache.files
  void refreshHostNetNs()
  return netNsCache ? netNsCache.files : null
}

/** Split the netprobe output (marker-separated) into the four proc texts. */
function splitNetSnapshot(out) {
  const files = { dev: [], route: [], trie: [], v6: [] }
  let current = 'dev'
  for (const line of String(out || '').split('\n')) {
    const m = line.match(/^===(\w+)===$/)
    if (m) { current = m[1].toLowerCase(); files[current] = files[current] || []; continue }
    files[current].push(line)
  }
  return { dev: files.dev.join('\n'), route: files.route.join('\n'), trie: files.trie.join('\n'), v6: files.v6.join('\n') }
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8') } catch { return null }
}

function exists(p) {
  try { return fs.existsSync(p) } catch { return false }
}

function round1(n) { return Math.round(n * 10) / 10 }
function round2(n) { return Math.round(n * 100) / 100 }
function clampInt(n, lo, hi) {
  const v = Number.isFinite(n) ? Math.floor(n) : lo
  return Math.max(lo, Math.min(hi, v))
}

/** Decode /proc/mounts octal escapes (space is \040, etc.). */
function unescapeMount(s) {
  return s.replace(/\\([0-7]{3})/g, (m, o) => String.fromCharCode(parseInt(o, 8)))
}

/** Minimal unix-socket GET for the Docker Engine API. */
function dockerGet(sockPath, p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: sockPath, path: p, method: 'GET' }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)) } catch (e) { reject(new Error('docker: bad json: ' + e.message)) }
        } else {
          reject(new Error('docker ' + res.statusCode + ': ' + data.slice(0, 200)))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(3000, () => { req.destroy(new Error('docker: timeout')) })
    req.end()
  })
}

/** Run a small concurrency-limited map. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      try { results[idx] = await fn(items[idx], idx) } catch (e) { results[idx] = { __error: e instanceof Error ? e.message : String(e) } }
    }
  }
  const workers = []
  for (let w = 0; w < Math.min(limit, items.length); w++) workers.push(worker())
  await Promise.all(workers)
  return results
}

/**
 * Parse /proc/cpuinfo text.
 * `logical` counts 'processor' lines (logical CPUs, incl. SMT threads);
 * `physical` counts unique (physical id, core id) pairs — the real core
 * count (null when not advertised, e.g. some ARM boards).
 */
export function parseCpuInfo(text) {
  const info = { logical: 0, physical: null, model: null, clockMhz: null }
  if (!text) return info
  let phys = null
  let core = null
  let seenPhysical = false
  const pairs = new Set()
  function finalize() {
    if (phys != null || core != null) pairs.add((phys == null ? '' : phys) + '|' + (core == null ? '' : core))
  }
  for (const line of text.split('\n')) {
    const t = line.trim()
    const colon = t.indexOf(':')
    if (colon < 0) continue
    const key = t.slice(0, colon).trim()
    const val = t.slice(colon + 1).trim()
    if (key === 'processor') { finalize(); info.logical++; phys = null; core = null }
    else if (key === 'physical id') { seenPhysical = true; phys = val }
    else if (key === 'core id') core = val
    else if (key === 'model name' && !info.model) info.model = val
    else if (key === 'Hardware' && !info.model) info.model = val
    else if (key === 'Processor' && !info.model) info.model = val
    else if (key === 'cpu MHz' && info.clockMhz == null && Number.isFinite(parseFloat(val))) info.clockMhz = parseFloat(val)
  }
  finalize()
  info.logical = info.logical || 1
  info.physical = seenPhysical && pairs.size > 0 ? pairs.size : null
  return info
}

/**
 * v0.3: extract the numeric exit code from a Docker status string like
 * "Exited (137) 5 seconds ago" (null when not an exited status).
 */
export function parseExitCode(status) {
  if (!status) return null
  const m = String(status).match(/^Exited\s+\((\d+)\)/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * v0.3: a container is an "issue" when it is crash-looping (restarting), dead,
 * unhealthy, health-starting, or exited with a NON-ZERO code. Cleanly stopped
 * containers (exit 0) are NOT issues — that is the stopped/issue semantic
 * split requested for v0.3.
 */
export function isIssueContainer(state, health, exitCode) {
  if (state === 'restarting' || state === 'dead') return true
  if (health === 'unhealthy' || health === 'starting') return true
  if (state === 'exited' && exitCode != null && exitCode !== 0) return true
  return false
}

/** v0.3: a container counts as "stopped" only when it exited cleanly (code 0). */
export function isStoppedContainer(state, exitCode) {
  return state === 'exited' && (exitCode == null || exitCode === 0)
}

/**
 * @param {object} config - composition-layer config (procRoot / sysRoot /
 *   fsRoot overrides; reserved refresh caps).
 */
export function createSystemCollector(config = {}) {
  const platform = config.platform || os.platform()
  const isWindows = platform === 'win32'

  // Windows has no /proc. Use built-in Node APIs for CPU/memory/network and a
  // constrained PowerShell/CIM bridge for disks and processes. The provider is
  // injectable so this path is testable without requiring Windows in CI.
  function powershellJson(script) {
    try {
      const out = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script + ' | ConvertTo-Json -Compress -Depth 4'], { encoding: 'utf8', timeout: 5000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
      if (!out.trim()) return []
      const value = JSON.parse(out.replace(/^\uFEFF/, '').trim())
      return Array.isArray(value) ? value : [value]
    } catch { return [] }
  }
  const windowsProvider = config.windowsProvider || {
    disks: () => powershellJson("Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace"),
    processes: () => powershellJson("Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine,WorkingSetSize,KernelModeTime,UserModeTime,CreationDate"),
    system: () => powershellJson("Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed")[0] || null,
  }

  // ---- Read-root resolution (Host Mount Mode) ----------------------------
  // Prefer a read-only host bind-mount when present, else the container's own
  // view. Explicit config wins over auto-detection.
  const procRoot = config.procRoot || (isWindows ? null : (exists('/host/proc/stat') ? '/host/proc' : '/proc'))
  const sysRoot = config.sysRoot || (isWindows ? null : (exists('/host/sys') ? '/host/sys' : '/sys'))
  const fsRoot = config.fsRoot || (isWindows ? null : (exists('/host/root') ? '/host/root' : '/'))
  // composition-layer overrides (hostMetrics / runtimeMode) exist so tests can
  // pin the data-source decision without depending on the CI host.
  const hostMetrics = config.hostMetrics != null ? !!config.hostMetrics : (isWindows || procRoot !== '/proc')
  // v0.7 data-source fix: a /proc that is literally "/proc" does NOT prove the
  // DSH process runs in a container. DSH on bare metal has no /host/proc and
  // was mislabelled "container" even while its process list showed dockerd /
  // tailscaled. When no explicit host mount exists the runtime probe decides.
  const runtimeMode = config.runtimeMode || detectMode()
  const viewIsHost = hostMetrics || runtimeMode === 'host'

  let procPrev = null
  let procTotalCpuPrev = null
  let diskCache = null
  let uidMap = null
  let uidMapRoot = null
  let dockerApiVersion = null
  let dockerListCache = null
  let procScanCache = null // { value: rows[], ts }
  let sourcesCache = null
  let consistencyCache = null

  // ---- Docker stats: background-only, cache-read on the request path ------
  // Awaiting one-shot stats for every container took >10 s (26 containers,
  // concurrency 4, 1–2 s each), so the Docker tab kept showing the overview's
  // stat-less snapshot with empty CPU/memory cells. The background loop
  // refreshes only while someone is looking at Docker; the endpoint returns
  // the last cache immediately, plus statsAgeMs.
  let dockerViewUntil = 0
  let dockerStatsTimer = null
  let dockerStatsInflight = null
  let dockerStats = { byId: new Map(), errors: {}, ts: 0 }
  const dockerPrevTotals = new Map() // id -> { cpuTotal, systemTotal }

  // Single fixed-cadence owner of the stateful rate maths (v0.7).
  const sampler = createSampler({
    read: () => readRawMetrics(),
    derive: (cur, prev, dtSec, nowMs) => deriveMetrics(cur, prev, dtSec, nowMs),
    intervalMs: config.sampleIntervalMs == null ? SAMPLE_INTERVAL_MS : Math.max(0, Number(config.sampleIntervalMs) || 0),
  })

  function userName(uid) {
    if (isWindows) return 'Windows'
    const root = uidMapRoot === null ? fsRoot : uidMapRoot
    if (uidMap === null || uidMapRoot !== fsRoot) {
      uidMapRoot = fsRoot
      uidMap = new Map()
      const passwd = readText(path.join(fsRoot, 'etc/passwd'))
      if (passwd) {
        for (const line of passwd.split('\n')) {
          const parts = line.split(':')
          if (parts.length >= 3 && parts[0]) uidMap.set(parts[2], parts[0])
        }
      }
    }
    return uidMap.get(String(uid)) || String(uid)
  }

  // -----------------------------------------------------------------------
  // v0.2.1 host metric readers — all from the resolved host roots, never os.*
  // -----------------------------------------------------------------------

  /** Host load average from <procRoot>/loadavg. */
  function readLoadavg() {
    if (isWindows) return [0, 0, 0]
    const t = readText(path.join(procRoot, 'loadavg'))
    if (!t) return null
    const p = t.trim().split(/\s+/)
    return [Number(p[0]), Number(p[1]), Number(p[2])]
  }

  /** Host uptime (seconds, float) from <procRoot>/uptime. */
  function readUptimeSeconds() {
    if (isWindows) return os.uptime()
    const t = readText(path.join(procRoot, 'uptime'))
    if (!t) return null
    const v = parseFloat(t.trim().split(/\s+/)[0])
    return Number.isFinite(v) ? v : null
  }

  /** Host CPU info from <procRoot>/cpuinfo (logical + physical cores). */
  function readCpuInfo() {
    if (isWindows) {
      const s = windowsProvider.system() || {}
      const cpus = os.cpus()
      return { logical: Number(s.NumberOfLogicalProcessors) || cpus.length || 1, physical: Number(s.NumberOfCores) || null, model: s.Name || (cpus[0] && cpus[0].model) || null, clockMhz: Number(s.MaxClockSpeed) || (cpus[0] && cpus[0].speed) || null }
    }
    return parseCpuInfo(readText(path.join(procRoot, 'cpuinfo')))
  }

  /** Host kernel release from <procRoot>/sys/kernel/osrelease. */
  function readKernelRelease() {
    if (isWindows) return os.release()
    const t = readText(path.join(procRoot, 'sys/kernel/osrelease'))
    return t ? t.trim() : null
  }

  /** Host OS pretty name from <fsRoot>/etc/os-release. */
  function readOsRelease() {
    if (isWindows) return os.type() + ' ' + os.release()
    const t = readText(path.join(fsRoot, 'etc/os-release'))
    if (!t) return null
    const kv = {}
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1)
      kv[m[1]] = v
    }
    return kv.PRETTY_NAME || (kv.NAME ? kv.NAME + (kv.VERSION ? ' ' + kv.VERSION : '') : null)
  }

  // ---- Host CPU: logical count scales CPU%; physical cores for display ----
  const cpuInfo = readCpuInfo()
  const numCores = cpuInfo.logical || os.cpus().length || 1

  /**
   * Aggregate CPU jiffies (all fields) from <procRoot>/stat. The full field set
   * feeds both the usage percentage and the CPU-time-composition donut.
   */
  function readCpuAggregate() {
    if (isWindows) {
      const times = os.cpus().map((c) => c.times)
      const sum = (k) => times.reduce((n, t) => n + (t[k] || 0), 0)
      const user = sum('user')
      const nice = sum('nice')
      const system = sum('sys')
      const idle = sum('idle')
      const irq = sum('irq')
      return { user, nice, system, idle, iowait: 0, irq, softirq: 0, steal: 0, total: user + nice + system + idle + irq }
    }
    return parseProcStatAggregate(readText(path.join(procRoot, 'stat')))
  }

  function readMemInfoKb() {
    if (isWindows) return {}
    const text = readText(path.join(procRoot, 'meminfo'))
    const out = {}
    if (!text) return out
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Za-z_]+):\s+(\d+)\s*kB/)
      if (m) out[m[1]] = Number(m[2])
    }
    return out
  }

  /** Snapshot /proc/net/dev -> { iface: { rx, tx } } in bytes. */
  function readNetDev(text) {
    if (text == null) text = readText(path.join(procRoot, 'net/dev'))
    const out = {}
    if (!text) return out
    for (const line of text.split('\n').slice(2)) {
      const m = line.trim().match(/^([^:]+):\s+(.+)$/)
      if (!m) continue
      const nums = m[2].trim().split(/\s+/).map(Number)
      if (nums.length >= 9) out[m[1]] = { rx: nums[0] || 0, tx: nums[8] || 0 }
    }
    return out
  }

  /** Read the interface name of the default IPv4 route from /proc/net/route. */
  function readDefaultRouteIface(text) {
    if (text == null) text = readText(path.join(procRoot, 'net/route'))
    if (!text) return null
    let best = null
    for (const line of text.split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 11) continue
      if (parts[1] !== '00000000') continue
      const metric = Number(parts[6]) || 0
      if (best === null || metric < best.metric) best = { iface: parts[0], metric }
    }
    return best ? best.iface : null
  }

  // /proc/net/route stores addresses in little-endian hex; convert to a
  // canonical 32-bit integer (network byte order) for subnet matching.
  function routeHexToInt(hex) {
    const v = parseInt(hex, 16) >>> 0
    return ((v & 0xff) << 24) | ((v & 0xff00) << 8) | ((v >> 8) & 0xff00) | ((v >> 24) & 0xff)
  }
  function ipv4ToInt(s) {
    const p = s.split('.').map(Number)
    return (((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0)
  }

  /**
   * Local IPv4 addresses from /proc/net/fib_trie (the "|-- <addr>" line
   * immediately followed by "/32 host LOCAL"). No interface name is present
   * in the trie, so we map each address to an interface via the connected
   * subnets in /proc/net/route (loopback maps to lo).
   */
  function readInterfaceIpv4Map(trieText, routeText) {
    const map = new Map() // iface -> ip
    const trie = trieText != null ? trieText : readText(path.join(procRoot, 'net/fib_trie'))
    const route = routeText != null ? routeText : readText(path.join(procRoot, 'net/route'))
    if (!trie) return map

    const addrs = new Set()
    const trieLines = trie.split('\n')
    for (let i = 0; i < trieLines.length - 1; i++) {
      const m = trieLines[i].match(/^\s*\|--\s+(\d+\.\d+\.\d+\.\d+)\s*$/)
      if (!m) continue
      if (/^\s*\/32\s+host\s+LOCAL\b/.test(trieLines[i + 1])) addrs.add(m[1])
    }

    const subnets = []
    if (route) {
      for (const line of route.split('\n').slice(1)) {
        const p = line.trim().split(/\s+/)
        if (p.length < 11) continue
        if (parseInt(p[2], 16) !== 0) continue // not connected (gateway present)
        const dest = parseInt(p[1], 16)
        if (dest === 0) continue // default route
        subnets.push({ iface: p[0], net: routeHexToInt(p[1]), mask: routeHexToInt(p[7]) })
      }
    }

    for (const addr of addrs) {
      let iface = null
      if (addr.startsWith('127.')) iface = 'lo'
      else {
        const n = ipv4ToInt(addr)
        const hit = subnets.find((s) => ((n & s.mask) >>> 0) === ((s.net & s.mask) >>> 0))
        iface = hit ? hit.iface : null
      }
      if (iface && !map.has(iface)) map.set(iface, addr)
    }
    return map
  }

  /** Compress a 32-hex IPv6 address to RFC-ish notation (:: compression). */
  function formatIpv6(hex) {
    const g = []
    for (let i = 0; i < 8; i++) g.push(hex.slice(i * 4, i * 4 + 4).replace(/^0+(?=.)/, ''))
    let bestStart = -1
    let bestLen = 0
    for (let i = 0; i < 8;) {
      if (g[i] !== '0') { i++; continue }
      let j = i
      while (j < 8 && g[j] === '0') j++
      if (j - i > bestLen) { bestLen = j - i; bestStart = i }
      i = j
    }
    if (bestLen >= 2) {
      const left = g.slice(0, bestStart).join(':')
      const right = g.slice(bestStart + bestLen).join(':')
      return (left ? left + ':' : '') + '::' + (right ? ':' + right : '')
    }
    return g.join(':')
  }

  /** IPv6 addresses per interface from /proc/net/if_inet6 (skip link-local/loopback). */
  function readInterfaceIpv6Map(text) {
    const map = new Map() // iface -> ip
    if (text == null) text = readText(path.join(procRoot, 'net/if_inet6'))
    if (!text) return map
    for (const line of text.split('\n')) {
      const p = line.trim().split(/\s+/)
      if (p.length < 6) continue
      const scope = parseInt(p[3], 16)
      // 0x10 host/loopback, 0x20 link-local, 0x80 compat — skip.
      if (scope === 0x10 || scope === 0x20 || scope === 0x80) continue
      const iface = p[5]
      if (!iface || map.has(iface)) continue
      map.set(iface, formatIpv6(p[0]))
    }
    return map
  }

  const VIRTUAL_IFACE_RE = /^(lo|docker\d*|br-|veth|virbr\d*|tailscale\d*|tun\d*|tap\d*|wg\d*|flannel|cali|kube-|cni\d*|vxlan|veth\d|nflx)/
  function isVirtualIface(name) { return VIRTUAL_IFACE_RE.test(name) }

  function memory() {
    const mi = readMemInfoKb()
    const total = mi.MemTotal ? mi.MemTotal * 1024 : os.totalmem()
    const available = mi.MemAvailable !== undefined ? mi.MemAvailable * 1024 : os.freemem()
    const used = total - available
    return { used, total, usage: total > 0 ? (used / total) * 100 : 0 }
  }

  /**
   * One raw sampler tick (v0.7): every counter the stateful rate maths needs.
   * Stateless reads (memory/disk/load/temperature) stay in deriveMetrics so a
   * snapshot is a complete overview payload.
   */
  function readRawMetrics() {
    const netHostWanted = !isWindows && hostMetrics && procRoot === '/host/proc'
    const hostFiles = netHostWanted ? netNsSnapshot() : null
    const useHostNet = !!(netHostWanted && hostFiles)
    const statText = isWindows ? null : readText(path.join(procRoot, 'stat'))
    const perCpuParsed = isWindows ? null : parseProcStatCpus(statText)
    const diskText = isWindows ? null : readText(path.join(procRoot, 'diskstats'))
    return {
      cpu: readCpuAggregate(),
      perCpu: perCpuParsed && perCpuParsed.cpus.length
        ? { cpus: perCpuParsed.cpus, procsRunning: perCpuParsed.procsRunning, procsBlocked: perCpuParsed.procsBlocked }
        : null,
      diskDevices: diskText == null ? null : parseDiskstats(diskText),
      netDev: isWindows ? null : readNetDev(useHostNet ? hostFiles.dev : null),
      netFiles: useHostNet ? hostFiles : null,
      useHostNet,
      vmstat: isWindows ? null : parseVmstat(readText(path.join(procRoot, 'vmstat'))),
      netRates: null,
    }
  }

  /**
   * Interface list + rates. raw.netRates is memoised so a cached (unchanged)
   * host netns snapshot keeps its rates instead of zeroing between refreshes.
   */
  function deriveNetwork(raw, prevRaw, dtSec) {
    if (isWindows) {
      const list = []
      for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
        const address = (addresses || []).find((a) => !a.internal && a.family === 'IPv4') || (addresses || []).find((a) => !a.internal)
        if (address) list.push({ name, ip: address.address, rxBytesPerSec: null, txBytesPerSec: null, virtual: false, primary: list.length === 0 })
      }
      return { primary: list[0] ? list[0].name : null, interfaces: list }
    }
    const useHost = !!raw.useHostNet
    const sample = raw.netDev || {}
    const fresh = !useHost || !prevRaw || raw.netFiles !== prevRaw.netFiles
    let rates = {}
    if (!fresh && prevRaw && prevRaw.netRates) {
      rates = prevRaw.netRates
    } else if (prevRaw && prevRaw.netDev && prevRaw.useHostNet === raw.useHostNet && dtSec > 0) {
      // Baseline guard: only diff counters from the SAME network namespace —
      // a container-netns fallback must never diff against a host snapshot.
      for (const name of Object.keys(sample)) {
        const p = prevRaw.netDev[name]
        if (p) {
          rates[name] = {
            rx: Math.max(0, (sample[name].rx - p.rx) / dtSec),
            tx: Math.max(0, (sample[name].tx - p.tx) / dtSec),
          }
        }
      }
    }
    raw.netRates = rates

    let primary = readDefaultRouteIface(useHost ? raw.netFiles.route : null)
    // Interface source of truth is /proc/net/dev: an interface is listed even
    // when the IP resolution (fib_trie / if_inet6) fails.
    const ipv4 = readInterfaceIpv4Map(useHost ? raw.netFiles.trie : null, useHost ? raw.netFiles.route : null)
    const ipv6 = readInterfaceIpv6Map(useHost ? raw.netFiles.v6 : null)
    const list = []
    for (const name of Object.keys(sample)) {
      // The host netns contains a swarm of bridge/veth plumbing — keep the
      // panel readable by dropping pure-virtual noise in Host Mount Mode.
      if (useHost && /^(veth|br-|docker\d*|lo)/.test(name)) continue
      const r = rates[name]
      list.push({
        name,
        ip: ipv4.get(name) || ipv6.get(name) || null,
        rxBytesPerSec: r ? round1(r.rx) : null,
        txBytesPerSec: r ? round1(r.tx) : null,
        virtual: isVirtualIface(name),
        primary: name === primary,
      })
    }
    if (!list.some((i) => i.primary) && list.length) {
      const physical = list.find((i) => !i.virtual) || list[0]
      physical.primary = true
      primary = physical.name
    }
    list.sort((a, b) =>
      (b.primary - a.primary) ||
      (Number(a.virtual) - Number(b.virtual)) ||
      a.name.localeCompare(b.name)
    )
    return { primary, interfaces: list }
  }

  /**
   * Derive a complete overview payload from one raw tick. prevRaw is null on
   * the first sample, so every rate is null (unknown), never a fake zero.
   */
  function deriveMetrics(raw, prevRaw, dtSec, nowMs) {
    const mem = memory()
    const diskInfo = disk()
    const load = readLoadavg() || os.loadavg()
    const kernel = readKernelRelease() || os.release()
    const osName = readOsRelease() || (os.type() + ' ' + os.release())
    const uptime = readUptimeSeconds() ?? os.uptime()

    const cpuBefore = prevRaw ? prevRaw.cpu : null
    const cpuUsageRaw = cpuBefore ? cpuPercent(cpuBefore, raw.cpu) : null
    const cpuTimes = cpuBefore ? cpuTimesPercent(cpuBefore, raw.cpu) : null

    let perCpu = null
    let procsRunning = null
    let procsBlocked = null
    if (raw.perCpu) {
      const beforeMap = new Map()
      if (prevRaw && prevRaw.perCpu) for (const c of prevRaw.perCpu.cpus) beforeMap.set(c.index, c)
      perCpu = raw.perCpu.cpus.map((c) => {
        const before = beforeMap.get(c.index)
        const pct = before ? cpuPercent(before, c) : null
        return { index: c.index, usage: pct == null ? null : round1(pct) }
      })
      procsRunning = raw.perCpu.procsRunning
      procsBlocked = raw.perCpu.procsBlocked
    }

    let diskIo = null
    if (raw.diskDevices) {
      const before = prevRaw && prevRaw.diskDevices ? prevRaw.diskDevices : null
      const list = [...raw.diskDevices.entries()].map(([name, cur]) => ({
        name,
        readBytesPerSec: before && before.has(name) ? rateBetween(before.get(name).readBytes, cur.readBytes, dtSec) : null,
        writeBytesPerSec: before && before.has(name) ? rateBetween(before.get(name).writeBytes, cur.writeBytes, dtSec) : null,
      }))
      const sum = (k) => list.reduce((a, d) => a + (d[k] == null ? 0 : d[k]), 0)
      const known = list.some((d) => d.readBytesPerSec != null)
      diskIo = {
        readBytesPerSec: known ? sum('readBytesPerSec') : null,
        writeBytesPerSec: known ? sum('writeBytesPerSec') : null,
        devices: list,
      }
    }

    let swapIo = null
    if (raw.vmstat && prevRaw && prevRaw.vmstat && dtSec > 0) {
      const inRate = pageRate(prevRaw.vmstat.pswpin, raw.vmstat.pswpin, dtSec)
      const outRate = pageRate(prevRaw.vmstat.pswpout, raw.vmstat.pswpout, dtSec)
      if (inRate != null || outRate != null) swapIo = { inBytesPerSec: inRate, outBytesPerSec: outRate }
    }

    return {
      cpuUsage: cpuUsageRaw == null ? null : round1(cpuUsageRaw),
      cpuTimes,
      cpuCores: numCores,
      physicalCores: cpuInfo.physical,
      cpuModel: cpuInfo.model || 'unknown',
      memoryUsed: mem.used,
      memoryTotal: mem.total,
      memoryUsage: round1(mem.usage),
      diskUsed: diskInfo.primary.used,
      diskTotal: diskInfo.primary.total,
      diskUsage: diskInfo.primary.usage,
      diskAvailable: diskInfo.available,
      disks: diskInfo.mounts,
      load1: load[0],
      load5: load[1],
      load15: load[2],
      uptimeSeconds: Math.round(uptime),
      cpuClockMhz: cpuInfo.clockMhz,
      osName,
      platform: os.platform(),
      arch: os.arch(),
      kernelVersion: kernel,
      network: deriveNetwork(raw, prevRaw, dtSec),
      ...memoryDetail(),
      perCpu,
      procsRunning,
      procsBlocked,
      ...taskCounts(),
      diskIo,
      temperatures: temperatures(),
      swapIo,
      sampledAt: nowMs,
    }
  }

  /**
   * Thermal readings from both /sys/class/thermal (type only) and
   * /sys/class/hwmon (chip name + temp*_label), so a sensor exposed as
   * "acpitz" or "x86_pkg_temp" gets a friendly localisable key instead of a
   * raw kernel identifier. Empty when neither class is readable.
   */
  function temperatures() {
    if (isWindows || !sysRoot) return []
    const readings = []

    const zoneDir = path.join(sysRoot, 'class/thermal')
    let zones = []
    try { zones = fs.readdirSync(zoneDir).filter((n) => /^thermal_zone\d+$/.test(n)).sort() } catch { /* no thermal class */ }
    for (const zone of zones) {
      const type = readText(path.join(zoneDir, zone, 'type'))
      const temp = readText(path.join(zoneDir, zone, 'temp'))
      readings.push({ type: type ? type.trim() : zone, source: 'thermal', milliCelsius: temp == null ? NaN : Number(temp.trim()) })
    }

    const hwmonDir = path.join(sysRoot, 'class/hwmon')
    let chips = []
    try { chips = fs.readdirSync(hwmonDir).filter((n) => /^hwmon\d+$/.test(n)).sort() } catch { /* no hwmon class */ }
    for (const chip of chips) {
      const chipDir = path.join(hwmonDir, chip)
      const name = readText(path.join(chipDir, 'name'))
      const type = name && name.trim() ? name.trim() : chip
      let files = []
      try { files = fs.readdirSync(chipDir).filter((n) => /^temp\d+_input$/.test(n)).sort() } catch { continue }
      for (const file of files) {
        const idx = Number(file.slice(4, file.indexOf('_input')))
        const label = readText(path.join(chipDir, 'temp' + idx + '_label'))
        const temp = readText(path.join(chipDir, file))
        readings.push({
          type,
          label: label && label.trim() ? label.trim() : null,
          source: 'hwmon',
          milliCelsius: temp == null ? NaN : Number(temp.trim()),
        })
      }
    }
    return normalizeThermal(readings)
  }

  /** Swap and memory breakdown in bytes from meminfo; null fields when unknown. */
  function memoryDetail() {
    const mi = readMemInfoKb()
    const kb = (k) => (mi[k] === undefined ? null : mi[k] * 1024)
    const swapTotal = kb('SwapTotal')
    const swapFree = kb('SwapFree')
    const swapUsed = swapTotal != null && swapFree != null ? swapTotal - swapFree : null
    return {
      swap: swapTotal == null ? null : {
        total: swapTotal,
        used: swapUsed,
        usage: swapTotal > 0 ? round1((swapUsed / swapTotal) * 100) : 0,
      },
      memoryBreakdown: {
        free: kb('MemFree'),
        buffers: kb('Buffers'),
        cached: kb('Cached'),
        available: kb('MemAvailable'),
      },
    }
  }

  /** Runnable/total task counts from loadavg (threadCount = total scheduling entities). */
  function taskCounts() {
    if (isWindows) return { threadCount: null, runnableCount: null }
    const t = parseLoadavgTasks(readText(path.join(procRoot, 'loadavg')))
    return { threadCount: t.total, runnableCount: t.running }
  }

  // Pseudo / transient filesystems never useful for capacity monitoring.
  // v0.7: efivarfs was missing, so /sys/firmware/efi/efivars leaked into the
  // partition list as if it were a data volume.
  const PSEUDO_FS = /^(tmpfs|devtmpfs|squashfs|proc|sysfs|cgroup2?|devpts|mqueue|shm|hugetlbfs|ramfs|securityfs|debugfs|tracefs|pstore|configfs|fusectl|autofs|nsfs|binfmt_misc|bpf|efivarfs|rpc_pipefs|selinuxfs)$/

  // Kernel/runtime plumbing that is never a capacity mount regardless of the
  // filesystem type (efivarfs lives under /sys/firmware/efi/efivars).
  const PSEUDO_MOUNT_PREFIXES = ['/sys', '/proc', '/dev', '/run']
  function isPseudoMount(mount) {
    for (const prefix of PSEUDO_MOUNT_PREFIXES) {
      if (mount === prefix || mount.startsWith(prefix + '/')) return true
    }
    return false
  }

  function disk() {
    if (diskCache && Date.now() - diskCache.ts < DISK_CACHE_MS) return diskCache.value
    if (isWindows) {
      const rows = windowsProvider.disks()
      const mounts = rows.map((d) => {
        const total = Number(d.Size) || 0
        const free = Number(d.FreeSpace) || 0
        const mount = String(d.DeviceID || '')
        return { mount, filesystem: d.FileSystem || 'NTFS', used: Math.max(0, total - free), free, avail: free, total, usage: total > 0 ? round1(((total - free) / total) * 100) : 0 }
      }).filter((d) => d.mount && d.total > 0)
      const root = mounts.find((d) => d.mount.toUpperCase() === 'C:') || mounts[0]
      const value = { available: mounts.length > 0, primary: root ? { mount: root.mount, used: root.used, total: root.total, avail: root.avail, usage: root.usage } : { mount: 'C:', used: 0, total: 0, avail: 0, usage: 0 }, mounts }
      diskCache = { value, ts: Date.now() }
      return value
    }
    const empty = { available: false, primary: { mount: '/', used: 0, total: 0, avail: 0, usage: 0 }, mounts: [] }

    const mountsText = readText(path.join(procRoot, 'mounts'))
    if (!mountsText) {
      diskCache = { value: empty, ts: Date.now() }
      return empty
    }

    const mounts = []
    for (const line of mountsText.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 3) continue
      const mount = unescapeMount(parts[1])
      let fstype = parts[2]
      if (PSEUDO_FS.test(fstype)) continue
      if (isPseudoMount(mount)) continue
      // Skip per-container overlay mounts (docker/containerd internals).
      if (fstype === 'overlay' && /(overlay2|containers)/.test(mount)) continue
      let st
      try { st = fs.statfsSync(path.join(fsRoot, mount)) } catch { continue }
      const total = st.blocks * st.bsize
      if (!total) continue
      const free = st.bfree * st.bsize
      const avail = st.bavail * st.bsize
      const used = Math.max(0, total - free)
      // In Host Mount Mode the mount table is the container's own — label the
      // filesystem by the real statfs type of the host path instead.
      if (fsRoot !== '/' && procRoot === '/host/proc') fstype = fsTypeName(st.type)
      // df semantics: ext4 reserves blocks for root, so used/total under-reports
      // what df prints. used/(used+avail) matches df.
      mounts.push({ mount, filesystem: fstype, used, free, avail, total, usage: dfUsagePercent(used, avail) })
    }

    // Host Mount Mode: surface the host data volumes that live outside the
    // container's own mount table (e.g. fnOS /vol1) through the read-only root.
    if (fsRoot !== '/' && procRoot === '/host/proc') {
      for (const hp of ['/vol1', '/data', '/workspace']) {
        if (mounts.some((m) => m.mount === hp)) continue
        let st
        try { st = fs.statfsSync(path.join(fsRoot, hp)) } catch { continue }
        const total = st.blocks * st.bsize
        if (!total) continue
        const free = st.bfree * st.bsize
        const avail = st.bavail * st.bsize
        const used = Math.max(0, total - free)
        mounts.push({ mount: hp, filesystem: fsTypeName(st.type), used, free, avail, total, usage: dfUsagePercent(used, avail) })
      }
    }

    // Same filesystem is often mounted at several paths (/, /data, /etc/hosts);
    // dedup by st_dev (device id — reliable in both container and host modes),
    // keeping the shortest mount point (preferring /). Fall back to size when
    // stat is unavailable.
    const byDevice = new Map()
    for (const m of mounts) {
      let dev = null
      try { dev = fs.statSync(path.join(fsRoot, m.mount)).dev } catch { /* fall through to size key */ }
      const key = dev != null ? String(dev) : (m.total + '|' + m.used)
      const prev = byDevice.get(key)
      if (!prev || m.mount === '/' || m.mount.length < prev.mount.length) byDevice.set(key, m)
    }
    const uniq = Array.from(byDevice.values())
    uniq.sort((a, b) =>
      (a.mount === '/' ? -1 : b.mount === '/' ? 1 : 0) || (b.usage - a.usage)
    )
    const root = uniq.find((m) => m.mount === '/') || uniq[0]
    const value = {
      available: uniq.length > 0,
      primary: root ? { mount: root.mount, used: root.used, total: root.total, avail: root.avail, usage: root.usage } : empty.primary,
      mounts: uniq,
    }
    diskCache = { value, ts: Date.now() }
    return value
  }

  /** Full /proc scan: every PID with name/user/cpu/mem/rss/ppid/command/elapsed. */
  function scanProcesses() {
    if (isWindows) {
      const total = os.totalmem() || 1
      const now = Date.now()
      return windowsProvider.processes().map((p) => {
        const pid = Number(p.ProcessId) || 0
        const rssBytes = Number(p.WorkingSetSize) || 0
        const created = p.CreationDate ? new Date(String(p.CreationDate)).getTime() : now
        const cpuTime = (Number(p.UserModeTime) || 0) + (Number(p.KernelModeTime) || 0)
        return { pid, ppid: Number(p.ParentProcessId) || 0, name: String(p.Name || 'unknown'), user: 'Windows', cpu: round2(Math.max(0, cpuTime / 10000000 / Math.max(0.001, (now - created) / 1000) * 100)), mem: round2((rssBytes / total) * 100), rssBytes, command: String(p.CommandLine || p.Name || '').slice(0, 400), elapsedSeconds: Math.max(0, Math.round((now - created) / 1000)) }
      }).filter((p) => p.pid > 0)
    }
    const mi = readMemInfoKb()
    const memTotalKb = mi.MemTotal || 1
    const cpuAgg = readCpuAggregate()

    let pids
    try {
      pids = fs.readdirSync(path.join(procRoot)).filter((n) => /^\d+$/.test(n)).map(Number)
    } catch {
      return []
    }

    const current = new Map()
    const rows = []
    // v0.2.1: process elapsed uses the HOST uptime (host metrics accuracy).
    const bootUptime = readUptimeSeconds() ?? os.uptime()

    for (const pid of pids) {
      const stat = readText(path.join(procRoot, String(pid), 'stat'))
      if (!stat) continue
      const close = stat.lastIndexOf(')')
      const before = stat.slice(0, close + 1)
      const after = stat.slice(close + 2).trim().split(/\s+/)
      const commStart = before.indexOf('(')
      const comm = commStart >= 0 ? before.slice(commStart + 1, before.length - 1) : String(pid)
      // after[] starts at field 3 (state). ppid=f4=>after[1], utime=f14=>after[11],
      // stime=f15=>after[12], starttime=f22=>after[19].
      const ppid = Number(after[1] || 0)
      const utime = Number(after[11] || 0)
      const stime = Number(after[12] || 0)
      const starttime = Number(after[19] || 0)
      const cpuTime = utime + stime

      const status = readText(path.join(procRoot, String(pid), 'status'))
      let uid = 0
      let vmRssKb = 0
      if (status) {
        const uidLine = status.split('\n').find((l) => l.startsWith('Uid:'))
        if (uidLine) uid = Number(uidLine.trim().split(/\s+/)[1] || 0)
        const rssLine = status.split('\n').find((l) => l.startsWith('VmRSS:'))
        if (rssLine) vmRssKb = Number(rssLine.trim().split(/\s+/)[1] || 0)
      }

      let cpu
      const prev = procPrev ? procPrev.get(pid) : null
      if (prev && procTotalCpuPrev && cpuAgg && cpuAgg.total > procTotalCpuPrev.total) {
        const dProc = cpuTime - prev.cpuTime
        const dTotal = cpuAgg.total - procTotalCpuPrev.total
        cpu = dTotal > 0 ? (dProc / dTotal) * numCores * 100 : 0
      } else {
        const elapsed = Math.max(0.001, bootUptime - starttime / CLK_TCK)
        cpu = (cpuTime / CLK_TCK / elapsed) * 100
      }

      let command = ''
      const raw = readText(path.join(procRoot, String(pid), 'cmdline'))
      if (raw) command = raw.replace(/\0/g, ' ').trim()
      if (!command) command = '[' + comm + ']'

      current.set(pid, { cpuTime })
      rows.push({
        pid,
        ppid,
        name: comm,
        user: userName(uid),
        cpu: round2(Math.max(0, cpu)),
        mem: round2((vmRssKb / memTotalKb) * 100),
        rssBytes: vmRssKb * 1024,
        command: command.length > 400 ? command.slice(0, 400) + '…' : command,
        elapsedSeconds: Math.max(0, Math.round(bootUptime - starttime / CLK_TCK)),
      })
    }

    procPrev = current
    procTotalCpuPrev = cpuAgg
    return rows
  }

  function applyProcessQuery(rows, payload) {
    const query = (payload && payload.query ? String(payload.query) : '').trim().toLowerCase()
    const sort = payload && payload.sort && ['cpu', 'mem', 'pid', 'name'].includes(payload.sort) ? payload.sort : 'cpu'
    const order = payload && payload.order === 'asc' ? 'asc' : 'desc'
    const offset = clampInt(payload && payload.offset, 0, 1000000)
    const limit = clampInt(payload && payload.limit, 1, MAX_PROCESS_LIMIT)

    let matched = rows
    if (query) {
      matched = rows.filter((r) =>
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.command && r.command.toLowerCase().includes(query)) ||
        (r.user && r.user.toLowerCase().includes(query)) ||
        String(r.pid).includes(query)
      )
    }

    const dir = order === 'asc' ? 1 : -1
    const sorted = matched.slice().sort((a, b) => {
      if (sort === 'name') return dir * String(a.name).localeCompare(String(b.name))
      return dir * ((a[sort] || 0) - (b[sort] || 0))
    })

    return {
      processes: sorted.slice(offset, offset + limit),
      total: rows.length,
      matched: matched.length,
      offset,
      limit,
      sort,
      order,
      source: viewIsHost ? 'host' : 'container',
    }
  }

  /**
   * Group processes by name+command (aggregate view). Groups are built over
   * the FULL scan (all PIDs), then sorted by aggregated CPU desc and paged —
   * same correctness model as the list view.
   */
  function aggregateProcesses(rows, payload) {
    const query = (payload && payload.query ? String(payload.query) : '').trim().toLowerCase()
    const offset = clampInt(payload && payload.offset, 0, 1000000)
    const limit = clampInt(payload && payload.limit, 1, MAX_PROCESS_LIMIT)
    let matched = rows
    if (query) {
      matched = rows.filter((r) =>
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.command && r.command.toLowerCase().includes(query)) ||
        (r.user && r.user.toLowerCase().includes(query)) ||
        String(r.pid).includes(query)
      )
    }
    const groups = new Map()
    for (const r of matched) {
      const key = r.name + '\u0000' + (r.command || '')
      let g = groups.get(key)
      if (!g) {
        // v0.3: groups carry aggregate details — total RSS and the distinct
        // users running the group (for the expanded aggregate view).
        g = { name: r.name, command: r.command, count: 0, cpu: 0, mem: 0, rssBytes: 0, users: [], pids: [] }
        groups.set(key, g)
      }
      g.count++
      g.cpu += r.cpu
      g.mem += r.mem
      g.rssBytes += r.rssBytes || 0
      if (g.pids.length < 30) g.pids.push(r.pid)
      if (g.users.length < 3 && r.user && g.users.indexOf(r.user) < 0) g.users.push(r.user)
    }
    const list = Array.from(groups.values())
    list.sort((a, b) => b.cpu - a.cpu)
    return {
      groups: list.slice(offset, offset + limit),
      total: rows.length,
      matched: matched.length,
      groupsTotal: list.length,
      aggregate: true,
      offset,
      limit,
      source: viewIsHost ? 'host' : 'container',
    }
  }

  /** Host-side process search/sort/pagination/aggregate (snapshot-cached). */
  function processes(payload = {}) {
    let rows
    if (procScanCache && Date.now() - procScanCache.ts < PROCESS_SCAN_CACHE_MS) {
      rows = procScanCache.value
    } else {
      rows = scanProcesses()
      procScanCache = { value: rows, ts: Date.now() }
    }
    if (payload.aggregate) return aggregateProcesses(rows, payload)
    return applyProcessQuery(rows, payload)
  }

  async function dockerApiBase() {
    if (dockerApiVersion) return dockerApiVersion
    try {
      const v = await dockerGet(DOCKER_SOCKET, '/version')
      const api = v && (v.ApiVersion || v.MinAPIVersion || '1.41')
      dockerApiVersion = 'v' + String(api).split('.')[0] + '.' + String(api).split('.')[1]
    } catch {
      dockerApiVersion = 'v1.41'
    }
    return dockerApiVersion
  }

  /** Docker daemon summary from GET /info + /version (read-only); never throws. */
  async function dockerInfo() {
    if (!dockerAvailable()) return { available: false, reason: 'no-socket' }
    try {
      const base = await dockerApiBase()
      const [info, version] = await Promise.all([
        dockerGet(DOCKER_SOCKET, '/' + base + '/info'),
        dockerGet(DOCKER_SOCKET, '/' + base + '/version'),
      ])
      return {
        available: true,
        daemon: {
          serverVersion: version.Version || null,
          apiVersion: version.ApiVersion || null,
          operatingSystem: info.OperatingSystem || null,
          kernelVersion: info.KernelVersion || null,
          storageDriver: info.Driver || null,
          containers: info.Containers ?? null,
          running: info.ContainersRunning ?? null,
          paused: info.ContainersPaused ?? null,
          stopped: info.ContainersStopped ?? null,
          images: info.Images ?? null,
          cpus: info.NCPU ?? null,
          memTotal: info.MemTotal ?? null,
        },
      }
    } catch (e) {
      return { available: false, reason: 'error', message: e instanceof Error ? e.message : String(e) }
    }
  }

  function dockerAvailable() {
    return exists(DOCKER_SOCKET)
  }

  async function dockerContainerList() {
    if (dockerListCache && Date.now() - dockerListCache.ts < DOCKER_LIST_CACHE_MS) return dockerListCache.value
    const base = await dockerApiBase()
    const list = (await dockerGet(DOCKER_SOCKET, '/' + base + '/containers/json?all=1'))
      // The host-netns network probe spawns a short-lived read-only container;
      // keep it out of the panel's container list.
      .filter((c) => !(c.Names || []).some((n) => String(n).startsWith('/dsh-netprobe')))

    // v0.3: annotate every container once (state / health / exit code), then
    // derive both the summary and the per-row payload from the same source.
    const annotated = list.map((c) => ({
      raw: c,
      state: c.State || 'unknown',
      health: parseHealth(c.Status),
      exitCode: parseExitCode(c.Status),
    }))
    const count = (fn) => annotated.filter(fn).length
    const summary = {
      total: list.length,
      running: count((a) => a.state === 'running'),
      // stopped and issues are DISJOINT: clean exits vs real problems.
      stopped: count((a) => isStoppedContainer(a.state, a.exitCode)),
      crashed: count((a) => a.state === 'exited' && a.exitCode != null && a.exitCode !== 0),
      paused: count((a) => a.state === 'paused'),
      restarting: count((a) => a.state === 'restarting'),
      dead: count((a) => a.state === 'dead'),
      healthy: count((a) => a.health === 'healthy'),
      unhealthy: count((a) => a.health === 'unhealthy'),
      starting: count((a) => a.health === 'starting'),
      issues: count((a) => isIssueContainer(a.state, a.health, a.exitCode)),
    }
    const value = { available: true, summary, list: annotated.map((a) => a.raw) }
    dockerListCache = { value, ts: Date.now() }
    return value
  }

  /**
   * One background one-shot stats read (v0.7). stream=false returns cumulative
   * counters, so the CPU percentage is computed by the HOST against the
   * previous read's totals — Docker's own precpu_stats is not reliable across
   * separate one-shot requests.
   */
  async function containerStatsOnce(id) {
    const base = await dockerApiBase()
    if (!/^[0-9a-fA-F]{6,64}$/.test(id)) throw new Error('docker: bad container id')
    const stats = await dockerGet(DOCKER_SOCKET, '/' + base + '/containers/' + id + '/stats?stream=false')
    const cpuStats = stats.cpu_stats || {}
    const onlineCpus = cpuStats.online_cpus || numCores || 1
    const totalUsage = cpuStats.cpu_usage && typeof cpuStats.cpu_usage.total_usage === 'number' ? cpuStats.cpu_usage.total_usage : null
    const systemUsage = typeof cpuStats.system_cpu_usage === 'number' ? cpuStats.system_cpu_usage : null
    let cpuUsage = null
    const prev = dockerPrevTotals.get(id)
    if (prev && totalUsage != null && systemUsage != null) {
      const dCpu = totalUsage - prev.cpuTotal
      const dSys = systemUsage - prev.systemTotal
      if (dSys > 0 && dCpu >= 0) cpuUsage = round2((dCpu / dSys) * onlineCpus * 100)
    }
    if (totalUsage != null && systemUsage != null && systemUsage > 0) {
      dockerPrevTotals.set(id, { cpuTotal: totalUsage, systemTotal: systemUsage })
    }
    const mem = stats.memory_stats || {}
    const usage = typeof mem.usage === 'number' ? mem.usage : null
    const limit = typeof mem.limit === 'number' ? mem.limit : null
    return {
      cpuUsage,
      memoryUsage: usage,
      memoryLimit: limit,
      memoryUsagePct: usage != null && limit > 0 ? round2((usage / limit) * 100) : null,
    }
  }

  /** Refresh the stats cache for every running container (serialised). */
  function refreshDockerStats() {
    if (dockerStatsInflight) return dockerStatsInflight
    dockerStatsInflight = (async () => {
      try {
        const r = await dockerContainerList()
        const running = r.list.filter((c) => c.State === 'running')
        const results = await mapLimit(running, 4, (c) => containerStatsOnce(c.Id))
        const byId = new Map()
        const errors = {}
        for (let i = 0; i < running.length; i++) {
          const res = results[i]
          if (res && res.__error) errors[running[i].Id] = res.__error
          else if (res) byId.set(running[i].Id, res)
        }
        dockerStats = { byId, errors, ts: Date.now() }
      } catch (e) {
        dockerStats = { byId: new Map(), errors: {}, ts: Date.now(), error: e instanceof Error ? e.message : String(e) }
      } finally {
        dockerStatsInflight = null
      }
    })()
    return dockerStatsInflight
  }

  /**
   * Background stats loop. It only refreshes while a browser asked for Docker
   * stats within the last DOCKER_STATS_VIEW_MS, so an idle daemon costs
   * nothing while the 26-container fetch (concurrency 4, 1–2 s each) runs off
   * the request path.
   */
  function ensureDockerStatsTimer() {
    if (dockerStatsTimer) return
    dockerStatsTimer = setInterval(() => {
      if (Date.now() > dockerViewUntil) return
      void refreshDockerStats()
    }, DOCKER_STATS_REFRESH_MS)
    if (dockerStatsTimer.unref) dockerStatsTimer.unref()
  }

  function parseHealth(status) {
    if (!status) return 'none'
    if (/\(healthy\)/i.test(status)) return 'healthy'
    if (/\(unhealthy\)/i.test(status)) return 'unhealthy'
    if (/(health:\s*starting|\(starting\))/i.test(status)) return 'starting'
    return 'none'
  }

  const EMPTY_DOCKER_SUMMARY = { total: 0, running: 0, stopped: 0, paused: 0, healthy: 0, unhealthy: 0, starting: 0 }

  async function containers(withStats) {
    // v0.2.1: return an explicit status/error instead of an empty/ambiguous
    // result or a thrown exception. The client can show the precise reason.
    if (!dockerAvailable()) {
      return {
        available: false,
        source: 'unavailable',
        error: '未检测到 /var/run/docker.sock',
        summary: EMPTY_DOCKER_SUMMARY,
        containers: [],
      }
    }

    let summary
    let list
    try {
      const r = await dockerContainerList()
      summary = r.summary
      list = r.list
    } catch (e) {
      return {
        available: false,
        source: viewIsHost ? 'host' : 'container',
        error: e instanceof Error ? e.message : String(e),
        summary: EMPTY_DOCKER_SUMMARY,
        containers: [],
      }
    }

    if (withStats) {
      // Mark the Docker view active and answer from the cache immediately; the
      // background loop refreshes. The first refresh may still be empty, so the
      // client shows "sampling" and statsAgeMs reports cache age.
      dockerViewUntil = Date.now() + DOCKER_STATS_VIEW_MS
      ensureDockerStatsTimer()
      void refreshDockerStats()
    }
    const statsById = dockerStats.byId
    const statsErrors = dockerStats.errors || {}

    const rows = list.map((c) => {
      const id = c.Id
      const name = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : id.slice(0, 12)
      const ports = (c.Ports || []).map((p) => ({
        hostIp: p.IP || null,
        hostPort: p.PublicPort != null ? Number(p.PublicPort) : null,
        containerPort: p.PrivatePort != null ? Number(p.PrivatePort) : null,
        protocol: p.Type || 'tcp',
      }))
      const row = {
        id: id.slice(0, 12),
        name,
        image: c.Image || '',
        state: c.State || 'unknown',
        status: c.Status || '',
        health: parseHealth(c.Status),
        exitCode: parseExitCode(c.Status),
        ports,
        cpuUsage: null,
        memoryUsage: null,
        memoryLimit: null,
        memoryUsagePct: null,
        statsError: statsErrors[id] || null,
      }
      const stats = statsById.get(id)
      if (stats) {
        row.cpuUsage = stats.cpuUsage
        row.memoryUsage = stats.memoryUsage
        row.memoryLimit = stats.memoryLimit
        row.memoryUsagePct = stats.memoryUsagePct
      }
      return row
    })

    return {
      available: true,
      source: viewIsHost ? 'host' : 'container',
      summary,
      containers: rows,
      statsAgeMs: dockerStats.ts ? Date.now() - dockerStats.ts : null,
      statsRequested: !!withStats,
      statsError: dockerStats.error || null,
    }
  }

  /** DSH-process run environment: is the plugin itself in a container? */
  function detectMode() {
    if (isWindows) return 'host'
    if (exists('/.dockerenv')) return 'container'
    const cgroup = readText('/proc/1/cgroup')
    if (cgroup && /(docker|containerd|kubepods|podman|libpod|lxc|nspawn)/i.test(cgroup)) return 'container'
    if (/^[0-9a-f]{12}$/.test(os.hostname())) return 'container'
    return 'host'
  }

  /** Hostname: prefer the host's /etc/hostname in Host Mount Mode. */
  function detectHostname() {
    if (isWindows) return os.hostname()
    if (fsRoot !== '/') {
      const h = readText(path.join(fsRoot, 'etc/hostname'))
      if (h && h.trim()) return h.trim()
    }
    return os.hostname()
  }

  /** Read a mount point's options from the container's own mountinfo. */
  function readMountOptions(mountpoint) {
    const text = readText('/proc/self/mountinfo')
    if (!text) return null
    for (const line of text.split('\n')) {
      const dash = line.indexOf(' - ')
      if (dash < 0) continue
      const left = line.slice(0, dash).split(' ')
      if (left.length < 6) continue
      if (unescapeMount(left[4]) === mountpoint) return left[5]
    }
    return null
  }

  function isReadOnlyMount(mountpoint) {
    const opts = readMountOptions(mountpoint)
    if (opts == null) return null
    return opts.split(',').includes('ro')
  }

  /** Concrete per-item source paths (so the UI can show the REAL origin). */
  function buildSources() {
    if (isWindows) return { platform: 'windows', system: 'node:os + PowerShell/CIM', disks: 'Win32_LogicalDisk', processes: 'Win32_Process', dockerSocket: dockerAvailable() ? DOCKER_SOCKET : null }
    return {
      procRoot,
      sysRoot,
      fsRoot,
      loadavg: path.join(procRoot, 'loadavg'),
      uptime: path.join(procRoot, 'uptime'),
      cpuinfo: path.join(procRoot, 'cpuinfo'),
      osrelease: path.join(procRoot, 'sys/kernel/osrelease'),
      osRelease: path.join(fsRoot, 'etc/os-release'),
      netDev: path.join(procRoot, 'net/dev'),
      netRoute: path.join(procRoot, 'net/route'),
      fibTrie: path.join(procRoot, 'net/fib_trie'),
      ifInet6: path.join(procRoot, 'net/if_inet6'),
      mounts: path.join(procRoot, 'mounts'),
      mountinfo: path.join(procRoot, 'self/mountinfo'),
      processes: path.join(procRoot, '<pid>/stat'),
      dockerSocket: dockerAvailable() ? DOCKER_SOCKET : null,
    }
  }

  /** Host/container data-consistency self-check. */
  function detectConsistency() {
    const warnings = []
    if (isWindows) return { ok: true, warnings }
    if (hostMetrics) {
      const ro = isReadOnlyMount('/host/proc')
      if (ro === false) warnings.push('宿主机 /proc 未以只读挂载（建议加 :ro）')
      const hostInit = readText(path.join(procRoot, '1/comm'))
      const contInit = readText('/proc/1/comm')
      if (hostInit && contInit && hostInit.trim() === contInit.trim()) {
        warnings.push('宿主 /proc 与容器 PID 命名空间一致（可能已启用 pid:host）')
      }
    }
    const missing = []
    if (!readText(path.join(procRoot, 'loadavg'))) missing.push('loadavg')
    if (!readText(path.join(procRoot, 'uptime'))) missing.push('uptime')
    if (!readText(path.join(procRoot, 'cpuinfo'))) missing.push('cpuinfo')
    if (!readText(path.join(procRoot, 'sys/kernel/osrelease'))) missing.push('osrelease')
    if (fsRoot !== '/' && !readText(path.join(fsRoot, 'etc/os-release'))) missing.push('os-release')
    if (missing.length) warnings.push('数据源缺失：' + missing.join('、'))
    return { ok: warnings.length === 0, warnings }
  }

  function getSources() {
    if (!sourcesCache) sourcesCache = buildSources()
    return sourcesCache
  }
  function getConsistency() {
    if (!consistencyCache) consistencyCache = detectConsistency()
    return consistencyCache
  }

  function detectEnvironment() {
    const mode = detectMode()
    const systemSource = viewIsHost ? 'host' : 'container'
    return {
      mode,
      hostname: detectHostname(),
      systemSource,
      processSource: systemSource,
      dockerSource: dockerAvailable() ? 'host' : 'unavailable',
      consistency: getConsistency(),
      sources: getSources(),
    }
  }

  /**
   * v0.3 meta status细分 + capabilities: fine-grained per-source status and the
   * feature capabilities of this Host (surfaced in the About dialog). The
   * client reads them from the meta endpoint's value payload.
   */
  function metaInfo() {
    const env = detectEnvironment()
    const hostNetNs = hostMetrics && procRoot === '/host/proc'
    return {
      status: {
        mode: env.mode,
        systemSource: env.systemSource,
        processSource: env.processSource,
        dockerSource: env.dockerSource,
        hostMetrics,
        networkProbe: hostNetNs ? (netNsCache && netNsCache.files ? 'host-netns' : 'container-netns') : 'container-netns',
        consistency: env.consistency,
      },
      capabilities: {
        hostMount: hostMetrics,
        dockerSocket: dockerAvailable(),
        hostNetNsProbe: hostNetNs,
        processAggregate: true,
        containerStats: dockerAvailable(),
        swap: !isWindows,
        perCpu: !isWindows,
        diskIo: !isWindows && exists(path.join(procRoot, 'diskstats')),
        temperature: temperatures().length > 0,
        history: true,
        dockerInfo: dockerAvailable(),
      },
    }
  }

  /**
   * Subscribe a listener to every completed sampler snapshot (the history ring
   * uses this, so history is fed by the one 2 s clock rather than polling
   * overview() on a second timer). Returns an unsubscribe function.
   */
  function subscribeMetrics(listener) {
    const unsubscribe = sampler.subscribe((snap) => {
      try { listener(snap.value) } catch { /* never break sampling */ }
    })
    sampler.start()
    sampler.take()
    return unsubscribe
  }

  /** Start the fixed-cadence sampler (idempotent); safe to call from a ctx effect. */
  function start() {
    return sampler.start()
  }

  /** Stop timers owned by this collector (ctx effect disposal). */
  function dispose() {
    sampler.stop()
    if (dockerStatsTimer) { clearInterval(dockerStatsTimer); dockerStatsTimer = null }
  }

  return {
    metaInfo,
    dockerInfo,
    /**
     * Latest complete snapshot from the fixed-cadence sampler (v0.7). The
     * request path never performs the stateful rate maths itself, so every
     * caller sees the same interval — that is what stops the CPU jitter.
     */
    async overview() {
      const snap = sampler.take()
      const value = snap ? snap.value : {}
      return { ...value, environment: detectEnvironment() }
    },
    processes,
    containers,
    subscribeMetrics,
    start,
    dispose,
    /** Exposed for tests/ops: sample immediately without waiting for the clock. */
    sampleNow() {
      return sampler.sample()
    },
  }
}
