/**
 * dsh-side-monitor — Host collectors (read-only).
 *
 * Pulls CPU / memory / load / uptime / network / disk / processes from the
 * standard library + /proc + `df`, and Docker state from the local
 * Engine API over /var/run/docker.sock. Everything here is read-only: no
 * control operations, no arbitrary command execution, no arbitrary Docker API
 * proxy. @module dsh-side-monitor/collectors
 */
import os from 'node:os'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import http from 'node:http'

// Linux USER_HZ (clock ticks per second) used by /proc/<pid>/stat.
const CLK_TCK = 100
// Default cap of process rows returned to the client.
const DEFAULT_PROCESS_LIMIT = 50
// Disk collection cache window (ms) — df is a subprocess, keep it cheap.
const DISK_CACHE_MS = 10_000
// Docker container-list cache window (ms).
const DOCKER_LIST_CACHE_MS = 5_000
// Docker socket path.
const DOCKER_SOCKET = '/var/run/docker.sock'

function readText(p) {
  try { return fs.readFileSync(p, 'utf8') } catch { return null }
}

function round1(n) { return Math.round(n * 10) / 10 }
function round2(n) { return Math.round(n * 100) / 100 }

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
  const processLimit = Number.isFinite(config.processLimit) && config.processLimit > 0
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

    const ifaces = os.networkInterfaces()
    const list = []
    for (const name of Object.keys(ifaces)) {
      const addrs = ifaces[name] || []
      const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal)
      const ipv6 = addrs.find((a) => a.family === 'IPv6' && !a.internal)
      const addr = ipv4 || ipv6
      if (!addr) continue
      list.push({
        name,
        ip: addr.address,
        rxBytesPerSec: round1(rates[name] ? rates[name].rx : 0),
        txBytesPerSec: round1(rates[name] ? rates[name].tx : 0),
      })
    }
    return list
  }

  function disk() {
    if (diskCache && Date.now() - diskCache.ts < DISK_CACHE_MS) return diskCache.value
    return new Promise((resolve) => {
      execFile('df', ['-Pk', '/'], { timeout: 5000 }, (err, stdout) => {
        let value = { available: false, used: 0, total: 0, usage: 0 }
        if (!err && stdout) {
          const lines = stdout.trim().split('\n')
          const line = lines[lines.length - 1]
          const parts = line.trim().split(/\s+/)
          // Filesystem 1024-blocks Used Available Capacity% Mounted
          if (parts.length >= 4) {
            const total = Number(parts[1]) * 1024
            const used = Number(parts[2]) * 1024
            value = {
              available: true,
              used,
              total,
              usage: total > 0 ? (used / total) * 100 : 0,
            }
          }
        }
        diskCache = { value, ts: Date.now() }
        resolve(value)
      })
    })
  }

  function processes() {
    const mi = readMemInfoKb()
    const memTotalKb = mi.MemTotal || 1
    const cpuAgg = readCpuAggregate()
    const now = Date.now()

    let entries
    try {
      entries = fs.readdirSync('/proc').filter((n) => /^\d+$/.test(n)).map(Number)
    } catch {
      return { processes: [], total: 0 }
    }

    const current = new Map()
    const rows = []

    for (const pid of entries) {
      const stat = readText('/proc/' + pid + '/stat')
      if (!stat) continue
      const close = stat.lastIndexOf(')')
      const before = stat.slice(0, close + 1)
      const after = stat.slice(close + 2).trim().split(/\s+/)
      const commStart = before.indexOf('(')
      const comm = commStart >= 0 ? before.slice(commStart + 1, before.length - 1) : String(pid)
      // after[] starts at field 3 (state). utime=field14 => after[11], stime=field15 => after[12], starttime=field22 => after[19]
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
        const elapsed = Math.max(0.001, os.uptime() - starttime / CLK_TCK)
        cpu = (cpuTime / CLK_TCK / elapsed) * 100
      }

      current.set(pid, { cpuTime })
      rows.push({
        pid,
        name: comm,
        user: userName(uid),
        cpu: round2(Math.max(0, cpu)),
        mem: round2((vmRssKb / memTotalKb) * 100),
      })
    }

    procPrev = current
    procTotalCpuPrev = cpuAgg
    rows.sort((a, b) => b.cpu - a.cpu)
    const limited = rows.slice(0, processLimit)
    // Read cmdline only for the displayed rows (cheap on containers, a big
    // win when DSH runs directly on the host with thousands of PIDs).
    for (const row of limited) {
      const raw = readText('/proc/' + row.pid + '/cmdline')
      if (raw) {
        const cmd = raw.replace(/\0/g, ' ').trim()
        row.command = cmd.length > 200 ? cmd.slice(0, 200) + '…' : cmd
      } else {
        row.command = '[' + row.name + ']'
      }
    }
    return { processes: limited, total: rows.length, memTotalKb }
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
    const value = {
      available: true,
      summary: {
        total: list.length,
        running: list.filter((c) => c.State === 'running').length,
        stopped: list.filter((c) => c.State === 'exited' || c.State === 'dead').length,
        paused: list.filter((c) => c.State === 'paused').length,
      },
      list,
    }
    dockerListCache = { value, ts: Date.now() }
    return value
  }

  async function containerStats(id) {
    const base = await dockerApiBase()
    if (!/^[0-9a-fA-F]{6,64}$/.test(id)) throw new Error('docker: bad container id')
    return dockerGet(DOCKER_SOCKET, '/' + base + '/containers/' + id + '/stats?stream=false')
  }

  async function containers(withStats) {
    if (!dockerAvailable()) {
      return { available: false, summary: { total: 0, running: 0, stopped: 0, paused: 0 }, containers: [] }
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

    const containers = list.map((c) => {
      const id = c.Id
      const name = (c.Names && c.Names[0]) ? c.Names[0].replace(/^\//, '') : id.slice(0, 12)
      const ports = (c.Ports || []).map((p) => {
        const pub = p.PublicPort ? String(p.PublicPort) : ''
        const priv = p.PrivatePort ? String(p.PrivatePort) : ''
        return pub && priv ? pub + '->' + priv : (pub || priv)
      })
      const row = {
        id: id.slice(0, 12),
        name,
        image: c.Image || '',
        state: c.State || 'unknown',
        status: c.Status || '',
        uptime: c.Status || '',
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

    return { available: true, summary, containers }
  }

  return {
    async overview() {
      const mem = memory()
      const diskInfo = await disk()
      const load = os.loadavg()
      const cpus = os.cpus()
      return {
        cpuUsage: round1(cpuUsage()),
        cpuCores: numCores,
        cpuModel: cpus.length ? cpus[0].model : 'unknown',
        memoryUsed: mem.used,
        memoryTotal: mem.total,
        memoryUsage: round1(mem.usage),
        diskUsed: diskInfo.used,
        diskTotal: diskInfo.total,
        diskUsage: round1(diskInfo.usage),
        diskAvailable: diskInfo.available,
        load1: load[0],
        load5: load[1],
        load15: load[2],
        uptimeSeconds: Math.round(os.uptime()),
        cpuClockMhz: cpus.length ? cpus[0].speed : null,
        osName: os.type() + ' ' + os.release(),
        platform: os.platform(),
        arch: os.arch(),
        kernelVersion: os.release(),
        hostname: os.hostname(),
        network: network(),
      }
    },
    processes,
    containers,
  }
}
