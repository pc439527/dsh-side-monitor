import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSystemCollector, parseCpuInfo, parseExitCode, isIssueContainer, isStoppedContainer } from '../lib/collectors.js'
import { dfUsagePercent } from '../lib/metrics.js'

const FIXTURE = fileURLToPath(new URL('./fixtures/proc/', import.meta.url))
const FIXTURE_SYS = fileURLToPath(new URL('./fixtures/sys/', import.meta.url))

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

// ---- v0.3 docker stopped / issue semantic split ---------------------------

test('parseExitCode: extracts exit code from Docker status strings', () => {
  assert.equal(parseExitCode('Exited (0) 2 hours ago'), 0)
  assert.equal(parseExitCode('Exited (137) 5 seconds ago'), 137)
  assert.equal(parseExitCode('Up 2 hours (healthy)'), null)
  assert.equal(parseExitCode(''), null)
  assert.equal(parseExitCode(null), null)
})

test('isIssueContainer / isStoppedContainer: clean stop is NOT an issue', () => {
  // clean stop (exit 0) → stopped, never an issue
  assert.equal(isIssueContainer('exited', 'none', 0), false)
  assert.equal(isStoppedContainer('exited', 0), true)
  // non-zero exit → issue (crashed), not "stopped"
  assert.equal(isIssueContainer('exited', 'none', 137), true)
  assert.equal(isStoppedContainer('exited', 137), false)
  // crash-loop / dead / unhealthy / health-starting → issues
  assert.equal(isIssueContainer('restarting', 'none', null), true)
  assert.equal(isIssueContainer('dead', 'none', null), true)
  assert.equal(isIssueContainer('running', 'unhealthy', null), true)
  assert.equal(isIssueContainer('running', 'starting', null), true)
  // healthy running / paused / created are neither
  assert.equal(isIssueContainer('running', 'healthy', null), false)
  assert.equal(isIssueContainer('paused', 'none', null), false)
  assert.equal(isStoppedContainer('paused', null), false)
})

// ---- fixture proc tree (host metrics) ------------------------------------

test('overview: cpuUsage is null on first sample (unknown, not zero)', async () => {
  const c = createSystemCollector({ procRoot: FIXTURE, sampleIntervalMs: 0 })
  const o1 = await c.overview()
  assert.equal(o1.cpuUsage, null)
  // second call has a delta → number
  const o2 = await c.overview()
  assert.equal(typeof o2.cpuUsage, 'number')
})

test('overview: logical/physical cores parsed from fixture cpuinfo', async () => {
  const c = createSystemCollector({ procRoot: FIXTURE, sampleIntervalMs: 0 })
  const o = await c.overview()
  assert.equal(o.cpuCores, 4)
  assert.equal(o.physicalCores, 2)
  assert.ok(o.cpuModel.includes('i5-6200U'))
  assert.equal(o.environment.systemSource, 'host')
})

test('network: interface without IP is still listed (P0: /proc/net/dev is the source of truth)', async () => {
  const c = createSystemCollector({ procRoot: FIXTURE, sampleIntervalMs: 0 })
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
  const c = createSystemCollector({ procRoot: FIXTURE, sampleIntervalMs: 0 })
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
  const c = createSystemCollector({ procRoot: FIXTURE, sampleIntervalMs: 0 })
  const g = c.processes({ aggregate: true, limit: 50 })
  assert.equal(g.aggregate, true)
  const socat = g.groups.find((x) => x.name === 'socat')
  assert.ok(socat, 'socat group must exist')
  assert.equal(socat.count, 2)
  assert.deepEqual(socat.pids.slice().sort(), [2, 3])
})

test('processes: aggregate groups carry details (rssBytes + users)', () => {
  const c = createSystemCollector({ procRoot: FIXTURE, sampleIntervalMs: 0 })
  const g = c.processes({ aggregate: true, limit: 50 })
  const socat = g.groups.find((x) => x.name === 'socat')
  assert.ok(socat, 'socat group must exist')
  assert.equal(typeof socat.rssBytes, 'number')
  assert.ok(socat.rssBytes >= 0, 'rssBytes must be a non-negative number')
  assert.ok(Array.isArray(socat.users))
  assert.ok(socat.users.length >= 1, 'users must list at least the group owner')
})

test('Windows provider: overview, disks and processes return data without /proc', async () => {
  const c = createSystemCollector({
    platform: 'win32',
    windowsProvider: {
      system: () => ({ Name: 'Test CPU', NumberOfCores: 4, NumberOfLogicalProcessors: 8, MaxClockSpeed: 3200 }),
      disks: () => [{ DeviceID: 'C:', FileSystem: 'NTFS', Size: 1000, FreeSpace: 250 }],
      processes: () => [{ ProcessId: 42, ParentProcessId: 4, Name: 'test.exe', CommandLine: 'test.exe --watch', WorkingSetSize: 100, CreationDate: new Date().toISOString(), UserModeTime: 0, KernelModeTime: 0 }],
    },
  })
  const o = await c.overview()
  assert.equal(o.cpuCores, 8)
  assert.equal(o.physicalCores, 4)
  assert.equal(o.diskTotal, 1000)
  assert.equal(o.diskUsed, 750)
  assert.equal(o.environment.systemSource, 'host')
  const p = c.processes({ limit: 10 })
  assert.equal(p.total, 1)
  assert.equal(p.processes[0].name, 'test.exe')
  assert.equal(p.processes[0].ppid, 4)
})

test('data source: bare /proc + host runtime is labelled host (v0.7 fix)', async () => {
  const host = createSystemCollector({ procRoot: FIXTURE, hostMetrics: false, runtimeMode: 'host', sampleIntervalMs: 0 })
  const ho = await host.overview()
  assert.equal(ho.environment.systemSource, 'host')
  assert.equal(ho.environment.processSource, 'host')
  assert.equal(host.processes({ limit: 1 }).source, 'host')
  assert.equal(host.processes({ aggregate: true, limit: 1 }).source, 'host')

  const cont = createSystemCollector({ procRoot: FIXTURE, hostMetrics: false, runtimeMode: 'container', sampleIntervalMs: 0 })
  const co = await cont.overview()
  assert.equal(co.environment.systemSource, 'container')
  assert.equal(co.environment.processSource, 'container')
  assert.equal(cont.processes({ limit: 1 }).source, 'container')
  assert.equal(cont.metaInfo().status.systemSource, 'container')
})

test('disk: pseudo mounts filtered, avail reported, usage follows df', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsm-root-'))
  const proc = mkdtempSync(join(tmpdir(), 'dsm-proc-'))
  try {
    mkdirSync(join(root, 'data'))
    writeFileSync(join(proc, 'mounts'), [
      'sysfs /sys sysfs rw 0 0',
      'efivarfs /sys/firmware/efi/efivars efivarfs rw 0 0',
      'proc /proc proc rw 0 0',
      'devtmpfs /dev devtmpfs rw 0 0',
      'tmpfs /run tmpfs rw 0 0',
      'fuse.portal /run/user/1000/gvfs fuse.portal rw 0 0',
      '/dev/sdb1 /data ext4 rw 0 0',
    ].join('\n') + '\n')
    const c = createSystemCollector({ procRoot: proc, fsRoot: root, sampleIntervalMs: 0 })
    const o = await c.overview()
    assert.equal(o.disks.length, 1, 'only the real data mount survives: ' + JSON.stringify(o.disks))
    const data = o.disks[0]
    assert.equal(data.mount, '/data')
    assert.equal(data.filesystem, 'ext4')
    assert.equal(typeof data.avail, 'number')
    // bavail <= bfree on ext4 (reserved blocks) — avail is the df denominator.
    assert.ok(data.avail <= data.free)
    assert.ok(data.avail >= 0)
    assert.equal(data.usage, dfUsagePercent(data.used, data.avail))
    assert.equal(o.diskAvailable, true)
    assert.equal(o.diskUsage, data.usage)
    assert.ok(!o.disks.some((d) => d.mount.startsWith('/sys') || d.mount === '/proc' || d.mount === '/dev' || d.mount === '/run'))
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(proc, { recursive: true, force: true })
  }
})

test('temperatures: hwmon labels and thermal zones get friendly keys (v0.7)', async () => {
  const c = createSystemCollector({ procRoot: FIXTURE, sysRoot: FIXTURE_SYS, sampleIntervalMs: 0 })
  const o = await c.overview()
  const byName = new Map(o.temperatures.map((t) => [t.name, t]))
  assert.equal(byName.get('x86_pkg_temp').key, 'cpuPackage')
  assert.equal(byName.get('x86_pkg_temp').celsius, 45)
  assert.equal(byName.get('x86_pkg_temp').source, 'thermal')
  assert.equal(byName.get('acpitz').key, 'mainboardAcpi')
  assert.equal(byName.get('Composite').key, 'nvme')
  assert.equal(byName.get('Composite').source, 'hwmon')
  assert.equal(byName.get('Composite').celsius, 38.8)
  assert.equal(byName.get('Package id 0').key, 'cpuPackage')
  assert.equal(byName.get('Package id 0').celsius, 46)
})

test('metaInfo: fine-grained status + capabilities (v0.3)', () => {
  const c = createSystemCollector({ procRoot: FIXTURE, sampleIntervalMs: 0 })
  const m = c.metaInfo()
  assert.ok(m.status, 'status object must exist')
  assert.ok(m.status.mode === 'host' || m.status.mode === 'container')
  assert.equal(m.status.systemSource, 'host') // fixture procRoot => host metrics
  assert.equal(typeof m.status.networkProbe, 'string')
  assert.ok(m.status.consistency && Array.isArray(m.status.consistency.warnings))
  assert.ok(m.capabilities, 'capabilities object must exist')
  assert.equal(m.capabilities.hostMount, true) // fixture uses a host procRoot
  assert.equal(m.capabilities.processAggregate, true)
  assert.equal(typeof m.capabilities.dockerSocket, 'boolean')
  assert.equal(typeof m.capabilities.hostNetNsProbe, 'boolean')
})
