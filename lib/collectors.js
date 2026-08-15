/**
 * dsh-side-monitor — Host collectors (read-only).
 *
 * Pulls CPU / memory / load / uptime / network / disk / processes from the
 * standard library + /proc + `df`, and Docker state from the local Engine API
 * over /var/run/docker.sock. Everything here is read-only: no control
 * operations, no arbitrary command execution, no arbitrary Docker API proxy.
 *
 * v0.2 additions: host/container mode detection, host-side process
 * search/sort/pagination, Docker health status + structured ports, multi-mount
 * disk collection, default-route network detection, and a snapshot cache so
 * repeated RPC reads reuse recent scans instead of re-reading /proc.
 * @module dsh-side-monitor/collectors
 */
import os from 'node:os'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import http from 'node:http'

// Linux USER_HZ (clock ticks per second) used by /proc/<pid>/stat.
const CLK_TCK = 100
// Default page size of process rows returned to the client.
const DEFAULT_PROCESS_LIMIT = 50
// Hard cap on the process page size (a single RPC response).
const MAX_PROCESS_LIMIT = 200
// Process scan snapshot cache window (ms).
const PROCESS_SCAN_CACHE_MS = 1500
// Disk collection cache window (ms) — df is a subprocess, keep it cheap.
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

function round1(n) { return Math.round(n * 10) / 10 }
function round2(n) { return Math.round(n * 100) / 100 }
function clampInt(n, lo, hi) {
  const v = Number.isFinite(n) ? Math.floor(n) : lo
  return Math.max(lo, Math.min(hi, v))
}

/** Parse the aggregate `cpu  ...` line of /proc/stat into idle/total jiffies. */
function parseCpuAggregate(line) {
  const nums = line.trim().split(/\s+/).slice(1).map(Number)
  const user = nums[0] || 0
  const nice = nums[1] || 0
  const system = nums[2] || 0
  const idle = nums[3] || 0
  const iowait = nums[4] || 0
  const irq = nums[5] || 0
  const softirq = nums[6] || 0
  const steal = nums[7] || 0
  const idleAll = idle + iowait
  const total = user + nice + system + idleAll + irq + softirq + steal
  return { idle: idleAll, total }
}

function readCpuAggregate() {
  const stat = readText('/proc/stat')
  if (!stat) return null
  const line = stat.split('\n').find((l) => l.startsWith('cpu '))
  return line ? parseCpuAggregate(line) : null
}

function readMemInfoKb() {
  const text = readText('/proc/meminfo')
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
  const text = readText('/proc/net/dev')
  const out = {}
  if (!text) return out
  for (const line of text.split('\n').slice(2)) {
    const m = line.trim().match(/^([^:]+):\s+(.+)$/)
    if (!m) continue
    const nums = m[2].trim().split(/\s+/).map(Number)
    // rx_bytes = nums[0], tx_bytes = nums[8]
    if (nums.length >= 9) out[m[1]] = { rx: nums[0] || 0, tx: nums[8] || 0 }
  }
  return out
}

/** Read the interface name of the default IPv4 route from /proc/net/route. */
function readDefaultRouteIface() {
  const text = readText('/proc/net/route')
  if (!text) return null
  let best = null
  for (const line of text.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/)
    // Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT
    if (parts.length < 11) continue
    if (parts[1] !== '00000000') continue // Destination must be default
    const metric = Number(parts[6]) || 0
    if (best === null || metric < best.metric) best = { iface: parts[0], metric }
  }
  return best ? best.iface : null
}

// Virtual / non-physical interface name patterns.
const VIRTUAL_IFACE_RE = /^(lo|docker\d*|br-|veth|virbr\d*|tailscale\d*|tun\d*|tap\d*|wg\d*|flannel|cali|kube-|cni\d*|vxlan|veth\d|nflx)/

function isVirtualIface(name) { return VIRTUAL_IFACE_RE.test(name) }

/**
 * Detect whether the DSH host half runs inside a container. Strong signals
 * (.dockerenv, container runtime in /proc/1/cgroup) win; a Docker-default
 * 12-hex-char hostname is a soft signal.
 */
function detectMode() {
  if (fs.existsSync('/.dockerenv')) return 'container'
  const cgroup = readText('/proc/1/cgroup')
  if (cgroup && /(docker|containerd|kubepods|podman|libpod|lxc|nspawn)/i.test(cgroup)) return 'container'
  if (/^[0-9a-f]{12}$/.test(os.hostname())) return 'container'
  return 'host'
}

/** Minimal unix-socket GET for the Docker Engine API. */
function dockerGet(sockPath, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: sockPath, path, method: 'GET' }, (res) => {
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
 * @param {object} config - composition-layer config (reserved; refresh caps etc).
 */
export function createSystemCollector(config = {}) {
  const numCores = os.cpus().length || 1
  const defaultLimit = Number.isFinite(config.processLimit) && config.processLimit > 0
    ? config.processLimit
    : DEFAULT_PROCESS_LIMIT

  let cpuPrev = null
  let netPrev = null
  let procPrev = null
  let procTotalCpuPrev = null
  let diskCache = null
  let uidMap = null
  let dockerApiVersion = null
  let dockerListCache = null
  let dockerStatsCache = new Map() // id -> { value, ts }
  let procScanCache = null // { value: rows[], ts }

  function userName(uid) {
    if (uidMap === null) {
      uidMap = new Map()
      const passwd = readText('/etc/passwd')
      if (passwd) {
        for (const line of passwd.split('\n')) {
          const parts = line.split(':')
          if (parts.length >= 3 && parts[0]) uidMap.set(parts[2], parts[0])
        }
      }
    }
    return uidMap.get(String(uid)) || String(uid)
  }

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
    return {
      used,
      total,
      usage: total > 0 ? (used / total) * 100 : 0,
    }
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
    const ifaces = os.networkInterfaces()
    const list = []
    for (const name of Object.keys(ifaces)) {
      const addrs = ifaces[name] || []
      const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal)
      const ipv6 = addrs.find((a) => a.family === 'IPv6' && !a.internal)
      const addr = ipv4 || ipv6
      if (!addr) continue // skip loopback & address-less interfaces
      list.push({
        name,
        ip: addr.address,
        rxBytesPerSec: round1(rates[name] ? rates[name].rx : 0),
        txBytesPerSec: round1(rates[name] ? rates[name].tx : 0),
        virtual: isVirtualIface(name),
        primary: name === primary,
      })
    }
    if (!list.some((i) => i.primary) && list.length) {
      // No default route found (or route iface has no IP): pick the first non-virtual.
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

  function disk() {
    if (diskCache && Date.now() - diskCache.ts < DISK_CACHE_MS) return diskCache.value
    return new Promise((resolve) => {
      execFile('df', ['-Pk'], { timeout: 5000 }, (err, stdout) => {
        const empty = { available: false, primary: { mount: '/', used: 0, total: 0, usage: 0 }, mounts: [] }
        if (err || !stdout) {
          diskCache = { value: empty, ts: Date.now() }
          resolve(empty)
          return
        }
        // Pseudo/transient filesystems never useful for capacity monitoring.
        const PSEUDO = /^(tmpfs|devtmpfs|squashfs|proc|sysfs|cgroup2?|devpts|mqueue|shm|hugetlbfs|ramfs|securityfs|debugfs|tracefs|pstore|configfs|fusectl|autofs|nsfs|binfmt_misc|bpf)$/
        const mounts = []
        for (const line of stdout.trim().split('\n').slice(1)) {
          const parts = line.trim().split(/\s+/)
          if (parts.length < 6) continue
          const filesystem = parts[0]
          if (PSEUDO.test(filesystem)) continue
          const total = Number(parts[1]) * 1024
          const used = Number(parts[2]) * 1024
          const mount = parts.slice(5).join(' ')
          if (!total) continue
          mounts.push({
            mount,
            filesystem,
            used,
            total,
            usage: round1((used / total) * 100),
          })
        }
        // Dedup by device+size: the same filesystem is often mounted at
        // several paths (e.g. /, /data, /etc/hosts in a container); keep the
        // shortest mount point (preferring /) to avoid duplicate rows.
        const byDevice = new Map()
        for (const m of mounts) {
          const key = m.total + '|' + m.used
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
        resolve(value)
      })
    })
  }

  /** Full /proc scan: every PID with name/user/cpu/mem/rss/ppid/command/elapsed. */
  function scanProcesses() {
    const mi = readMemInfoKb()
    const memTotalKb = mi.MemTotal || 1
    const cpuAgg = readCpuAggregate()

    let pids
    try {
      pids = fs.readdirSync('/proc').filter((n) => /^\d+$/.test(n)).map(Number)
    } catch {
      return []
    }

    const current = new Map()
    const rows = []
    const bootUptime = os.uptime()

    for (const pid of pids) {
      const stat = readText('/proc/' + pid + '/stat')
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

      const status = readText('/proc/' + pid + '/status')
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
      const raw = readText('/proc/' + pid + '/cmdline')
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
    try { return fs.existsSync(DOCKER_SOCKET) } catch { return false }
  }

  async function dockerContainerList() {
    if (dockerListCache && Date.now() - dockerListCache.ts < DOCKER_LIST_CACHE_MS) return dockerListCache.value
    const base = await dockerApiBase()
    const list = await dockerGet(DOCKER_SOCKET, '/' + base + '/containers/json?all=1')

    const health = (h) => list.filter((c) => h(c)).length
    const summary = {
      total: list.length,
      running: health((c) => c.State === 'running'),
      stopped: health((c) => c.State === 'exited' || c.State === 'dead'),
      paused: health((c) => c.State === 'paused'),
      healthy: health((c) => /\(healthy\)/i.test(c.Status || '')),
      unhealthy: health((c) => /\(unhealthy\)/i.test(c.Status || '')),
      starting: health((c) => /(health:\s*starting|\(starting\))/i.test(c.Status || '')),
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

  async function containers(withStats) {
    if (!dockerAvailable()) {
      return {
        available: false,
        summary: { total: 0, running: 0, stopped: 0, paused: 0, healthy: 0, unhealthy: 0, starting: 0 },
        containers: [],
      }
    }
    const { summary, list } = await dockerContainerList()

    let statsById = {}
    if (withStats) {
      const running = list.filter((c) => c.State === 'running')
      const results = await mapLimit(running, 4, (c) => containerStats(c.Id))
      for (let i = 0; i < running.length; i++) {
        if (!results[i] || results[i].__error) continue
        statsById[running[i].Id] = results[i]
      }
    }

    const containersRows = list.map((c) => {
      const id = c.Id
      const name = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : id.slice(0, 12)
      const ports = (c.Ports || []).map((p) => ({
        ip: p.IP || null,
        public: p.PublicPort != null ? Number(p.PublicPort) : null,
        private: p.PrivatePort != null ? Number(p.PrivatePort) : null,
        type: p.Type || 'tcp',
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
        if (dSys > 0 && dCpu >= 0) {
          row.cpuUsage = round2((dCpu / dSys) * onlineCpus * 100)
        }
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

    return { available: true, summary, containers: containersRows }
  }

  return {
    async overview() {
      const mem = memory()
      const diskInfo = await disk()
      const load = os.loadavg()
      const cpus = os.cpus()
      const net = network()
      return {
        mode: detectMode(),
        hostname: os.hostname(),
        cpuUsage: round1(cpuUsage()),
        cpuCores: numCores,
        cpuModel: cpus.length ? cpus[0].model : 'unknown',
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
        uptimeSeconds: Math.round(os.uptime()),
        cpuClockMhz: cpus.length ? cpus[0].speed : null,
        osName: os.type() + ' ' + os.release(),
        platform: os.platform(),
        arch: os.arch(),
        kernelVersion: os.release(),
        network: net,
      }
    },
    processes,
    containers,
  }
}
