
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createSystemCollector } from '../lib/collectors.js'

const HAS_DOCKER = existsSync('/var/run/docker.sock')

test('containers(stats) answers immediately from cache, never blocking on the daemon (v0.7)', { skip: !HAS_DOCKER && 'no docker socket' }, async () => {
  const c = createSystemCollector({})
  try {
    const t0 = Date.now()
    const res = await c.containers(true)
    const ms = Date.now() - t0
    // The old path awaited one-shot stats for every container (>10 s with 26).
    assert.ok(ms < 3000, 'cold stats request must be cache-fast, took ' + ms + 'ms')
    assert.equal(res.available, true)
    if (res.available) {
      assert.ok(Array.isArray(res.containers))
      assert.equal(res.statsRequested, true)
      // statsAgeMs is null until the background refresh lands; then a number.
      assert.ok(res.statsAgeMs === null || typeof res.statsAgeMs === 'number')
      for (const row of res.containers) {
        assert.ok('cpuUsage' in row && 'memoryUsage' in row && 'memoryUsagePct' in row)
      }
    }
  } finally {
    c.dispose()
  }
})

test('containers(stats) fills CPU and memory from the background refresh', { skip: !HAS_DOCKER && 'no docker socket' }, async () => {
  const c = createSystemCollector({})
  try {
    await c.containers(true)
    let snap = null
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      snap = await c.containers(true)
      if (snap.containers.some((x) => x.cpuUsage != null)) break
    }
    const withCpu = snap.containers.filter((x) => x.cpuUsage != null)
    const withMem = snap.containers.filter((x) => x.memoryUsage != null)
    assert.ok(withCpu.length > 0, 'CPU% must populate from the background refresh')
    assert.equal(withMem.length, withCpu.length, 'memory populates alongside CPU')
    assert.ok(typeof snap.statsAgeMs === 'number' && snap.statsAgeMs >= 0)
    for (const row of withCpu) {
      assert.ok(row.cpuUsage >= 0 && row.cpuUsage < 100 * 64, 'plausible CPU%: ' + row.cpuUsage)
    }
  } finally {
    c.dispose()
  }
})
