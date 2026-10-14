import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSampler } from '../lib/sampler.js'

/** Counter read + delta derive, mirroring the collector's rate maths shape. */
function counterSampler(intervalMs = 2000) {
  let clock = 0
  let value = 0
  const sampler = createSampler({
    read: () => ({ v: value }),
    derive: (cur, prev, dtSec) => ({ v: cur.v, delta: prev ? (cur.v - prev.v) / dtSec : null }),
    intervalMs,
    now: () => clock,
  })
  return {
    sampler,
    advance(ms, by = 0) { clock += ms; value += by },
    get clock() { return clock },
  }
}

test('first sample has no prev (unknown, never a fake zero)', () => {
  const s = counterSampler()
  const first = s.sampler.sample()
  assert.equal(first.value.delta, null)
  assert.equal(first.value.v, 0)
})

test('take() reuses the snapshot inside the cadence and resamples after it', () => {
  const s = counterSampler(2000)
  s.sampler.take()
  s.advance(500, 10)
  const cached = s.sampler.take()
  assert.equal(cached.value.delta, null, 'inside the cadence the snapshot is reused')
  s.advance(2000, 20)
  const fresh = s.sampler.take()
  assert.equal(fresh.value.delta, 30 / 2.5, 'delta is measured against the previous SAMPLE, not the caller')
})

test('intervalMs 0 samples on every take()', () => {
  const s = counterSampler(0)
  s.sampler.take()
  s.advance(100, 5)
  const second = s.sampler.take()
  assert.equal(second.value.delta, 5 / 0.1)
})

test('subscribe() receives completed snapshots; unsubscribe stops them', () => {
  const s = counterSampler(0)
  const seen = []
  const off = s.sampler.subscribe((snap) => seen.push(snap.value.v))
  s.advance(0, 1)
  s.sampler.sample()
  s.advance(0, 2)
  s.sampler.sample()
  off()
  s.advance(0, 3)
  s.sampler.sample()
  assert.deepEqual(seen, [1, 3])
  assert.equal(s.sampler.latest.value.v, 6)
})

test('a throwing read or derive never crashes the sampler', () => {
  let boom = false
  const sampler = createSampler({
    read: () => { if (boom) throw new Error('bad read'); return { v: 1 } },
    derive: (cur) => ({ v: cur.v }),
    intervalMs: 0,
    now: () => 0,
  })
  const first = sampler.sample()
  assert.equal(first.value.v, 1)
  boom = true
  const second = sampler.sample()
  assert.equal(second.value.v, 1, 'last good snapshot is kept')
  assert.equal(sampler.latest, second)
})

test('a throwing listener never breaks sampling', () => {
  const s = counterSampler(0)
  s.sampler.subscribe(() => { throw new Error('listener') })
  assert.doesNotThrow(() => s.sampler.sample())
  assert.equal(s.sampler.latest.value.v, 0)
})

test('start()/stop() own a single timer', () => {
  const s = counterSampler(2000)
  const stop1 = s.sampler.start()
  const stop2 = s.sampler.start()
  assert.equal(typeof stop1, 'function')
  stop1()
  stop2()
  assert.doesNotThrow(() => s.sampler.stop())
})
