/**
 * dsh-side-monitor — browser half (module-loader bundle).
 *
 * Registers the "系统监控" footer action (sidebar.footer.action) and mounts a
 * right-side monitor drawer as a portal. All data arrives through the Host
 * /side-monitor RPC; the browser never touches /proc, df, or the Docker socket.
 * @module dsh-side-monitor/client
 */
window.__ModuleLoader__.load({
  id: "dsh-side-monitor",
  factory: function (require) {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var ReactDOMClient = require("react-dom/client");

    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useMemo = React.useMemo;
    var useSyncExternalStore = React.useSyncExternalStore;

    var RPC_CHANNEL = "/side-monitor";

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------
    function h(type, props) {
      var rest = Array.prototype.slice.call(arguments, 2);
      var children = [];
      (function flatten(arr) {
        arr.forEach(function (c) {
          if (c === null || c === undefined || c === false) return;
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
        get: function () { return state; },
        update: function (fn) {
          var next = fn(state);
          if (next !== state) {
            state = next;
            listeners.forEach(function (l) { l(); });
          }
        },
        subscribe: function (l) {
          listeners.push(l);
          return function () {
            var i = listeners.indexOf(l);
            if (i >= 0) listeners.splice(i, 1);
          };
        },
      };
    }

    function pushHistory(ref, value, max) {
      var arr = ref.current;
      arr.push(value);
      if (arr.length > max) arr.shift();
    }

    function fmtBytes(n) {
      if (n === null || n === undefined || isNaN(n)) return "—";
      if (n === 0) return "0 B";
      var units = ["B", "KB", "MB", "GB", "TB", "PB"];
      var i = Math.floor(Math.log(Math.abs(n)) / Math.log(1024));
      i = Math.max(0, Math.min(i, units.length - 1));
      return (n / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0) + " " + units[i];
    }

    function fmtRate(n) { return fmtBytes(n) + "/s"; }

    function fmtUptime(sec) {
      if (sec === null || sec === undefined || isNaN(sec)) return "—";
      sec = Math.floor(sec);
      var d = Math.floor(sec / 86400);
      var hh = Math.floor((sec % 86400) / 3600);
      var mm = Math.floor((sec % 3600) / 60);
      if (d > 0) return d + " 天 " + hh + " 时 " + mm + " 分";
      if (hh > 0) return hh + " 时 " + mm + " 分";
      if (mm > 0) return mm + " 分 " + (sec % 60) + " 秒";
      return sec + " 秒";
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
    };

    function callRpc(connection, endpoint, payload) {
      if (!connection || !connection.rpc || typeof connection.rpc.call !== "function") {
        return Promise.reject(new Error("连接服务不可用"));
      }
      return connection.rpc.call(RPC_CHANNEL, endpoint, payload);
    }

    // ---------------------------------------------------------------------
    // styles (injected once at materialization)
    // ---------------------------------------------------------------------
    var CSS = [
      ".dsm-trigger{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa3b2);padding:7px 10px;border-radius:8px;font-size:13px;font-family:var(--dsw-font-family,inherit);transition:color .15s ease,background .15s ease}",
      ".dsm-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-trigger-active{color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-trigger-rail{width:auto;justify-content:center;padding:7px}",
      ".dsm-trigger-label{white-space:nowrap}",
      ".dsm-root{position:fixed;top:0;right:0;height:100vh;width:min(520px,100vw);max-width:100vw;box-sizing:border-box;z-index:1500;display:flex;flex-direction:column;background:var(--dsw-specific-sidebar-fill,#17171e);border-left:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));box-shadow:-24px 0 48px rgba(0,0,0,.35);color:var(--dsw-alias-label-primary,#e7eaf0);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif);font-size:13px;line-height:1.5;animation:dsm-in .18s ease}",
      "@keyframes dsm-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}",
      ".dsm-header{flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}",
      ".dsm-title{font-size:15px;font-weight:600}",
      ".dsm-close{border:none;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa3b2);width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center}",
      ".dsm-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-tabs{flex:none;display:flex;gap:4px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}",
      ".dsm-tab{flex:1;border:none;background:transparent;cursor:pointer;padding:7px 0;color:var(--dsw-alias-label-secondary,#9aa3b2);border-radius:8px;font-size:13px;font-weight:500;font-family:inherit}",
      ".dsm-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-tab-active{color:var(--dsw-alias-label-primary,#e7eaf0);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
      ".dsm-body{flex:1;overflow-y:auto;padding:14px}",
      ".dsm-body::-webkit-scrollbar{width:10px}",
      ".dsm-body::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,rgba(255,255,255,.12));border-radius:8px}",
      ".dsm-body::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2,rgba(255,255,255,.2))}",
      ".dsm-panel{display:flex;flex-direction:column;gap:12px}",
      ".dsm-grid{display:grid;gap:12px}",
      ".dsm-grid-2{grid-template-columns:1fr 1fr}",
      ".dsm-card{background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:12px;padding:12px}",
      ".dsm-card-head{font-size:12px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-bottom:10px}",
      ".dsm-card-body{display:flex;align-items:center;gap:12px}",
      ".dsm-col{flex-direction:column;align-items:stretch;gap:8px}",
      ".dsm-card-value{display:flex;flex-direction:column;gap:2px;min-width:0}",
      ".dsm-big{font-size:20px;font-weight:650;font-variant-numeric:tabular-nums}",
      ".dsm-sub{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsm-muted{color:var(--dsw-alias-label-secondary,#9aa3b2)}",
      ".dsm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}",
      ".dsm-spark{margin-top:10px;display:block;opacity:.85}",
      ".dsm-ring{flex:none}",
      ".dsm-net-row{display:flex;align-items:center;gap:8px}",
      ".dsm-net-val{margin-left:auto;font-variant-numeric:tabular-nums}",
      ".dsm-dot{width:8px;height:8px;border-radius:50%;flex:none}",
      ".dsm-load{display:flex;flex-direction:column;gap:8px}",
      ".dsm-load-row{display:flex;align-items:center;gap:8px}",
      ".dsm-load-label{width:28px;flex:none}",
      ".dsm-load-bar{flex:1;height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}",
      ".dsm-load-fill{height:100%;border-radius:4px;background:var(--dsw-alias-state-business-primary,#4f8cff);transition:width .3s ease}",
      ".dsm-load-val{width:52px;text-align:right;font-variant-numeric:tabular-nums;font-size:12px}",
      ".dsm-kv{display:flex;flex-direction:column}",
      ".dsm-kv-row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)}",
      ".dsm-kv-row:last-child{border-bottom:none}",
      ".dsm-kv-val{text-align:right;word-break:break-word;min-width:0}",
      ".dsm-chips{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}",
      ".dsm-chips-top{margin-bottom:2px}",
      ".dsm-chip{background:rgba(255,255,255,.03);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:10px;padding:8px 6px;text-align:center}",
      ".dsm-chip-val{display:block;font-size:18px;font-weight:650;font-variant-numeric:tabular-nums}",
      ".dsm-chip-label{font-size:11px}",
      ".dsm-search{width:100%;box-sizing:border-box;background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));border-radius:8px;padding:8px 10px;color:var(--dsw-alias-label-primary,#e7eaf0);font-size:13px;font-family:inherit;outline:none}",
      ".dsm-search:focus{border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
      ".dsm-count{font-size:12px}",
      ".dsm-table{width:100%;min-width:420px;border-collapse:collapse;font-size:12px}",
      ".dsm-table th{position:sticky;top:0;text-align:left;font-weight:600;color:var(--dsw-alias-label-secondary,#9aa3b2);padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));background:var(--dsw-specific-sidebar-fill,#17171e)}",
      ".dsm-table td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}",
      ".dsm-table tbody tr:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}",
      ".dsm-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".dsm-sortable{cursor:pointer;user-select:none}",
      ".dsm-sortable:hover{color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-sorted{color:var(--dsw-alias-state-business-primary,#4f8cff)}",
      ".dsm-command{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#9aa3b2)}",
      ".dsm-docker-name{font-weight:600;color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-docker-image{font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsm-state-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px}",
      ".dsm-state{color:var(--dsw-alias-label-secondary,#9aa3b2);padding:24px 8px;text-align:center}",
      ".dsm-error{color:var(--dsw-alias-state-error-primary,#f87171)}",
      ".dsm-root,.dsm-root *{box-sizing:border-box}",
      "@media (max-width:520px){.dsm-root{width:100vw}.dsm-grid-2{grid-template-columns:1fr}.dsm-chips{grid-template-columns:repeat(2,1fr)}}",
    ].join("\n");

    (function injectCss() {
      if (document.getElementById("dsh-side-monitor-css")) return;
      var style = document.createElement("style");
      style.id = "dsh-side-monitor-css";
      style.textContent = CSS;
      document.head.appendChild(style);
    })();

    // ---------------------------------------------------------------------
    // small presentational components
    // ---------------------------------------------------------------------
    function Ring(props) {
      var value = Math.max(0, Math.min(100, props.value || 0));
      var size = props.size || 56;
      var stroke = props.stroke || 5;
      var color = props.color || COLORS.ok;
      var r = (size - stroke) / 2;
      var c = 2 * Math.PI * r;
      var offset = c * (1 - value / 100);
      return h("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, className: "dsm-ring", "aria-hidden": true },
        h("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: "rgba(255,255,255,.08)", strokeWidth: stroke }),
        h("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeDasharray: c.toFixed(2), strokeDashoffset: offset.toFixed(2), transform: "rotate(-90 " + (size / 2) + " " + (size / 2) + ")" })
      );
    }

    function Sparkline(props) {
      var data = props.data || [];
      var hpx = props.height || 30;
      var color = props.color || COLORS.ok;
      var W = 160;
      if (data.length < 2) {
        return h("div", { className: "dsm-spark", style: { height: hpx } });
      }
      var max = -Infinity;
      var min = Infinity;
      data.forEach(function (v) { if (v > max) max = v; if (v < min) min = v; });
      var range = (max - min) || 1;
      var pts = data.map(function (v, i) {
        var x = (i / (data.length - 1)) * W;
        var y = hpx - ((v - min) / range) * (hpx - 4) - 2;
        return x.toFixed(1) + "," + y.toFixed(1);
      }).join(" ");
      return h("svg", { className: "dsm-spark", viewBox: "0 0 " + W + " " + hpx, preserveAspectRatio: "none", width: "100%", height: hpx, "aria-hidden": true },
        h("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" })
      );
    }

    function MonitorIcon(props) {
      var s = props.size || 16;
      return h("svg", { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
        h("path", { d: "M3 13h4l2.5-6 4 10 2.5-4H21" })
      );
    }

    function CloseIcon(props) {
      var s = props.size || 16;
      return h("svg", { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", "aria-hidden": true },
        h("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
        h("line", { x1: 18, y1: 6, x2: 6, y2: 18 })
      );
    }

    function LoadingBox() { return h("div", { className: "dsm-state" }, "加载中…"); }
    function ErrorBox(msg) { return h("div", { className: "dsm-state dsm-error" }, "无法获取数据：" + (msg || "未知错误")); }

    function Chip(label, value, color) {
      return h("div", { className: "dsm-chip" },
        h("span", { className: "dsm-chip-val", style: { color: color } }, value),
        h("span", { className: "dsm-muted dsm-chip-label" }, label)
      );
    }

    // ---------------------------------------------------------------------
    // polling hook: immediate tick, then re-arm; pauses when tab hidden
    // ---------------------------------------------------------------------
    function usePoll(fn, intervalMs, enabled) {
      var fnRef = useRef(fn);
      fnRef.current = fn;
      useEffect(function () {
        if (!enabled) return undefined;
        var stopped = false;
        var timer = null;
        function tick() {
          if (stopped) return;
          try { fnRef.current(); } catch (e) { /* keep polling */ }
          timer = setTimeout(tick, intervalMs);
        }
        function onVis() {
          if (document.hidden) {
            if (timer) { clearTimeout(timer); timer = null; }
          } else if (timer === null) {
            tick();
          }
        }
        tick();
        document.addEventListener("visibilitychange", onVis);
        return function () {
          stopped = true;
          if (timer) clearTimeout(timer);
          document.removeEventListener("visibilitychange", onVis);
        };
      }, [enabled, intervalMs]);
    }

    // ---------------------------------------------------------------------
    // sidebar trigger
    // ---------------------------------------------------------------------
    function MonitorTrigger(props) {
      var wide = props.wide !== false;
      var openStore = props.openStore;
      var open = useSyncExternalStore(
        openStore ? openStore.subscribe : function () { return function () {}; },
        function () { return openStore ? openStore.get().open : false; }
      );
      var isRail = !wide;
      var cls = "dsm-trigger" + (isRail ? " dsm-trigger-rail" : "") + (open ? " dsm-trigger-active" : "");
      return h("button", {
        className: cls,
        title: "系统监控",
        "aria-label": "系统监控",
        onClick: function () {
          if (openStore) openStore.update(function (s) { return { open: !s.open }; });
        },
      },
        h(MonitorIcon, { size: 16 }),
        isRail ? null : h("span", { className: "dsm-trigger-label" }, "系统监控")
      );
    }

    // ---------------------------------------------------------------------
    // panels
    // ---------------------------------------------------------------------
    function MetricCard(label, value, suffix, color, history, sub) {
      return h("div", { className: "dsm-card" },
        h("div", { className: "dsm-card-head" }, label),
        h("div", { className: "dsm-card-body" },
          h(Ring, { value: value, color: color }),
          h("div", { className: "dsm-card-value" },
            h("span", { className: "dsm-big", style: { color: color } }, value.toFixed(1) + suffix),
            sub ? h("span", { className: "dsm-muted dsm-sub" }, sub) : null
          )
        ),
        h(Sparkline, { data: history, color: color })
      );
    }

    function NetCard(overview) {
      var ifaces = overview.network || [];
      var totalRx = 0;
      var totalTx = 0;
      ifaces.forEach(function (i) { totalRx += i.rxBytesPerSec; totalTx += i.txBytesPerSec; });
      return h("div", { className: "dsm-card" },
        h("div", { className: "dsm-card-head" }, "网络吞吐"),
        h("div", { className: "dsm-card-body dsm-col" },
          h("div", { className: "dsm-net-row" },
            h("span", { className: "dsm-dot", style: { background: COLORS.netRx } }),
            "下行",
            h("span", { className: "dsm-net-val" }, fmtRate(totalRx))
          ),
          h("div", { className: "dsm-net-row" },
            h("span", { className: "dsm-dot", style: { background: COLORS.netTx } }),
            "上行",
            h("span", { className: "dsm-net-val" }, fmtRate(totalTx))
          )
        )
      );
    }

    function DiskCard(overview) {
      if (!overview.diskAvailable) {
        return h("div", { className: "dsm-card" },
          h("div", { className: "dsm-card-head" }, "根分区磁盘"),
          h("div", { className: "dsm-card-body" }, h("span", { className: "dsm-muted" }, "无法获取磁盘信息"))
        );
      }
      var color = colorForPct(overview.diskUsage);
      return h("div", { className: "dsm-card" },
        h("div", { className: "dsm-card-head" }, "根分区磁盘"),
        h("div", { className: "dsm-card-body" },
          h(Ring, { value: overview.diskUsage, color: color, size: 44 }),
          h("div", { className: "dsm-card-value" },
            h("span", { className: "dsm-big", style: { color: color } }, overview.diskUsage.toFixed(1) + "%"),
            h("span", { className: "dsm-muted dsm-sub" }, fmtBytes(overview.diskUsed) + " / " + fmtBytes(overview.diskTotal))
          )
        )
      );
    }

    function LoadCard(overview) {
      var load = [overview.load1, overview.load5, overview.load15];
      var labels = ["1m", "5m", "15m"];
      var maxLoad = Math.max.apply(null, load.concat([overview.cpuCores, 1]));
      return h("div", { className: "dsm-card" },
        h("div", { className: "dsm-card-head" }, "系统负载"),
        h("div", { className: "dsm-load" },
          load.map(function (v, i) {
            var pct = Math.min(100, (v / maxLoad) * 100);
            return h("div", { className: "dsm-load-row", key: labels[i] },
              h("span", { className: "dsm-muted dsm-load-label" }, labels[i]),
              h("div", { className: "dsm-load-bar" }, h("div", { className: "dsm-load-fill", style: { width: pct + "%" } })),
              h("span", { className: "dsm-load-val" }, v.toFixed(2))
            );
          })
        ),
        h("div", { className: "dsm-muted dsm-sub", style: { marginTop: 8 } }, "已运行 " + fmtUptime(overview.uptimeSeconds))
      );
    }

    function SystemCard(overview) {
      var rows = [
        ["操作系统", overview.osName],
        ["内核", overview.kernelVersion],
        ["主机名", overview.hostname],
        ["CPU", overview.cpuModel],
        ["核心数", String(overview.cpuCores)],
        ["架构", overview.arch],
        ["总内存", fmtBytes(overview.memoryTotal)],
      ];
      return h("div", { className: "dsm-card" },
        h("div", { className: "dsm-card-head" }, "系统信息"),
        h("div", { className: "dsm-kv" },
          rows.map(function (r) {
            return h("div", { className: "dsm-kv-row", key: r[0] },
              h("span", { className: "dsm-muted" }, r[0]),
              h("span", { className: "dsm-kv-val" }, r[1])
            );
          })
        )
      );
    }

    function InterfacesCard(overview) {
      var ifaces = overview.network || [];
      if (!ifaces.length) return null;
      return h("div", { className: "dsm-card" },
        h("div", { className: "dsm-card-head" }, "网络接口"),
        h("table", { className: "dsm-table" },
          h("thead", null, h("tr", null,
            h("th", null, "接口"),
            h("th", null, "IP"),
            h("th", { className: "dsm-num" }, "接收"),
            h("th", { className: "dsm-num" }, "发送")
          )),
          h("tbody", null, ifaces.map(function (i) {
            return h("tr", { key: i.name },
              h("td", { className: "dsm-mono" }, i.name),
              h("td", null, i.ip),
              h("td", { className: "dsm-num" }, fmtRate(i.rxBytesPerSec)),
              h("td", { className: "dsm-num" }, fmtRate(i.txBytesPerSec))
            );
          }))
        )
      );
    }

    function DockerSummaryCard(containers) {
      if (!containers) return null;
      if (!containers.available) {
        return h("div", { className: "dsm-card" },
          h("div", { className: "dsm-card-head" }, "Docker 容器"),
          h("div", { className: "dsm-card-body" }, h("span", { className: "dsm-muted" }, "Docker 不可用（未检测到 /var/run/docker.sock）"))
        );
      }
      var s = containers.summary;
      return h("div", { className: "dsm-card" },
        h("div", { className: "dsm-card-head" }, "Docker 容器"),
        h("div", { className: "dsm-chips" },
          Chip("总数", s.total, "#8b8fa3"),
          Chip("运行", s.running, COLORS.ok),
          Chip("停止", s.stopped, COLORS.err),
          Chip("暂停", s.paused, COLORS.warn)
        )
      );
    }

    function OverviewPanel(props) {
      var overview = props.overview;
      var containers = props.containers;
      var error = props.error;
      if (error && !overview) return ErrorBox(error);
      if (!overview) return LoadingBox();
      return h("div", { className: "dsm-panel" },
        h("div", { className: "dsm-grid dsm-grid-2" },
          MetricCard("CPU 使用率", overview.cpuUsage, "%", COLORS.cpu, props.cpuHistory, overview.cpuModel || (overview.cpuCores + " 核")),
          MetricCard("内存使用率", overview.memoryUsage, "%", COLORS.mem, props.memHistory, fmtBytes(overview.memoryUsed) + " / " + fmtBytes(overview.memoryTotal))
        ),
        h("div", { className: "dsm-grid dsm-grid-2" },
          NetCard(overview),
          DiskCard(overview)
        ),
        LoadCard(overview),
        SystemCard(overview),
        InterfacesCard(overview),
        DockerSummaryCard(containers)
      );
    }

    function ProcessesPanel(props) {
      var data = props.data;
      var error = props.error;
      var query = props.query;
      var setQuery = props.setQuery;
      var sortKey = props.sortKey;
      var sortDir = props.sortDir;
      var toggleSort = props.toggleSort;
      if (error && !data) return ErrorBox(error);
      if (!data) return LoadingBox();

      var rows = data.processes || [];
      var q = (query || "").toLowerCase();
      var filtered = q
        ? rows.filter(function (p) {
            return (p.name && p.name.toLowerCase().indexOf(q) >= 0) ||
              (p.command && p.command.toLowerCase().indexOf(q) >= 0);
          })
        : rows.slice();

      filtered.sort(function (a, b) {
        var va = a[sortKey];
        var vb = b[sortKey];
        var cmp;
        if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
        else cmp = String(va == null ? "" : va).localeCompare(String(vb == null ? "" : vb));
        return sortDir === "asc" ? cmp : -cmp;
      });

      function thSort(key, label) {
        var cls = "dsm-num dsm-sortable" + (sortKey === key ? " dsm-sorted" : "");
        return h("th", { className: cls, onClick: function () { toggleSort(key); } }, label + (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""));
      }

      return h("div", { className: "dsm-panel" },
        h("input", {
          className: "dsm-search", type: "text", placeholder: "搜索进程名 / 命令…",
          value: query || "",
          onChange: function (e) { setQuery(e.target.value); },
        }),
        h("div", { className: "dsm-muted dsm-count" }, "共 " + data.total + " 个进程，显示前 " + filtered.length + " 个"),
        h("table", { className: "dsm-table" },
          h("thead", null, h("tr", null,
            h("th", { className: "dsm-num" }, "PID"),
            h("th", null, "进程"),
            h("th", null, "用户"),
            thSort("cpu", "CPU%"),
            thSort("mem", "MEM%"),
            h("th", null, "命令")
          )),
          h("tbody", null, filtered.map(function (p) {
            return h("tr", { key: p.pid },
              h("td", { className: "dsm-num" }, p.pid),
              h("td", { className: "dsm-mono" }, p.name),
              h("td", null, p.user),
              h("td", { className: "dsm-num" }, p.cpu.toFixed(1)),
              h("td", { className: "dsm-num" }, p.mem.toFixed(1)),
              h("td", { className: "dsm-command", title: p.command }, p.command)
            );
          }))
        )
      );
    }

    function DockerPanel(props) {
      var data = props.data;
      var error = props.error;
      if (error && !data) return ErrorBox(error);
      if (!data) return LoadingBox();
      if (!data.available) {
        return h("div", { className: "dsm-panel" }, h("div", { className: "dsm-state dsm-error" }, "Docker 不可用（未检测到 /var/run/docker.sock）"));
      }
      var s = data.summary;
      return h("div", { className: "dsm-panel" },
        h("div", { className: "dsm-chips" },
          Chip("总数", s.total, "#8b8fa3"),
          Chip("运行", s.running, COLORS.ok),
          Chip("停止", s.stopped, COLORS.err),
          Chip("暂停", s.paused, COLORS.warn)
        ),
        h("table", { className: "dsm-table" },
          h("thead", null, h("tr", null,
            h("th", null, "容器"),
            h("th", null, "状态"),
            h("th", { className: "dsm-num" }, "CPU%"),
            h("th", { className: "dsm-num" }, "内存"),
            h("th", null, "端口")
          )),
          h("tbody", null, (data.containers || []).map(function (c) {
            var stateColor = c.state === "running" ? COLORS.ok : (c.state === "paused" ? COLORS.warn : COLORS.err);
            var memText = c.memoryUsage != null
              ? fmtBytes(c.memoryUsage) + (c.memoryUsagePct != null ? " (" + c.memoryUsagePct.toFixed(1) + "%)" : "")
              : "—";
            return h("tr", { key: c.id },
              h("td", null,
                h("div", { className: "dsm-docker-name" }, c.name),
                h("div", { className: "dsm-muted dsm-docker-image", title: c.image }, c.image)
              ),
              h("td", null,
                h("span", { className: "dsm-state-dot", style: { background: stateColor } }),
                c.status
              ),
              h("td", { className: "dsm-num" }, c.cpuUsage != null ? c.cpuUsage.toFixed(1) : "—"),
              h("td", { className: "dsm-num" }, memText),
              h("td", { className: "dsm-mono" }, (c.ports && c.ports.length) ? c.ports.join(", ") : "—")
            );
          }))
        )
      );
    }

    // ---------------------------------------------------------------------
    // drawer
    // ---------------------------------------------------------------------
    function MonitorDrawerBody(props) {
      var ctx = props.ctx;
      var openStore = props.openStore;
      var connection = ctx.connection;

      var tabState = useState("overview");
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

      var errorState = useState(null);
      var error = errorState[0];
      var setError = errorState[1];

      var cpuHistory = useRef([]);
      var memHistory = useRef([]);

      var procQueryState = useState("");
      var procQuery = procQueryState[0];
      var setProcQuery = procQueryState[1];

      var procSortState = useState(["cpu", "desc"]);
      var procSort = procSortState[0];
      var setProcSort = procSortState[1];

      function toggleProcSort(key) {
        setProcSort(function (prev) {
          if (prev[0] === key) return [key, prev[1] === "desc" ? "asc" : "desc"];
          return [key, "desc"];
        });
      }

      usePoll(function () {
        callRpc(connection, "overview", {}).then(function (res) {
          if (res && res.ok) {
            setOverview(res.value);
            setError(null);
            pushHistory(cpuHistory, res.value.cpuUsage, 40);
            pushHistory(memHistory, res.value.memoryUsage, 40);
          } else if (res && res.error) {
            setError(res.error.message);
          }
        }).catch(function (e) { setError(e && e.message ? e.message : String(e)); });
      }, 2000, true);

      usePoll(function () {
        callRpc(connection, "processes", {}).then(function (res) {
          if (res && res.ok) { setProcesses(res.value); setError(null); }
          else if (res && res.error) setError(res.error.message);
        }).catch(function (e) { setError(e && e.message ? e.message : String(e)); });
      }, 3000, tab === "processes");

      usePoll(function () {
        callRpc(connection, "containers", { stats: tab === "docker" }).then(function (res) {
          if (res && res.ok) { setContainers(res.value); setError(null); }
          else if (res && res.error) setError(res.error.message);
        }).catch(function (e) { setError(e && e.message ? e.message : String(e)); });
      }, 5000, tab === "overview" || tab === "docker");

      function close() {
        openStore.update(function (s) { return { open: false }; });
      }

      var tabs = [
        ["overview", "概览"],
        ["processes", "进程"],
        ["docker", "Docker"],
      ];

      var body;
      if (tab === "overview") {
        body = h(OverviewPanel, {
          overview: overview,
          containers: containers,
          error: error,
          cpuHistory: cpuHistory.current,
          memHistory: memHistory.current,
        });
      } else if (tab === "processes") {
        body = h(ProcessesPanel, {
          data: processes,
          error: error,
          query: procQuery,
          setQuery: setProcQuery,
          sortKey: procSort[0],
          sortDir: procSort[1],
          toggleSort: toggleProcSort,
        });
      } else {
        body = h(DockerPanel, { data: containers, error: error });
      }

      return h("div", { className: "dsm-root" },
        h("div", { className: "dsm-header" },
          h("span", { className: "dsm-title" }, "系统监控"),
          h("button", { className: "dsm-close", onClick: close, title: "关闭", "aria-label": "关闭" }, h(CloseIcon, { size: 16 }))
        ),
        h("div", { className: "dsm-tabs" },
          tabs.map(function (t) {
            return h("button", {
              key: t[0],
              className: "dsm-tab" + (tab === t[0] ? " dsm-tab-active" : ""),
              onClick: function () { setTab(t[0]); },
            }, t[1]);
          })
        ),
        h("div", { className: "dsm-body" }, body)
      );
    }

    function MonitorDrawer(props) {
      var openStore = props.openStore;
      var open = useSyncExternalStore(
        openStore ? openStore.subscribe : function () { return function () {}; },
        function () { return openStore ? openStore.get().open : false; }
      );
      if (!open) return null;
      return h(MonitorDrawerBody, { ctx: props.ctx, openStore: openStore });
    }

    // ---------------------------------------------------------------------
    // plugin entry
    // ---------------------------------------------------------------------
    var name = "side-monitor";
    var inject = ["slots", "connection"];

    function apply(ctx) {
      var openStore = createStore({ open: false });

      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register({
          name: "sidebar.footer.action",
          id: "side-monitor",
          order: 2,
          label: "系统监控",
          inject: function () { return { openStore: openStore }; },
        }, MonitorTrigger);
      });

      ctx.effect(function () {
        var host = document.createElement("div");
        host.setAttribute("data-dsh-side-monitor", "");
        document.body.appendChild(host);
        var root = ReactDOMClient.createRoot(host);
        root.render(React.createElement(MonitorDrawer, { ctx: ctx, openStore: openStore }));
        return function () {
          root.unmount();
          host.remove();
        };
      }, "side-monitor: drawer mount");
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return exports;
  },
});
