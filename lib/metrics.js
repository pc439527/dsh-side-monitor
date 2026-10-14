/**
 * dsh-side-monitor — pure metric parsers and sample helpers (v0.7).
 *
 * Everything here is side-effect free so it can be unit-tested against
 * fixtures. Collectors read the files; this module only interprets text.
 * @module dsh-side-monitor/metrics
 */

const SECTOR_BYTES = 512

/**
 * Parse per-CPU counters from /proc/stat. Returns the `cpuN` rows (not the
 * aggregate `cpu` line) plus procs_running / procs_blocked.
 * Each row: { index, total, idle } in jiffies; idle includes iowait.
 */
export function parseProcStatCpus(text) {
  const cpus = []
  let running = null
  let blocked = null
  if (!text) return { cpus, procsRunning: null, procsBlocked: null }
  for (const line of String(text).split('\n')) {
    const m = line.match(/^cpu(\d+)\s+(.*)$/)
    if (m) {
      const f = m[2].trim().split(/\s+/).map(Number)
      if (f.length < 4 || f.some((n) => !Number.isFinite(n))) continue
      const total = f.slice(0, 8).reduce((a, b) => a + (b || 0), 0)
      const idle = (f[3] || 0) + (f[4] || 0)
      cpus.push({ index: Number(m[1]), total, idle })
      continue
    }
    const r = line.match(/^procs_running\s+(\d+)/)
    if (r) running = Number(r[1])
    const b = line.match(/^procs_blocked\s+(\d+)/)
    if (b) blocked = Number(b[1])
  }
  return { cpus, procsRunning: running, procsBlocked: blocked }
}

/**
 * Parse the aggregate `cpu  ...` line of /proc/stat into its per-field jiffies
 * (user, nice, system, idle, iowait, irq, softirq, steal) plus the total.
 * Returns null when the aggregate line is missing or unusable.
 */
export function parseProcStatAggregate(text) {
  if (!text) return null
  for (const line of String(text).split('\n')) {
    if (!line.startsWith('cpu ')) continue
    const f = line.trim().split(/\s+/).slice(1).map(Number)
    if (f.length < 4) return null
    const num = (i) => (Number.isFinite(f[i]) ? f[i] : 0)
    const [user, nice, system, idle, iowait, irq, softirq, steal] =
      [num(0), num(1), num(2), num(3), num(4), num(5), num(6), num(7)]
    return { user, nice, system, idle, iowait, irq, softirq, steal,
      total: user + nice + system + idle + iowait + irq + softirq + steal }
  }
  return null
}

/**
 * CPU time composition (%) between two aggregate snapshots — the data behind
 * the "CPU time breakdown" donut. user folds in nice, irq folds in softirq;
 * the parts are normalised so they sum to ~100.
 */
export function cpuTimesPercent(prev, cur) {
  if (!prev || !cur || !((cur.total || 0) - (prev.total || 0) > 0)) return null
  const d = (k) => Math.max(0, (cur[k] || 0) - (prev[k] || 0))
  const parts = {
    user: d('user') + d('nice'),
    system: d('system'),
    irq: d('irq') + d('softirq'),
    iowait: d('iowait'),
    steal: d('steal'),
    idle: d('idle'),
  }
  const total = parts.user + parts.system + parts.irq + parts.iowait + parts.steal + parts.idle
  if (!(total > 0)) return null
  const out = {}
  for (const k of Object.keys(parts)) out[k] = Math.round((parts[k] / total) * 1000) / 10
  return out
}

/** Utilisation percent between two per-CPU snapshots, clamped to 0..100. */
export function cpuPercent(prev, cur) {
  if (!prev || !cur) return null
  const dTotal = cur.total - prev.total
  const dIdle = cur.idle - prev.idle
  if (dTotal <= 0) return 0
  return Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100))
}

/** Whole physical disks only: partitions, loop/ram/dm/md/sr devices are skipped. */
export function isWholeDisk(name) {
  return /^(sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+)$/.test(name)
    || /^nvme\d+n\d+$/.test(name)
    || /^mmcblk\d+$/.test(name)
}

/**
 * Parse /proc/diskstats into cumulative byte counters for whole disks.
 * Returns Map<name, { readBytes, writeBytes }>. Field layout: major minor name
 * reads reads_merged sectors_read ms writes writes_merged sectors_written ...
 */
export function parseDiskstats(text) {
  const out = new Map()
  if (!text) return out
  for (const line of String(text).split('\n')) {
    const p = line.trim().split(/\s+/)
    if (p.length < 10) continue
    const name = p[2]
    if (!isWholeDisk(name)) continue
    const sectorsRead = Number(p[5])
    const sectorsWritten = Number(p[9])
    if (!Number.isFinite(sectorsRead) || !Number.isFinite(sectorsWritten)) continue
    out.set(name, { readBytes: sectorsRead * SECTOR_BYTES, writeBytes: sectorsWritten * SECTOR_BYTES })
  }
  return out
}

/** Bytes per second between two cumulative counters; null without a usable interval. */
export function rateBetween(prev, cur, dtSec) {
  if (prev == null || cur == null || !(dtSec > 0)) return null
  const d = cur - prev
  return d < 0 ? 0 : d / dtSec
}

/** Parse /proc/loadavg 4th field "running/total" into thread-level counters. */
export function parseLoadavgTasks(text) {
  if (!text) return { running: null, total: null }
  const m = String(text).trim().split(/\s+/)[3]
  const mm = m && m.match(/^(\d+)\/(\d+)$/)
  if (!mm) return { running: null, total: null }
  return { running: Number(mm[1]), total: Number(mm[2]) }
}

/**
 * Friendly sensor keys (v0.7). The client localises these; an unknown chip
 * falls back to the raw hwmon/thermal name. Ordered most-specific first.
 */
export const THERMAL_KEYS = Object.freeze({
  x86_pkg_temp: 'cpuPackage',
  coretemp: 'cpuPackage',
  k10temp: 'cpuPackage',
  zenpower: 'cpuPackage',
  cpu_thermal: 'cpuPackage',
  soc_thermal: 'cpuPackage',
  acpitz: 'mainboardAcpi',
  nvme: 'nvme',
  drivetemp: 'disk',
  amdgpu: 'gpu',
  i915: 'gpu',
  nouveau: 'gpu',
})

/** Map a sensor chip name and/or label to a friendly key (null = unknown). */
export function thermalKey(type, label) {
  const hay = (String(type || '') + ' ' + String(label || '')).toLowerCase()
  for (const needle of Object.keys(THERMAL_KEYS)) {
    if (hay.includes(needle)) return THERMAL_KEYS[needle]
  }
  return null
}

/**
 * Normalise thermal readings. Input: [{ type, label?, source?, milliCelsius }]
 * from /sys/class/thermal/thermal_zone* and /sys/class/hwmon/hwmon*.
 * Unreadable or implausible values are dropped; exact duplicates (a chip
 * exposed by both thermal_zone and hwmon) collapse into one entry.
 */
export function normalizeThermal(readings) {
  const out = []
  const seen = new Set()
  for (const r of readings || []) {
    const v = Number(r && r.milliCelsius)
    if (!Number.isFinite(v) || v <= -40000 || v >= 150000) continue
    const type = String((r && r.type) || 'zone')
    const label = r && r.label ? String(r.label) : null
    const key = thermalKey(type, label)
    const name = label || type
    const celsius = Math.round(v / 100) / 10
    const dedup = name + '|' + celsius
    if (seen.has(dedup)) continue
    seen.add(dedup)
    out.push({ key, name, type, label, source: (r && r.source) || 'thermal', celsius })
  }
  return out
}

/**
 * Parse the swap paging counters (pswpin / pswpout, in pages) from /proc/vmstat.
 * Returns {} when the file is absent or has neither counter.
 */
export function parseVmstat(text) {
  const out = {}
  if (!text) return out
  for (const line of String(text).split('\n')) {
    const m = line.match(/^(pswpin|pswpout)\s+(\d+)/)
    if (m) out[m[1]] = Number(m[2])
  }
  return out
}

/** Byte rate from two cumulative page counters; null without a usable interval. */
export function pageRate(prevPages, curPages, dtSec, pageBytes = 4096) {
  if (prevPages == null || curPages == null || !(dtSec > 0)) return null
  const d = curPages - prevPages
  return d < 0 ? 0 : (d * pageBytes) / dtSec
}

/**
 * df-style usage percent: used / (used + available), NOT used / total — ext4
 * reserves blocks for root, so used/total under-reports what df prints.
 */
export function dfUsagePercent(used, avail) {
  const u = Number(used) || 0
  const denom = u + (Number(avail) || 0)
  if (!(denom > 0)) return 0
  return Math.round((u / denom) * 1000) / 10
}

/** Fixed-size ring buffer of { t, ...fields } samples, oldest dropped first. */
export class SampleRing {
  constructor(maxSamples) {
    this.max = Math.max(1, maxSamples | 0)
    this.items = []
  }
  push(sample) {
    this.items.push(sample)
    if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max)
  }
  /** Samples whose timestamp is within the last sinceSeconds (capped by capacity). */
  since(sinceSeconds, nowMs = Date.now()) {
    const cutoff = nowMs - Math.max(0, sinceSeconds) * 1000
    return this.items.filter((s) => s.t >= cutoff)
  }
  get size() { return this.items.length }
}
