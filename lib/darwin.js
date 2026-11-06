/**
 * dsh-side-monitor — macOS (Darwin) provider.
 *
 * macOS has no /proc, so the Linux collectors cannot work there. This module
 * reads the same metrics from Apple's own tooling and returns them in the
 * Linux collectors' shapes:
 *
 *   CPU        node:os cpu times (user/sys/idle/irq)      — same as Linux deltas
 *   CPU model  sysctl machdep.cpu.brand_string / hw.*
 *   Memory     vm_stat page counts + sysctl hw.memsize
 *   Swap       sysctl vm.swapusage
 *   Load       node:os loadavg() (getloadavg(3))
 *   Uptime     node:os uptime()
 *   Disks      df -k, APFS container aware (/ and /System/Volumes/Data)
 *   Network    netstat -ib byte counters + os.networkInterfaces() addresses
 *   Processes  ps -A -o pid,ppid,user,%cpu,%mem,rss,etime,state,command
 *   Threads    sysctl kern.num_threads + runnable count from ps states
 *
 * Everything is read-only; no sudo, no privileged helper. Temperature is not
 * available without powermetrics (root) so it reports "none" like a headless
 * machine. The provider is injectable so the parsers are unit-testable.
 *
 * @module dsh-side-monitor/darwin
 */
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

/** Default command runner: bounded, non-interactive, never throws. */
function run(bin, args, timeout = 4000) {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// pure parsers (unit-tested against real snapshots)
// ---------------------------------------------------------------------------

/**
 * Parse `df -k` output into filesystem rows.
 * Handles mount points containing spaces by treating the first 8 columns as
 * positional and joining the rest.
 * @param text - raw `df -k` stdout.
 * @returns [{ filesystem, totalKb, usedKb, availKb, capacity, mount }]
 */
export function parseDf(text) {
  const rows = []
  if (!text) return rows
  for (const line of String(text).split('\n').slice(1)) {
    if (!line.trim()) continue
    const m = line.match(/^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%\s+\S+\s+\S+\s+\S+%\s+(.+)$/)
    if (!m) continue
    rows.push({
      filesystem: m[1],
      totalKb: Number(m[2]),
      usedKb: Number(m[3]),
      availKb: Number(m[4]),
      capacity: Number(m[5]),
      mount: m[6].trim(),
    })
  }
  return rows
}

/** Filesystems that never represent user capacity. */
const DARWIN_PSEUDO_FS = /^(devfs|map\s+auto_home|autofs|none)$/

/**
 * Reduce `df` rows to the mounts a monitor should show.
 *
 * APFS exposes the read-only system volume at `/` and the user data volume at
 * `/System/Volumes/Data`; they share one container. Finder shows ONE disk, so
 * when Data exists it becomes the `/` row (its used/available are the numbers
 * people expect) and the system volume is dropped.
 * @param rows - parsed df rows.
 */
export function selectDarwinDisks(rows) {
  const real = rows.filter((r) => !DARWIN_PSEUDO_FS.test(r.filesystem))
  const data = real.find((r) => r.mount === '/System/Volumes/Data')
  const root = real.find((r) => r.mount === '/')
  const primary = data || root
  if (!primary) return []
  const out = []
  // One row for the APFS container: used + available from the Data volume.
  out.push({
    mount: '/',
    filesystem: data ? 'apfs' : (root ? 'apfs' : 'apfs'),
    used: primary.usedKb * 1024,
    total: (primary.usedKb + primary.availKb) * 1024,
    usage: primary.usedKb + primary.availKb > 0
      ? Math.round((primary.usedKb / (primary.usedKb + primary.availKb)) * 1000) / 10
      : 0,
  })
  // External / additional volumes keep their own row. Recovery is a system
  // volume Apple mounts under /Volumes, not user storage.
  for (const r of real) {
    if (r.mount === '/' || r.mount === '/System/Volumes/Data') continue
    if (r.mount.startsWith('/System/Volumes/')) continue
    if (r.mount === '/Volumes/Recovery') continue
    if (!r.mount.startsWith('/Volumes/')) continue
    out.push({
      mount: r.mount,
      filesystem: 'apfs',
      used: r.usedKb * 1024,
      total: (r.usedKb + r.availKb) * 1024,
      usage: r.usedKb + r.availKb > 0 ? Math.round((r.usedKb / (r.usedKb + r.availKb)) * 1000) / 10 : 0,
    })
  }
  return out
}

/**
 * Parse `vm_stat` into byte counts.
 * @param text - raw vm_stat stdout.
 * @returns {{ pageSize, free, active, inactive, speculative, wired, purgeable, available, cached }}
 */
export function parseVmStat(text) {
  const out = { pageSize: 4096, free: 0, active: 0, inactive: 0, speculative: 0, wired: 0, purgeable: 0, available: 0, cached: 0 }
  if (!text) return out
  const pm = String(text).match(/page size of (\d+) bytes/)
  if (pm) out.pageSize = Number(pm[1]) || 4096
  const grab = (label) => {
    const m = String(text).match(new RegExp('^' + label + ':\\s+(\\d+)\\.?', 'm'))
    return m ? Number(m[1]) : 0
  }
  const ps = out.pageSize
  out.free = grab('Pages free') * ps
  out.active = grab('Pages active') * ps
  out.inactive = grab('Pages inactive') * ps
  out.speculative = grab('Pages speculative') * ps
  out.wired = grab('Pages wired down') * ps
  out.purgeable = grab('Pages purgeable') * ps
  // Apple's own "available" approximation: reclaimable pages.
  out.available = out.free + out.inactive + out.speculative + out.purgeable
  out.cached = out.inactive + out.purgeable
  return out
}

/**
 * Parse `sysctl vm.swapusage` ("total = 3072.00M  used = 2071.38M  free = ...").
 * @returns {{ total, used, free }} in bytes, or null when unreadable.
 */
export function parseSwapusage(text) {
  if (!text) return null
  const num = (label) => {
    const m = String(text).match(new RegExp(label + '\\s*=\\s*([\\d.]+)([KMGT])'))
    if (!m) return null
    const mult = { K: 0, M: 1, G: 2, T: 3 }[m[2]]
    return Math.round(Number(m[1]) * Math.pow(1024, mult + 1)) // value is in KB units × suffix
  }
  const total = num('total')
  const used = num('used')
  const free = num('free')
  if (total == null && used == null) return null
  return { total: total ?? 0, used: used ?? 0, free: free ?? 0 }
}

/**
 * Parse `ps -A -o pid=,ppid=,user=,%cpu=,%mem=,rss=,etime=,state=,command=`.
 * rss is KiB; cpu is percent of one core (matches the Linux provider's scale).
 * @returns [{ pid, ppid, user, name, cpu, mem, rssBytes, command, elapsedSeconds, runnable }]
 */
export function parsePs(text) {
  const rows = []
  if (!text) return rows
  for (const line of String(text).split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/)
    if (!m) continue
    const pid = Number(m[1])
    if (!pid) continue
    const command = m[9].trim()
    const name = command.split(/\s+/)[0].split('/').pop() || String(pid)
    rows.push({
      pid,
      ppid: Number(m[2]) || 0,
      user: m[3],
      cpu: Number(m[4]) || 0,
      mem: Number(m[5]) || 0,
      rssBytes: (Number(m[6]) || 0) * 1024,
      elapsedSeconds: parseElapsed(m[7]),
      runnable: (m[8] || '').startsWith('R'),
      command,
      name,
    })
  }
  return rows
}

/** ps etime: [[D-]HH:]MM:SS -> seconds. */
export function parseElapsed(s) {
  if (!s) return 0
  let days = 0
  let rest = s
  const dash = rest.indexOf('-')
  if (dash >= 0) {
    days = Number(rest.slice(0, dash)) || 0
    rest = rest.slice(dash + 1)
  }
  const parts = rest.split(':').map(Number)
  let h = 0, m = 0, sec = 0
  if (parts.length === 3) { h = parts[0] || 0; m = parts[1] || 0; sec = parts[2] || 0 }
  else if (parts.length === 2) { m = parts[0] || 0; sec = parts[1] || 0 }
  else sec = parts[0] || 0
  return Math.max(0, days * 86400 + h * 3600 + m * 60 + sec)
}

/**
 * Parse `netstat -ib` Link rows into byte counters.
 * The interface row carrying `<Link#N>` in the Network column holds the
 * authoritative Ibytes/Obytes counters; address rows repeat them.
 * @returns { iface: { rx, tx } } in bytes.
 */
export function parseNetstat(text) {
  const out = {}
  if (!text) return out
  for (const line of String(text).split('\n').slice(1)) {
    const p = line.trim().split(/\s+/)
    // Columns: Name Mtu Network [Address...] Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
    // The Address column is absent on interfaces without a MAC (e.g. lo0), so
    // index the seven counter columns from the END rather than from the start.
    if (p.length < 10) continue
    if (!/^<Link#\d+>$/.test(p[2])) continue
    const name = p[0]
    if (out[name]) continue
    const n = p.length
    const rx = Number(p[n - 5]) // Ibytes
    const tx = Number(p[n - 2]) // Obytes
    if (Number.isFinite(rx) && Number.isFinite(tx)) out[name] = { rx, tx }
  }
  return out
}

/** Parse `route -n get default` and return the interface name, or null. */
export function parseDefaultRoute(text) {
  if (!text) return null
  const m = String(text).match(/^\s*interface:\s*(\S+)$/m)
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// provider
// ---------------------------------------------------------------------------

/**
 * Build the macOS provider.
 * @param exec - optional command runner override (tests inject canned output).
 */
export function createDarwinProvider(exec = run) {
  const cache = new Map()
  const cached = (key, ttl, fn) => {
    const hit = cache.get(key)
    const now = Date.now()
    if (hit && now - hit.ts < ttl) return hit.value
    const value = fn()
    cache.set(key, { value, ts: now })
    return value
  }

  return {
    /** hw.memsize, hw.physicalcpu, hw.logicalcpu, machdep.cpu.brand_string. */
    cpuInfo() {
      return cached('cpu', 60_000, () => {
        const out = exec('sysctl', ['-n', 'hw.memsize', 'hw.physicalcpu', 'hw.logicalcpu', 'machdep.cpu.brand_string'])
        const lines = String(out).split('\n').map((l) => l.trim())
        const cpus = os.cpus()
        return {
          totalMemory: Number(lines[0]) || os.totalmem(),
          physical: Number(lines[1]) || null,
          logical: Number(lines[2]) || cpus.length || 1,
          model: lines[3] || (cpus[0] && cpus[0].model) || null,
          clockMhz: (cpus[0] && cpus[0].speed) || null,
        }
      })
    },

    /** Aggregate CPU jiffy-like counters (node:os times, same scale as Linux). */
    cpuAggregate() {
      const times = os.cpus().map((c) => c.times)
      return {
        idle: times.reduce((n, t) => n + t.idle, 0),
        total: times.reduce((n, t) => n + t.user + t.nice + t.sys + t.idle + t.irq, 0),
      }
    },

    /** Per-core counters for the performance view. */
    perCoreTimes() {
      return os.cpus().map((c, i) => ({ index: i, ...c.times, total: c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq, idle: c.times.idle }))
    },

    /** Memory in bytes: free/available/active/inactive/wired/cached. */
    memory() {
      return cached('mem', 1000, () => {
        const vm = parseVmStat(exec('vm_stat', []))
        const total = this.cpuInfo().totalMemory
        return {
          total,
          available: Math.min(total, vm.available),
          free: Math.min(total, vm.free),
          active: vm.active,
          inactive: vm.inactive,
          wired: vm.wired,
          cached: vm.cached,
        }
      })
    },

    /** Swap usage in bytes. */
    swap() {
      return cached('swap', 2000, () => parseSwapusage(exec('sysctl', ['-n', 'vm.swapusage'])))
    },

    /** Disk rows for the overview and the disks section. */
    disks() {
      return cached('disk', 10_000, () => selectDarwinDisks(parseDf(exec('df', ['-k']))))
    },

    /** Process table (full scan). */
    processes() {
      return parsePs(exec('ps', ['-A', '-o', 'pid=,ppid=,user=,%cpu=,%mem=,rss=,etime=,state=,command='], 6000))
    },

    /** Network counters and interface addresses. */
    network() {
      // No cache: the rate diff needs the freshest cumulative counters, and a
      // shared snapshot across two rapid polls would compute a 0 B/s interval.
      return {
        counters: parseNetstat(exec('netstat', ['-ib'], 4000)),
        defaultIface: parseDefaultRoute(exec('route', ['-n', 'get', 'default'], 2000)),
      }
    },

    /** Kernel thread total + runnable process count. */
    taskCounts() {
      return cached('tasks', 1500, () => {
        const raw = exec('sysctl', ['-n', 'kern.num_threads'])
        const threads = Number(String(raw).trim()) || null
        const states = exec('ps', ['-A', '-o', 'state='], 4000)
        let runnable = 0
        for (const line of String(states).split('\n')) if (/^\s*R/.test(line)) runnable++
        return { threadCount: threads, runnableCount: runnable || null }
      })
    },

    /** Product name + version from sw_vers. */
    osName() {
      return cached('os', 60_000, () => {
        const out = exec('sw_vers', [])
        const name = (String(out).match(/^ProductName:\s*(.+)$/m) || [])[1]
        const version = (String(out).match(/^ProductVersion:\s*(.+)$/m) || [])[1]
        if (name && version) return name.trim() + ' ' + version.trim()
        return os.type() + ' ' + os.release()
      })
    },

    /** macOS exposes no unprivileged thermal sensor. */
    temperatures() {
      return []
    },

    /** Docker Desktop sockets, in priority order. */
    dockerSockets() {
      const out = []
      if (process.env.DOCKER_HOST && /^unix:\/\//.test(process.env.DOCKER_HOST)) out.push(process.env.DOCKER_HOST.replace(/^unix:\/\//, ''))
      out.push('/var/run/docker.sock')
      out.push(path.join(os.homedir(), '.docker/run/docker.sock'))
      return out
    },
  }
}
