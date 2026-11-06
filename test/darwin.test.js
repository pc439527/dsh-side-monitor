/**
 * macOS (Darwin) provider tests — real command output shapes, no Mac required.
 * The provider accepts an injected command runner, so every parser and the
 * collector integration run against canned snapshots in CI.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDf, selectDarwinDisks, parseVmStat, parseSwapusage, parsePs, parseElapsed, parseNetstat, parseDefaultRoute, createDarwinProvider } from '../lib/darwin.js'
import { createSystemCollector } from '../lib/collectors.js'

const DF = [
  'Filesystem     1024-blocks      Used Available Capacity iused     ifree %iused  Mounted on',
  '/dev/disk3s1s1   482746452  13619088  28428160    33%  490464 284281600    0%   /',
  'devfs                  221       221         0   100%     766         0  100%   /dev',
  '/dev/disk3s6     482746452   4194336  28428160    13%       4 284281600    0%   /System/Volumes/VM',
  '/dev/disk3s2     482746452  11279428  28428160    29%    1084 284281600    0%   /System/Volumes/Preboot',
  '/dev/disk3s5     482746452 423045152  28427012    94% 3176338 284270120    1%   /System/Volumes/Data',
  'map auto_home            0         0         0   100%       0         0     -   /System/Volumes/Data/home',
  '/dev/disk3s3     482746452   1946648  28427012     7%      86 284270120    0%   /Volumes/Recovery',
].join('\n')

const VM_STAT = [
  'Mach Virtual Memory Statistics: (page size of 16384 bytes)',
  'Pages free:                                    18647.',
  'Pages active:                                 526801.',
  'Pages inactive:                               524572.',
  'Pages speculative:                               875.',
  'Pages throttled:                                   0.',
  'Pages wired down:                             245481.',
  'Pages purgeable:                                7665.',
  '"Translation faults":                      430434827.',
].join('\n')

const PS = [
  '    1     0 root               0.2  0.1  23552 02-21:30:52 Ss   /sbin/launchd',
  '  619     1 _windowserver     45.0  0.4 105856 02-21:29:58 Rs   /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon',
  '21821 21806 kinder            20.9  5.4 1359088 13:34 S    /Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness',
].join('\n')

const NETSTAT = [
  'Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll',
  'lo0        16384 <Link#1>                      12761960     0 7545710312 12761960     0 7545710312     0',
  'lo0        16384 127           localhost       12761960     - 7545710312 12761960     - 7545710312     -',
  'en0        1500 <Link#7>    bc:74:ea:b4:f8:cd 18782725     0 19117745844 15712844     0 3969145455     0',
  'en0        1500  192.168.5     192.168.5.60    18782725     - 19117745844 15712844     - 3969145455     -',
  'bridge0    1500 <Link#11>   16:5c:0d:a1:6e:00     0     0          0        0     0          0     0',
].join('\n')

test('parseDf + selectDarwinDisks: APFS container becomes one "/" row', () => {
  const rows = parseDf(DF)
  // `map auto_home` has no numeric %iused column and is skipped by parseDf.
  assert.equal(rows.length, 6)
  assert.equal(rows[0].mount, '/')
  const disks = selectDarwinDisks(rows)
  const root = disks.find((d) => d.mount === '/')
  assert.ok(root, 'root row present')
  // Data volume numbers win: 423045152 + 28427012 KiB
  assert.equal(root.total, (423045152 + 28427012) * 1024)
  assert.equal(root.used, 423045152 * 1024)
  assert.ok(root.usage > 90 && root.usage < 100)
  // No /System/Volumes/* rows leak into the panel.
  assert.equal(disks.some((d) => d.mount.startsWith('/System/Volumes/')), false)
})

test('parseDf handles mount points containing spaces', () => {
  const rows = parseDf([
    'Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on',
    '/dev/disk4s1 1000 400 600 40% 1 1 0% /Volumes/My Disk',
  ].join('\n'))
  assert.equal(rows[0].mount, '/Volumes/My Disk')
  assert.equal(rows[0].usedKb, 400)
})

test('parseVmStat: page counts become bytes, available is reclaimable', () => {
  const m = parseVmStat(VM_STAT)
  assert.equal(m.pageSize, 16384)
  assert.equal(m.free, 18647 * 16384)
  assert.equal(m.active, 526801 * 16384)
  assert.equal(m.wired, 245481 * 16384)
  assert.equal(m.cached, (524572 + 7665) * 16384)
  assert.equal(m.available, (18647 + 524572 + 875 + 7665) * 16384)
})

test('parseSwapusage: M/K/G suffix to bytes', () => {
  const s = parseSwapusage('total = 3072.00M  used = 2071.38M  free = 1000.62M  (encrypted)')
  assert.equal(s.total, Math.round(3072 * 1024 * 1024))
  assert.equal(s.used, Math.round(2071.38 * 1024 * 1024))
  assert.equal(parseSwapusage(''), null)
})

test('parsePs: etime, rss KiB -> bytes, runnable from state', () => {
  const rows = parsePs(PS)
  assert.equal(rows.length, 3)
  const win = rows[1]
  assert.equal(win.pid, 619)
  assert.equal(win.user, '_windowserver')
  assert.equal(win.rssBytes, 105856 * 1024)
  assert.equal(win.name, 'WindowServer')
  assert.equal(win.runnable, true)
  assert.equal(rows[0].elapsedSeconds, 2 * 86400 + 21 * 3600 + 30 * 60 + 52)
})

test('parseElapsed: D-HH:MM:SS / HH:MM:SS / MM:SS', () => {
  assert.equal(parseElapsed('02-21:30:52'), 2 * 86400 + 21 * 3600 + 30 * 60 + 52)
  assert.equal(parseElapsed('1:02:03'), 3723)
  assert.equal(parseElapsed('00:05'), 5)
})

test('parseNetstat: only <Link#> rows carry counters; no duplicates', () => {
  const n = parseNetstat(NETSTAT)
  assert.deepEqual(n.lo0, { rx: 7545710312, tx: 7545710312 })
  assert.deepEqual(n.en0, { rx: 19117745844, tx: 3969145455 })
  assert.deepEqual(n.bridge0, { rx: 0, tx: 0 })
})

test('parseDefaultRoute: reads the interface line', () => {
  assert.equal(parseDefaultRoute('   route to: default\ndestination: default\n  interface: en0\n'), 'en0')
  assert.equal(parseDefaultRoute(''), null)
})

test('darwin provider: injected runner produces the expected shapes', () => {
  const table = {
    'sysctl -n hw.memsize hw.physicalcpu hw.logicalcpu machdep.cpu.brand_string': '25769803776\n15\n15\nApple M5 Pro\n',
    'vm_stat': VM_STAT,
    'sysctl -n vm.swapusage': 'total = 3072.00M  used = 2071.38M  free = 1000.62M',
    'df -k': DF,
    'ps -A -o pid=,ppid=,user=,%cpu=,%mem=,rss=,etime=,state=,command=': PS,
    'netstat -ib': NETSTAT,
    'route -n get default': '   route to: default\n  interface: en0\n',
    'sysctl -n kern.num_threads': '30720\n',
    'ps -A -o state=': 'Ss\nRs\nS\n',
    'sw_vers': 'ProductName:\tmacOS\nProductVersion:\t27.3\nBuildVersion:\t26C5035r\n',
  }
  const exec = (bin, args) => table[(bin + ' ' + (args || []).join(' ')).trim()] ?? ''
  const p = createDarwinProvider(exec)
  assert.equal(p.cpuInfo().model, 'Apple M5 Pro')
  assert.equal(p.cpuInfo().logical, 15)
  assert.equal(p.memory().total, 25769803776)
  assert.equal(p.swap().used, Math.round(2071.38 * 1024 * 1024))
  assert.equal(p.disks()[0].mount, '/')
  assert.equal(p.processes().length, 3)
  assert.equal(p.network().counters.en0.rx, 19117745844)
  assert.equal(p.network().defaultIface, 'en0')
  assert.deepEqual(p.taskCounts(), { threadCount: 30720, runnableCount: 1 })
  assert.equal(p.osName(), 'macOS 27.3')
  assert.deepEqual(p.temperatures(), [])
})

test('collector on darwin: overview/processes/meta use the native provider', async () => {
  const table = {
    'sysctl -n hw.memsize hw.physicalcpu hw.logicalcpu machdep.cpu.brand_string': '25769803776\n15\n15\nApple M5 Pro\n',
    'vm_stat': VM_STAT,
    'sysctl -n vm.swapusage': 'total = 3072.00M  used = 2071.38M  free = 1000.62M',
    'df -k': DF,
    'ps -A -o pid=,ppid=,user=,%cpu=,%mem=,rss=,etime=,state=,command=': PS,
    'netstat -ib': NETSTAT,
    'route -n get default': '   route to: default\n  interface: en0\n',
    'sysctl -n kern.num_threads': '30720\n',
    'ps -A -o state=': 'Ss\nRs\nS\n',
    'sw_vers': 'ProductName:\tmacOS\nProductVersion:\t27.3\n',
  }
  const exec = (bin, args) => table[(bin + ' ' + (args || []).join(' ')).trim()] ?? ''
  const c = createSystemCollector({ platform: 'darwin', darwinProvider: createDarwinProvider(exec) })
  const o1 = await c.overview()
  assert.equal(o1.environment.mode, 'host')
  assert.equal(o1.cpuModel, 'Apple M5 Pro')
  assert.equal(o1.cpuCores, 15)
  assert.equal(o1.cpuUsage, null, 'first sample is unknown, never a fake zero')
  assert.ok(o1.memoryUsage > 0 && o1.memoryUsage < 100)
  assert.ok(o1.diskUsage > 0)
  assert.equal(o1.disks.length, 1)
  assert.equal(o1.osName, 'macOS 27.3')
  assert.equal(o1.network.primary, 'en0')
  assert.equal(o1.swap.total, Math.round(3072 * 1024 * 1024))
  assert.equal(o1.threadCount, 30720)
  assert.equal(o1.diskIo, null, 'macOS has no read/write split')
  assert.equal(o1.temperatures.length, 0)

  const o2 = await c.overview()
  assert.equal(typeof o2.cpuUsage, 'number')

  const p = c.processes({ limit: 10 })
  assert.equal(p.total, 3)
  assert.equal(p.source, 'host')

  const meta = c.metaInfo()
  assert.equal(meta.capabilities.swap, true)
  assert.equal(meta.capabilities.perCpu, true)
  assert.equal(meta.capabilities.diskIo, false)
  assert.equal(meta.capabilities.temperature, false)
  assert.equal(meta.status.systemSource, 'host')
  assert.equal(meta.status.consistency.ok, true)
})
