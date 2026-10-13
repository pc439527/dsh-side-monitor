import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseProcStatCpus, cpuPercent, isWholeDisk, parseDiskstats, rateBetween,
  parseLoadavgTasks, normalizeThermal, SampleRing,
} from '../lib/metrics.js'

const STAT = [
  'cpu  100 0 50 800 50 0 0 0 0 0',
  'cpu0 50 0 25 400 25 0 0 0 0 0',
  'cpu1 50 0 25 400 25 0 0 0 0 0',
  'intr 1 2 3',
  'procs_running 3',
  'procs_blocked 1',
].join('\n')

test('parseProcStatCpus: per-core rows, iowait counts as idle, procs counters', () => {
  const r = parseProcStatCpus(STAT)
  assert.equal(r.cpus.length, 2)
  assert.deepEqual(r.cpus[0], { index: 0, total: 500, idle: 425 })
  assert.equal(r.procsRunning, 3)
  assert.equal(r.procsBlocked, 1)
})

test('parseProcStatCpus: empty input is safe', () => {
  assert.deepEqual(parseProcStatCpus(null), { cpus: [], procsRunning: null, procsBlocked: null })
})

test('cpuPercent: utilisation between samples, clamped, null without prev', () => {
  assert.equal(cpuPercent(null, { total: 10, idle: 5 }), null)
  assert.equal(cpuPercent({ total: 100, idle: 50 }, { total: 200, idle: 100 }), 50)
  assert.equal(cpuPercent({ total: 100, idle: 50 }, { total: 100, idle: 50 }), 0)
})

test('isWholeDisk: physical disks yes, partitions/virtual devices no', () => {
  for (const n of ['sda', 'vdb', 'nvme0n1', 'mmcblk0', 'xvda']) assert.equal(isWholeDisk(n), true, n)
  for (const n of ['sda1', 'nvme0n1p1', 'loop0', 'ram0', 'dm-0', 'md127', 'sr0', 'mmcblk0p1']) assert.equal(isWholeDisk(n), false, n)
})

test('parseDiskstats: sectors converted to bytes, whole disks only', () => {
  const text = [
    '   8  0 sda 10 0 2000 5 20 0 4000 9 0 0 0',
    '   8  1 sda1 1 0 8 0 1 0 8 0 0 0 0',
    '   7  0 loop0 1 0 8 0 1 0 8 0 0 0 0',
  ].join('\n')
  const m = parseDiskstats(text)
  assert.deepEqual([...m.keys()], ['sda'])
  assert.deepEqual(m.get('sda'), { readBytes: 2000 * 512, writeBytes: 4000 * 512 })
})

test('rateBetween: bytes/sec, counter reset yields 0, missing interval yields null', () => {
  assert.equal(rateBetween(1000, 3000, 2), 1000)
  assert.equal(rateBetween(5000, 100, 2), 0)
  assert.equal(rateBetween(1000, 3000, 0), null)
  assert.equal(rateBetween(null, 3000, 2), null)
})

test('parseLoadavgTasks: running/total from 4th field', () => {
  assert.deepEqual(parseLoadavgTasks('0.61 0.42 0.35 2/100 3456\n'), { running: 2, total: 100 })
  assert.deepEqual(parseLoadavgTasks('garbage'), { running: null, total: null })
})

test('normalizeThermal: milli-celsius to celsius, implausible dropped', () => {
  const r = normalizeThermal([
    { type: 'x86_pkg_temp', milliCelsius: 45250 },
    { type: 'broken', milliCelsius: NaN },
    { type: 'hot', milliCelsius: 200000 },
  ])
  assert.deepEqual(r, [{ name: 'x86_pkg_temp', celsius: 45.3 }])
})

test('SampleRing: bounded, since() filters by age', () => {
  const ring = new SampleRing(3)
  for (let i = 0; i < 5; i++) ring.push({ t: 1000 * i, v: i })
  assert.equal(ring.size, 3)
  assert.deepEqual(ring.items.map((s) => s.v), [2, 3, 4])
  assert.deepEqual(ring.since(1, 4000).map((s) => s.v), [3, 4])
})
