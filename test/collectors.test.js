import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createSystemCollector, parseCpuInfo } from '../lib/collectors.js'

const FIXTURE = fileURLToPath(new URL('./fixtures/proc/', import.meta.url))

// ---- pure parser fixtures ------------------------------------------------

const INTEL_HT = [
  'processor\t: 0', 'model name\t: Intel(R) Core(TM) i5-6200U CPU @ 2.30GHz',
  'physical id\t: 0', 'core id\t\t: 0', 'cpu MHz\t\t: 2400.000', '',
  'processor\t: 1', 'physical id\t: 0', 'core id\t\t: 0', '',
  'processor\t: 2', 'physical id\t: 0', 'core id\t\t: 1', '',
  'processor\t: 3', 'physical id\t: 0', 'core id\t\t: 1', '',
].join('\n')

const ARM = Array.from({ length: 8 }, (_, i) => 'processor\t: ' + i).join('\n') + '\nmodel name\t: ARMv8 Processor\n'

test('parseCpuInfo: Intel HT = 2 physical / 4 logical', () => {
  const info = parseCpuInfo(INTEL_HT)
  assert.equal(info.logical, 4)
  assert.equal(info.physical, 2)
  assert.ok(info.model.includes('i5-6200U'))
  assert.equal(info.clockMhz, 2400)
})

test('parseCpuInfo: no physical id advertised → physical null', () => {
  const info = parseCpuInfo(ARM)
  assert.equal(info.logical, 8)
  assert.equal(info.physical, null)
})

// ---- fixture proc tree (host metrics) ------------------------------------

test('overview: cpuUsage is null on first sample (unknown, not zero)', async () => {
  const c = createSystemCollector({ procRoot: FIXTURE })
  const o1 = await c.overview()
  assert.equal(o1.cpuUsage, null)
  // second call has a delta → number
  const o2 = await c.overview()
  assert.equal(typeof o2.cpuUsage, 'number')
})

test('overview: logical/physical cores parsed from fixture cpuinfo', async () => {
  const c = createSystemCollector({ procRoot: FIXTURE })
  const o = await c.overview()
  assert.equal(o.cpuCores, 4)
  assert.equal(o.physicalCores, 2)
  assert.ok(o.cpuModel.includes('i5-6200U'))
  assert.equal(o.environment.systemSource, 'host')
})

test('network: interface without IP is still listed (P0: /proc/net/dev is the source of truth)', async () => {
  const c = createSystemCollector({ procRoot: FIXTURE })
  const o = await c.overview()
  const names = o.network.interfaces.map((i) => i.name)
  assert.ok(names.includes('veth123'), 'veth123 must appear even without IP')
  assert.ok(names.includes('eth0'))
  const v = o.network.interfaces.find((i) => i.name === 'veth123')
  assert.equal(v.ip, null)
  const e = o.network.interfaces.find((i) => i.name === 'eth0')
  assert.equal(e.ip, '192.168.0.5')
  assert.equal(o.network.primary, 'eth0')
  // first sample → rates unknown (null)
  assert.equal(e.rxBytesPerSec, null)
  const o2 = await c.overview()
  const e2 = o2.network.interfaces.find((i) => i.name === 'eth0')
  assert.equal(typeof e2.rxBytesPerSec, 'number')
})

test('processes: search/sort/pagination with source + ppid', () => {
  const c = createSystemCollector({ procRoot: FIXTURE })
  const p = c.processes({ query: '', sort: 'cpu', order: 'desc', limit: 10 })
  assert.equal(p.total, 3)
  assert.equal(p.source, 'host')
  for (const row of p.processes) {
    assert.ok(Number.isInteger(row.pid))
    assert.ok(Number.isInteger(row.ppid))
  }
  const socat = p.processes.filter((r) => r.name === 'socat')
  assert.equal(socat.length, 2)
})

test('processes: aggregate groups by name+command', () => {
  const c = createSystemCollector({ procRoot: FIXTURE })
  const g = c.processes({ aggregate: true, limit: 50 })
  assert.equal(g.aggregate, true)
  const socat = g.groups.find((x) => x.name === 'socat')
  assert.ok(socat, 'socat group must exist')
  assert.equal(socat.count, 2)
  assert.deepEqual(socat.pids.slice().sort(), [2, 3])
})
