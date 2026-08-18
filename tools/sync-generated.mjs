#!/usr/bin/env node
/**
 * sync-generated.mjs — regenerate the generated parts of lib/client.js and
 * verify there is no drift (v0.3.0).
 *
 *   1. CLIENT_VERSION  <- package.json version   (client version auto-sync)
 *   2. inline i18n dictionary + t() infrastructure <- lib/i18n.js
 *   3. i18n lint: t() results must NEVER be spliced with string concatenation
 *      — every sentence is a message with {placeholders}.
 *
 * Usage:
 *   node tools/sync-generated.mjs            # write (sync)
 *   node tools/sync-generated.mjs --check    # verify only; exit 1 on drift/lint
 *
 * Order matters: the literal-replacement pass runs FIRST, then the i18n
 * infrastructure (with the raw JSON dictionaries) is injected — so the map
 * never touches the injected dictionary. The MESSAGES line is then
 * force-regenerated from lib/i18n.js (self-healing).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { messages } from '../lib/i18n.js'

const CLIENT = new URL('../lib/client.js', import.meta.url).pathname
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const VERSION = PKG.version

// ---- 1. literal map (exact quoted zh literal -> message key) ----------------
// Replaces any raw zh string that sneaks back into client.js with a t() call.
// Entries whose literal is absent are no-ops (kept as a safety net).
const MAP = [
  ['"系统监控"', 'monitorTitle'],
  ['"立即刷新"', 'refreshNow'],
  ['"更多"', 'more'],
  ['"关闭"', 'close'],
  ['"拖动调整宽度"', 'dragResize'],
  ['"点击查看采集来源"', 'clickViewSources'],
  ['"查看采集来源"', 'viewDataSources'],
  ['"复制诊断信息"', 'copyDiagnostics'],
  ['"关于"', 'about'],
  ['"语言"', 'language'],
  ['"设置 (v0.3)"', 'settingsV03'],
  ['"设置将在 v0.3 提供"', 'settingsInV03'],
  ['"加载中…"', 'loading'],
  ['"未知错误"', 'unknownError'],
  ['"连接服务不可用"', 'connectionUnavailable'],
  ['"实时"', 'live'],
  ['"等待首次数据…"', 'waitingFirstData'],
  ['"概览"', 'overview'],
  ['"进程"', 'processes'],
  ['"CPU 使用率"', 'cpuUsage'],
  ['"内存使用率"', 'memoryUsage'],
  ['"下行"', 'download'],
  ['"上行"', 'upload'],
  ['"磁盘"', 'disk'],
  ['"无法获取磁盘信息"', 'noDiskInfo'],
  ['"系统负载"', 'systemLoad'],
  ['"系统信息"', 'systemInfo'],
  ['"操作系统"', 'operatingSystem'],
  ['"内核"', 'kernel'],
  ['"主机名"', 'hostname'],
  ['"物理核心"', 'physicalCores'],
  ['"逻辑 CPU"', 'logicalCpu'],
  ['"架构"', 'architecture'],
  ['"总内存"', 'totalMemory'],
  ['"磁盘分区"', 'diskPartitions'],
  ['"网络接口"', 'networkInterfaces'],
  ['"Docker 容器"', 'dockerContainers'],
  ['"Docker 不可用（未检测到 /var/run/docker.sock）"', 'dockerUnavailableSock'],
  ['"总数"', 'total'],
  ['"运行"', 'running'],
  ['"异常"', 'issues'],
  ['"接口"', 'iface'],
  ['"主"', 'primary'],
  ['"虚拟"', 'virtual'],
  ['"宿主机"', 'host'],
  ['"当前容器"', 'currentContainer'],
  ['"未知"', 'unknown'],
  ['"搜索进程 / 命令 / 用户…"', 'searchProcess'],
  ['"内存"', 'mem'],
  ['"名称"', 'name'],
  ['"列表"', 'list'],
  ['"聚合"', 'grouped'],
  ['"按聚合 CPU 排序"', 'byAggregatedCpu'],
  ['"加载更多"', 'loadMore'],
  ['"用户"', 'user'],
  ['"命令"', 'command'],
  ['"运行时长"', 'uptimeLabel'],
  ['"搜索容器 / 镜像 / 端口…"', 'searchContainer'],
  ['"容器"', 'container'],
  ['"状态"', 'status'],
  ['"端口"', 'ports'],
  ['"无端口映射"', 'noPortMappings'],
  ['"仅宿主机"', 'hostOnly'],
  ['"复制失败"', 'copyFailed'],
  ['"已复制地址"', 'copiedAddr'],
  ['"已复制诊断信息"', 'copiedDiagnostics'],
  ['"HTTP 打开"', 'httpOpen'],
  ['"HTTPS 打开"', 'httpsOpen'],
  ['"复制地址"', 'copyAddress'],
  ['"复制地址（宿主机本地）"', 'copyAddressHostLocal'],
  ['"未发布到宿主机，仅容器内可用"', 'notPublishedToast'],
  ['"仅宿主机本地可用"', 'hostLocalToast'],
  ['"运行中"', 'runningState'],
  ['"已暂停"', 'pausedState'],
  ['"已停止"', 'stoppedState'],
  ['"已退出"', 'exitedState'],
  ['"已创建"', 'createdState'],
  ['"重启中"', 'restartingState'],
  ['"采集来源"', 'dataSources'],
  ['"运行环境"', 'runtime'],
  ['"负载 / 运行时长"', 'loadUptime'],
  ['"CPU 核心 / 型号"', 'cpuCoresModel'],
  ['"内核版本"', 'kernelVersion'],
  ['"⚠ 一致性自检"', 'consistencyCheck'],
  ['"不可用"', 'unavailable'],
  ['"⚠ 版本不一致"', 'versionMismatchHead'],
]

// ---- i18n lint: t() results must never be concatenated ----------------------
// Catches  t("key") + ...   and   ... + t("key")   (with or without a vars arg).
const LINT_RES = [
  /t\(\s*["'][^"']*["'](?:\s*,\s*\{[^}]*\})?\s*\)\s*\+/,
  /\+\s*t\(\s*["'][^"']*["']/,
]

/** Regenerate the generated parts of client.js source. */
export function generate(src) {
  // 1. literal replacements (raw zh -> t() calls)
  for (const [lit, key] of MAP) {
    src = src.split(lit).join('t("' + key + '")')
  }
  // 2. inject infrastructure (AFTER the map — the JSON stays raw)
  const anchor = '    var exports = module.exports;'
  if (!src.includes(anchor)) throw new Error('infra anchor not found')
  if (!src.includes('function t(key, vars)')) {
    const infra = [
      '',
      '        // ---- i18n (v0.3.0) — generated from lib/i18n.js by tools/sync-generated.mjs',
      '        var LANG_KEY = "dsh-side-monitor:language";',
      '        var LANG_ZH = "zh-CN";',
      '        var LANG_EN = "en-US";',
      '        var MESSAGES = ' + JSON.stringify(messages) + ';',
      '        var langListeners = [];',
      '        var currentLang = (function () {',
      '          try { var v = localStorage.getItem(LANG_KEY); return v === LANG_EN ? LANG_EN : LANG_ZH } catch (e) { return LANG_ZH }',
      '        })();',
      '        function t(key, vars) {',
      '          var text = (MESSAGES[currentLang] && MESSAGES[currentLang][key]) || (MESSAGES[LANG_ZH] && MESSAGES[LANG_ZH][key]) || key;',
      '          if (vars) { for (var k in vars) text = text.split("{" + k + "}").join(String(vars[k])); }',
      '          return text;',
      '        }',
      '        function setLang(l) {',
      '          if (l !== LANG_ZH && l !== LANG_EN) return;',
      '          currentLang = l;',
      '          try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* storage unavailable */ }',
      '          for (var i = 0; i < langListeners.length; i++) langListeners[i]();',
      '        }',
      '        function useLangTick() {',
      '          return React.useSyncExternalStore(',
      '            function (cb) { langListeners.push(cb); return function () { var i = langListeners.indexOf(cb); if (i >= 0) langListeners.splice(i, 1); }; },',
      '            function () { return currentLang; }',
      '          );',
      '        }',
      '',
    ].join('\n')
    src = src.replace(anchor, anchor + '\n' + infra)
  }
  // 3. force-regenerate the inline dictionary (self-healing)
  const jsonLine = '        var MESSAGES = ' + JSON.stringify(messages) + ';'
  src = src.replace(/^\s*var MESSAGES = \{.+?\};\n/m, jsonLine + '\n')
  // 4. client version auto-sync from package.json
  if (!/var CLIENT_VERSION = "[^"]*";/.test(src)) throw new Error('CLIENT_VERSION anchor not found')
  src = src.replace(/var CLIENT_VERSION = "[^"]*";/, 'var CLIENT_VERSION = "' + VERSION + '";')
  return src
}

/** Find lines where a t() call is spliced with string concatenation. */
export function lint(src) {
  const hits = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const re of LINT_RES) {
      if (re.test(lines[i])) { hits.push((i + 1) + ': ' + lines[i].trim()); break }
    }
  }
  return hits
}

const check = process.argv.includes('--check')
const src = readFileSync(CLIENT, 'utf8')
const want = generate(src)
const violations = lint(src)
let failed = false

if (violations.length) {
  console.error('I18N LINT: t() results must not be spliced with + — use message placeholders:')
  for (const v of violations) console.error('  lib/client.js:' + v)
}

if (check) {
  if (src !== want) {
    failed = true
    console.error('DRIFT: lib/client.js generated parts are out of sync (client version and/or i18n).')
    console.error('Run: node tools/sync-generated.mjs')
  }
  if (failed) process.exit(1)
  console.log('ok: client version ' + VERSION + ' + i18n in sync, no concatenation violations')
} else {
  if (violations.length) {
    console.error('I18N LINT: fix the concatenations first, then re-run sync (file left untouched).')
    process.exit(1)
  }
  writeFileSync(CLIENT, want)
  console.log('synced lib/client.js: CLIENT_VERSION -> ' + VERSION + ', i18n dictionary, literals')
}
