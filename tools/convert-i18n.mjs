/**
 * convert-i18n.mjs — regenerate the client-side i18n layer of lib/client.js.
 *
 * Order matters: the literal-replacement pass runs FIRST, then the i18n
 * infrastructure (with the raw JSON dictionaries) is injected — so the map
 * never touches the injected dictionary.
 *
 * Run from the repo root:  node tools/convert-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { messages } from '../lib/i18n.js'

const CLIENT = new URL('../lib/client.js', import.meta.url).pathname
let src = readFileSync(CLIENT, 'utf8')

// ---- 1. literal map (exact quoted literal -> message key) ------------------
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
  ['"无法获取数据："', 'cannotFetch'],
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
  ['"接收"', 'receive'],
  ['"发送"', 'send'],
  ['"主"', 'primary'],
  ['"虚拟"', 'virtual'],
  ['"来源："', 'sourcePrefix'],
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

let replaced = 0
const missing = []
for (const [lit, key] of MAP) {
  const before = src.split(lit).length - 1
  if (before === 0) { missing.push(key + ' (' + lit + ')'); continue }
  src = src.split(lit).join('t("' + key + '")')
  replaced += before
}

// ---- 2. inject infrastructure (AFTER the map — the JSON stays raw) --------
const anchor = '    var exports = module.exports;'
if (!src.includes(anchor)) throw new Error('infra anchor not found')
if (!src.includes('function t(key, vars)')) {
  const infra = `
        // ---- i18n (v0.2.3) — generated from lib/i18n.js by tools/convert-i18n.mjs
        var LANG_KEY = "dsh-side-monitor:language";
        var LANG_ZH = "zh-CN";
        var LANG_EN = "en-US";
        var MESSAGES = ${JSON.stringify(messages)};
        var langListeners = [];
        var currentLang = (function () {
          try { var v = localStorage.getItem(LANG_KEY); return v === LANG_EN ? LANG_EN : LANG_ZH } catch (e) { return LANG_ZH }
        })();
        function t(key, vars) {
          var text = (MESSAGES[currentLang] && MESSAGES[currentLang][key]) || (MESSAGES[LANG_ZH] && MESSAGES[LANG_ZH][key]) || key;
          if (vars) { for (var k in vars) text = text.split("{" + k + "}").join(String(vars[k])); }
          return text;
        }
        function setLang(l) {
          if (l !== LANG_ZH && l !== LANG_EN) return;
          currentLang = l;
          try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* storage unavailable */ }
          for (var i = 0; i < langListeners.length; i++) langListeners[i]();
        }
        function useLangTick() {
          return React.useSyncExternalStore(
            function (cb) { langListeners.push(cb); return function () { var i = langListeners.indexOf(cb); if (i >= 0) langListeners.splice(i, 1); }; },
            function () { return currentLang; }
          );
        }
`;
  src = src.replace(anchor, anchor + '\n' + infra)
}


// ---- 4. force-regenerate the inline dictionary (self-healing: the map may
// touch raw JSON values on re-runs, so always rebuild the line from i18n.js)
const jsonLine = '        var MESSAGES = ' + JSON.stringify(messages) + ';'
src = src.replace(/^\s*var MESSAGES = \{.+?\};\n/m, jsonLine + '\n')

writeFileSync(CLIENT, src)
console.log('replaced literals:', replaced)
console.log('missing:', missing.length ? missing.join(', ') : '(none)')
