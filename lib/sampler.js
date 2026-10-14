/**
 * dsh-side-monitor — fixed-cadence metrics sampler (v0.7).
 *
 * The rate maths in collectors.js (CPU %, per-core %, disk IO, network, swap
 * paging) is stateful: it needs the previous raw counters and the elapsed
 * interval. Doing that inside the request path made the interval depend on who
 * called overview() last — the 2 s history sampler and a browser poll
 * interleaved, so a short gap produced a noisy percentage (the 6.8% ↔ 17.7%
 * jitter). This module owns the previous snapshot and the single 2 s loop;
 * requests read the latest completed snapshot instead.
 *
 * It is pure with respect to the OS: read()/derive() are injected and the clock
 * is injectable, so it is unit-testable without fixtures or real timers.
 * @module dsh-side-monitor/sampler
 */

/**
 * @param {object} options
 * @param {() => any} options.read - read the current raw counters.
 * @param {(cur, prevRaw, dtSec, nowMs) => any} options.derive - derive the
 *   snapshot value; prevRaw is null on the first sample.
 * @param {number} [options.intervalMs=2000] - fixed cadence; 0 disables the
 *   timer so every take() samples (used by tests).
 * @param {() => number} [options.now] - injectable clock.
 */
export function createSampler(options = {}) {
  const read = options.read
  const derive = options.derive
  const intervalMs = options.intervalMs == null ? 2000 : Math.max(0, options.intervalMs | 0)
  const now = options.now || (() => Date.now())
  const listeners = new Set()
  let prev = null
  let latest = null
  let timer = null
  let sampling = false

  /** Read + derive one snapshot, advancing the previous-state cursor. */
  function sample() {
    if (typeof read !== 'function' || typeof derive !== 'function') return latest
    if (sampling) return latest
    sampling = true
    try {
      const raw = read()
      const t = now()
      const dtSec = prev ? (t - prev.t) / 1000 : 0
      const value = derive(raw, prev ? prev.raw : null, dtSec, t)
      if (value == null) return latest
      prev = { t, raw }
      latest = { t, value }
      for (const fn of Array.from(listeners)) {
        try { fn(latest) } catch { /* a listener error must never break sampling */ }
      }
      return latest
    } catch {
      // A missed sample is preferable to a crashed host plugin.
      return latest
    } finally {
      sampling = false
    }
  }

  /** Latest snapshot, resampled when it is older than the cadence. */
  function take() {
    if (latest && now() - latest.t < intervalMs) return latest
    return sample() || latest
  }

  /** Start the fixed-cadence loop (idempotent); returns a stop function. */
  function start() {
    if (timer || intervalMs <= 0) return stop
    timer = setInterval(() => { sample() }, intervalMs)
    if (timer.unref) timer.unref()
    return stop
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null }
  }

  /** Subscribe to completed snapshots; returns an unsubscribe function. */
  function subscribe(fn) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }

  return {
    sample,
    take,
    start,
    stop,
    subscribe,
    get latest() { return latest },
    get previous() { return prev },
    get intervalMs() { return intervalMs },
  }
}

export default createSampler
