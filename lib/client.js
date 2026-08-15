/**
 * dsh-side-monitor — browser half (module-loader bundle).
 *
 * Registers the "系统监控" footer action (sidebar.footer.action) and mounts a
 * right-side monitor drawer as a portal. All data arrives through the Host
 * /side-monitor RPC; the browser never touches /proc, df, or the Docker socket.
 *
 * v0.2: container-query responsive layout; per-page independent error/updatedAt
 * with stale retention; host/container environment + source badge; CPU/memory
 * cards (big % + area sparkline, no gauge); lightweight Network/Disk KPIs;
 * clickable Docker ports (web open / non-web copy); mobile fullscreen (<768px);
 * host-side process search/sort/pagination; draggable width.
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
    var useSyncExternalStore = React.useSyncExternalStore;

    var RPC_CHANNEL = "/side-monitor";

    var MIN_W = 360;
    var MAX_W = 800;
    var DEFAULT_W = 500;
    var WIDTH_KEY = "dsh-side-monitor:width";

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

    function relTime(sec) {
      if (sec <= 1) return "刚刚更新";
      if (sec < 60) return sec + " 秒前";
      if (sec < 3600) return Math.floor(sec / 60) + " 分前";
      return Math.floor(sec / 3600) + " 时前";
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
      muted: "var(--dsw-alias-label-secondary, #9aa3b2)",
    };

    function sourceLabel(source) {
      if (source === "host") return "宿主机";
      if (source === "container") return "当前容器";
      return "未知";
    }

    function containerStateLabel(state) {
      if (state === "running") return "运行中";
      if (state === "paused") return "已暂停";
      if (state === "exited" || state === "dead") return "已停止";
      return state || "unknown";
    }

    function containerStateColor(state) {
      if (state === "running") return COLORS.ok;
      if (state === "paused") return COLORS.warn;
      return COLORS.err;
    }

    function containerStatusBadge(c) {
      if (c.state === "running") {
        if (c.health === "unhealthy") return { label: "Unhealthy", color: COLORS.err };
        if (c.health === "starting") return { label: "Starting", color: COLORS.warn };
        if (c.health === "healthy") return { label: "Healthy", color: COLORS.ok };
        return { label: "运行中", color: COLORS.ok };
      }
      if (c.state === "paused") return { label: "已暂停", color: COLORS.warn };
      return { label: "已停止", color: COLORS.err };
    }

    function containerMemText(c) {
      if (c.memoryUsage == null) return "—";
      var pct = c.memoryUsagePct != null ? " · " + c.memoryUsagePct.toFixed(1) + "%" : "";
      return fmtBytes(c.memoryUsage) + pct;
    }

    function callRpc(connection, endpoint, payload) {
      if (!connection || !connection.rpc || typeof connection.rpc.call !== "function") {
        return Promise.reject(new Error("连接服务不可用"));
      }
      return connection.rpc.call(RPC_CHANNEL, endpoint, payload);
    }

    function initialWidth() {
      try {
        var v = parseInt(localStorage.getItem(WIDTH_KEY), 10);
        if (Number.isFinite(v) && v >= MIN_W && v <= MAX_W) return v;
      } catch (e) { /* ignore */ }
      return DEFAULT_W;
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
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        if (cb) cb(ok);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { if (cb) cb(true); }, function () { fallback(); });
      } else {
        fallback();
      }
    }

    // ---- Docker port helpers ---------------------------------------------
    var HTTP_PORTS = { 80: 1, 3000: 1, 3080: 1, 5173: 1, 8000: 1, 8008: 1, 8080: 1, 9000: 1 };
    var HTTPS_PORTS = { 443: 1, 8443: 1, 9443: 1 };

    function portProtocolFor(port) {
      if (port == null) return null;
      if (HTTPS_PORTS[port]) return "https";
      if (HTTP_PORTS[port]) return "http";
      return null;
    }

    // A port is "web" if either the published or container port is a known web port.
    function portWebProtocol(p) {
      return portProtocolFor(p.hostPort) || portProtocolFor(p.containerPort);
    }

    function useMediaQuery(query) {
      var state = useState(function () {
        return typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false;
      });
      var matches = state[0];
      var setMatches = state[1];
      useEffect(function () {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        var mql = window.matchMedia(query);
        function onChange(e) { setMatches(e.matches); }
        setMatches(mql.matches);
        if (mql.addEventListener) mql.addEventListener("change", onChange);
        else mql.addListener(onChange);
        return function () {
          if (mql.removeEventListener) mql.removeEventListener("change", onChange);
          else mql.removeListener(onChange);
        };
      }, [query]);
      return matches;
    }

    // ---------------------------------------------------------------------
    // styles (injected once at materialization)
    // ---------------------------------------------------------------------
    var CSS = [
      // trigger
      ".dsm-trigger{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa3b2);padding:7px 10px;border-radius:8px;font-size:13px;font-family:var(--dsw-font-family,inherit);transition:color .15s ease,background .15s ease}",
      ".dsm-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-trigger-active{color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-trigger-rail{width:auto;justify-content:center;padding:7px}",
      ".dsm-trigger-label{white-space:nowrap}",
      // root + chrome
      ".dsm-root{position:fixed;top:0;right:0;height:100vh;width:500px;min-width:360px;max-width:100vw;box-sizing:border-box;z-index:1500;display:flex;flex-direction:column;background:var(--dsw-specific-sidebar-fill,#17171e);border-left:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));box-shadow:-24px 0 48px rgba(0,0,0,.35);color:var(--dsw-alias-label-primary,#e7eaf0);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif);font-size:13px;line-height:1.5;animation:dsm-in .18s ease;container-type:inline-size}",
      "@keyframes dsm-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}",
      ".dsm-root-mobile{left:0;right:0;width:100vw !important;max-width:none;min-width:0;border-left:none;border-right:none}",
      ".dsm-root-mobile .dsm-resize{display:none}",
      ".dsm-resize{position:absolute;top:0;left:-4px;width:8px;height:100%;cursor:ew-resize;z-index:3;touch-action:none}",
      ".dsm-resize::after{content:'';position:absolute;top:0;left:3px;width:2px;height:100%;background:rgba(255,255,255,.08);transition:background .15s ease}",
      ".dsm-resize:hover::after,.dsm-resize:active::after{background:var(--dsw-alias-state-business-primary,#4f8cff)}",
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
      ".dsm-close{border:none;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary,#9aa3b2);width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center}",
      ".dsm-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
      // menu dropdown
      ".dsm-menu{position:absolute;top:calc(100% + 6px);right:0;min-width:160px;background:var(--dsw-specific-surface-fill,#22222b);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.45);padding:4px;z-index:10}",
      ".dsm-menu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary,#e7eaf0);padding:8px 10px;border-radius:7px;font-size:13px;font-family:inherit;cursor:pointer}",
      ".dsm-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
      ".dsm-menu-item:disabled{opacity:.4;cursor:default}",
      ".dsm-menu-sep{height:1px;background:var(--dsw-alias-border-l2,rgba(255,255,255,.08));margin:4px 6px}",
      // status line
      ".dsm-status-line{flex:none;display:flex;align-items:center;gap:7px;padding:7px 14px;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.06))}",
      ".dsm-status-dot{width:7px;height:7px;border-radius:50%;flex:none}",
      // tabs
      ".dsm-tabs{flex:none;display:flex;gap:4px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))}",
      ".dsm-tab{flex:1;border:none;background:transparent;cursor:pointer;padding:7px 0;color:var(--dsw-alias-label-secondary,#9aa3b2);border-radius:8px;font-size:13px;font-weight:500;font-family:inherit}",
      ".dsm-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e7eaf0)}",
      ".dsm-tab-active{color:var(--dsw-alias-label-primary,#e7eaf0);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
      ".dsm-body{flex:1;overflow-y:auto;padding:14px}",
      ".dsm-body::-webkit-scrollbar{width:10px}",
      ".dsm-body::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,rgba(255,255,255,.12));border-radius:8px}",
      ".dsm-panel{display:flex;flex-direction:column;gap:14px}",
      ".dsm-metrics-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}",
      "@container (min-width:420px){.dsm-metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
      // strong metric card (CPU / Memory)
      ".dsm-metric{background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:12px;padding:12px;min-width:0}",
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
      ".dsm-chips{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
      "@container (min-width:420px){.dsm-chips{grid-template-columns:repeat(3,1fr)}}",
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
      ".dsm-proc-cmd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsm-proc-detail{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.1);display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px}",
      ".dsm-proc-detail .dsm-kv-row{border-bottom:none;padding:2px 0}",
      ".dsm-proc-detail-command{grid-column:1 / -1}",
      ".dsm-loadmore{align-self:center;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:rgba(255,255,255,.03);color:var(--dsw-alias-label-secondary,#9aa3b2);border-radius:8px;padding:6px 14px;font-size:12px;font-family:inherit;cursor:pointer}",
      ".dsm-loadmore:hover{color:var(--dsw-alias-label-primary,#e7eaf0)}",
      // docker dual renderer
      ".dsm-docker-table-wrap{display:none}",
      ".dsm-docker-list{display:flex;flex-direction:column;gap:10px}",
      "@container (min-width:680px){.dsm-docker-table-wrap{display:block}.dsm-docker-list{display:none}}",
      ".dsm-container-card{background:var(--dsw-alias-button-elevated-fill,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.07));border-radius:12px;padding:12px}",
      ".dsm-container-head{display:flex;align-items:center;gap:8px;min-width:0}",
      ".dsm-container-name{font-weight:600;color:var(--dsw-alias-label-primary,#e7eaf0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
      ".dsm-container-image{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsm-container-stats{display:flex;flex-wrap:wrap;gap:16px;margin-top:8px;font-size:12px}",
      ".dsm-container-stat{display:flex;gap:6px;font-variant-numeric:tabular-nums}",
      ".dsm-container-uptime{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-top:8px}",
      ".dsm-port-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center}",
      ".dsm-port-chip{display:inline-flex;align-items:center;gap:5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;background:rgba(255,255,255,.05);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));border-radius:6px;padding:3px 8px;color:var(--dsw-alias-label-primary,#e7eaf0);cursor:pointer}",
      ".dsm-port-chip:hover{border-color:var(--dsw-alias-state-business-primary,#4f8cff)}",
      ".dsm-port-ico{font-size:11px;line-height:1}",
      ".dsm-port-none{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);font-variant-numeric:tabular-nums}",
      ".dsm-table .dsm-port-chips{margin-top:0}",
      ".dsm-port-block{margin-top:10px}",
      ".dsm-port-label{font-size:11px;color:var(--dsw-alias-label-secondary,#9aa3b2);margin-bottom:4px}",
      // port context menu
      ".dsm-portmenu-backdrop{position:fixed;inset:0;z-index:1600}",
      ".dsm-portmenu{position:fixed;min-width:140px;background:var(--dsw-specific-surface-fill,#26262f);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.5);padding:4px;z-index:1601}",
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
      ".dsm-modal{background:var(--dsw-specific-surface-fill,#26262f);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:12px;padding:16px;width:100%;max-width:320px;box-shadow:0 24px 64px rgba(0,0,0,.6)}",
      ".dsm-modal-title{font-size:14px;font-weight:600;margin-bottom:12px}",
      ".dsm-modal-close{float:right;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9aa3b2);cursor:pointer;font-size:16px;line-height:1}",
      // toast
      ".dsm-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--dsw-specific-surface-fill,#26262f);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));color:var(--dsw-alias-label-primary,#e7eaf0);border-radius:10px;padding:9px 16px;font-size:13px;box-shadow:0 12px 32px rgba(0,0,0,.5);z-index:1800;animation:dsm-toast-in .18s ease}",
      "@keyframes dsm-toast-in{from{transform:translate(-50%,8px);opacity:0}to{transform:translate(-50%,0);opacity:1}}",
      ".dsm-root,.dsm-root *{box-sizing:border-box}",
    ].join("\n");

    (function injectCss() {
      if (document.getElementById("dsh-side-monitor-css")) return;
      var style = document.createElement("style");
      style.id = "dsh-side-monitor-css";
      style.textContent = CSS;
      document.head.appendChild(style);
    })();

    // ---------------------------------------------------------------------
    // presentational components
    // ---------------------------------------------------------------------
    function Sparkline(props) {
      var data = props.data || [];
      var hpx = props.height || 36;
      var color = props.color || COLORS.ok;
      var W = 160;
      if (data.length < 2) {
        return h("div", { className: "dsm-spark", style: { height: hpx } });
      }
      var fixed = !!props.fixed;
      var min = fixed ? 0 : Infinity;
      var max = fixed ? 100 : -Infinity;
      if (!fixed) data.forEach(function (v) { if (v > max) max = v; if (v < min) min = v; });
      var range = (max - min) || 1;
      var pts = data.map(function (v, i) {
        var x = (i / (data.length - 1)) * W;
        var clamped = Math.min(max, Math.max(min, v));
        var y = hpx - ((clamped - min) / range) * (hpx - 4) - 2;
        return x.toFixed(1) + "," + y.toFixed(1);
      });
      var pointsStr = pts.join(" ");
      var areaStr = "0," + hpx + " " + pointsStr + " " + W + "," + hpx;
      return h("svg", { className: "dsm-spark", viewBox: "0 0 " + W + " " + hpx, preserveAspectRatio: "none", width: "100%", height: hpx, "aria-hidden": true },
        props.fill ? h("polygon", { points: areaStr, fill: color, opacity: 0.12 }) : null,
        h("polyline", { points: pointsStr, fill: "none", stroke: color, strokeWidth: 1.8, strokeLinejoin: "round", strokeLinecap: "round" })
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

    function RefreshIcon(props) {
      var s = props.size || 16;
      return h("svg", { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: props.className || null, "aria-hidden": true },
        h("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
        h("polyline", { points: "21 3 21 9 15 9" })
      );
    }

    function MoreIcon(props) {
      var s = props.size || 16;
      return h("svg", { width: s, height: s, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true },
        h("circle", { cx: 5, cy: 12, r: 1.7 }),
        h("circle", { cx: 12, cy: 12, r: 1.7 }),
        h("circle", { cx: 19, cy: 12, r: 1.7 })
      );
    }

    function LoadingBox() { return h("div", { className: "dsm-state" }, "加载中…"); }
    function ErrorBox(msg) { return h("div", { className: "dsm-state dsm-error" }, "无法获取数据：" + (msg || "未知错误")); }

    function StaleBanner(props) {
      return h("div", { className: "dsm-stale" },
        "⚠ 数据刷新失败 · 最后成功更新 " + props.ago + (props.msg ? " · " + props.msg : "")
      );
    }

    function Chip(label, value, color) {
      return h("div", { className: "dsm-chip" },
        h("span", { className: "dsm-chip-val", style: { color: color } }, value),
        h("span", { className: "dsm-muted dsm-chip-label" }, label)
      );
    }

    function SortChip(label, key, activeKey, order, onClick) {
      var active = key === activeKey;
      var arrow = active ? (order === "asc" ? " ↑" : " ↓") : "";
      return h("button", {
        className: "dsm-sortchip" + (active ? " dsm-sortchip-active" : ""),
        onClick: function () { onClick(key); },
      }, label + arrow);
    }

    // ---------------------------------------------------------------------
    // polling hook
    // ---------------------------------------------------------------------
    function usePoll(fn, intervalMs, enabled, deps) {
      var fnRef = useRef(fn);
      fnRef.current = fn;
      var depsArr = deps || [];
      useEffect(function () {
        if (!enabled) return undefined;
        var stopped = false;
        var inFlight = false;
        var timer = null;
        function arm() { if (stopped) return; timer = setTimeout(tick, intervalMs); }
        async function tick() {
          if (stopped || inFlight) return;
          inFlight = true;
          try { await fnRef.current(); } catch (e) { /* keep polling */ }
          finally { inFlight = false; arm(); }
        }
        function onVis() {
          if (document.hidden) { if (timer) { clearTimeout(timer); timer = null; } }
          else if (timer === null && !inFlight) tick();
        }
        tick();
        document.addEventListener("visibilitychange", onVis);
        return function () {
          stopped = true;
          if (timer) clearTimeout(timer);
          document.removeEventListener("visibilitychange", onVis);
        };
      }, [enabled, intervalMs].concat(depsArr));
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
          if (openStore) openStore.update(function (s) { return { open: !s.open, width: s.width }; });
        },
      },
        h(MonitorIcon, { size: 16 }),
        isRail ? null : h("span", { className: "dsm-trigger-label" }, "系统监控")
      );
    }

    // ---------------------------------------------------------------------
    // overview
    // ---------------------------------------------------------------------
    function MetricCard(props) {
      return h("div", { className: "dsm-metric" },
        h("div", { className: "dsm-metric-head" },
          h("span", { className: "dsm-metric-label" }, props.label),
          h("span", { className: "dsm-metric-value", style: { color: props.color } }, props.value.toFixed(1) + props.suffix)
        ),
        props.sub ? h("div", { className: "dsm-metric-sub" }, props.sub) : null,
        h(Sparkline, { data: props.history, color: props.color, fixed: true, fill: true })
      );
    }

    function NetKpi(overview) {
      var net = overview.network || { primary: null, interfaces: [] };
      var ifaces = net.interfaces || [];
      var primary = null;
      for (var i = 0; i < ifaces.length; i++) if (ifaces[i].primary) { primary = ifaces[i]; break; }
      var rx = 0, tx = 0;
      if (primary) { rx = primary.rxBytesPerSec; tx = primary.txBytesPerSec; }
      else ifaces.forEach(function (i) { rx += i.rxBytesPerSec; tx += i.txBytesPerSec; });
      return h("div", { className: "dsm-kpi" },
        h("div", { className: "dsm-kpi-head" }, "网络 · " + (primary ? primary.name : "—")),
        h("div", { className: "dsm-kpi-row" },
          h("span", { className: "dsm-dot", style: { background: COLORS.netRx } }), "下行",
          h("span", { className: "dsm-kpi-val" }, fmtRate(rx))
        ),
        h("div", { className: "dsm-kpi-row" },
          h("span", { className: "dsm-dot", style: { background: COLORS.netTx } }), "上行",
          h("span", { className: "dsm-kpi-val" }, fmtRate(tx))
        )
      );
    }

    function DiskKpi(overview) {
      if (!overview.diskAvailable) {
        return h("div", { className: "dsm-kpi" },
          h("div", { className: "dsm-kpi-head" }, "磁盘"),
          h("span", { className: "dsm-muted" }, "无法获取磁盘信息")
        );
      }
      var color = colorForPct(overview.diskUsage);
      var mount = overview.disks && overview.disks[0] ? overview.disks[0].mount : "/";
      return h("div", { className: "dsm-kpi" },
        h("div", { className: "dsm-kpi-head" }, "磁盘 · " + mount),
        h("span", { className: "dsm-kpi-value", style: { color: color } }, overview.diskUsage.toFixed(1) + "%"),
        h("span", { className: "dsm-kpi-sub" }, fmtBytes(overview.diskUsed) + " / " + fmtBytes(overview.diskTotal))
      );
    }

    function LoadSection(overview) {
      var load = [overview.load1, overview.load5, overview.load15];
      var labels = ["1m", "5m", "15m"];
      var maxLoad = Math.max.apply(null, load.concat([overview.cpuCores, 1]));
      return h("div", { className: "dsm-section" },
        h("div", { className: "dsm-section-head" }, "系统负载"),
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
        h("div", { className: "dsm-muted dsm-sub", style: { marginTop: 8 } }, "运行时间 " + fmtUptime(overview.uptimeSeconds))
      );
    }

    function SystemSection(overview) {
      var rows = [
        ["操作系统", overview.osName],
        ["内核", overview.kernelVersion],
        ["主机名", overview.environment ? overview.environment.hostname : overview.hostname],
        ["CPU", overview.cpuModel],
        ["核心数", String(overview.cpuCores)],
        ["架构", overview.arch],
        ["总内存", fmtBytes(overview.memoryTotal)],
      ];
      return h("div", { className: "dsm-section" },
        h("div", { className: "dsm-section-head" }, "系统信息"),
        h("div", { className: "dsm-kv" },
          rows.map(function (r) {
            return h("div", { className: "dsm-kv-row", key: r[0] },
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
      return h("div", { className: "dsm-section" },
        h("div", { className: "dsm-section-head" }, "磁盘分区"),
        h("div", { className: "dsm-disk-list" },
          disks.map(function (d) {
            var color = colorForPct(d.usage);
            return h("div", { key: d.mount },
              h("div", { className: "dsm-disk-top" },
                h("span", { className: "dsm-mono", title: d.mount }, d.mount),
                h("span", { className: "dsm-disk-usage", style: { color: color } }, d.usage.toFixed(0) + "%")
              ),
              h("div", { className: "dsm-disk-sub" }, fmtBytes(d.used) + " / " + fmtBytes(d.total)),
              h("div", { className: "dsm-disk-bar" },
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
      return h("div", { className: "dsm-section" },
        h("div", { className: "dsm-section-head" }, "网络接口"),
        h("table", { className: "dsm-table" },
          h("thead", null, h("tr", null,
            h("th", null, "接口"), h("th", null, "IP"),
            h("th", { className: "dsm-num" }, "接收"), h("th", { className: "dsm-num" }, "发送")
          )),
          h("tbody", null, ifaces.map(function (i) {
            return h("tr", { key: i.name },
              h("td", { className: "dsm-mono" },
                i.primary ? h("span", { className: "dsm-tag dsm-tag-primary" }, "主") : null,
                " " + i.name,
                i.virtual ? h("span", { className: "dsm-tag dsm-tag-virt" }, "虚拟") : null
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
        return h("div", { className: "dsm-section" },
          h("div", { className: "dsm-section-head" }, "Docker 容器"),
          h("div", { className: "dsm-muted" }, "Docker 不可用（未检测到 /var/run/docker.sock）")
        );
      }
      var s = containers.summary;
      var abnormal = (s.unhealthy || 0) + (s.starting || 0) + (s.stopped || 0) + (s.paused || 0);
      return h("div", { className: "dsm-section" },
        h("div", { className: "dsm-section-head" }, "Docker 容器"),
        h("div", { className: "dsm-chips" },
          Chip("总数", s.total, "#8b8fa3"),
          Chip("运行", s.running, COLORS.ok),
          Chip("异常", abnormal, abnormal > 0 ? COLORS.err : COLORS.ok)
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
      var cpuSub = overview.cpuCores + " 核 · Load " + overview.load1.toFixed(2);
      return h("div", { className: "dsm-panel" },
        stale ? StaleBanner(stale) : null,
        h("div", { className: "dsm-metrics-grid" },
          MetricCard({ label: "CPU 使用率", value: overview.cpuUsage, suffix: "%", color: COLORS.cpu, history: props.cpuHistory, sub: cpuSub }),
          MetricCard({ label: "内存使用率", value: overview.memoryUsage, suffix: "%", color: COLORS.mem, history: props.memHistory, sub: fmtBytes(overview.memoryUsed) + " / " + fmtBytes(overview.memoryTotal) }),
          NetKpi(overview),
          DiskKpi(overview)
        ),
        LoadSection(overview),
        SystemSection(overview),
        DiskPartitionsSection(overview),
        InterfacesSection(overview),
        DockerSummarySection(containers)
      );
    }

    // ---------------------------------------------------------------------
    // process panel
    // ---------------------------------------------------------------------
    function ProcessDetailRow(k, v) {
      return h("div", { className: "dsm-kv-row" },
        h("span", { className: "dsm-muted" }, k),
        h("span", { className: "dsm-kv-val" }, v)
      );
    }

    function ProcessCard(props) {
      var p = props.p;
      var openState = useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      return h("div", {
        className: "dsm-proc-row" + (open ? " dsm-proc-open" : ""),
        onClick: function () { setOpen(!open); },
      },
        h("div", { className: "dsm-proc-top" },
          h("span", { className: "dsm-proc-name", title: p.name }, p.name),
          h("span", { className: "dsm-proc-cpu" }, p.cpu.toFixed(1) + "%")
        ),
        h("div", { className: "dsm-proc-meta" },
          h("span", null, "PID " + p.pid + " · PPID " + (p.ppid != null ? p.ppid : "—")),
          h("span", null, "· " + p.user),
          h("span", { className: "dsm-proc-mem" }, "MEM " + p.mem.toFixed(1) + "%")
        ),
        h("div", { className: "dsm-proc-cmd", title: p.command }, p.command),
        open ? h("div", { className: "dsm-proc-detail" },
          ProcessDetailRow("PID", String(p.pid)),
          ProcessDetailRow("PPID", String(p.ppid != null ? p.ppid : "—")),
          ProcessDetailRow("USER", p.user),
          ProcessDetailRow("CPU", p.cpu.toFixed(1) + "%"),
          ProcessDetailRow("MEM", p.mem.toFixed(1) + "%"),
          ProcessDetailRow("RSS", fmtBytes(p.rssBytes)),
          ProcessDetailRow("运行时长", fmtUptime(p.elapsedSeconds)),
          h("div", { className: "dsm-proc-detail-command" },
            h("span", { className: "dsm-muted" }, "命令："),
            h("span", { className: "dsm-mono", title: p.command }, p.command)
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
      if (error && !data) return ErrorBox(error);
      if (!data) return LoadingBox();

      var rows = data.processes || [];
      var hasMore = data.matched > rows.length;
      var sourceText = sourceLabel(data.source);

      return h("div", { className: "dsm-panel" },
        stale ? StaleBanner(stale) : null,
        h("div", { className: "dsm-count", style: { display: "flex", justifyContent: "space-between" } },
          h("span", { className: "dsm-muted" }, "来源：" + sourceText),
          h("span", { className: "dsm-muted" }, "共 " + data.total + " 个进程" + (query ? " · 匹配 " + data.matched + " 个" : ""))
        ),
        h("input", {
          className: "dsm-search", type: "text", placeholder: "搜索进程 / 命令 / 用户…",
          value: query || "",
          onChange: function (e) { setQuery(e.target.value); },
        }),
        h("div", { className: "dsm-sortchips" },
          SortChip("CPU", "cpu", sortKey, order, toggleSort),
          SortChip("内存", "mem", sortKey, order, toggleSort),
          SortChip("PID", "pid", sortKey, order, toggleSort),
          SortChip("名称", "name", sortKey, order, toggleSort)
        ),
        h("div", { className: "dsm-proc-table-wrap" },
          h("table", { className: "dsm-table" },
            h("thead", null, h("tr", null,
              h("th", { className: "dsm-num" }, "PID"),
              h("th", null, "进程"),
              h("th", null, "用户"),
              h("th", { className: "dsm-num" }, "CPU%"),
              h("th", { className: "dsm-num" }, "MEM%"),
              h("th", null, "命令")
            )),
            h("tbody", null, rows.map(function (p) {
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
        ),
        h("div", { className: "dsm-proc-list" },
          rows.map(function (p) { return h(ProcessCard, { p: p, key: p.pid }); })
        ),
        hasMore ? h("button", { className: "dsm-loadmore", onClick: onLoadMore }, "加载更多") : null
      );
    }

    // ---------------------------------------------------------------------
    // docker panel
    // ---------------------------------------------------------------------
    function dedupPorts(ports) {
      var seen = {};
      var out = [];
      (ports || []).forEach(function (p) {
        var key = (p.hostPort != null ? p.hostPort : "") + "|" + (p.containerPort != null ? p.containerPort : "") + "|" + (p.protocol || "tcp");
        if (seen[key]) return;
        seen[key] = true;
        out.push(p);
      });
      return out;
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
        return h("div", { className: "dsm-panel" },
          h("div", { className: "dsm-state dsm-error" }, "Docker 不可用（未检测到 /var/run/docker.sock）")
        );
      }

      var s = data.summary;
      var containers = data.containers || [];
      var abnormalCount = containers.filter(function (c) { return c.state !== "running" || c.health === "unhealthy" || c.health === "starting"; }).length;

      var q = (query || "").toLowerCase();
      var filtered = containers.filter(function (c) {
        if (q) {
          var portsText = (c.ports || []).map(function (p) { return (p.hostPort != null ? p.hostPort : "") + " " + (p.containerPort != null ? p.containerPort : ""); }).join(" ");
          var hay = (c.name + " " + c.image + " " + portsText + " " + (c.status || "") + " " + (c.health || "")).toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        if (filter === "running" && c.state !== "running") return false;
        if (filter === "abnormal" && !(c.state !== "running" || c.health === "unhealthy" || c.health === "starting")) return false;
        return true;
      });

      var filters = [
        ["all", "全部", s.total],
        ["running", "运行", s.running],
        ["abnormal", "异常", abnormalCount],
      ];

      function hostName() { return window.location.hostname || "localhost"; }

      function openPort(p, protocol) {
        var hp = p.hostPort != null ? p.hostPort : p.containerPort;
        if (hp == null) return;
        window.open(protocol + "://" + hostName() + ":" + hp, "_blank");
      }

      function copyPort(p) {
        var hp = p.hostPort != null ? p.hostPort : p.containerPort;
        if (hp == null) return;
        copyText(hostName() + ":" + hp, function (ok) { showToast(ok ? "已复制地址" : "复制失败"); });
      }

      function handlePortClick(p) {
        var proto = portWebProtocol(p);
        var hp = p.hostPort != null ? p.hostPort : p.containerPort;
        if (proto && hp != null) openPort(p, proto);
        else copyPort(p);
      }

      function portChips(c) {
        var ports = dedupPorts(c.ports);
        if (!ports.length) {
          return h("span", { className: "dsm-port-none" }, "无端口映射");
        }
        return h("div", { className: "dsm-port-chips" },
          ports.map(function (p, i) {
            var proto = portWebProtocol(p);
            var hp = p.hostPort != null ? p.hostPort : p.containerPort;
            var label = p.hostPort != null ? String(p.hostPort) : String(p.containerPort) + "/" + (p.protocol || "tcp");
            var tooltip = "宿主端口 " + (p.hostPort != null ? p.hostPort : "—") + " · 容器端口 " + p.containerPort + "/" + (p.protocol || "tcp");
            return h("button", {
              key: String(i) + label,
              className: "dsm-port-chip",
              title: tooltip,
              onClick: function () { handlePortClick(p); },
              onContextMenu: function (e) { e.preventDefault(); setPortMenu({ x: e.clientX, y: e.clientY, port: p }); },
            },
              h("span", { className: "dsm-port-ico" }, proto ? "🌐" : "📋"),
              label
            );
          })
        );
      }

      return h("div", { className: "dsm-panel" },
        stale ? StaleBanner(stale) : null,
        h("div", { className: "dsm-chips" },
          Chip("总数", s.total, "#8b8fa3"),
          Chip("运行", s.running, COLORS.ok),
          Chip("异常", abnormalCount, abnormalCount > 0 ? COLORS.err : COLORS.ok)
        ),
        h("input", {
          className: "dsm-search", type: "text", placeholder: "搜索容器 / 镜像 / 端口…",
          value: query || "",
          onChange: function (e) { setQuery(e.target.value); },
        }),
        h("div", { className: "dsm-filterchips" },
          filters.map(function (f) {
            return h("button", {
              key: f[0],
              className: "dsm-filterchip" + (filter === f[0] ? " dsm-filterchip-active" : ""),
              onClick: function () { setFilter(f[0]); },
            }, f[1], h("span", { className: "dsm-filterchip-count" }, String(f[2])));
          })
        ),
        h("div", { className: "dsm-muted dsm-count" }, "显示 " + filtered.length + " 个容器"),
        h("div", { className: "dsm-docker-table-wrap" },
          h("table", { className: "dsm-table" },
            h("thead", null, h("tr", null,
              h("th", null, "容器"), h("th", null, "状态"),
              h("th", { className: "dsm-num" }, "CPU%"), h("th", { className: "dsm-num" }, "内存"), h("th", null, "端口")
            )),
            h("tbody", null, filtered.map(function (c) {
              var badge = containerStatusBadge(c);
              return h("tr", { key: c.id },
                h("td", null,
                  h("div", { className: "dsm-docker-name" }, c.name),
                  h("div", { className: "dsm-muted dsm-docker-image", title: c.image }, c.image)
                ),
                h("td", null,
                  h("span", { className: "dsm-state-dot", style: { background: badge.color } }),
                  h("span", { style: { color: badge.color } }, badge.label)
                ),
                h("td", { className: "dsm-num" }, c.cpuUsage != null ? c.cpuUsage.toFixed(1) : "—"),
                h("td", { className: "dsm-num" }, containerMemText(c)),
                h("td", null, portChips(c))
              );
            }))
          )
        ),
        h("div", { className: "dsm-docker-list" },
          filtered.map(function (c) {
            var badge = containerStatusBadge(c);
            return h("div", { className: "dsm-container-card", key: c.id },
              h("div", { className: "dsm-container-head" },
                h("span", { className: "dsm-state-dot", style: { background: badge.color } }),
                h("span", { className: "dsm-container-name", title: c.name }, c.name),
                h("span", { className: "dsm-container-state", style: { color: badge.color, marginLeft: "auto", flex: "none", fontSize: 11 } }, badge.label)
              ),
              h("div", { className: "dsm-container-image", title: c.image }, c.image),
              h("div", { className: "dsm-container-stats" },
                h("span", { className: "dsm-container-stat" },
                  h("span", { className: "dsm-muted" }, "CPU"),
                  h("span", null, c.cpuUsage != null ? c.cpuUsage.toFixed(1) + "%" : "—")
                ),
                h("span", { className: "dsm-container-stat" },
                  h("span", { className: "dsm-muted" }, "内存"),
                  h("span", null, containerMemText(c))
                )
              ),
              h("div", { className: "dsm-port-block" },
                h("div", { className: "dsm-port-label" }, "端口"),
                portChips(c)
              ),
              c.status ? h("div", { className: "dsm-container-uptime" }, c.status) : null
            );
          })
        ),
        portMenu ? h("div", { className: "dsm-portmenu-backdrop", onClick: function () { setPortMenu(null); } },
          h("div", { className: "dsm-portmenu", style: { left: portMenu.x, top: portMenu.y }, onClick: function (e) { e.stopPropagation(); } },
            h("button", { onClick: function () { openPort(portMenu.port, "http"); setPortMenu(null); } }, "HTTP 打开"),
            h("button", { onClick: function () { openPort(portMenu.port, "https"); setPortMenu(null); } }, "HTTPS 打开"),
            h("button", { onClick: function () { copyPort(portMenu.port); setPortMenu(null); } }, "复制地址")
          )
        ) : null
      );
    }

    // ---------------------------------------------------------------------
    // source modal + diagnostic
    // ---------------------------------------------------------------------
    function SourceModal(props) {
      var env = props.env || {};
      function row(k, v) {
        return h("div", { className: "dsm-kv-row" },
          h("span", { className: "dsm-muted" }, k),
          h("span", { className: "dsm-kv-val" }, v)
        );
      }
      var modeLabel = env.mode === "container" ? "Container" : env.mode === "host" ? "Host" : "—";
      var dockerLabel = env.dockerSource === "host" ? "宿主机 Docker Engine" : env.dockerSource === "unavailable" ? "不可用" : "—";
      return h("div", { className: "dsm-modal-backdrop", onClick: props.onClose },
        h("div", { className: "dsm-modal", onClick: function (e) { e.stopPropagation(); } },
          h("button", { className: "dsm-modal-close", onClick: props.onClose, "aria-label": "关闭" }, "×"),
          h("div", { className: "dsm-modal-title" }, "采集来源"),
          h("div", { className: "dsm-kv" },
            row("运行环境", modeLabel),
            row("系统数据", sourceLabel(env.systemSource)),
            row("进程数据", sourceLabel(env.processSource)),
            row("Docker", dockerLabel)
          )
        )
      );
    }

    function buildDiagnostic(overview, processes, containers) {
      var L = [];
      var env = overview && overview.environment;
      L.push("DSH Side Monitor Diagnostic");
      L.push("");
      L.push("Host: " + (env ? env.hostname : "—"));
      L.push("Mode: " + (env && env.mode === "container" ? "Container" : "Host"));
      L.push("System Source: " + (env ? sourceLabel(env.systemSource) : "—"));
      L.push("Process Source: " + (env ? sourceLabel(env.processSource) : "—"));
      L.push("Docker Source: " + (env && env.dockerSource === "host" ? "Host" : "unavailable"));
      L.push("OS: " + (overview ? overview.osName : "—"));
      L.push("Uptime: " + (overview ? fmtUptime(overview.uptimeSeconds) : "—"));
      if (overview) {
        L.push("");
        L.push("CPU:");
        L.push(overview.cpuModel);
        L.push("Usage: " + overview.cpuUsage.toFixed(1) + "%");
        L.push("Cores: " + overview.cpuCores);
        L.push("");
        L.push("Memory:");
        L.push(fmtBytes(overview.memoryUsed) + " / " + fmtBytes(overview.memoryTotal));
        L.push(overview.memoryUsage.toFixed(1) + "%");
        L.push("");
        L.push("Load:");
        L.push("1m  " + overview.load1.toFixed(2));
        L.push("5m  " + overview.load5.toFixed(2));
        L.push("15m " + overview.load15.toFixed(2));
        L.push("");
        L.push("Disk:");
        (overview.disks || []).forEach(function (d) {
          L.push(d.mount + "  " + fmtBytes(d.used) + " / " + fmtBytes(d.total) + " (" + d.usage.toFixed(1) + "%)");
        });
      }
      L.push("");
      if (containers && containers.available) {
        L.push("Docker:");
        L.push(containers.summary.total + " total");
        L.push(containers.summary.running + " running");
        L.push((containers.summary.unhealthy || 0) + " unhealthy");
      } else {
        L.push("Docker: unavailable");
      }
      L.push("");
      if (processes && processes.processes) {
        L.push("Top Processes:");
        processes.processes.slice(0, 10).forEach(function (p) {
          L.push(p.name + "       CPU " + p.cpu.toFixed(1) + "% MEM " + p.mem.toFixed(1) + "%");
        });
      }
      return L.join("\n");
    }

    // ---------------------------------------------------------------------
    // drawer
    // ---------------------------------------------------------------------
    function MonitorDrawerBody(props) {
      var ctx = props.ctx;
      var openStore = props.openStore;
      var connection = ctx.connection;
      var isMobile = useMediaQuery("(max-width: 767px)");

      var tabState = useState("overview");
      var tab = tabState[0];
      var setTab = tabState[1];

      var width = useSyncExternalStore(
        openStore ? openStore.subscribe : function () { return function () {}; },
        function () { return openStore ? openStore.get().width : DEFAULT_W; }
      );

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
      var toastState = useState("");
      var toast = toastState[0];
      var setToast = toastState[1];
      var toastTimer = useRef(null);
      var nowState = useState(Date.now());
      var now = nowState[0];
      var setNow = nowState[1];

      useEffect(function () {
        var t = setTimeout(function () { setProcQueryD(procQuery); }, 250);
        return function () { clearTimeout(t); };
      }, [procQuery]);

      useEffect(function () {
        var t = setInterval(function () { setNow(Date.now()); }, 1000);
        return function () { clearInterval(t); };
      }, []);

      useEffect(function () {
        if (!menuOpen) return undefined;
        function onDoc(ev) {
          if (menuRef.current && !menuRef.current.contains(ev.target)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return function () { document.removeEventListener("mousedown", onDoc); };
      }, [menuOpen]);

      function toggleProcSort(key) {
        if (procSort === key) setProcOrder(procOrder === "desc" ? "asc" : "desc");
        else { setProcSort(key); setProcOrder(key === "name" ? "asc" : "desc"); }
      }

      function showToast(msg) {
        setToast(msg);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(function () { setToast(""); }, 2200);
      }

      function refreshAll() {
        setRefreshing(true);
        setRefreshVersion(function (v) { return v + 1; });
        setMenuOpen(false);
        setTimeout(function () { setRefreshing(false); }, 900);
      }

      function copyDiagnostic() {
        setMenuOpen(false);
        var text = buildDiagnostic(overview, processes, containers);
        copyText(text, function (ok) { showToast(ok ? "已复制诊断信息" : "复制失败"); });
      }

      usePoll(function () {
        return callRpc(connection, "overview", {}).then(function (res) {
          if (res && res.ok) {
            setOverview(res.value);
            setOverviewError(null);
            setOverviewUpdated(Date.now());
            pushHistory(cpuHistory, res.value.cpuUsage, 40);
            pushHistory(memHistory, res.value.memoryUsage, 40);
          } else if (res && res.error) setOverviewError(res.error.message);
        }).catch(function (e) { setOverviewError(e && e.message ? e.message : String(e)); });
      }, 2000, true, [refreshVersion]);

      usePoll(function () {
        return callRpc(connection, "processes", { query: procQueryD, sort: procSort, order: procOrder, offset: 0, limit: procLimit }).then(function (res) {
          if (res && res.ok) { setProcesses(res.value); setProcessError(null); setProcessUpdated(Date.now()); }
          else if (res && res.error) setProcessError(res.error.message);
        }).catch(function (e) { setProcessError(e && e.message ? e.message : String(e)); });
      }, 3000, tab === "processes", [procQueryD, procSort, procOrder, procLimit, refreshVersion]);

      usePoll(function () {
        return callRpc(connection, "containers", { stats: tab === "docker" }).then(function (res) {
          if (res && res.ok) { setContainers(res.value); setDockerError(null); setDockerUpdated(Date.now()); }
          else if (res && res.error) setDockerError(res.error.message);
        }).catch(function (e) { setDockerError(e && e.message ? e.message : String(e)); });
      }, 5000, tab === "overview" || tab === "docker", [refreshVersion, tab]);

      function close() {
        openStore.update(function (s) { return { open: false, width: s.width }; });
      }

      function startResize(e) {
        if (isMobile) return;
        e.preventDefault();
        var startX = e.clientX;
        var startWidth = openStore.get().width;
        function onMove(ev) {
          var w = Math.max(MIN_W, Math.min(MAX_W, startWidth - (ev.clientX - startX)));
          openStore.update(function (s) { return { open: s.open, width: w }; });
        }
        function onUp() {
          try { localStorage.setItem(WIDTH_KEY, String(openStore.get().width)); } catch (err) { /* ignore */ }
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      }

      function staleInfo(error, updatedAt) {
        if (!error || !updatedAt) return null;
        var sec = Math.max(0, Math.round((now - updatedAt) / 1000));
        return { ago: relTime(sec), msg: error };
      }

      var env = overview && overview.environment;
      function statusInfo() {
        var updatedAt, error;
        if (tab === "overview") { updatedAt = overviewUpdated; error = overviewError; }
        else if (tab === "processes") { updatedAt = processUpdated; error = processError; }
        else { updatedAt = dockerUpdated; error = dockerError; }
        var source = env ? " · " + sourceLabel(env.systemSource) + "视角" : "";
        if (!updatedAt) return { color: "#9aa3b2", text: "等待首次数据…" };
        var sec = Math.max(0, Math.round((now - updatedAt) / 1000));
        if (error) return { color: COLORS.err, text: "数据中断 · 最后成功更新 " + relTime(sec) + source };
        return { color: COLORS.ok, text: "实时 · " + relTime(sec) + source };
      }

      var tabs = [
        ["overview", "概览"],
        ["processes", "进程"],
        ["docker", "Docker"],
      ];

      var mode = env && env.mode;
      var modeLabel = mode === "container" ? "Container" : mode === "host" ? "Host" : "…";
      var modeColor = mode === "container" ? COLORS.warn : COLORS.ok;
      var status = statusInfo();

      var body;
      if (tab === "overview") {
        body = h(OverviewPanel, {
          overview: overview,
          containers: containers,
          error: overviewError,
          stale: staleInfo(overviewError, overviewUpdated),
          cpuHistory: cpuHistory.current,
          memHistory: memHistory.current,
        });
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
          onLoadMore: function () { setProcLimit(function (n) { return Math.min(200, n + 60); }); },
        });
      } else {
        body = h(DockerPanel, { data: containers, error: dockerError, stale: staleInfo(dockerError, dockerUpdated), showToast: showToast });
      }

      return h("div", { className: "dsm-root" + (isMobile ? " dsm-root-mobile" : ""), style: isMobile ? { width: "100%" } : { width: width + "px" } },
        isMobile ? null : h("div", { className: "dsm-resize", title: "拖动调整宽度", onPointerDown: startResize }),
        h("div", { className: "dsm-header" },
          h("div", { className: "dsm-title-col" },
            h("div", { className: "dsm-title-row" },
              h("span", { className: "dsm-title" }, "系统监控"),
              h("span", { className: "dsm-mode", title: "点击查看采集来源", onClick: function () { setSourceModal(true); } },
                h("span", { className: "dsm-mode-dot", style: { background: modeColor } }),
                modeLabel
              )
            ),
            h("span", { className: "dsm-hostname", title: env ? env.hostname : "" }, env ? env.hostname : "")
          ),
          h("div", { className: "dsm-header-actions" },
            h("button", { className: "dsm-icon-btn", onClick: refreshAll, title: "立即刷新", "aria-label": "立即刷新" },
              h(RefreshIcon, { size: 16, className: refreshing ? "dsm-spin" : "" })
            ),
            h("div", { ref: menuRef, style: { position: "relative" } },
              h("button", { className: "dsm-icon-btn", onClick: function () { setMenuOpen(!menuOpen); }, title: "更多", "aria-label": "更多" }, h(MoreIcon, { size: 16 })),
              menuOpen ? h("div", { className: "dsm-menu" },
                h("button", { className: "dsm-menu-item", onClick: refreshAll }, "立即刷新"),
                h("button", { className: "dsm-menu-item", onClick: copyDiagnostic }, "复制诊断信息"),
                h("button", { className: "dsm-menu-item", onClick: function () { setMenuOpen(false); setSourceModal(true); } }, "查看采集来源"),
                h("div", { className: "dsm-menu-sep" }),
                h("button", { className: "dsm-menu-item", disabled: true, title: "设置将在 v0.3 提供" }, "设置 (v0.3)")
              ) : null
            ),
            h("button", { className: "dsm-close", onClick: close, title: "关闭", "aria-label": "关闭" }, h(CloseIcon, { size: 16 }))
          )
        ),
        h("div", { className: "dsm-status-line" },
          h("span", { className: "dsm-status-dot", style: { background: status.color } }),
          status.text
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
        h("div", { className: "dsm-body" }, body),
        toast ? h("div", { className: "dsm-toast" }, toast) : null,
        sourceModal ? h(SourceModal, { env: env, onClose: function () { setSourceModal(false); } }) : null
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
      var openStore = createStore({ open: false, width: initialWidth() });

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
