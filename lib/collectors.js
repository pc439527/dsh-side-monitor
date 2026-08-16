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
// Per-container Docker stats cache window (ms).
const DOCKER_STATS_CACHE_MS = 3_000
// Docker socket path.
const DOCKER_SOCKET = '/var/run/docker.sock'

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
 * @param {object} config - composition-layer config (procRoot / sysRoot /
 *   fsRoot overrides; reserved refresh caps).
 */
export function createSystemCollector(config = {}) {
  // ---- Read-root resolution (Host Mount Mode) ----------------------------
  // Prefer a read-only host bind-mount when present, else the container's own
  // view. Explicit config wins over auto-detection.
  const procRoot = config.procRoot || (exists('/host/proc/stat') ? '/host/proc' : '/proc')
  const sysRoot = config.sysRoot || (exists('/host/sys') ? '/host/sys' : '/sys')
  const fsRoot = config.fsRoot || (exists('/host/root') ? '/host/root' : '/')
  const hostMetrics = procRoot !== '/proc'

  let cpuPrev = null
  let netPrev = null
  let procPrev = null
  let procTotalCpuPrev = null
  let diskCache = null
  let uidMap = null
  let uidMapRoot = null
  let dockerApiVersion = null
  let dockerListCache = null
  const dockerStatsCache = new Map() // id -> { value, ts }
  let procScanCache = null // { value: rows[], ts }
  let sourcesCache = null
  let consistencyCache = null

  function userName(uid) {
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
    const t = readText(path.join(procRoot, 'loadavg'))
    if (!t) return null
    const p = t.trim().split(/\s+/)
    return [Number(p[0]), Number(p[1]), Number(p[2])]
  }

  /** Host uptime (seconds, float) from <procRoot>/uptime. */
  function readUptimeSeconds() {
    const t = readText(path.join(procRoot, 'uptime'))
    if (!t) return null
    const v = parseFloat(t.trim().split(/\s+/)[0])
    return Number.isFinite(v) ? v : null
  }

  /** Host CPU core count / model / clock from <procRoot>/cpuinfo. */
  function readCpuInfo() {
    const text = readText(path.join(procRoot, 'cpuinfo'))
    const info = { cores: 0, model: null, clockMhz: null }
    if (!text) return info
    let cores = 0
    for (const line of text.split('\n')) {
      const t = line.trim()
      const colon = t.indexOf(':')
      if (colon < 0) continue
      const key = t.slice(0, colon).trim()
      const val = t.slice(colon + 1).trim()
      if (key === 'processor') cores++
      else if (key === 'model name' && !info.model) info.model = val
      else if (key === 'Hardware' && !info.model) info.model = val
      else if (key === 'Processor' && !info.model) info.model = val
      else if (key === 'cpu MHz' && info.clockMhz == null && Number.isFinite(parseFloat(val))) info.clockMhz = parseFloat(val)
    }
    info.cores = cores || 1
    return info
  }

  /** Host kernel release from <procRoot>/sys/kernel/osrelease. */
  function readKernelRelease() {
    const t = readText(path.join(procRoot, 'sys/kernel/osrelease'))
    return t ? t.trim() : null
  }

  /** Host OS pretty name from <fsRoot>/etc/os-release. */
  function readOsRelease() {
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

  // ---- Host CPU core count (single source of truth for CPU% scaling) ----
  const cpuInfo = readCpuInfo()
  const numCores = cpuInfo.cores || os.cpus().length || 1

  /** Parse the aggregate "cpu  ..." line of /proc/stat into idle/total jiffies. */
  function parseCpuAggregate(line) {
    const nums = line.trim().split(/\s+/).slice(1).map(Number)
    const idle = (nums[3] || 0) + (nums[4] || 0)
    const total = (nums[0] || 0) + (nums[1] || 0) + (nums[2] || 0) + idle + (nums[5] || 0) + (nums[6] || 0) + (nums[7] || 0)
    return { idle, total }
  }

  function readCpuAggregate() {
    const stat = readText(path.join(procRoot, 'stat'))
    if (!stat) return null
    const line = stat.split('\n').find((l) => l.startsWith('cpu '))
    return line ? parseCpuAggregate(line) : null
  }

  function readMemInfoKb() {
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
  function readNetDev() {
    const text = readText(path.join(procRoot, 'net/dev'))
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
  function readDefaultRouteIface() {
    const text = readText(path.join(procRoot, 'net/route'))
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
  function readInterfaceIpv4Map() {
    const map = new Map() // iface -> ip
    const trie = readText(path.join(procRoot, 'net/fib_trie'))
    const route = readText(path.join(procRoot, 'net/route'))
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
  function readInterfaceIpv6Map() {
    const map = new Map() // iface -> ip
    const text = readText(path.join(procRoot, 'net/if_inet6'))
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

  function cpuUsage() {
    const s = readCpuAggregate()
    if (!s) return 0
    if (cpuPrev) {
      const dTotal = s.total - cpuPrev.total
      const dIdle = s.idle - cpuPrev.idle
      cpuPrev = s
      if (dTotal <= 0) return 0
      return Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100))
    }
    cpuPrev = s
    return 0
  }

  function memory() {
    const mi = readMemInfoKb()
    const total = mi.MemTotal ? mi.MemTotal * 1024 : os.totalmem()
    const available = mi.MemAvailable !== undefined ? mi.MemAvailable * 1024 : os.freemem()
    const used = total - available
    return { used, total, usage: total > 0 ? (used / total) * 100 : 0 }
  }

  function network() {
    const sample = readNetDev()
    const now = Date.now()
    const rates = {}
    if (netPrev) {
      const dt = (now - netPrev.ts) / 1000
      if (dt > 0) {
        for (const name of Object.keys(sample)) {
          const p = netPrev.data[name]
          if (p) {
            rates[name] = {
              rx: Math.max(0, (sample[name].rx - p.rx) / dt),
              tx: Math.max(0, (sample[name].tx - p.tx) / dt),
            }
          }
        }
      }
    }
    netPrev = { data: sample, ts: now }

    let primary = readDefaultRouteIface()
    // Interface IPs come from /proc (host-aware), never os.networkInterfaces().
    const ipv4 = readInterfaceIpv4Map()
    const ipv6 = readInterfaceIpv6Map()
    const list = []
    for (const name of Object.keys(sample)) {
      const ip = ipv4.get(name) || ipv6.get(name)
      if (!ip) continue
      list.push({
        name,
        ip,
        rxBytesPerSec: round1(rates[name] ? rates[name].rx : 0),
        txBytesPerSec: round1(rates[name] ? rates[name].tx : 0),
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

  // Pseudo / transient filesystems never useful for capacity monitoring.
  const PSEUDO_FS = /^(tmpfs|devtmpfs|squashfs|proc|sysfs|cgroup2?|devpts|mqueue|shm|hugetlbfs|ramfs|securityfs|debugfs|tracefs|pstore|configfs|fusectl|autofs|nsfs|binfmt_misc|bpf)$/

  /** Mount point -> major:minor, parsed from <procRoot>/self/mountinfo. */
  function readMountDevices() {
    const map = new Map()
    const text = readText(path.join(procRoot, 'self/mountinfo'))
    if (!text) return map
    for (const line of text.split('\n')) {
      const dash = line.indexOf(' - ')
      if (dash < 0) continue
      const left = line.slice(0, dash).split(' ')
      if (left.length < 5) continue
      map.set(unescapeMount(left[4]), left[2])
    }
    return map
  }

  function disk() {
    if (diskCache && Date.now() - diskCache.ts < DISK_CACHE_MS) return diskCache.value
    const empty = { available: false, primary: { mount: '/', used: 0, total: 0, usage: 0 }, mounts: [] }

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
      const fstype = parts[2]
      if (PSEUDO_FS.test(fstype)) continue
      // Skip per-container overlay mounts (docker/containerd internals).
      if (fstype === 'overlay' && /(overlay2|containers)/.test(mount)) continue
      let st
      try { st = fs.statfsSync(path.join(fsRoot, mount)) } catch { continue }
      const total = st.blocks * st.bsize
      if (!total) continue
      const used = (st.blocks - st.bfree) * st.bsize
      mounts.push({ mount, filesystem: fstype, used, total, usage: round1((used / total) * 100) })
    }

    // Same filesystem is often mounted at several paths (/, /data, /etc/hosts);
    // dedup by device identity (major:minor from mountinfo), keeping the
    // shortest mount point (preferring /). Fall back to size if mountinfo
    // is unavailable.
    const devMap = readMountDevices()
    const byDevice = new Map()
    for (const m of mounts) {
      const dev = devMap.get(m.mount)
      const key = dev != null ? dev : (m.total + '|' + m.used)
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
      primary: root ? { mount: root.mount, used: root.used, total: root.total, usage: root.usage } : empty.primary,
      mounts: uniq,
    }
    diskCache = { value, ts: Date.now() }
    return value
  }

  /** Full /proc scan: every PID with name/user/cpu/mem/rss/ppid/command/elapsed. */
  function scanProcesses() {
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
      source: hostMetrics ? 'host' : 'container',
    }
  }

  /** Host-side process search/sort/pagination (read from the snapshot cache). */
  function processes(payload = {}) {
    let rows
    if (procScanCache && Date.now() - procScanCache.ts < PROCESS_SCAN_CACHE_MS) {
      rows = procScanCache.value
    } else {
      rows = scanProcesses()
      procScanCache = { value: rows, ts: Date.now() }
    }
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

  function dockerAvailable() {
    return exists(DOCKER_SOCKET)
  }

  async function dockerContainerList() {
    if (dockerListCache && Date.now() - dockerListCache.ts < DOCKER_LIST_CACHE_MS) return dockerListCache.value
    const base = await dockerApiBase()
    const list = await dockerGet(DOCKER_SOCKET, '/' + base + '/containers/json?all=1')

    const count = (fn) => list.filter(fn).length
    const summary = {
      total: list.length,
      running: count((c) => c.State === 'running'),
      stopped: count((c) => c.State === 'exited' || c.State === 'dead'),
      paused: count((c) => c.State === 'paused'),
      healthy: count((c) => /\(healthy\)/i.test(c.Status || '')),
      unhealthy: count((c) => /\(unhealthy\)/i.test(c.Status || '')),
      starting: count((c) => /(health:\s*starting|\(starting\))/i.test(c.Status || '')),
    }
    const value = { available: true, summary, list }
    dockerListCache = { value, ts: Date.now() }
    return value
  }

  async function containerStats(id) {
    const cached = dockerStatsCache.get(id)
    if (cached && Date.now() - cached.ts < DOCKER_STATS_CACHE_MS) return cached.value
    const base = await dockerApiBase()
    if (!/^[0-9a-fA-F]{6,64}$/.test(id)) throw new Error('docker: bad container id')
    const stats = await dockerGet(DOCKER_SOCKET, '/' + base + '/containers/' + id + '/stats?stream=false')
    dockerStatsCache.set(id, { value: stats, ts: Date.now() })
    return stats
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
        source: 'host',
        error: e instanceof Error ? e.message : String(e),
        summary: EMPTY_DOCKER_SUMMARY,
        containers: [],
      }
    }

    let statsById = {}
    const statsErrors = {}
    if (withStats) {
      const running = list.filter((c) => c.State === 'running')
      const results = await mapLimit(running, 4, (c) => containerStats(c.Id))
      for (let i = 0; i < running.length; i++) {
        const r = results[i]
        if (r && r.__error) statsErrors[running[i].Id] = r.__error
        else if (r) statsById[running[i].Id] = r
      }
    }

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
        ports,
        cpuUsage: null,
        memoryUsage: null,
        memoryLimit: null,
        memoryUsagePct: null,
        statsError: statsErrors[id] || null,
      }
      const stats = statsById[id]
      if (stats) {
        const cpuStats = stats.cpu_stats || {}
        const prevCpu = stats.precpu_stats || {}
        const totalUsage = cpuStats.cpu_usage ? cpuStats.cpu_usage.total_usage : 0
        const prevTotalUsage = prevCpu.cpu_usage ? prevCpu.cpu_usage.total_usage : 0
        const systemUsage = cpuStats.system_cpu_usage || 0
        const prevSystemUsage = prevCpu.system_cpu_usage || 0
        const onlineCpus = (cpuStats.online_cpus || numCores || 1)
        const dCpu = totalUsage - prevTotalUsage
        const dSys = systemUsage - prevSystemUsage
        if (dSys > 0 && dCpu >= 0) row.cpuUsage = round2((dCpu / dSys) * onlineCpus * 100)
        const mem = stats.memory_stats || {}
        const usage = typeof mem.usage === 'number' ? mem.usage : null
        const limit = typeof mem.limit === 'number' ? mem.limit : null
        if (usage !== null) {
          row.memoryUsage = usage
          row.memoryLimit = limit
          row.memoryUsagePct = limit > 0 ? round2((usage / limit) * 100) : null
        }
      }
      return row
    })

    return { available: true, source: 'host', summary, containers: rows }
  }

  /** DSH-process run environment: is the plugin itself in a container? */
  function detectMode() {
    if (exists('/.dockerenv')) return 'container'
    const cgroup = readText('/proc/1/cgroup')
    if (cgroup && /(docker|containerd|kubepods|podman|libpod|lxc|nspawn)/i.test(cgroup)) return 'container'
    if (/^[0-9a-f]{12}$/.test(os.hostname())) return 'container'
    return 'host'
  }

  /** Hostname: prefer the host's /etc/hostname in Host Mount Mode. */
  function detectHostname() {
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
    const systemSource = hostMetrics ? 'host' : 'container'
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

  return {
    async overview() {
      const mem = memory()
      const diskInfo = disk()
      const load = readLoadavg() || os.loadavg()
      const net = network()
      const kernel = readKernelRelease() || os.release()
      const osName = readOsRelease() || (os.type() + ' ' + os.release())
      const uptime = readUptimeSeconds() ?? os.uptime()
      return {
        environment: detectEnvironment(),
        cpuUsage: round1(cpuUsage()),
        cpuCores: numCores,
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
        network: net,
      }
    },
    processes,
    containers,
  }
}
