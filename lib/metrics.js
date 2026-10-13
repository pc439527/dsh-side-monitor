/**
 * dsh-side-monitor — pure metric parsers and sample helpers (v0.6).
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
 * Normalise thermal readings. Input: [{ type, milliCelsius }] as read from
 * /sys/class/thermal/thermal_zone*. Unreadable or implausible values are dropped.
 */
export function normalizeThermal(readings) {
  const out = []
  for (const r of readings || []) {
    const v = Number(r && r.milliCelsius)
    if (!Number.isFinite(v) || v <= -40000 || v >= 150000) continue
    out.push({ name: String((r && r.type) || 'zone'), celsius: Math.round(v / 100) / 10 })
  }
  return out
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
