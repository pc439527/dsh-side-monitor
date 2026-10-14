(() => {
  // src/client/index.js
  window.__ModuleLoader__.load({
    id: "dsh-side-monitor",
    factory: function(require2) {
      "use strict";
      var module = { exports: {} };
      var exports = module.exports;
      var LANG_KEY = "dsh-side-monitor:language";
      var LANG_ZH = "zh-CN";
      var LANG_EN = "en-US";
      var MESSAGES = { "zh-CN": { "monitorTitle": "系统监控", "liveUpdated": "实时 · {ago}", "refreshNow": "立即刷新", "more": "更多", "close": "关闭", "dragResize": "拖动调整宽度", "clickViewSources": "点击查看采集来源", "refreshFailed": "数据刷新失败 · 最后成功更新 {ago}", "refreshFailedMsg": "数据刷新失败 · 最后成功更新 {ago} · {msg}", "waitingFirstData": "等待首次数据…", "sampling": "正在采样…", "dataInterrupted": "数据中断 · 最后成功更新 {ago}", "copyDiagnostics": "复制诊断信息", "viewDataSources": "查看采集来源", "about": "关于", "language": "语言", "loading": "加载中…", "cannotFetchDetail": "无法获取数据：{detail}", "unknownError": "未知错误", "updatedJustNow": "刚刚更新", "secondsAgo": "{sec} 秒前", "minutesAgo": "{n} 分前", "hoursAgo": "{n} 时前", "connectionUnavailable": "连接服务不可用", "overview": "概览", "loadAverage1": "负载 1m", "performance": "性能", "hardware": "硬件与系统", "trendTitle": "近期趋势", "historyEmpty": "历史数据采集中…（每 2 秒一个样本）", "swapUsage": "交换分区", "swapIn": "换入", "swapRateSub": "{used} · 换入 {inRate} · 换出 {outRate}", "alertDisk": "磁盘 {mount} 已用 {pct}%", "alertSwap": "交换分区 {swap}%，内存 {mem}%，内存压力偏高", "alertTemp": "{name} 温度 {celsius}°C", "alertUnhealthy": "{n} 个容器健康检查异常", "swapOut": "换出", "tempCpuPackage": "CPU 封装", "tempMainboardAcpi": "主板 ACPI", "tempNvme": "NVMe 固态", "tempDisk": "硬盘", "tempGpu": "显卡", "threads": "线程", "runnableCount": "可运行 {n}", "diskIo": "磁盘 IO", "diskRead": "读取", "diskWrite": "写入", "perCoreCpu": "每核 CPU", "minutesN": "{n} 分钟", "cpuClock": "主频", "temperature": "温度", "noTempSensor": "无温度传感器", "memBreakdown": "内存分布", "memFree": "空闲", "memBuffers": "缓冲", "memCached": "缓存", "memAvailable": "可用", "daemonInfo": "Docker 守护进程", "daemonVersion": "版本", "daemonApiVersion": "API 版本", "storageDriver": "存储驱动", "images": "镜像", "dockerDaemonUnavailable": "Docker 守护进程不可用", "notSupported": "当前平台不支持", "dockerRunningStopped": "运行 {running} · 停止 {stopped} · 暂停 {paused}", "processes": "进程", "docker": "Docker", "cpuUsage": "CPU 使用率", "memoryUsage": "内存使用率", "networkIface": "网络 · {iface}", "networkProbe": "网络探测", "download": "下行", "upload": "上行", "disk": "磁盘", "diskMount": "磁盘 · {mount}", "noDiskInfo": "无法获取磁盘信息", "systemLoad": "系统负载", "uptimeValue": "运行时间 {value}", "systemInfo": "系统信息", "operatingSystem": "操作系统", "kernel": "内核", "hostname": "主机名", "physicalCores": "物理核心", "logicalCpu": "逻辑 CPU", "architecture": "架构", "totalMemory": "总内存", "diskPartitions": "磁盘分区", "networkInterfaces": "网络接口", "dockerContainers": "Docker 容器", "total": "总数", "running": "运行", "issues": "异常", "all": "全部", "primary": "主", "virtual": "虚拟", "iface": "接口", "receive": "RX", "send": "TX", "coresThreadsLoad": "{phys} 核 / {logical} 线程 · Load {load}", "logicalCpuLoad": "{logical} 逻辑 CPU · Load {load}", "uptimeFull": "{d} 天 {hh} 时 {mm} 分", "uptimeHm": "{hh} 时 {mm} 分", "uptimeMs": "{mm} 分 {ss} 秒", "uptimeS": "{s} 秒", "dataSourceHost": "宿主数据", "dataSourceContainer": "容器数据", "runtimeContainer": "DSH 运行于容器", "runtimeHost": "DSH 运行于宿主机", "hostView": "宿主机视角", "containerView": "当前容器视角", "dockerUnavailableDetail": "Docker 不可用 · {detail}", "dockerUnavailableSock": "Docker 不可用（未检测到 /var/run/docker.sock）", "dockerSockMissing": "未检测到 /var/run/docker.sock", "sourceValue": "来源：{source}", "host": "宿主机", "currentContainer": "当前容器", "unknown": "未知", "searchProcess": "搜索进程 / 命令 / 用户…", "mem": "内存", "name": "名称", "list": "列表", "grouped": "聚合", "processesTotal": "共 {total} 个进程", "processesTotalMatched": "共 {total} 个进程 · 匹配 {matched} 个", "matchedCount": "匹配 {matched} 个", "groupsTotalMatched": "共 {total} 类 · 匹配 {matched} 个", "byAggregatedCpu": "按聚合 CPU 排序", "loadMore": "加载更多", "user": "用户", "command": "命令", "commandPrefix": "命令：", "uptimeLabel": "运行时长", "groupsCount": "{count} 个进程", "searchContainer": "搜索容器 / 镜像 / 端口…", "container": "容器", "status": "状态", "ports": "端口", "noPortMappings": "无端口映射", "hostOnly": "仅宿主机", "containerOnly": "容器内", "copiedAddr": "已复制地址", "copyFailed": "复制失败", "notPublishedToast": "未发布到宿主机，仅容器内可用", "hostLocalToast": "仅宿主机本地可用", "titleUnpublished": "未发布到宿主机（仅容器内端口），不可打开", "titleHostLocal": "仅宿主机本地（{host}:{port}），浏览器无法从外部打开", "tooltipPort": "宿主 {host}:{port} · 容器端口 {cport}/{proto}", "showingContainers": "显示 {count} 个容器", "httpOpen": "HTTP 打开", "httpsOpen": "HTTPS 打开", "copyAddress": "复制地址", "copyAddressHostLocal": "复制地址（宿主机本地）", "runningState": "运行中", "pausedState": "已暂停", "stoppedState": "已停止", "crashedState": "已崩溃", "crashedCode": "已崩溃 ({code})", "healthy": "健康", "unhealthy": "异常", "starting": "启动中", "upFor": "已运行 {n} {unit}", "unitSeconds": "秒", "unitMinutes": "分钟", "unitHours": "小时", "unitDays": "天", "exitedDetail": "已退出{detail}", "createdState": "已创建", "restartingState": "重启中", "dataSources": "采集来源", "runtime": "运行环境", "loadUptime": "负载 / 运行时长", "cpuCoresModel": "CPU 核心 / 型号", "kernelVersion": "内核版本", "consistencyCheck": "⚠ 一致性自检", "consistencyOk": "一致性正常", "consistencyWarn": "⚠ {n} 项警告", "unavailable": "不可用", "hostnameRuntime": "{hostname} · {runtime}", "sourceWithPath": "{origin} · {path}", "aboutHostRuntime": "宿主运行时", "aboutStarted": "启动时间", "aboutRuntimeId": "Runtime ID", "aboutNode": "Node", "unknownHostVersion": "未知", "versionMismatchHead": "⚠ 版本不一致", "versionMismatchDetail": "Host 与浏览器端协议不兼容，请重启 DeepSeek Harness 加载最新 Host 端", "versionBanner": "⚠ 系统监控组件版本不一致 · Browser v{browser} · Host {host} · 请重启 DeepSeek Harness", "capabilities": "能力", "yes": "是", "no": "否", "capHostMount": "Host Mount 模式", "capDockerSocket": "Docker Socket", "capHostNetNs": "宿主网络命名空间探测", "capProcessAggregate": "进程聚合", "capContainerStats": "容器实时统计", "netProbeHost": "宿主网络命名空间", "netProbeContainer": "容器网络命名空间", "diagTitle": "DSH Side Monitor 诊断信息", "diagHost": "主机：{value}", "diagRuntime": "运行环境：{value}", "diagSystemSource": "系统数据来源：{value}", "diagProcessSource": "进程数据来源：{value}", "diagDockerSource": "Docker 数据来源：{value}", "diagCpu": "CPU：", "diagMemory": "内存：", "diagLoad": "负载：", "diagDisk": "磁盘：", "diagUsage": "使用率：{value}", "diagCores": "核心：{value}", "diagStat": "{label}：{n}", "copiedDiagnostics": "已复制诊断信息", "diagDocker": "Docker：{value}", "diagTopProcesses": "主要进程：", "systemData": "系统数据", "processData": "进程数据", "dockerData": "Docker 数据" }, "en-US": { "monitorTitle": "System Monitor", "liveUpdated": "Live · {ago}", "refreshNow": "Refresh Now", "more": "More", "close": "Close", "dragResize": "Drag to resize", "clickViewSources": "Click to view data sources", "refreshFailed": "Refresh failed · Last successful update {ago}", "refreshFailedMsg": "Refresh failed · Last successful update {ago} · {msg}", "waitingFirstData": "Waiting for first data…", "sampling": "Sampling…", "dataInterrupted": "Data interrupted · Last successful update {ago}", "copyDiagnostics": "Copy Diagnostics", "viewDataSources": "Data Sources", "about": "About", "language": "Language", "loading": "Loading…", "cannotFetchDetail": "Failed to fetch data: {detail}", "unknownError": "Unknown error", "updatedJustNow": "Updated just now", "secondsAgo": "{sec} seconds ago", "minutesAgo": "{n} min ago", "hoursAgo": "{n} hr ago", "connectionUnavailable": "Connection service unavailable", "overview": "Overview", "loadAverage1": "Load 1m", "performance": "Performance", "hardware": "Hardware & system", "trendTitle": "Recent trends", "historyEmpty": "Collecting history… (one sample every 2 s)", "swapUsage": "Swap", "swapIn": "Swap in", "swapRateSub": "{used} · In {inRate} · Out {outRate}", "alertDisk": "Disk {mount} at {pct}% used", "alertSwap": "Swap {swap}%, memory {mem}% — memory pressure", "alertTemp": "{name} at {celsius}°C", "alertUnhealthy": "{n} container(s) unhealthy", "swapOut": "Swap out", "tempCpuPackage": "CPU package", "tempMainboardAcpi": "Mainboard ACPI", "tempNvme": "NVMe SSD", "tempDisk": "Disk", "tempGpu": "GPU", "threads": "Threads", "runnableCount": "Runnable {n}", "diskIo": "Disk I/O", "diskRead": "Read", "diskWrite": "Write", "perCoreCpu": "Per-core CPU", "minutesN": "{n} min", "cpuClock": "CPU clock", "temperature": "Temperature", "noTempSensor": "No temperature sensor", "memBreakdown": "Memory breakdown", "memFree": "Free", "memBuffers": "Buffers", "memCached": "Cached", "memAvailable": "Available", "daemonInfo": "Docker daemon", "daemonVersion": "Version", "daemonApiVersion": "API version", "storageDriver": "Storage driver", "images": "Images", "dockerDaemonUnavailable": "Docker daemon unavailable", "notSupported": "Not supported on this platform", "dockerRunningStopped": "Running {running} · Stopped {stopped} · Paused {paused}", "processes": "Processes", "docker": "Docker", "cpuUsage": "CPU Usage", "memoryUsage": "Memory Usage", "networkIface": "Network · {iface}", "networkProbe": "Network probe", "download": "Download", "upload": "Upload", "disk": "Disk", "diskMount": "Disk · {mount}", "noDiskInfo": "No disk info available", "systemLoad": "System Load", "uptimeValue": "Uptime {value}", "systemInfo": "System Information", "operatingSystem": "Operating System", "kernel": "Kernel", "hostname": "Hostname", "physicalCores": "Physical Cores", "logicalCpu": "Logical CPUs", "architecture": "Architecture", "totalMemory": "Total Memory", "diskPartitions": "Disk Partitions", "networkInterfaces": "Network Interfaces", "dockerContainers": "Docker Containers", "total": "Total", "running": "Running", "issues": "Issues", "all": "All", "primary": "Main", "virtual": "Virtual", "iface": "Interface", "receive": "RX", "send": "TX", "coresThreadsLoad": "{phys} cores / {logical} threads · Load {load}", "logicalCpuLoad": "{logical} logical CPUs · Load {load}", "uptimeFull": "{d}d {hh}h {mm}m", "uptimeHm": "{hh}h {mm}m", "uptimeMs": "{mm}m {ss}s", "uptimeS": "{s}s", "dataSourceHost": "Host Data", "dataSourceContainer": "Container Data", "runtimeContainer": "DSH running in container", "runtimeHost": "DSH running on host", "hostView": "Host view", "containerView": "Container view", "dockerUnavailableDetail": "Docker unavailable · {detail}", "dockerUnavailableSock": "Docker unavailable (no /var/run/docker.sock)", "dockerSockMissing": "no /var/run/docker.sock", "sourceValue": "Source: {source}", "host": "Host", "currentContainer": "Current Container", "unknown": "Unknown", "searchProcess": "Search process / command / user…", "mem": "Memory", "name": "Name", "list": "List", "grouped": "Grouped", "processesTotal": "{total} processes", "processesTotalMatched": "{total} processes · {matched} matched", "matchedCount": "{matched} matched", "groupsTotalMatched": "{total} groups · {matched} matched", "byAggregatedCpu": "Sorted by aggregated CPU", "loadMore": "Load More", "user": "User", "command": "Command", "commandPrefix": "Command: ", "uptimeLabel": "Uptime", "groupsCount": "{count} processes", "searchContainer": "Search containers / images / ports…", "container": "Container", "status": "Status", "ports": "Ports", "noPortMappings": "No port mappings", "hostOnly": "Host only", "containerOnly": "Container only", "copiedAddr": "Address copied", "copyFailed": "Copy failed", "notPublishedToast": "Not published to host — container only", "hostLocalToast": "Host-local only", "titleUnpublished": "Not published to host (container-only port) — cannot open", "titleHostLocal": "Host-local ({host}:{port}) — browser cannot open from outside", "tooltipPort": "Host {host}:{port} · Container port {cport}/{proto}", "showingContainers": "Showing {count} containers", "httpOpen": "Open HTTP", "httpsOpen": "Open HTTPS", "copyAddress": "Copy address", "copyAddressHostLocal": "Copy address (host-local)", "runningState": "Running", "pausedState": "Paused", "stoppedState": "Stopped", "crashedState": "Crashed", "crashedCode": "Crashed ({code})", "healthy": "Healthy", "unhealthy": "Unhealthy", "starting": "Starting", "upFor": "Up for {n} {unit}", "unitSeconds": "seconds", "unitMinutes": "minutes", "unitHours": "hours", "unitDays": "days", "exitedDetail": "Exited{detail}", "createdState": "Created", "restartingState": "Restarting", "dataSources": "Data Sources", "runtime": "Runtime", "loadUptime": "Load / Uptime", "cpuCoresModel": "CPU cores / model", "kernelVersion": "Kernel version", "consistencyCheck": "⚠ Consistency check", "consistencyOk": "Consistent", "consistencyWarn": "⚠ {n} warnings", "unavailable": "Unavailable", "hostnameRuntime": "{hostname} · {runtime}", "sourceWithPath": "{origin} · {path}", "aboutHostRuntime": "Host Runtime", "aboutStarted": "Started", "aboutRuntimeId": "Runtime ID", "aboutNode": "Node", "unknownHostVersion": "unknown", "versionMismatchHead": "⚠ Version mismatch", "versionMismatchDetail": "Host and browser protocols are incompatible. Restart DeepSeek Harness to load the latest Host.", "versionBanner": "⚠ System Monitor component versions do not match. Browser v{browser} · Host {host} · Restart DeepSeek Harness.", "capabilities": "Capabilities", "yes": "Yes", "no": "No", "capHostMount": "Host mount mode", "capDockerSocket": "Docker Socket", "capHostNetNs": "Host netns probe", "capProcessAggregate": "Process aggregation", "capContainerStats": "Container stats", "netProbeHost": "Host netns", "netProbeContainer": "Container netns", "diagTitle": "DSH Side Monitor Diagnostics", "diagHost": "Host: {value}", "diagRuntime": "Runtime: {value}", "diagSystemSource": "System data source: {value}", "diagProcessSource": "Process data source: {value}", "diagDockerSource": "Docker data source: {value}", "diagCpu": "CPU:", "diagMemory": "Memory:", "diagLoad": "Load:", "diagDisk": "Disk:", "diagUsage": "Usage: {value}", "diagCores": "Cores: {value}", "diagStat": "{label}: {n}", "copiedDiagnostics": "Diagnostics copied", "diagDocker": "Docker: {value}", "diagTopProcesses": "Top Processes:", "systemData": "System Data", "processData": "Process Data", "dockerData": "Docker Data" } };
      var langListeners = [];
      var currentLang = (function() {
        try {
          var v = localStorage.getItem(LANG_KEY);
          return v === LANG_EN ? LANG_EN : LANG_ZH;
        } catch (e) {
          return LANG_ZH;
        }
      })();
      function t(key, vars) {
        var text = MESSAGES[currentLang] && MESSAGES[currentLang][key] || MESSAGES[LANG_ZH] && MESSAGES[LANG_ZH][key] || key;
        if (vars) {
          for (var k in vars) text = text.split("{" + k + "}").join(String(vars[k]));
        }
        return text;
      }
      function setLang(l) {
        if (l !== LANG_ZH && l !== LANG_EN) return;
        currentLang = l;
        try {
          localStorage.setItem(LANG_KEY, l);
        } catch (e) {
        }
        for (var i = 0; i < langListeners.length; i++) langListeners[i]();
      }
      function useLangTick() {
        return React.useSyncExternalStore(
          function(cb) {
            langListeners.push(cb);
            return function() {
              var i = langListeners.indexOf(cb);
              if (i >= 0) langListeners.splice(i, 1);
            };
          },
          function() {
            return currentLang;
          }
        );
      }
      var React = require2("react");
      var useState = React.useState;
      var useEffect = React.useEffect;
      var useRef = React.useRef;
      var useSyncExternalStore = React.useSyncExternalStore;
      var RPC_CHANNEL = "/side-monitor";
      var PROTOCOL_VERSION = 4;
      var CLIENT_VERSION = "0.7.0";
      function h(type, props) {
        var rest = Array.prototype.slice.call(arguments, 2);
        var children = [];
        (function flatten(arr) {
          arr.forEach(function(c) {
            if (c === null || c === void 0 || c === false) return;
            if (Array.isArray(c)) flatten(c);
            else children.push(c);
          });
        })(rest);
        var p = props || {};
        if (children.length) {
          p = Object.assign({}, p, { children: children.length === 1 ? children[0] : children });
        }
        return React.createElement(type, p);
      }
      function createStore(initial) {
        var state = initial;
        var listeners = [];
        return {
          get: function() {
            return state;
          },
          update: function(fn) {
            var next = fn(state);
            if (next !== state) {
              state = next;
              listeners.forEach(function(l) {
                l();
              });
            }
          },
          subscribe: function(l) {
            listeners.push(l);
            return function() {
              var i = listeners.indexOf(l);
              if (i >= 0) listeners.splice(i, 1);
            };
          }
        };
      }
      function pushHistory(ref, value, max) {
        var arr = ref.current;
        arr.push(value);
        if (arr.length > max) arr.shift();
      }
      function fmtBytes(n) {
        if (n === null || n === void 0 || isNaN(n)) return "—";
        if (n === 0) return "0 B";
        var units = ["B", "KB", "MB", "GB", "TB", "PB"];
        var i = Math.floor(Math.log(Math.abs(n)) / Math.log(1024));
        i = Math.max(0, Math.min(i, units.length - 1));
        return (n / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0) + " " + units[i];
      }
      function fmtRate(n) {
        return fmtBytes(n) + "/s";
      }
      function fmtUptime(sec) {
        if (sec === null || sec === void 0 || isNaN(sec)) return "—";
        sec = Math.floor(sec);
        var d = Math.floor(sec / 86400);
        var hh = Math.floor(sec % 86400 / 3600);
        var mm = Math.floor(sec % 3600 / 60);
        if (d > 0) return t("uptimeFull", { d, hh, mm });
        if (hh > 0) return t("uptimeHm", { hh, mm });
        if (mm > 0) return t("uptimeMs", { mm, ss: sec % 60 });
        return t("uptimeS", { s: sec });
      }
      function relTime(sec) {
        if (sec <= 1) return t("updatedJustNow");
        if (sec < 60) return t("secondsAgo", { sec });
        if (sec < 3600) return t("minutesAgo", { n: Math.floor(sec / 60) });
        return t("hoursAgo", { n: Math.floor(sec / 3600) });
      }
      function fmtTimestamp(ms) {
        try {
          return new Date(ms).toISOString().replace("T", " ").slice(0, 16);
        } catch (e) {
          return String(ms);
        }
      }
      function colorForPct(v) {
        if (v >= 90) return "var(--dsw-alias-state-error-primary, #f87171)";
        if (v >= 70) return "var(--dsw-alias-state-warn-primary, #f5b83d)";
        return "var(--dsw-alias-state-success-primary, #34d399)";
      }
      var COLORS = {
        cpu: "var(--dsw-alias-state-business-primary, #4f8cff)",
        mem: "var(--dsw-alias-brand-primary, #8b7cff)",
        netRx: "var(--dsw-alias-state-business-primary, #4f8cff)",
        netTx: "#22c3e6",
        ok: "var(--dsw-alias-state-success-primary, #34d399)",
        warn: "var(--dsw-alias-state-warn-primary, #f5b83d)",
        err: "var(--dsw-alias-state-error-primary, #f87171)",
        muted: "var(--dsw-alias-label-secondary, #9aa3b2)"
      };
      function sourceLabel(source) {
        if (source === "host") return t("host");
        if (source === "container") return t("currentContainer");
        return t("unknown");
      }
      function isContainerIssue(c) {
        if (c.state === "restarting" || c.state === "dead") return true;
        if (c.health === "unhealthy" || c.health === "starting") return true;
        if (c.state === "exited" && c.exitCode != null && c.exitCode !== 0) return true;
        return false;
      }
      function isContainerStopped(c) {
        return c.state === "exited" && (c.exitCode == null || c.exitCode === 0);
      }
      function containerStatusBadge(c) {
        if (c.state === "running") {
          if (c.health === "unhealthy") return { label: t("unhealthy"), color: COLORS.err };
          if (c.health === "starting") return { label: t("starting"), color: COLORS.warn };
          if (c.health === "healthy") return { label: t("healthy"), color: COLORS.ok };
          return { label: t("runningState"), color: COLORS.ok };
        }
        if (c.state === "paused") return { label: t("pausedState"), color: COLORS.warn };
        if (c.state === "restarting") return { label: t("restartingState"), color: COLORS.warn };
        if (c.state === "created") return { label: t("createdState"), color: COLORS.muted };
        if (c.state === "dead") return { label: t("crashedState"), color: COLORS.err };
        if (c.state === "exited") {
          if (c.exitCode != null && c.exitCode !== 0) return { label: t("crashedCode", { code: c.exitCode }), color: COLORS.err };
          return { label: t("stoppedState"), color: COLORS.muted };
        }
        return { label: c.state || t("unknown"), color: COLORS.err };
      }
      function containerMemText(c) {
        if (c.memoryUsage == null) return t("sampling");
        var pct = c.memoryUsagePct != null ? " · " + c.memoryUsagePct.toFixed(1) + "%" : "";
        return fmtBytes(c.memoryUsage) + pct;
      }
      function callRpc(connection, endpoint, payload) {
        if (!connection || !connection.rpc || typeof connection.rpc.call !== "function") {
          return Promise.reject(new Error(t("connectionUnavailable")));
        }
        return connection.rpc.call(RPC_CHANNEL, endpoint, payload);
      }
      function copyText(text, cb) {
        function fallback() {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          var ok = false;
          try {
            ok = document.execCommand("copy");
          } catch (e) {
            ok = false;
          }
          document.body.removeChild(ta);
          if (cb) cb(ok);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function() {
            if (cb) cb(true);
          }, function() {
            fallback();
          });
        } else {
          fallback();
        }
      }
      var HTTP_PORTS = { 80: 1, 3e3: 1, 3080: 1, 5173: 1, 8e3: 1, 8008: 1, 8080: 1, 9e3: 1 };
      var HTTPS_PORTS = { 443: 1, 8443: 1, 9443: 1 };
      function portProtocolFor(port) {
        if (port == null) return null;
        if (HTTPS_PORTS[port]) return "https";
        if (HTTP_PORTS[port]) return "http";
        return null;
      }
      function isPublishedPort(p) {
        return !!p && p.hostPort != null;
      }
      function isLoopbackPort(p) {
        if (!p || !p.hostIp) return false;
        var ip = String(p.hostIp).trim();
        return ip.indexOf("127.") === 0 || ip === "::1" || ip === "0:0:0:0:0:0:0:1";
      }
      function portHost(p) {
        var ip = p && p.hostIp ? String(p.hostIp).trim() : "";
        if (ip) {
          if (ip.indexOf(":") >= 0) {
            if (ip === "::" || ip === "0:0:0:0:0:0:0:0") return window.location.hostname || "localhost";
            if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "[::1]";
            return "[" + ip + "]";
          }
          if (ip === "0.0.0.0") return window.location.hostname || "localhost";
          return ip;
        }
        return window.location.hostname || "localhost";
      }
      function portWebProtocol(p) {
        if (!isPublishedPort(p) || isLoopbackPort(p)) return null;
        return portProtocolFor(p.hostPort) || portProtocolFor(p.containerPort);
      }
      function formatContainerStatus(status) {
        if (!status) return "";
        var s = String(status).replace(/\s*\(.*\)\s*$/, "").trim();
        var m = s.match(/^Up\s+(\d+)\s+(second|seconds|minute|minutes|hour|hours|day|days)/i);
        if (m) {
          var n = parseInt(m[1], 10);
          var u = m[2].toLowerCase();
          var unit = u.indexOf("second") === 0 ? "unitSeconds" : u.indexOf("minute") === 0 ? "unitMinutes" : u.indexOf("hour") === 0 ? "unitHours" : "unitDays";
          return t("upFor", { n, unit: t(unit) });
        }
        if (/^Exited/.test(s)) return t("exitedDetail", { detail: s.slice(6) });
        if (/^Created/.test(s)) return t("createdState");
        if (/^Restarting/.test(s)) return t("restartingState");
        if (/^Paused/.test(s)) return t("pausedState");
        return s;
      }
      var CSS = [
        // trigger
        ".dsm-trigger{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa3b2);padding:7px 10px;border-radius:8px;font-size:13px;font-family:var(--dsw-font-family,inherit);transition:color .15s ease,background .15s ease}",
        ".dsm-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-trigger-active{color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-trigger-rail{width:auto;justify-content:center;padding:7px}",
        ".dsm-trigger-label{white-space:nowrap}",
        // root + chrome
        ".dsm-page{height:100%;min-width:0;min-height:0;display:flex;flex-direction:row;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary,#e7eaf0);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif);font-size:13px;line-height:1.5;overflow:hidden;container-type:inline-size}",
        ".dsm-page .dsm-header{flex:none;padding:28px clamp(24px,4vw,48px) 12px;border-bottom:none}",
        ".dsm-page .dsm-title{font-size:20px;font-weight:500;line-height:28px}",
        ".dsm-page .dsm-status-line{flex:none;padding:0 clamp(24px,4vw,48px) 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.06))}",
        ".dsm-page .dsm-tabs{flex:none;padding:10px clamp(24px,4vw,48px);border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}",
        ".dsm-page .dsm-body{flex:1;min-height:0;overflow-y:auto;padding:16px clamp(24px,4vw,48px) 48px}",
        ".dsm-header{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));position:relative}",
        ".dsm-title-col{display:flex;flex-direction:column;gap:2px;min-width:0}",
        ".dsm-title-row{display:flex;align-items:center;gap:8px}",
        ".dsm-title{font-size:15px;font-weight:600}",
        ".dsm-mode{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));cursor:default}",
        ".dsm-mode-dot{width:7px;height:7px;border-radius:50%;flex:none}",
        ".dsm-hostname{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dsm-header-actions{display:flex;align-items:center;gap:2px;flex:none}",
        ".dsm-icon-btn{border:none;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa3b2);width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center}",
        ".dsm-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-spin{animation:dsm-spin .8s linear infinite}",
        "@keyframes dsm-spin{to{transform:rotate(360deg)}}",
        // menu dropdown
        ".dsm-menu{position:absolute;top:calc(100% + 6px);right:0;min-width:160px;background:var(--dsw-specific-menu,#22222b);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.45);padding:4px;z-index:10}",
        ".dsm-menu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary,#e7eaf0);padding:8px 10px;border-radius:7px;font-size:13px;font-family:inherit;cursor:pointer}",
        ".dsm-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
        ".dsm-menu-item:disabled{opacity:.4;cursor:default}",
        ".dsm-menu-sep{height:1px;background:var(--dsw-alias-border-l2,rgba(255,255,255,.08));margin:4px 6px}",
        ".dsm-menu-label{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px 2px;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2)}",
        // status line
        ".dsm-status-line{flex:none;display:flex;align-items:center;gap:7px;padding:7px 14px;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.06))}",
        ".dsm-status-dot{width:7px;height:7px;border-radius:50%;flex:none}",
        // tabs
        ".dsm-tabs{flex:none;display:flex;gap:4px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}",
        ".dsm-tab{flex:1;border:none;background:transparent;cursor:pointer;padding:7px 0;color:var(--dsw-alias-label-secondary,#9aa3b2);border-radius:8px;font-size:13px;font-weight:500;font-family:inherit}",
        ".dsm-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-tab-active{color:var(--dsw-alias-label-primary,#e7eaf0);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
        ".dsm-body{flex:1;overflow-y:auto;padding:14px;padding-bottom:calc(14px + env(safe-area-inset-bottom))}",
        ".dsm-body::-webkit-scrollbar{width:10px}",
        ".dsm-body::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,rgba(255,255,255,.12));border-radius:8px}",
        ".dsm-panel{display:flex;flex-direction:column;gap:14px}",
        ".dsm-metrics-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}",
        "@container (min-width:420px){.dsm-metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
        // strong metric card (CPU / Memory)
        ".dsm-metric{background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.03));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.05));border-radius:12px;padding:10px;min-width:0}",
        ".dsm-metric-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0}",
        ".dsm-metric-label{font-size:12px;color:var(--dsw-alias-label-secondary,#9aa3b2)}",
        ".dsm-metric-value{font-size:26px;font-weight:650;font-variant-numeric:tabular-nums;line-height:1.1;flex:none}",
        ".dsm-metric-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dsm-spark{margin-top:8px;display:block}",
        // lightweight KPI (Network / Disk)
        ".dsm-kpi{background:rgba(255,255,255,.02);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.06));border-radius:12px;padding:12px;min-width:0;display:flex;flex-direction:column;gap:6px}",
        ".dsm-kpi-head{font-size:12px;color:var(--dsw-alias-label-secondary,#9aa3b2)}",
        ".dsm-kpi-value{font-size:20px;font-weight:650;font-variant-numeric:tabular-nums;line-height:1.1}",
        ".dsm-kpi-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);font-variant-numeric:tabular-nums}",
        ".dsm-kpi-row{display:flex;align-items:center;gap:8px;font-size:13px}",
        ".dsm-kpi-val{margin-left:auto;font-variant-numeric:tabular-nums}",
        ".dsm-dot{width:8px;height:8px;border-radius:50%;flex:none}",
        // section (secondary info)
        ".dsm-section{border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));padding-top:12px}",
        ".dsm-section-head{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-bottom:10px;letter-spacing:.02em}",
        ".dsm-muted{color:var(--dsw-alias-label-secondary,#9aa3b2)}",
        ".dsm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}",
        // load
        ".dsm-load{display:flex;flex-direction:column;gap:8px}",
        ".dsm-load-row{display:flex;align-items:center;gap:8px}",
        ".dsm-load-label{width:28px;flex:none}",
        ".dsm-load-bar{flex:1;height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}",
        ".dsm-load-fill{height:100%;border-radius:4px;background:var(--dsw-alias-state-business-primary,#4f8cff);transition:width .3s ease}",
        ".dsm-load-val{width:52px;text-align:right;font-variant-numeric:tabular-nums;font-size:12px}",
        // kv
        ".dsm-kv{display:flex;flex-direction:column}",
        ".dsm-kv-row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)}",
        ".dsm-kv-row:last-child{border-bottom:none}",
        ".dsm-kv-val{text-align:right;word-break:break-word;min-width:0}",
        // summary chips
        ".dsm-chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:8px}",
        ".dsm-chip{background:rgba(255,255,255,.03);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:10px;padding:8px 6px;text-align:center}",
        ".dsm-chip-val{display:block;font-size:18px;font-weight:650;font-variant-numeric:tabular-nums}",
        ".dsm-chip-label{font-size:11px}",
        // search
        ".dsm-search{width:100%;box-sizing:border-box;background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));border-radius:8px;padding:8px 10px;color:var(--dsw-alias-label-primary,#e7eaf0);font-size:13px;font-family:inherit;outline:none}",
        ".dsm-search:focus{border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
        ".dsm-count{font-size:12px}",
        // sort chips
        ".dsm-sortchips{display:flex;flex-wrap:wrap;gap:6px}",
        ".dsm-sortchip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));background:rgba(255,255,255,.03);color:var(--dsw-alias-label-secondary,#9aa3b2);border-radius:8px;padding:5px 10px;font-size:12px;font-family:inherit;cursor:pointer}",
        ".dsm-sortchip:hover{color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-sortchip-active{color:var(--dsw-alias-state-business-primary,#4f8cff);border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
        // filter chips
        ".dsm-filterchips{display:flex;flex-wrap:wrap;gap:6px}",
        ".dsm-filterchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));background:rgba(255,255,255,.03);color:var(--dsw-alias-label-secondary,#9aa3b2);border-radius:8px;padding:5px 10px;font-size:12px;font-family:inherit;cursor:pointer}",
        ".dsm-filterchip:hover{color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-filterchip-active{color:var(--dsw-alias-label-primary,#e7eaf0);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
        ".dsm-filterchip-count{font-variant-numeric:tabular-nums;opacity:.75}",
        // table
        ".dsm-table{width:100%;border-collapse:collapse;font-size:12px}",
        ".dsm-table th{text-align:left;font-weight:600;color:var(--dsw-alias-label-secondary,#9aa3b2);padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}",
        ".dsm-table td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}",
        ".dsm-table tbody tr:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}",
        ".dsm-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}",
        ".dsm-command{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#9aa3b2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
        ".dsm-docker-name{font-weight:600;color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-docker-image{font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dsm-state-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px}",
        ".dsm-state{color:var(--dsw-alias-label-secondary,#9aa3b2);padding:24px 8px;text-align:center}",
        ".dsm-error{color:var(--dsw-alias-state-error-primary,#f87171)}",
        ".dsm-stale{display:flex;align-items:center;gap:8px;background:rgba(245,184,61,.08);border:1px solid rgba(245,184,61,.3);color:var(--dsw-alias-state-warn-primary,#f5b83d);border-radius:10px;padding:8px 12px;font-size:12px}",
        ".dsm-tag{display:inline-block;font-size:10px;line-height:1;padding:2px 5px;border-radius:5px;margin-right:4px;vertical-align:1px}",
        ".dsm-tag-primary{background:rgba(79,140,255,.16);color:var(--dsw-alias-state-business-primary,#4f8cff)}",
        ".dsm-tag-virt{background:rgba(255,255,255,.08);color:var(--dsw-alias-label-secondary,#9aa3b2)}",
        ".dsm-health-badge{font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;white-space:nowrap}",
        // process dual renderer
        ".dsm-proc-table-wrap{display:none}",
        ".dsm-proc-list{display:flex;flex-direction:column;gap:8px}",
        "@container (min-width:680px){.dsm-proc-table-wrap{display:block}.dsm-proc-list{display:none}}",
        ".dsm-proc-row{background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:10px;padding:10px 12px;cursor:pointer}",
        ".dsm-proc-row:hover{border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
        ".dsm-proc-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0}",
        ".dsm-proc-name{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
        ".dsm-proc-cpu{font-variant-numeric:tabular-nums;font-size:13px;font-weight:600;flex:none}",
        ".dsm-proc-meta{display:flex;align-items:baseline;gap:8px;margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2)}",
        ".dsm-proc-mem{margin-left:auto;flex:none;font-variant-numeric:tabular-nums}",
        ".dsm-proc-cmd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);opacity:.75;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dsm-proc-detail{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.1);display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px}",
        ".dsm-proc-detail .dsm-kv-row{border-bottom:none;padding:2px 0}",
        ".dsm-proc-detail-command{grid-column:1 / -1}",
        ".dsm-loadmore{align-self:center;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:rgba(255,255,255,.03);color:var(--dsw-alias-label-secondary,#9aa3b2);border-radius:8px;padding:6px 14px;font-size:12px;font-family:inherit;cursor:pointer}",
        ".dsm-loadmore:hover{color:var(--dsw-alias-label-primary,#e7eaf0)}",
        // docker dual renderer
        ".dsm-docker-table-wrap{display:none}",
        ".dsm-docker-list{display:flex;flex-direction:column;gap:10px}",
        "@container (min-width:680px){.dsm-docker-table-wrap{display:block}.dsm-docker-list{display:none}}",
        ".dsm-container-card{background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:10px;padding:8px 10px}",
        ".dsm-container-head{display:flex;align-items:center;gap:8px;min-width:0}",
        ".dsm-container-name{font-weight:600;color:var(--dsw-alias-label-primary,#e7eaf0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
        ".dsm-container-image{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dsm-container-stats{display:flex;flex-wrap:wrap;gap:12px;margin-top:5px;font-size:12px}",
        ".dsm-container-stat{display:flex;gap:6px;font-variant-numeric:tabular-nums}",
        ".dsm-container-uptime{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-top:5px}",
        ".dsm-port-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}",
        ".dsm-docker-table-wrap .dsm-table td{padding:5px 6px}",
        ".dsm-group-detail{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,.1)}",
        ".dsm-port-chip{display:inline-flex;align-items:center;gap:5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;background:rgba(255,255,255,.05);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));border-radius:6px;padding:3px 8px;color:var(--dsw-alias-label-primary,#e7eaf0);cursor:pointer}",
        ".dsm-port-chip:hover{border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
        ".dsm-port-chip-locked{cursor:default;opacity:.72;border-style:dashed}",
        ".dsm-port-chip-web{border-color:rgba(79,140,255,.45);color:#8fb4ff;background:rgba(79,140,255,.08)}",
        ".dsm-port-chip-loop{border-color:rgba(245,184,61,.45);color:#f5b83d;background:rgba(245,184,61,.08)}",
        ".dsm-port-chip-unpub{border-color:rgba(154,163,178,.35);color:#9aa3b2;background:rgba(255,255,255,.03)}",
        ".dsm-port-tag{font-size:10px;opacity:.8;color:inherit;white-space:nowrap}",
        ".dsm-port-ico{font-size:11px;line-height:1}",
        ".dsm-port-none{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);font-variant-numeric:tabular-nums}",
        ".dsm-table .dsm-port-chips{margin-top:0}",
        ".dsm-port-block{margin-top:10px}",
        ".dsm-port-label{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-bottom:4px}",
        // port context menu
        ".dsm-portmenu-backdrop{position:fixed;inset:0;z-index:1600}",
        ".dsm-portmenu{position:fixed;min-width:140px;background:var(--dsw-specific-menu,#26262f);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.5);padding:4px;z-index:1601}",
        ".dsm-portmenu button{display:block;width:100%;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary,#e7eaf0);padding:8px 10px;border-radius:7px;font-size:13px;font-family:inherit;cursor:pointer}",
        ".dsm-portmenu button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
        // disk partitions
        ".dsm-disk-list{display:flex;flex-direction:column;gap:10px}",
        ".dsm-disk-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}",
        ".dsm-disk-usage{font-variant-numeric:tabular-nums;font-weight:600;font-size:13px}",
        ".dsm-disk-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);font-variant-numeric:tabular-nums}",
        ".dsm-disk-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:6px}",
        ".dsm-disk-fill{height:100%;border-radius:4px;transition:width .3s ease}",
        // modal
        ".dsm-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1700;display:flex;align-items:center;justify-content:center;padding:20px}",
        ".dsm-modal{background:var(--dsw-specific-menu,#26262f);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:12px;padding:16px;width:100%;max-width:440px;box-shadow:0 24px 64px rgba(0,0,0,.6)}",
        ".dsm-modal-title{font-size:14px;font-weight:600;margin-bottom:12px}",
        ".dsm-consistency{margin-top:12px;padding:10px 12px;border:1px solid rgba(245,184,61,.3);background:rgba(245,184,61,.08);border-radius:10px}",
        ".dsm-consistency-head{font-size:12px;font-weight:600;color:var(--dsw-alias-state-warn-primary,#f5b83d);margin-bottom:6px}",
        ".dsm-consistency-item{font-size:11px;color:var(--dsw-alias-state-warn-primary,#f5b83d);line-height:1.5}",
        ".dsm-modal-close{float:right;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9aa3b2);cursor:pointer;font-size:16px;line-height:1}",
        // version mismatch banner + about
        ".dsm-version-banner{display:flex;align-items:center;gap:8px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.35);color:var(--dsw-alias-state-error-primary,#f87171);border-radius:10px;padding:8px 12px;font-size:12px}",
        ".dsm-version-row{display:flex;justify-content:space-between;gap:12px;padding:4px 0}",
        // process view toggle + group cards
        ".dsm-viewtoggle{display:inline-flex;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));border-radius:8px;overflow:hidden}",
        ".dsm-viewtoggle button{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9aa3b2);padding:5px 12px;font-size:12px;font-family:inherit;cursor:pointer}",
        ".dsm-viewtoggle button:hover{color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-viewtoggle button.dsm-view-active{color:var(--dsw-alias-label-primary,#e7eaf0);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
        ".dsm-group-card{background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:10px;padding:10px 12px;cursor:pointer}",
        ".dsm-group-card:hover{border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
        ".dsm-group-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-width:0}",
        ".dsm-group-name{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
        ".dsm-group-cpu{font-variant-numeric:tabular-nums;font-size:13px;font-weight:600;flex:none}",
        ".dsm-group-meta{display:flex;gap:12px;margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2)}",
        ".dsm-group-pids{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,.1);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);display:flex;flex-wrap:wrap;gap:4px}",
        ".dsm-group-pid{background:rgba(255,255,255,.05);border-radius:5px;padding:1px 6px}",
        // toast
        ".dsm-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--dsw-alias-toast-bg,var(--dsw-specific-menu,#26262f));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));color:var(--dsw-alias-toast-label,var(--dsw-alias-label-primary,#e7eaf0));border-radius:10px;padding:9px 16px;font-size:13px;box-shadow:0 12px 32px rgba(0,0,0,.5);z-index:1800;animation:dsm-toast-in .18s ease}",
        "@keyframes dsm-toast-in{from{transform:translate(-50%,8px);opacity:0}to{transform:translate(-50%,0);opacity:1}}",
        ".dsm-page-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}",
        ".dsm-rail{flex:none;width:188px;display:flex;flex-direction:column;gap:2px;padding:20px 12px;border-right:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));overflow-y:auto}",
        ".dsm-rail-item{display:flex;align-items:center;gap:10px;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9aa3b2);padding:8px 10px;border-radius:8px;font-family:inherit;font-size:13px;text-align:left;cursor:pointer;white-space:nowrap}",
        ".dsm-rail-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-rail-active{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#e7eaf0)}",
        ".dsm-rail-icon{width:16px;text-align:center;flex:none}",
        "@media (max-width:767px){.dsm-page{flex-direction:column}.dsm-rail{width:auto;flex-direction:row;overflow-x:auto;overflow-y:hidden;border-right:none;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));padding:8px 12px}}",
        ".dsm-row-between{display:flex;justify-content:space-between;align-items:center;gap:12px}",
        ".dsm-percore{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:8px}",
        ".dsm-core{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px}",
        ".dsm-core-bar{height:72px;width:100%;max-width:28px;background:rgba(255,255,255,.06);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden}",
        ".dsm-core-fill{width:100%;transition:height .3s ease}",
        ".dsm-core-label,.dsm-core-val{color:var(--dsw-alias-label-secondary,#9aa3b2);font-variant-numeric:tabular-nums}",
        ".dsm-extra-grid{margin-top:12px}",
        ".dsm-page,.dsm-page *{box-sizing:border-box}"
      ].join("\n");
      (function injectCss() {
        if (document.getElementById("dsh-side-monitor-css")) return;
        var style = document.createElement("style");
        style.id = "dsh-side-monitor-css";
        style.textContent = CSS;
        document.head.appendChild(style);
      })();
      function Sparkline(props) {
        var data = props.data || [];
        var hpx = props.height || 36;
        var color = props.color || COLORS.ok;
        var fillOpacity = props.fillOpacity != null ? props.fillOpacity : 0.12;
        var W = 160;
        if (data.length < 2) {
          return h("div", { className: "dsm-spark", style: { height: hpx } });
        }
        var fixed = !!props.fixed;
        var min = fixed ? 0 : Infinity;
        var max = fixed ? 100 : -Infinity;
        if (!fixed) data.forEach(function(v) {
          if (v > max) max = v;
          if (v < min) min = v;
        });
        var range = max - min || 1;
        var pts = data.map(function(v, i) {
          var x = i / (data.length - 1) * W;
          var clamped = Math.min(max, Math.max(min, v));
          var y = hpx - (clamped - min) / range * (hpx - 4) - 2;
          return x.toFixed(1) + "," + y.toFixed(1);
        });
        var pointsStr = pts.join(" ");
        var areaStr = "0," + hpx + " " + pointsStr + " " + W + "," + hpx;
        return h(
          "svg",
          { className: "dsm-spark", viewBox: "0 0 " + W + " " + hpx, preserveAspectRatio: "none", width: "100%", height: hpx, "aria-hidden": true },
          props.fill ? h("polygon", { points: areaStr, fill: color, opacity: fillOpacity }) : null,
          h("polyline", { points: pointsStr, fill: "none", stroke: color, strokeWidth: 1.8, strokeLinejoin: "round", strokeLinecap: "round" })
        );
      }
      function MonitorIcon(props) {
        var s = props.size || 16;
        return h(
          "svg",
          { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
          h("path", { d: "M3 13h4l2.5-6 4 10 2.5-4H21" })
        );
      }
      function RefreshIcon(props) {
        var s = props.size || 16;
        return h(
          "svg",
          { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: props.className || null, "aria-hidden": true },
          h("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
          h("polyline", { points: "21 3 21 9 15 9" })
        );
      }
      function MoreIcon(props) {
        var s = props.size || 16;
        return h(
          "svg",
          { width: s, height: s, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true },
          h("circle", { cx: 5, cy: 12, r: 1.7 }),
          h("circle", { cx: 12, cy: 12, r: 1.7 }),
          h("circle", { cx: 19, cy: 12, r: 1.7 })
        );
      }
      function LoadingBox() {
        return h("div", { className: "dsm-state" }, t("loading"));
      }
      function ErrorBox(msg) {
        return h("div", { className: "dsm-state dsm-error" }, t("cannotFetchDetail", { detail: msg || t("unknownError") }));
      }
      function StaleBanner(props) {
        return h(
          "div",
          { className: "dsm-stale" },
          props.msg ? t("refreshFailedMsg", { ago: props.ago, msg: props.msg }) : t("refreshFailed", { ago: props.ago })
        );
      }
      function Chip(label, value, color) {
        return h(
          "div",
          { className: "dsm-chip" },
          h("span", { className: "dsm-chip-val", style: { color } }, value),
          h("span", { className: "dsm-muted dsm-chip-label" }, label)
        );
      }
      function SortChip(label, key, activeKey, order, onClick) {
        var active = key === activeKey;
        var arrow = active ? order === "asc" ? " ↑" : " ↓" : "";
        return h("button", {
          className: "dsm-sortchip" + (active ? " dsm-sortchip-active" : ""),
          onClick: function() {
            onClick(key);
          }
        }, label + arrow);
      }
      function usePoll(fn, intervalMs, enabled, deps) {
        var fnRef = useRef(fn);
        fnRef.current = fn;
        var depsArr = deps || [];
        useEffect(function() {
          if (!enabled) return void 0;
          var stopped = false;
          var inFlight = false;
          var timer = null;
          function arm() {
            if (stopped) return;
            timer = setTimeout(tick, intervalMs);
          }
          async function tick() {
            if (stopped || inFlight) return;
            inFlight = true;
            try {
              await fnRef.current();
            } catch (e) {
            } finally {
              inFlight = false;
              arm();
            }
          }
          function onVis() {
            if (document.hidden) {
              if (timer) {
                clearTimeout(timer);
                timer = null;
              }
            } else if (timer === null && !inFlight) tick();
          }
          tick();
          document.addEventListener("visibilitychange", onVis);
          return function() {
            stopped = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVis);
          };
        }, [enabled, intervalMs].concat(depsArr));
      }
      function MetricCard(props) {
        var valText = props.value != null ? props.value.toFixed(1) + props.suffix : "…";
        var sub = props.value == null ? t("sampling") : props.sub;
        return h(
          "div",
          { className: "dsm-metric" },
          h(
            "div",
            { className: "dsm-metric-head" },
            h("span", { className: "dsm-metric-label" }, props.label),
            h("span", { className: "dsm-metric-value", style: { color: props.color } }, valText)
          ),
          sub ? h("div", { className: "dsm-metric-sub" }, sub) : null,
          h(Sparkline, { data: props.history, color: props.color, fixed: true, fill: true, fillOpacity: props.fillOpacity })
        );
      }
      function NetKpi(overview) {
        var net = overview.network || { primary: null, interfaces: [] };
        var ifaces = net.interfaces || [];
        var primary = null;
        for (var i = 0; i < ifaces.length; i++) if (ifaces[i].primary) {
          primary = ifaces[i];
          break;
        }
        var rx = primary ? primary.rxBytesPerSec : null;
        var tx = primary ? primary.txBytesPerSec : null;
        if (!primary && ifaces.length) {
          rx = 0;
          tx = 0;
          ifaces.forEach(function(i2) {
            if (i2.rxBytesPerSec != null) rx += i2.rxBytesPerSec;
            if (i2.txBytesPerSec != null) tx += i2.txBytesPerSec;
          });
          if (rx === 0 && ifaces.every(function(i2) {
            return i2.rxBytesPerSec == null;
          })) rx = null;
          if (tx === 0 && ifaces.every(function(i2) {
            return i2.txBytesPerSec == null;
          })) tx = null;
        }
        return h(
          "div",
          { className: "dsm-kpi" },
          h("div", { className: "dsm-kpi-head" }, t("networkIface", { iface: primary ? primary.name : "—" })),
          h(
            "div",
            { className: "dsm-kpi-row" },
            h("span", { className: "dsm-dot", style: { background: COLORS.netRx } }),
            t("download"),
            h("span", { className: "dsm-kpi-val" }, rx != null ? fmtRate(rx) : "—")
          ),
          h(
            "div",
            { className: "dsm-kpi-row" },
            h("span", { className: "dsm-dot", style: { background: COLORS.netTx } }),
            t("upload"),
            h("span", { className: "dsm-kpi-val" }, tx != null ? fmtRate(tx) : "—")
          )
        );
      }
      function DiskKpi(overview) {
        if (!overview.diskAvailable) {
          return h(
            "div",
            { className: "dsm-kpi" },
            h("div", { className: "dsm-kpi-head" }, t("disk")),
            h("span", { className: "dsm-muted" }, t("noDiskInfo"))
          );
        }
        var color = colorForPct(overview.diskUsage);
        var mount = overview.disks && overview.disks[0] ? overview.disks[0].mount : "/";
        return h(
          "div",
          { className: "dsm-kpi" },
          h("div", { className: "dsm-kpi-head" }, t("diskMount", { mount })),
          h("span", { className: "dsm-kpi-value", style: { color } }, overview.diskUsage.toFixed(1) + "%"),
          h("span", { className: "dsm-kpi-sub" }, fmtBytes(overview.diskUsed) + " / " + fmtBytes(overview.diskTotal))
        );
      }
      function LoadSection(overview) {
        var load = [overview.load1, overview.load5, overview.load15];
        var labels = ["1m", "5m", "15m"];
        var maxLoad = Math.max.apply(null, load.concat([overview.cpuCores, 1]));
        return h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("systemLoad")),
          h(
            "div",
            { className: "dsm-load" },
            load.map(function(v, i) {
              var pct = Math.min(100, v / maxLoad * 100);
              return h(
                "div",
                { className: "dsm-load-row", key: labels[i] },
                h("span", { className: "dsm-muted dsm-load-label" }, labels[i]),
                h("div", { className: "dsm-load-bar" }, h("div", { className: "dsm-load-fill", style: { width: pct + "%" } })),
                h("span", { className: "dsm-load-val" }, v.toFixed(2))
              );
            })
          ),
          h("div", { className: "dsm-muted dsm-sub", style: { marginTop: 8 } }, t("uptimeValue", { value: fmtUptime(overview.uptimeSeconds) }))
        );
      }
      function SystemSection(overview) {
        var rows = [
          [t("operatingSystem"), overview.osName],
          [t("kernel"), overview.kernelVersion],
          [t("hostname"), overview.environment ? overview.environment.hostname : overview.hostname],
          ["CPU", overview.cpuModel]
        ];
        if (overview.physicalCores != null) rows.push([t("physicalCores"), String(overview.physicalCores)]);
        rows.push([t("logicalCpu"), String(overview.cpuCores)]);
        rows.push([t("architecture"), overview.arch]);
        if (overview.cpuClockMhz) rows.push([t("cpuClock"), (overview.cpuClockMhz / 1e3).toFixed(2) + " GHz"]);
        rows.push([t("totalMemory"), fmtBytes(overview.memoryTotal)]);
        return h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("systemInfo")),
          h(
            "div",
            { className: "dsm-kv" },
            rows.map(function(r) {
              return h(
                "div",
                { className: "dsm-kv-row", key: r[0] },
                h("span", { className: "dsm-muted" }, r[0]),
                h("span", { className: "dsm-kv-val", title: r[1] }, r[1])
              );
            })
          )
        );
      }
      function DiskPartitionsSection(overview) {
        var disks = overview.disks || [];
        if (!disks.length) return null;
        return h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("diskPartitions")),
          h(
            "div",
            { className: "dsm-disk-list" },
            disks.map(function(d) {
              var color = colorForPct(d.usage);
              return h(
                "div",
                { key: d.mount },
                h(
                  "div",
                  { className: "dsm-disk-top" },
                  h("span", { className: "dsm-mono", title: d.mount }, d.mount),
                  h("span", { className: "dsm-disk-usage", style: { color } }, d.usage.toFixed(0) + "%")
                ),
                h("div", { className: "dsm-disk-sub" }, fmtBytes(d.used) + " / " + fmtBytes(d.total)),
                h(
                  "div",
                  { className: "dsm-disk-bar" },
                  h("div", { className: "dsm-disk-fill", style: { width: Math.min(100, d.usage) + "%", background: color } })
                )
              );
            })
          )
        );
      }
      function InterfacesSection(overview) {
        var net = overview.network || { interfaces: [] };
        var ifaces = net.interfaces || [];
        if (!ifaces.length) return null;
        return h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("networkInterfaces")),
          h(
            "table",
            { className: "dsm-table" },
            h("thead", null, h(
              "tr",
              null,
              h("th", null, t("iface")),
              h("th", null, "IP"),
              h("th", { className: "dsm-num" }, t("receive")),
              h("th", { className: "dsm-num" }, t("send"))
            )),
            h("tbody", null, ifaces.map(function(i) {
              return h(
                "tr",
                { key: i.name },
                h(
                  "td",
                  { className: "dsm-mono" },
                  i.primary ? h("span", { className: "dsm-tag dsm-tag-primary" }, t("primary")) : null,
                  " " + i.name,
                  i.virtual ? h("span", { className: "dsm-tag dsm-tag-virt" }, t("virtual")) : null
                ),
                h("td", null, i.ip),
                h("td", { className: "dsm-num" }, fmtRate(i.rxBytesPerSec)),
                h("td", { className: "dsm-num" }, fmtRate(i.txBytesPerSec))
              );
            }))
          )
        );
      }
      function DockerSummarySection(containers) {
        if (!containers) return null;
        if (!containers.available) {
          return h(
            "div",
            { className: "dsm-section" },
            h("div", { className: "dsm-section-head" }, t("dockerContainers")),
            h("div", { className: "dsm-muted" }, t("dockerUnavailableSock"))
          );
        }
        var s = containers.summary;
        var issues = s.issues != null ? s.issues : 0;
        return h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("dockerContainers")),
          h(
            "div",
            { className: "dsm-chips" },
            Chip(t("total"), s.total, "#8b8fa3"),
            Chip(t("running"), s.running, COLORS.ok),
            Chip(t("stoppedState"), s.stopped || 0, COLORS.muted),
            Chip(t("issues"), issues, issues > 0 ? COLORS.err : COLORS.ok)
          )
        );
      }
      function OverviewPanel(props) {
        var overview = props.overview;
        var containers = props.containers;
        var error = props.error;
        var stale = props.stale;
        if (error && !overview) return ErrorBox(error);
        if (!overview) return LoadingBox();
        var phys = overview.physicalCores;
        var cpuSub = phys != null && phys !== overview.cpuCores ? t("coresThreadsLoad", { phys, logical: overview.cpuCores, load: overview.load1.toFixed(2) }) : t("logicalCpuLoad", { logical: overview.cpuCores, load: overview.load1.toFixed(2) });
        return h(
          "div",
          { className: "dsm-panel" },
          stale ? StaleBanner(stale) : null,
          h(
            "div",
            { className: "dsm-metrics-grid" },
            MetricCard({ label: t("cpuUsage"), value: overview.cpuUsage, suffix: "%", color: COLORS.cpu, history: props.cpuHistory, sub: cpuSub }),
            MetricCard({ label: t("memoryUsage"), value: overview.memoryUsage, suffix: "%", color: COLORS.mem, history: props.memHistory, sub: fmtBytes(overview.memoryUsed) + " / " + fmtBytes(overview.memoryTotal), fillOpacity: 0.2 }),
            NetKpi(overview),
            DiskKpi(overview)
          ),
          h("div", { className: "dsm-metrics-grid dsm-extra-grid" }, ExtraCards(overview)),
          LoadSection(overview),
          MemBreakdownSection(overview),
          DockerSummarySection(containers)
        );
      }
      function ProcessDetailRow(k, v) {
        return h(
          "div",
          { className: "dsm-kv-row" },
          h("span", { className: "dsm-muted" }, k),
          h("span", { className: "dsm-kv-val" }, v)
        );
      }
      function ProcessCard(props) {
        var p = props.p;
        var openState = useState(false);
        var open = openState[0];
        var setOpen = openState[1];
        return h(
          "div",
          {
            className: "dsm-proc-row" + (open ? " dsm-proc-open" : ""),
            onClick: function() {
              setOpen(!open);
            }
          },
          h(
            "div",
            { className: "dsm-proc-top" },
            h("span", { className: "dsm-proc-name", title: p.name }, p.name),
            h("span", { className: "dsm-proc-cpu" }, p.cpu.toFixed(1) + "%")
          ),
          h(
            "div",
            { className: "dsm-proc-meta" },
            h("span", null, "PID " + p.pid + " · PPID " + (p.ppid != null ? p.ppid : "—")),
            h("span", null, "· " + p.user),
            h("span", { className: "dsm-proc-mem" }, "MEM " + p.mem.toFixed(1) + "%")
          ),
          h("div", { className: "dsm-proc-cmd", title: p.command }, p.command),
          open ? h(
            "div",
            { className: "dsm-proc-detail" },
            ProcessDetailRow("PID", String(p.pid)),
            ProcessDetailRow("PPID", String(p.ppid != null ? p.ppid : "—")),
            ProcessDetailRow("USER", p.user),
            ProcessDetailRow("CPU", p.cpu.toFixed(1) + "%"),
            ProcessDetailRow("MEM", p.mem.toFixed(1) + "%"),
            ProcessDetailRow("RSS", fmtBytes(p.rssBytes)),
            ProcessDetailRow(t("uptimeLabel"), fmtUptime(p.elapsedSeconds)),
            h(
              "div",
              { className: "dsm-proc-detail-command" },
              h("span", { className: "dsm-muted" }, t("commandPrefix")),
              h("span", { className: "dsm-mono", title: p.command }, p.command)
            )
          ) : null
        );
      }
      function ProcessGroupCard(props) {
        var g = props.g;
        var openState = useState(false);
        var open = openState[0];
        var setOpen = openState[1];
        return h(
          "div",
          { className: "dsm-group-card", onClick: function() {
            setOpen(!open);
          } },
          h(
            "div",
            { className: "dsm-group-top" },
            h("span", { className: "dsm-group-name", title: g.command }, g.name + " × " + g.count),
            h("span", { className: "dsm-group-cpu" }, g.cpu.toFixed(1) + "%")
          ),
          h(
            "div",
            { className: "dsm-group-meta" },
            h("span", null, "CPU " + g.cpu.toFixed(1) + "%"),
            h("span", null, "MEM " + g.mem.toFixed(1) + "%"),
            h("span", null, t("groupsCount", { count: g.count }))
          ),
          g.command ? h("div", { className: "dsm-proc-cmd", title: g.command }, g.command) : null,
          open ? h(
            "div",
            { className: "dsm-group-detail" },
            h(
              "div",
              { className: "dsm-group-pids" },
              g.pids.map(function(pid) {
                return h("span", { className: "dsm-group-pid", key: pid }, "PID " + pid);
              })
            ),
            h(
              "div",
              { className: "dsm-proc-detail" },
              ProcessDetailRow(t("command"), g.command || "—"),
              ProcessDetailRow(t("user"), g.users && g.users.length ? g.users.join(", ") : "—"),
              ProcessDetailRow("RSS", fmtBytes(g.rssBytes))
            )
          ) : null
        );
      }
      function ProcessesPanel(props) {
        var data = props.data;
        var error = props.error;
        var stale = props.stale;
        var query = props.query;
        var setQuery = props.setQuery;
        var sortKey = props.sortKey;
        var order = props.order;
        var toggleSort = props.toggleSort;
        var onLoadMore = props.onLoadMore;
        var view = props.view;
        var setView = props.setView;
        if (error && !data) return ErrorBox(error);
        if (!data) return LoadingBox();
        var isGroup = data.aggregate === true;
        var rows = data.processes || [];
        var groups = data.groups || [];
        var hasMore = data.matched > (isGroup ? groups.length : rows.length);
        var sourceText = sourceLabel(data.source);
        var countText = isGroup ? data.groupsTotal != null ? t("groupsTotalMatched", { total: data.groupsTotal, matched: data.matched }) : t("matchedCount", { matched: data.matched }) : query ? t("processesTotalMatched", { total: data.total, matched: data.matched }) : t("processesTotal", { total: data.total });
        return h(
          "div",
          { className: "dsm-panel" },
          stale ? StaleBanner(stale) : null,
          h(
            "div",
            { className: "dsm-count", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h("span", { className: "dsm-muted" }, t("sourceValue", { source: sourceText })),
            h("span", { className: "dsm-muted" }, countText)
          ),
          h("input", {
            className: "dsm-search",
            type: "text",
            placeholder: t("searchProcess"),
            value: query || "",
            onChange: function(e) {
              setQuery(e.target.value);
            }
          }),
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
            isGroup ? h("span", { className: "dsm-muted dsm-count" }, t("byAggregatedCpu")) : h(
              "div",
              { className: "dsm-sortchips" },
              SortChip("CPU", "cpu", sortKey, order, toggleSort),
              SortChip(t("mem"), "mem", sortKey, order, toggleSort),
              SortChip("PID", "pid", sortKey, order, toggleSort),
              SortChip(t("name"), "name", sortKey, order, toggleSort)
            ),
            h(
              "div",
              { className: "dsm-viewtoggle" },
              h("button", { className: view === "list" ? "dsm-view-active" : "", onClick: function() {
                setView("list");
              } }, t("list")),
              h("button", { className: view === "group" ? "dsm-view-active" : "", onClick: function() {
                setView("group");
              } }, t("grouped"))
            )
          ),
          isGroup ? h(
            "div",
            { className: "dsm-proc-list" },
            groups.map(function(g, i) {
              return h(ProcessGroupCard, { g, key: g.name + "|" + i });
            })
          ) : h(
            "div",
            { className: "dsm-panel" },
            h(
              "div",
              { className: "dsm-proc-table-wrap" },
              h(
                "table",
                { className: "dsm-table" },
                h("thead", null, h(
                  "tr",
                  null,
                  h("th", { className: "dsm-num" }, "PID"),
                  h("th", null, t("processes")),
                  h("th", null, t("user")),
                  h("th", { className: "dsm-num" }, "CPU%"),
                  h("th", { className: "dsm-num" }, "MEM%"),
                  h("th", null, t("command"))
                )),
                h("tbody", null, rows.map(function(p) {
                  return h(
                    "tr",
                    { key: p.pid },
                    h("td", { className: "dsm-num" }, p.pid),
                    h("td", { className: "dsm-mono" }, p.name),
                    h("td", null, p.user),
                    h("td", { className: "dsm-num" }, p.cpu.toFixed(1)),
                    h("td", { className: "dsm-num" }, p.mem.toFixed(1)),
                    h("td", { className: "dsm-command", title: p.command }, p.command)
                  );
                }))
              )
            ),
            h(
              "div",
              { className: "dsm-proc-list" },
              rows.map(function(p) {
                return h(ProcessCard, { p, key: p.pid });
              })
            )
          ),
          hasMore ? h("button", { className: "dsm-loadmore", onClick: onLoadMore }, t("loadMore")) : null
        );
      }
      function aggregatePorts(ports) {
        var groups = {};
        var order = [];
        (ports || []).forEach(function(p) {
          var key = (p.hostPort != null ? p.hostPort : "") + "|" + (p.containerPort != null ? p.containerPort : "") + "|" + (p.protocol || "tcp");
          if (!groups[key]) {
            groups[key] = { port: p, dual: false };
            order.push(key);
          }
          var ip = p.hostIp || "";
          if (ip.indexOf(":") >= 0) groups[key].dual = true;
          else if (ip === "0.0.0.0" || ip === "") groups[key].dual = true;
        });
        return order.map(function(k) {
          return groups[k];
        });
      }
      function DockerPanel(props) {
        var data = props.data;
        var error = props.error;
        var stale = props.stale;
        var showToast = props.showToast;
        var queryState = useState("");
        var query = queryState[0];
        var setQuery = queryState[1];
        var filterState = useState("all");
        var filter = filterState[0];
        var setFilter = filterState[1];
        var portMenuState = useState(null);
        var portMenu = portMenuState[0];
        var setPortMenu = portMenuState[1];
        if (error && !data) return ErrorBox(error);
        if (!data) return LoadingBox();
        if (!data.available) {
          return h(
            "div",
            { className: "dsm-panel" },
            h("div", { className: "dsm-state dsm-error", title: data.error || "" }, t("dockerUnavailableDetail", { detail: data.error || t("dockerSockMissing") }))
          );
        }
        var s = data.summary;
        var containers = data.containers || [];
        var issueCount = s.issues != null ? s.issues : containers.filter(isContainerIssue).length;
        var stoppedCount = s.stopped != null ? s.stopped : containers.filter(isContainerStopped).length;
        var q = (query || "").toLowerCase();
        var filtered = containers.filter(function(c) {
          if (q) {
            var portsText = (c.ports || []).map(function(p) {
              return (p.hostPort != null ? p.hostPort : "") + " " + (p.containerPort != null ? p.containerPort : "");
            }).join(" ");
            var hay = (c.name + " " + c.image + " " + portsText + " " + (c.status || "") + " " + (c.health || "")).toLowerCase();
            if (hay.indexOf(q) < 0) return false;
          }
          if (filter === "running" && c.state !== "running") return false;
          if (filter === "stopped" && !isContainerStopped(c)) return false;
          if (filter === "issues" && !isContainerIssue(c)) return false;
          return true;
        });
        var filters = [
          ["all", t("all"), s.total],
          ["running", t("running"), s.running],
          ["stopped", t("stoppedState"), stoppedCount],
          ["issues", t("issues"), issueCount]
        ];
        function openPort(p, protocol) {
          if (!isPublishedPort(p) || isLoopbackPort(p)) return;
          window.open(protocol + "://" + portHost(p) + ":" + p.hostPort, "_blank");
        }
        function copyPort(p) {
          if (!isPublishedPort(p)) return;
          copyText(portHost(p) + ":" + p.hostPort, function(ok) {
            showToast(ok ? t("copiedAddr") : t("copyFailed"));
          });
        }
        function handlePortClick(p) {
          if (!isPublishedPort(p)) {
            showToast(t("notPublishedToast"));
            return;
          }
          if (isLoopbackPort(p)) {
            showToast(t("hostLocalToast"));
            return;
          }
          var proto = portWebProtocol(p);
          if (proto) openPort(p, proto);
          else copyPort(p);
        }
        function portChips(c) {
          var ports = aggregatePorts(c.ports);
          if (!ports.length) {
            return h("span", { className: "dsm-port-none" }, t("noPortMappings"));
          }
          return h(
            "div",
            { className: "dsm-port-chips" },
            ports.map(function(item, i) {
              var p = item.port;
              if (!isPublishedPort(p)) {
                return h(
                  "span",
                  {
                    key: "u" + i,
                    className: "dsm-port-chip dsm-port-chip-locked dsm-port-chip-unpub",
                    title: t("titleUnpublished")
                  },
                  h("span", { className: "dsm-port-ico" }, "🔒"),
                  String(p.containerPort) + "/" + (p.protocol || "tcp"),
                  h("span", { className: "dsm-port-tag" }, t("containerOnly"))
                );
              }
              if (isLoopbackPort(p)) {
                return h(
                  "span",
                  {
                    key: "l" + i,
                    className: "dsm-port-chip dsm-port-chip-locked dsm-port-chip-loop",
                    title: t("titleHostLocal", { host: portHost(p), port: p.hostPort })
                  },
                  h("span", { className: "dsm-port-ico" }, "🔒"),
                  String(p.hostPort),
                  h("span", { className: "dsm-port-tag" }, t("hostOnly"))
                );
              }
              var proto = portWebProtocol(p);
              var label = proto ? String(p.hostPort) + " → " + String(p.containerPort) : String(p.hostPort);
              var tooltip = t("tooltipPort", { host: portHost(p), port: p.hostPort, cport: p.containerPort, proto: p.protocol || "tcp" });
              return h(
                "button",
                {
                  key: String(i) + label,
                  className: "dsm-port-chip" + (proto ? " dsm-port-chip-web" : ""),
                  title: tooltip,
                  onClick: function() {
                    handlePortClick(p);
                  },
                  onContextMenu: function(e) {
                    e.preventDefault();
                    setPortMenu({ x: e.clientX, y: e.clientY, port: p });
                  }
                },
                h("span", { className: "dsm-port-ico" }, proto ? "🌐" : "📋"),
                label,
                item.dual ? h("span", { className: "dsm-port-tag" }, "IPv4 + IPv6") : null
              );
            })
          );
        }
        return h(
          "div",
          { className: "dsm-panel" },
          stale ? StaleBanner(stale) : null,
          h(
            "div",
            { className: "dsm-chips" },
            Chip(t("total"), s.total, "#8b8fa3"),
            Chip(t("running"), s.running, COLORS.ok),
            Chip(t("stoppedState"), stoppedCount, COLORS.muted),
            Chip(t("issues"), issueCount, issueCount > 0 ? COLORS.err : COLORS.ok)
          ),
          h("input", {
            className: "dsm-search",
            type: "text",
            placeholder: t("searchContainer"),
            value: query || "",
            onChange: function(e) {
              setQuery(e.target.value);
            }
          }),
          h(
            "div",
            { className: "dsm-filterchips" },
            filters.map(function(f) {
              return h("button", {
                key: f[0],
                className: "dsm-filterchip" + (filter === f[0] ? " dsm-filterchip-active" : ""),
                onClick: function() {
                  setFilter(f[0]);
                }
              }, f[1], h("span", { className: "dsm-filterchip-count" }, String(f[2])));
            })
          ),
          h("div", { className: "dsm-muted dsm-count" }, t("showingContainers", { count: filtered.length })),
          h(
            "div",
            { className: "dsm-docker-table-wrap" },
            h(
              "table",
              { className: "dsm-table" },
              h("thead", null, h(
                "tr",
                null,
                h("th", null, t("container")),
                h("th", null, t("status")),
                h("th", { className: "dsm-num" }, "CPU%"),
                h("th", { className: "dsm-num" }, t("mem")),
                h("th", null, t("ports"))
              )),
              h("tbody", null, filtered.map(function(c) {
                var badge = containerStatusBadge(c);
                return h(
                  "tr",
                  { key: c.id },
                  h(
                    "td",
                    null,
                    h("div", { className: "dsm-docker-name" }, c.name),
                    h("div", { className: "dsm-muted dsm-docker-image", title: c.image }, c.image)
                  ),
                  h(
                    "td",
                    null,
                    h("span", { className: "dsm-state-dot", style: { background: badge.color } }),
                    h("span", { style: { color: badge.color } }, badge.label)
                  ),
                  h("td", { className: "dsm-num", title: c.statsError || "" }, (c.statsError ? "⚠ " : "") + (c.cpuUsage != null ? c.cpuUsage.toFixed(1) : t("sampling"))),
                  h("td", { className: "dsm-num", title: c.statsError || "" }, containerMemText(c)),
                  h("td", null, portChips(c))
                );
              }))
            )
          ),
          h(
            "div",
            { className: "dsm-docker-list" },
            filtered.map(function(c) {
              var badge = containerStatusBadge(c);
              return h(
                "div",
                { className: "dsm-container-card", key: c.id },
                h(
                  "div",
                  { className: "dsm-container-head" },
                  h("span", { className: "dsm-state-dot", style: { background: badge.color } }),
                  h("span", { className: "dsm-container-name", title: c.name }, c.name),
                  h("span", { className: "dsm-container-state", style: { color: badge.color, marginLeft: "auto", flex: "none", fontSize: 11 } }, badge.label)
                ),
                h("div", { className: "dsm-container-image", title: c.image }, c.image),
                h(
                  "div",
                  { className: "dsm-container-stats" },
                  h(
                    "span",
                    { className: "dsm-container-stat" },
                    h("span", { className: "dsm-muted" }, "CPU"),
                    h("span", { title: c.statsError || "" }, (c.statsError ? "⚠ " : "") + (c.cpuUsage != null ? c.cpuUsage.toFixed(1) + "%" : t("sampling")))
                  ),
                  h(
                    "span",
                    { className: "dsm-container-stat" },
                    h("span", { className: "dsm-muted" }, t("mem")),
                    h("span", { title: c.statsError || "" }, containerMemText(c))
                  )
                ),
                h(
                  "div",
                  { className: "dsm-port-block" },
                  portChips(c)
                ),
                c.status ? h("div", { className: "dsm-container-uptime" }, formatContainerStatus(c.status)) : null
              );
            })
          ),
          portMenu ? h(
            "div",
            { className: "dsm-portmenu-backdrop", onClick: function() {
              setPortMenu(null);
            } },
            h(
              "div",
              { className: "dsm-portmenu", style: { left: portMenu.x, top: portMenu.y }, onClick: function(e) {
                e.stopPropagation();
              } },
              isLoopbackPort(portMenu.port) ? h("div", { className: "dsm-menu-sep" }) : null,
              isLoopbackPort(portMenu.port) ? null : h("button", { onClick: function() {
                openPort(portMenu.port, "http");
                setPortMenu(null);
              } }, t("httpOpen")),
              isLoopbackPort(portMenu.port) ? null : h("button", { onClick: function() {
                openPort(portMenu.port, "https");
                setPortMenu(null);
              } }, t("httpsOpen")),
              h("button", { onClick: function() {
                copyPort(portMenu.port);
                setPortMenu(null);
              } }, isLoopbackPort(portMenu.port) ? t("copyAddressHostLocal") : t("copyAddress"))
            )
          ) : null
        );
      }
      function SourceModal(props) {
        var env = props.env || {};
        var sources = env.sources || {};
        var consistency = env.consistency || { warnings: [] };
        function row(k, v) {
          return h(
            "div",
            { className: "dsm-kv-row" },
            h("span", { className: "dsm-muted" }, k),
            h("span", { className: "dsm-kv-val dsm-mono", title: v }, v)
          );
        }
        var hostOr = env.systemSource === "host" ? t("host") : t("currentContainer");
        var procOr = env.processSource === "host" ? t("host") : t("currentContainer");
        var modeLabel = env.mode === "container" ? t("containerView") : env.mode === "host" ? t("hostView") : "—";
        var dockerLabel = env.dockerSource === "host" ? t("sourceWithPath", { origin: t("host"), path: sources.dockerSocket || "/var/run/docker.sock" }) : env.dockerSource === "unavailable" ? t("unavailable") : "—";
        return h(
          "div",
          { className: "dsm-modal-backdrop", onClick: props.onClose },
          h(
            "div",
            { className: "dsm-modal", onClick: function(e) {
              e.stopPropagation();
            } },
            h("button", { className: "dsm-modal-close", onClick: props.onClose, "aria-label": t("close") }, "×"),
            h("div", { className: "dsm-modal-title" }, t("dataSources")),
            h(
              "div",
              { className: "dsm-kv" },
              row(t("runtime"), modeLabel),
              row(t("loadUptime"), t("sourceWithPath", { origin: hostOr, path: sources.loadavg + " / " + sources.uptime })),
              row(t("cpuCoresModel"), t("sourceWithPath", { origin: hostOr, path: sources.cpuinfo })),
              row(t("kernelVersion"), t("sourceWithPath", { origin: hostOr, path: sources.osrelease })),
              row(t("operatingSystem"), t("sourceWithPath", { origin: hostOr, path: sources.osRelease })),
              row(t("networkInterfaces"), t("sourceWithPath", { origin: hostOr, path: sources.netDev + " + " + sources.fibTrie })),
              row(t("disk"), t("sourceWithPath", { origin: hostOr, path: sources.mounts + " + " + sources.mountinfo })),
              row(t("processes"), t("sourceWithPath", { origin: procOr, path: sources.processes })),
              row("Docker", dockerLabel)
            ),
            consistency.warnings && consistency.warnings.length ? h(
              "div",
              { className: "dsm-consistency" },
              h("div", { className: "dsm-consistency-head" }, t("consistencyCheck")),
              consistency.warnings.map(function(w, i) {
                return h("div", { className: "dsm-consistency-item", key: i }, w);
              })
            ) : null
          )
        );
      }
      function AboutModal(props) {
        function row(k, v) {
          return h(
            "div",
            { className: "dsm-kv-row" },
            h("span", { className: "dsm-muted" }, k),
            h("span", { className: "dsm-kv-val dsm-mono" }, v)
          );
        }
        var env = props.env || {};
        var sysSrc = env.systemSource === "host" ? t("host") : env.systemSource === "container" ? t("currentContainer") : "—";
        var procSrc = env.processSource === "host" ? t("host") : env.processSource === "container" ? t("currentContainer") : "—";
        var dockSrc = env.dockerSource === "host" ? t("host") : env.dockerSource === "unavailable" ? t("unavailable") : "—";
        function yn(v) {
          return v ? t("yes") : t("no");
        }
        function probeLabel(p) {
          if (p === "host-netns") return t("netProbeHost");
          if (p === "container-netns") return t("netProbeContainer");
          return t("unavailable");
        }
        var st = props.meta && props.meta.status;
        var caps = props.meta && props.meta.capabilities;
        var consistency = st && st.consistency;
        return h(
          "div",
          { className: "dsm-modal-backdrop", onClick: props.onClose },
          h(
            "div",
            { className: "dsm-modal", onClick: function(e) {
              e.stopPropagation();
            } },
            h("button", { className: "dsm-modal-close", onClick: props.onClose, "aria-label": t("close") }, "×"),
            h("div", { className: "dsm-modal-title" }, t("about")),
            h(
              "div",
              { className: "dsm-kv" },
              row("Browser", "v" + CLIENT_VERSION),
              row("Host", props.hostVersion ? "v" + props.hostVersion : t("unknownHostVersion")),
              row("RPC", "v" + PROTOCOL_VERSION),
              row(t("runtime"), env.mode === "container" ? t("containerView") : env.mode === "host" ? t("hostView") : "—"),
              row(t("systemData"), sysSrc),
              row(t("processData"), procSrc),
              row(t("dockerData"), dockSrc)
            ),
            props.meta ? h(
              "div",
              { className: "dsm-consistency", style: { marginTop: 10 } },
              h("div", { className: "dsm-consistency-head" }, t("aboutHostRuntime")),
              h(
                "div",
                { className: "dsm-kv" },
                row(t("aboutStarted"), fmtTimestamp(props.meta.startedAt)),
                row(t("aboutRuntimeId"), String(props.meta.runtimeId).slice(0, 8) + "…"),
                row(t("aboutNode"), props.meta.nodeVersion + " · " + props.meta.platform + "/" + props.meta.arch)
              )
            ) : null,
            st ? h(
              "div",
              { className: "dsm-consistency", style: { marginTop: 10 } },
              h("div", { className: "dsm-consistency-head" }, t("status")),
              h(
                "div",
                { className: "dsm-kv" },
                row(t("systemData"), sourceLabel(st.systemSource)),
                row(t("processData"), sourceLabel(st.processSource)),
                row(t("dockerData"), st.dockerSource === "host" ? t("host") : st.dockerSource === "unavailable" ? t("unavailable") : "—"),
                row(t("networkProbe"), probeLabel(st.networkProbe)),
                row(t("consistencyCheck"), consistency && consistency.warnings && consistency.warnings.length ? t("consistencyWarn", { n: consistency.warnings.length }) : t("consistencyOk"))
              )
            ) : null,
            caps ? h(
              "div",
              { className: "dsm-consistency", style: { marginTop: 10 } },
              h("div", { className: "dsm-consistency-head" }, t("capabilities")),
              h(
                "div",
                { className: "dsm-kv" },
                row(t("capHostMount"), yn(caps.hostMount)),
                row(t("capDockerSocket"), yn(caps.dockerSocket)),
                row(t("capHostNetNs"), yn(caps.hostNetNsProbe)),
                row(t("capProcessAggregate"), yn(caps.processAggregate)),
                row(t("capContainerStats"), yn(caps.containerStats))
              )
            ) : null,
            props.mismatch ? h(
              "div",
              { className: "dsm-consistency" },
              h("div", { className: "dsm-consistency-head" }, t("versionMismatchHead")),
              h("div", { className: "dsm-consistency-item" }, t("versionMismatchDetail"))
            ) : null
          )
        );
      }
      function computeAlerts(overview, containers) {
        var out = [];
        if (!overview) return out;
        (overview.disks || []).forEach(function(d) {
          if (d.usage != null && d.usage >= 90) out.push(t("alertDisk", { mount: d.mount, pct: d.usage.toFixed(0) }));
        });
        if (overview.swap && overview.swap.usage >= 50 && overview.memoryUsage != null && overview.memoryUsage >= 85) {
          out.push(t("alertSwap", { swap: overview.swap.usage.toFixed(0), mem: overview.memoryUsage.toFixed(0) }));
        }
        (overview.temperatures || []).forEach(function(x) {
          if (x.celsius >= 85) out.push(t("alertTemp", { name: thermalName(x), celsius: x.celsius.toFixed(0) }));
        });
        if (containers && containers.available && containers.summary && containers.summary.unhealthy > 0) {
          out.push(t("alertUnhealthy", { n: containers.summary.unhealthy }));
        }
        return out;
      }
      function buildDiagnostic(overview, processes, containers) {
        var L = [];
        var env = overview && overview.environment;
        L.push(t("diagTitle"));
        L.push("");
        L.push(t("diagHost", { value: env ? env.hostname : "—" }));
        L.push(t("diagRuntime", { value: env && env.mode === "container" ? t("containerView") : env && env.mode === "host" ? t("hostView") : "—" }));
        L.push(t("diagSystemSource", { value: env ? sourceLabel(env.systemSource) : "—" }));
        L.push(t("diagProcessSource", { value: env ? sourceLabel(env.processSource) : "—" }));
        L.push(t("diagDockerSource", { value: env && env.dockerSource === "host" ? t("host") : env && env.dockerSource === "unavailable" ? t("unavailable") : "—" }));
        if (overview) {
          L.push("");
          L.push(t("diagCpu"));
          L.push(overview.cpuModel);
          L.push(t("diagUsage", { value: overview.cpuUsage != null ? overview.cpuUsage.toFixed(1) + "%" : t("sampling") }));
          L.push(t("diagCores", { value: overview.cpuCores }));
          L.push("");
          L.push(t("diagMemory"));
          L.push(fmtBytes(overview.memoryUsed) + " / " + fmtBytes(overview.memoryTotal));
          L.push(overview.memoryUsage != null ? overview.memoryUsage.toFixed(1) + "%" : t("sampling"));
          L.push("");
          L.push(t("diagLoad"));
          L.push("1m  " + (overview.load1 != null ? overview.load1.toFixed(2) : "—"));
          L.push("5m  " + (overview.load5 != null ? overview.load5.toFixed(2) : "—"));
          L.push("15m " + (overview.load15 != null ? overview.load15.toFixed(2) : "—"));
          L.push("");
          L.push(t("diagDisk"));
          (overview.disks || []).forEach(function(d) {
            L.push(d.mount + "  " + fmtBytes(d.used) + " / " + fmtBytes(d.total) + " (" + (d.usage != null ? d.usage.toFixed(1) : "—") + "%)");
          });
        }
        L.push("");
        if (containers && containers.available) {
          L.push(t("diagDocker", { value: containers.summary.total + " / " + containers.summary.running + " / " + (containers.summary.issues || 0) }));
          L.push(t("diagStat", { label: t("total"), n: containers.summary.total }));
          L.push(t("diagStat", { label: t("running"), n: containers.summary.running }));
          L.push(t("diagStat", { label: t("issues"), n: containers.summary.issues || 0 }));
        } else {
          L.push(t("diagDocker", { value: t("unavailable") }));
        }
        if (processes && processes.processes) {
          L.push("");
          L.push(t("diagTopProcesses"));
          processes.processes.slice(0, 10).forEach(function(p) {
            L.push(p.name + "       CPU " + (p.cpu != null ? p.cpu.toFixed(1) : "—") + "% MEM " + (p.mem != null ? p.mem.toFixed(1) : "—") + "%");
          });
        }
        return L.join("\n");
      }
      function TrendCard(props) {
        var v = props.value;
        return h(
          "div",
          { className: "dsm-metric" },
          h(
            "div",
            { className: "dsm-metric-head" },
            h("span", { className: "dsm-metric-label" }, props.label),
            h("span", { className: "dsm-metric-value", style: { color: props.color } }, v != null ? props.format(v) : "…")
          ),
          h(Sparkline, { data: props.history || [], color: props.color, fill: true, fillOpacity: 0.16 })
        );
      }
      function PerCoreBars(props) {
        var perCpu = props.perCpu;
        if (!perCpu) return h("div", { className: "dsm-muted" }, t("notSupported"));
        return h("div", { className: "dsm-percore" }, perCpu.map(function(c) {
          var v = c.usage;
          var color = v == null ? "rgba(255,255,255,.12)" : colorForPct(v);
          return h(
            "div",
            { className: "dsm-core", key: c.index, title: "CPU " + c.index + (v == null ? "" : " · " + v.toFixed(1) + "%") },
            h(
              "div",
              { className: "dsm-core-bar" },
              h("div", { className: "dsm-core-fill", style: { height: (v == null ? 0 : v) + "%", background: color } })
            ),
            h("span", { className: "dsm-core-label" }, String(c.index)),
            h("span", { className: "dsm-core-val" }, v == null ? "…" : v.toFixed(0) + "%")
          );
        }));
      }
      function WindowPicker(props) {
        var opts = [[60, "1"], [300, "5"], [600, "10"]];
        return h("div", { className: "dsm-viewtoggle" }, opts.map(function(o) {
          return h("button", {
            key: o[0],
            className: props.value === o[0] ? "dsm-view-active" : "",
            onClick: function() {
              props.onChange(o[0]);
            }
          }, t("minutesN", { n: o[1] }));
        }));
      }
      function PerformanceView(props) {
        var samples = props.samples || [];
        var overview = props.overview;
        function col(k) {
          return samples.map(function(x) {
            return x[k];
          }).filter(function(v) {
            return v != null;
          });
        }
        function last(k) {
          var a = col(k);
          return a.length ? a[a.length - 1] : null;
        }
        var head = h(
          "div",
          { className: "dsm-row-between" },
          h("span", { className: "dsm-section-head" }, t("trendTitle")),
          h(WindowPicker, { value: props.window, onChange: props.onWindow })
        );
        var grid = h(
          "div",
          { className: "dsm-metrics-grid" },
          h(MetricCard, { label: t("cpuUsage"), value: last("cpu"), suffix: "%", color: COLORS.cpu, history: col("cpu") }),
          h(MetricCard, { label: t("memoryUsage"), value: last("mem"), suffix: "%", color: COLORS.mem, history: col("mem"), fillOpacity: 0.2 }),
          h(MetricCard, { label: t("swapUsage"), value: last("swap"), suffix: "%", color: COLORS.warn, history: col("swap") }),
          h(TrendCard, { label: t("loadAverage1"), value: last("load1"), format: function(v) {
            return v.toFixed(2);
          }, color: COLORS.ok, history: col("load1") }),
          h(TrendCard, { label: t("download"), value: last("netRx"), format: fmtRate, color: COLORS.netRx, history: col("netRx") }),
          h(TrendCard, { label: t("upload"), value: last("netTx"), format: fmtRate, color: COLORS.netTx, history: col("netTx") }),
          h(TrendCard, { label: t("diskRead"), value: last("diskRead"), format: fmtRate, color: "#f5a524", history: col("diskRead") }),
          h(TrendCard, { label: t("diskWrite"), value: last("diskWrite"), format: fmtRate, color: "#e879f9", history: col("diskWrite") })
        );
        var cores = h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("perCoreCpu")),
          h(PerCoreBars, { perCpu: overview ? overview.perCpu : null })
        );
        return h(
          "div",
          { className: "dsm-panel" },
          head,
          samples.length < 2 ? h("div", { className: "dsm-muted dsm-sub", style: { marginTop: 8 } }, t("historyEmpty")) : null,
          grid,
          cores
        );
      }
      function ExtraCards(overview) {
        var cards = [];
        if (overview.swap) {
          var sio = overview.swapIo;
          var swapSub = fmtBytes(overview.swap.used) + " / " + fmtBytes(overview.swap.total);
          if (sio) swapSub = t("swapRateSub", { used: swapSub, inRate: sio.inBytesPerSec != null ? fmtRate(sio.inBytesPerSec) : "—", outRate: sio.outBytesPerSec != null ? fmtRate(sio.outBytesPerSec) : "—" });
          cards.push(h(MetricCard, { key: "swap", label: t("swapUsage"), value: overview.swap.usage, suffix: "%", color: COLORS.warn, history: [], sub: swapSub }));
        }
        cards.push(h(
          "div",
          { key: "threads", className: "dsm-kpi" },
          h("div", { className: "dsm-kpi-head" }, t("threads")),
          h("span", { className: "dsm-kpi-value" }, overview.threadCount != null ? String(overview.threadCount) : "—"),
          h("span", { className: "dsm-kpi-sub" }, t("runnableCount", { n: overview.runnableCount != null ? overview.runnableCount : "—" }))
        ));
        var io = overview.diskIo;
        cards.push(h(
          "div",
          { key: "io", className: "dsm-kpi" },
          h("div", { className: "dsm-kpi-head" }, t("diskIo")),
          h(
            "div",
            { className: "dsm-kpi-row" },
            h("span", { className: "dsm-dot", style: { background: "#f5a524" } }),
            t("diskRead"),
            h("span", { className: "dsm-kpi-val" }, io && io.readBytesPerSec != null ? fmtRate(io.readBytesPerSec) : "—")
          ),
          h(
            "div",
            { className: "dsm-kpi-row" },
            h("span", { className: "dsm-dot", style: { background: "#e879f9" } }),
            t("diskWrite"),
            h("span", { className: "dsm-kpi-val" }, io && io.writeBytesPerSec != null ? fmtRate(io.writeBytesPerSec) : "—")
          )
        ));
        return cards;
      }
      function MemBreakdownSection(overview) {
        var mb = overview.memoryBreakdown;
        if (!mb) return null;
        var rows = [[t("memFree"), mb.free], [t("memBuffers"), mb.buffers], [t("memCached"), mb.cached], [t("memAvailable"), mb.available]];
        return h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("memBreakdown")),
          h("div", { className: "dsm-kv" }, rows.map(function(r) {
            return h(
              "div",
              { className: "dsm-kv-row", key: r[0] },
              h("span", { className: "dsm-muted" }, r[0]),
              h("span", { className: "dsm-kv-val" }, r[1] != null ? fmtBytes(r[1]) : "—")
            );
          }))
        );
      }
      var VIEW_KEY = "dsh-side-monitor:view";
      var VIEW_TABS = ["overview", "performance", "processes", "docker", "hardware"];
      function readStoredView() {
        try {
          var v = localStorage.getItem(VIEW_KEY);
          return VIEW_TABS.indexOf(v) >= 0 ? v : "overview";
        } catch (e) {
          return "overview";
        }
      }
      function storeView(v) {
        try {
          localStorage.setItem(VIEW_KEY, v);
        } catch (e) {
        }
      }
      var THERMAL_LABEL_KEYS = { cpuPackage: "tempCpuPackage", mainboardAcpi: "tempMainboardAcpi", nvme: "tempNvme", disk: "tempDisk", gpu: "tempGpu" };
      function thermalName(x) {
        var k = x && x.key ? THERMAL_LABEL_KEYS[x.key] : null;
        return k ? t(k) : x && x.name || "—";
      }
      function TemperatureSection(overview) {
        var temps = overview.temperatures || [];
        return h(
          "div",
          { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, t("temperature")),
          temps.length ? h("div", { className: "dsm-kv" }, temps.map(function(x, i) {
            var color = x.celsius >= 85 ? COLORS.err : x.celsius >= 70 ? COLORS.warn : COLORS.ok;
            return h(
              "div",
              { className: "dsm-kv-row", key: x.name + i },
              h("span", { className: "dsm-muted dsm-mono", title: x.type || x.name }, thermalName(x)),
              h("span", { className: "dsm-kv-val", style: { color } }, x.celsius.toFixed(1) + " °C")
            );
          })) : h("div", { className: "dsm-muted" }, t("noTempSensor"))
        );
      }
      function HardwareView(props) {
        var o = props.overview;
        if (!o) return LoadingBox();
        return h(
          "div",
          { className: "dsm-panel" },
          SystemSection(o),
          TemperatureSection(o),
          DiskPartitionsSection(o),
          InterfacesSection(o)
        );
      }
      function DaemonInfoCard(props) {
        var info = props.info;
        var head = h("div", { className: "dsm-section-head" }, t("daemonInfo"));
        if (!info) return h("div", { className: "dsm-section" }, head, h("div", { className: "dsm-muted" }, t("loading")));
        if (!info.available) return h("div", { className: "dsm-section" }, head, h("div", { className: "dsm-muted" }, t("dockerDaemonUnavailable")));
        var d = info.daemon;
        var rows = [
          [t("daemonVersion"), d.serverVersion || "—"],
          [t("daemonApiVersion"), d.apiVersion || "—"],
          [t("operatingSystem"), d.operatingSystem || "—"],
          [t("kernel"), d.kernelVersion || "—"],
          [t("storageDriver"), d.storageDriver || "—"],
          [t("images"), d.images != null ? String(d.images) : "—"],
          ["CPU", d.cpus != null ? String(d.cpus) : "—"],
          [t("totalMemory"), d.memTotal != null ? fmtBytes(d.memTotal) : "—"],
          [t("dockerContainers"), t("dockerRunningStopped", {
            running: d.running != null ? d.running : "—",
            stopped: d.stopped != null ? d.stopped : "—",
            paused: d.paused != null ? d.paused : "—"
          })]
        ];
        return h(
          "div",
          { className: "dsm-section" },
          head,
          h("div", { className: "dsm-kv" }, rows.map(function(r) {
            return h(
              "div",
              { className: "dsm-kv-row", key: r[0] },
              h("span", { className: "dsm-muted" }, r[0]),
              h("span", { className: "dsm-kv-val", title: r[1] }, r[1])
            );
          }))
        );
      }
      function MonitorDrawerBody(props) {
        var connection = props.connection || (props.ctx ? props.ctx.connection : null);
        var tabState = useState(readStoredView);
        var tab = tabState[0];
        var setTab = tabState[1];
        var overviewState = useState(null);
        var overview = overviewState[0];
        var setOverview = overviewState[1];
        var processesState = useState(null);
        var processes = processesState[0];
        var setProcesses = processesState[1];
        var containersState = useState(null);
        var containers = containersState[0];
        var setContainers = containersState[1];
        var overviewErrorState = useState(null);
        var overviewError = overviewErrorState[0];
        var setOverviewError = overviewErrorState[1];
        var processErrorState = useState(null);
        var processError = processErrorState[0];
        var setProcessError = processErrorState[1];
        var dockerErrorState = useState(null);
        var dockerError = dockerErrorState[0];
        var setDockerError = dockerErrorState[1];
        var overviewUpdatedState = useState(null);
        var overviewUpdated = overviewUpdatedState[0];
        var setOverviewUpdated = overviewUpdatedState[1];
        var processUpdatedState = useState(null);
        var processUpdated = processUpdatedState[0];
        var setProcessUpdated = processUpdatedState[1];
        var dockerUpdatedState = useState(null);
        var dockerUpdated = dockerUpdatedState[0];
        var setDockerUpdated = dockerUpdatedState[1];
        var cpuHistory = useRef([]);
        var memHistory = useRef([]);
        var procQueryState = useState("");
        var procQuery = procQueryState[0];
        var setProcQuery = procQueryState[1];
        var procQueryDState = useState("");
        var procQueryD = procQueryDState[0];
        var setProcQueryD = procQueryDState[1];
        var procSortState = useState("cpu");
        var procSort = procSortState[0];
        var setProcSort = procSortState[1];
        var procOrderState = useState("desc");
        var procOrder = procOrderState[0];
        var setProcOrder = procOrderState[1];
        var procLimitState = useState(60);
        var procLimit = procLimitState[0];
        var setProcLimit = procLimitState[1];
        var refreshVersionState = useState(0);
        var refreshVersion = refreshVersionState[0];
        var setRefreshVersion = refreshVersionState[1];
        var refreshingState = useState(false);
        var refreshing = refreshingState[0];
        var setRefreshing = refreshingState[1];
        var menuState = useState(false);
        var menuOpen = menuState[0];
        var setMenuOpen = menuState[1];
        var menuRef = useRef(null);
        var sourceModalState = useState(false);
        var sourceModal = sourceModalState[0];
        var setSourceModal = sourceModalState[1];
        var aboutModalState = useState(false);
        var aboutModal = aboutModalState[0];
        var setAboutModal = aboutModalState[1];
        var procViewState = useState("list");
        var procView = procViewState[0];
        var setProcView = procViewState[1];
        var hostVersionState = useState(null);
        var hostVersion = hostVersionState[0];
        var setHostVersion = hostVersionState[1];
        var metaState = useState(null);
        var meta = metaState[0];
        var setMeta = metaState[1];
        var versionMismatchState = useState(false);
        var versionMismatch = versionMismatchState[0];
        var setVersionMismatch = versionMismatchState[1];
        var toastState = useState("");
        var toast = toastState[0];
        var setToast = toastState[1];
        var toastTimer = useRef(null);
        var nowState = useState(Date.now());
        var now = nowState[0];
        var setNow = nowState[1];
        useLangTick();
        var histWindowState = useState(600);
        var histWindow = histWindowState[0];
        var setHistWindow = histWindowState[1];
        var histState = useState(null);
        var histData = histState[0];
        var setHistData = histState[1];
        var daemonState = useState(null);
        var daemon = daemonState[0];
        var setDaemon = daemonState[1];
        usePoll(function() {
          return callRpc(connection, "history", { sinceSeconds: histWindow }).then(function(res) {
            if (res && res.ok) setHistData(res.value);
          }).catch(function() {
          });
        }, 5e3, tab === "performance", [histWindow, tab, refreshVersion]);
        usePoll(function() {
          return callRpc(connection, "dockerInfo", {}).then(function(res) {
            if (res && res.ok) setDaemon(res.value);
          }).catch(function() {
          });
        }, 1e4, tab === "docker", [tab, refreshVersion]);
        useEffect(function() {
          var t2 = setTimeout(function() {
            setProcQueryD(procQuery);
          }, 250);
          return function() {
            clearTimeout(t2);
          };
        }, [procQuery]);
        useEffect(function() {
          var t2 = setInterval(function() {
            setNow(Date.now());
          }, 1e3);
          return function() {
            clearInterval(t2);
          };
        }, []);
        useEffect(function() {
          if (!menuOpen) return void 0;
          function onDoc(ev) {
            if (menuRef.current && !menuRef.current.contains(ev.target)) setMenuOpen(false);
          }
          document.addEventListener("mousedown", onDoc);
          return function() {
            document.removeEventListener("mousedown", onDoc);
          };
        }, [menuOpen]);
        function toggleProcSort(key) {
          if (procSort === key) setProcOrder(procOrder === "desc" ? "asc" : "desc");
          else {
            setProcSort(key);
            setProcOrder(key === "name" ? "asc" : "desc");
          }
        }
        function showToast(msg) {
          setToast(msg);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(function() {
            setToast("");
          }, 2200);
        }
        function refreshAll() {
          setRefreshing(true);
          setRefreshVersion(function(v) {
            return v + 1;
          });
          setMenuOpen(false);
          setTimeout(function() {
            setRefreshing(false);
          }, 900);
        }
        function copyDiagnostic() {
          setMenuOpen(false);
          var text = buildDiagnostic(overview, processes, containers);
          copyText(text, function(ok) {
            showToast(ok ? t("copiedDiagnostics") : t("copyFailed"));
          });
        }
        useEffect(function() {
          var cancelled = false;
          callRpc(connection, "meta", {}).then(function(res) {
            if (cancelled) return;
            if (!res || !res.ok || !res.value) {
              setVersionMismatch(true);
              return;
            }
            setMeta(res.value);
            setHostVersion(res.value.pluginVersion ? String(res.value.pluginVersion) : null);
            setVersionMismatch(res.value.protocolVersion !== PROTOCOL_VERSION);
          }).catch(function() {
            if (!cancelled) setVersionMismatch(true);
          });
          return function() {
            cancelled = true;
          };
        }, [connection]);
        useEffect(function() {
          var cancelled = false;
          callRpc(connection, "history", { sinceSeconds: 120 }).then(function(res) {
            if (cancelled || !res || !res.ok || !res.value) return;
            var s = res.value.samples || [];
            cpuHistory.current = s.map(function(x) {
              return x.cpu;
            }).filter(function(v) {
              return v != null;
            }).slice(-40);
            memHistory.current = s.map(function(x) {
              return x.mem;
            }).filter(function(v) {
              return v != null;
            }).slice(-40);
            setHistData(res.value);
          }).catch(function() {
          });
          return function() {
            cancelled = true;
          };
        }, [connection]);
        usePoll(function() {
          return callRpc(connection, "overview", {}).then(function(res) {
            if (res && res.ok) {
              setOverview(res.value);
              setOverviewError(null);
              setOverviewUpdated(Date.now());
              if (typeof res.value.cpuUsage === "number") pushHistory(cpuHistory, res.value.cpuUsage, 40);
              if (typeof res.value.memoryUsage === "number") pushHistory(memHistory, res.value.memoryUsage, 40);
            } else if (res && res.error) setOverviewError(res.error.message);
          }).catch(function(e) {
            setOverviewError(e && e.message ? e.message : String(e));
          });
        }, 2e3, true, [refreshVersion]);
        usePoll(function() {
          return callRpc(connection, "processes", { query: procQueryD, sort: procSort, order: procOrder, offset: 0, limit: procLimit, aggregate: procView === "group" }).then(function(res) {
            if (res && res.ok) {
              setProcesses(res.value);
              setProcessError(null);
              setProcessUpdated(Date.now());
            } else if (res && res.error) setProcessError(res.error.message);
          }).catch(function(e) {
            setProcessError(e && e.message ? e.message : String(e));
          });
        }, 3e3, tab === "processes", [procQueryD, procSort, procOrder, procLimit, procView, refreshVersion]);
        usePoll(function() {
          return callRpc(connection, "containers", { stats: tab === "docker" }).then(function(res) {
            if (res && res.ok) {
              setContainers(res.value);
              setDockerError(null);
              setDockerUpdated(Date.now());
            } else if (res && res.error) setDockerError(res.error.message);
          }).catch(function(e) {
            setDockerError(e && e.message ? e.message : String(e));
          });
        }, 5e3, tab === "overview" || tab === "docker", [refreshVersion, tab]);
        function staleInfo(error, updatedAt) {
          if (!error || !updatedAt) return null;
          var sec = Math.max(0, Math.round((now - updatedAt) / 1e3));
          return { ago: relTime(sec), msg: error };
        }
        var env = overview && overview.environment;
        function statusInfo() {
          var updatedAt, error;
          if (tab === "overview" || tab === "performance" || tab === "hardware") {
            updatedAt = overviewUpdated;
            error = overviewError;
          } else if (tab === "processes") {
            updatedAt = processUpdated;
            error = processError;
          } else {
            updatedAt = dockerUpdated;
            error = dockerError;
          }
          if (!updatedAt) return { color: "#9aa3b2", text: t("waitingFirstData") };
          var sec = Math.max(0, Math.round((now - updatedAt) / 1e3));
          if (error) return { color: COLORS.err, text: t("dataInterrupted", { ago: relTime(sec) }) };
          return { color: COLORS.ok, text: t("liveUpdated", { ago: relTime(sec) }) };
        }
        var tabs = [
          ["overview", t("overview"), "◎"],
          ["performance", t("performance"), "∿"],
          ["processes", t("processes"), "≡"],
          ["docker", t("docker"), "▣"],
          ["hardware", t("hardware"), "⚙"]
        ];
        function renderRail() {
          return h(
            "nav",
            { className: "dsm-rail", "aria-label": t("monitorTitle") },
            tabs.map(function(item) {
              return h("button", {
                key: item[0],
                className: "dsm-rail-item" + (tab === item[0] ? " dsm-rail-active" : ""),
                onClick: function() {
                  storeView(item[0]);
                  setTab(item[0]);
                }
              }, h("span", { className: "dsm-rail-icon" }, item[2]), h("span", null, item[1]));
            })
          );
        }
        var mode = env && env.mode;
        var dataSource = env ? env.systemSource || env.dockerSource : null;
        var modeLabel = dataSource === "host" ? t("dataSourceHost") : dataSource === "container" ? t("dataSourceContainer") : "…";
        var modeColor = dataSource === "host" ? COLORS.ok : COLORS.warn;
        var runtimeNote = mode === "container" ? t("runtimeContainer") : mode === "host" ? t("runtimeHost") : "";
        var hostTitle = env ? env.hostname : "";
        var hostText = hostTitle && runtimeNote ? t("hostnameRuntime", { hostname: hostTitle, runtime: runtimeNote }) : hostTitle;
        var status = statusInfo();
        var body;
        if (tab === "overview") {
          body = h(OverviewPanel, {
            overview,
            containers,
            error: overviewError,
            stale: staleInfo(overviewError, overviewUpdated),
            cpuHistory: cpuHistory.current,
            memHistory: memHistory.current
          });
        } else if (tab === "performance") {
          body = h(PerformanceView, { samples: histData ? histData.samples : [], overview, window: histWindow, onWindow: setHistWindow });
        } else if (tab === "hardware") {
          body = h(HardwareView, { overview });
        } else if (tab === "processes") {
          body = h(ProcessesPanel, {
            data: processes,
            error: processError,
            stale: staleInfo(processError, processUpdated),
            query: procQuery,
            setQuery: setProcQuery,
            sortKey: procSort,
            order: procOrder,
            toggleSort: toggleProcSort,
            onLoadMore: function() {
              setProcLimit(function(n) {
                return Math.min(200, n + 60);
              });
            },
            view: procView,
            setView: setProcView
          });
        } else {
          body = h("div", null, h(DaemonInfoCard, { info: daemon }), h(DockerPanel, { data: containers, error: dockerError, stale: staleInfo(dockerError, dockerUpdated), showToast }));
        }
        var alerts = computeAlerts(overview, containers);
        var alertsNode = alerts.length ? h(
          "div",
          { className: "dsm-alerts", style: { margin: "8px 14px 0", padding: "8px 10px", borderRadius: 8, background: "rgba(245,165,36,.14)", color: COLORS.warn, fontSize: 12 } },
          alerts.map(function(a, i) {
            return h("div", { key: i }, a);
          })
        ) : null;
        var pageContent = h(
          "div",
          { className: "dsm-page-main" },
          h(
            "div",
            { className: "dsm-header" },
            h(
              "div",
              { className: "dsm-title-col" },
              h(
                "div",
                { className: "dsm-title-row" },
                h("span", { className: "dsm-title" }, t("monitorTitle")),
                h(
                  "span",
                  { className: "dsm-mode", title: t("clickViewSources"), onClick: function() {
                    setSourceModal(true);
                  } },
                  h("span", { className: "dsm-mode-dot", style: { background: modeColor } }),
                  modeLabel
                )
              ),
              h("span", { className: "dsm-hostname", title: hostTitle }, hostText)
            ),
            h(
              "div",
              { className: "dsm-header-actions" },
              h(
                "button",
                { className: "dsm-icon-btn", onClick: refreshAll, title: t("refreshNow"), "aria-label": t("refreshNow") },
                h(RefreshIcon, { size: 16, className: refreshing ? "dsm-spin" : "" })
              ),
              h(
                "div",
                { ref: menuRef, style: { position: "relative" } },
                h("button", { className: "dsm-icon-btn", onClick: function() {
                  setMenuOpen(!menuOpen);
                }, title: t("more"), "aria-label": t("more") }, h(MoreIcon, { size: 16 })),
                menuOpen ? h(
                  "div",
                  { className: "dsm-menu" },
                  h("button", { className: "dsm-menu-item", onClick: refreshAll }, t("refreshNow")),
                  h("button", { className: "dsm-menu-item", onClick: copyDiagnostic }, t("copyDiagnostics")),
                  h("button", { className: "dsm-menu-item", onClick: function() {
                    setMenuOpen(false);
                    setSourceModal(true);
                  } }, t("viewDataSources")),
                  h("div", { className: "dsm-menu-sep" }),
                  h("div", { className: "dsm-menu-label" }, t("language")),
                  h("button", { className: "dsm-menu-item", onClick: function() {
                    setLang(LANG_ZH);
                  } }, (currentLang === LANG_ZH ? "✓ " : "") + "简体中文"),
                  h("button", { className: "dsm-menu-item", onClick: function() {
                    setLang(LANG_EN);
                  } }, (currentLang === LANG_EN ? "✓ " : "") + "English"),
                  h("div", { className: "dsm-menu-sep" }),
                  h("button", { className: "dsm-menu-item", onClick: function() {
                    setMenuOpen(false);
                    setAboutModal(true);
                  } }, t("about"))
                ) : null
              )
            )
          ),
          h(
            "div",
            { className: "dsm-status-line" },
            h("span", { className: "dsm-status-dot", style: { background: status.color } }),
            status.text
          ),
          alertsNode,
          versionMismatch ? h(
            "div",
            { className: "dsm-version-banner", style: { margin: "8px 14px 0" } },
            t("versionBanner", { browser: CLIENT_VERSION, host: hostVersion ? "v" + hostVersion : t("unknownHostVersion") })
          ) : null,
          h("div", { className: "dsm-body" }, body),
          toast ? h("div", { className: "dsm-toast" }, toast) : null,
          sourceModal ? h(SourceModal, { env, onClose: function() {
            setSourceModal(false);
          } }) : null,
          aboutModal ? h(AboutModal, { env, meta, hostVersion, mismatch: versionMismatch, onClose: function() {
            setAboutModal(false);
          } }) : null
        );
        return h("div", { className: "dsm-page" }, renderRail(), pageContent);
      }
      function MonitorPanelPage() {
        return h(MonitorDrawerBody, { page: true, connection: monitorConnection });
      }
      var name = "side-monitor";
      var inject = ["slots", "connection"];
      var monitorConnection = null;
      function apply(ctx) {
        monitorConnection = ctx.connection;
        ctx.slots.inject("main", function() {
          return ctx.slots.register({ name: "main", key: "dsh-side-monitor" }, MonitorPanelPage);
        });
        ctx.slots.inject("sidebar.panellist", function() {
          return ctx.slots.register({
            name: "sidebar.panellist",
            id: "dsh-side-monitor",
            order: 30,
            label: function() {
              return t("monitorTitle");
            }
          }, MonitorIcon);
        });
      }
      exports.name = name;
      exports.inject = inject;
      exports.apply = apply;
      return exports;
    }
  });
})();
