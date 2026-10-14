import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRpcHandler, historySample, startHistorySampler, ENDPOINTS, PROTOCOL_VERSION, HISTORY_MAX_SINCE_SECONDS } from '../lib/rpc.js'
import { SampleRing } from '../lib/metrics.js'

test('protocol v4 and the new endpoints are declared', () => {
  assert.equal(PROTOCOL_VERSION, 4)
  assert.equal(ENDPOINTS.history, 'history')
  assert.equal(ENDPOINTS.dockerInfo, 'dockerInfo')
})

test('history endpoint returns samples within the requested window, clamped to the maximum', async () => {
  const ring = new SampleRing(10)
  const now = Date.now()
  ring.push({ t: now - 700_000, cpu: 1 })
  ring.push({ t: now - 30_000, cpu: 2 })
  ring.push({ t: now - 1_000, cpu: 3 })
  const handler = createRpcHandler({}, ring)
  const r = await handler('history', { sinceSeconds: 60 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.samples.map((s) => s.cpu), [2, 3])
  const all = await handler('history', {})
  assert.equal(all.value.sinceSeconds, HISTORY_MAX_SINCE_SECONDS)
  const huge = await handler('history', { sinceSeconds: 99999 })
  assert.equal(huge.value.sinceSeconds, HISTORY_MAX_SINCE_SECONDS)
})

test('dockerInfo endpoint delegates to the collector and wraps the result', async () => {
  const handler = createRpcHandler({ dockerInfo: async () => ({ available: false, reason: 'no-socket' }) })
  const r = await handler('dockerInfo', {})
  assert.deepEqual(r, { ok: true, value: { available: false, reason: 'no-socket' } })
})

test('historySample maps the primary interface and disk IO; missing fields stay null', () => {
  const s = historySample({
    cpuUsage: 12.5, memoryUsage: 40, swap: { usage: 3 }, load1: 0.5,
    network: { interfaces: [
      { name: 'eth0', primary: true, rxBytesPerSec: 100, txBytesPerSec: 50 },
      { name: 'docker0', primary: false, rxBytesPerSec: 999, txBytesPerSec: 999 },
    ] },
    diskIo: { readBytesPerSec: 7, writeBytesPerSec: 8 },
  }, 42)
  assert.deepEqual(s, { t: 42, cpu: 12.5, mem: 40, swap: 3, load1: 0.5, netRx: 100, netTx: 50, diskRead: 7, diskWrite: 8 })
  const empty = historySample({ network: { interfaces: [] } }, 1)
  assert.equal(empty.netRx, null)
  assert.equal(empty.diskRead, null)
  assert.equal(empty.swap, null)
})

test('history is fed by the collector sampler subscription when available (v0.7)', async () => {
  const ring = new SampleRing(10)
  let listener = null
  let unsubscribed = false
  const collector = { subscribeMetrics(fn) { listener = fn; return () => { unsubscribed = true } } }
  const stop = startHistorySampler(collector, ring)
  listener({ cpuUsage: 12, memoryUsage: 40, network: { interfaces: [] } })
  assert.equal(ring.size, 1)
  assert.equal(ring.items[0].cpu, 12)
  stop()
  assert.equal(unsubscribed, true)
})
