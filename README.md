# dsh-side-monitor

A **read-only system monitor** for DeepSeek Harness (DSH) Web: a “System Monitor” entry in the left sidebar footer opens a right-side monitor drawer that shows live **host** (the machine DSH runs on) overview, process list, and Docker container status.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Read-only by design: no docker restart/stop, no process kill, no exec, no shell. Built for quick resource checks, troubleshooting, and container observation.

## v0.3.0 — stopped/issue split, perf, capabilities & drift checks

- **Docker stopped / issue semantic split**: a cleanly stopped container (exit code 0) is now just "Stopped" — it no longer inflates the issue count. Issues are reserved for real problems: unhealthy, health-starting, crash-looping (restarting), dead, or non-zero exits. The Overview + Docker tabs show separate **Total / Running / Stopped / Issues** chips and filters; crashed containers display their exit code (Crashed (137)).
- **Host network probe performance**: the `--net=host` netns probe now runs at most every 15s (was 5s) and never blocks the overview poll — stale snapshots are reused while the refresh happens in the background, with a baseline guard so the container-netns fallback never diffs against host-netns counters.
- **Client version auto-sync**: `lib/client.js`'s `CLIENT_VERSION` is regenerated from `package.json` by `tools/sync-generated.mjs` (replaces `tools/convert-i18n.mjs`), which also regenerates the inline i18n dictionary and lints for the no-concatenation rule; `npm run check:gen` verifies there is no drift.
- **i18n no-string-concatenation**: every user-visible sentence is a placeholder message — no `t("a") + t("b")` splicing anywhere in the client, enforced by the generator's lint.
- **Label & header polish**: `Received/Sent` -> `RX/TX`; `DSH Container` -> `DSH running in container` (`DSH on host` -> `DSH running on host`); the status line under the header no longer repeats the data source (it was duplicated with the header badge) and the view label is properly spaced (`Host view`, never `Hostview`).
- **meta status细分 + capabilities**: the `meta` endpoint reports fine-grained status (mode, per-source state, network probe, consistency) and Host capabilities (Host Mount mode, Docker socket, host-netns probe, process aggregation, container stats) — shown in new Status / Capabilities sections of the About dialog.
- **Process aggregate details**: grouped cards expand to show the command, distinct users and total RSS.
- **Memory chart transparency**: the memory sparkline fill opacity is tuned for legibility (0.2 vs 0.12 for CPU); Docker cards are compressed further.

## v0.2.3 — i18n & host networking

- **Full bilingual UI (zh-CN / en-US)**: default Simplified Chinese (never follows the browser), switch instantly from the drawer menu (⋯ → Language) with persistence via `dsh-side-monitor:language`. Every header / tab / card / process / docker / toast / error / tooltip / diagnostics string is translated (dictionary in `lib/i18n.js`, regenerated into the client bundle by `tools/sync-generated.mjs`).
- **Header** now shows the data source badge (`Host Data` / `宿主数据`) with the runtime note in the subtitle (`PC9527-fnOS · DSH Container`); **About** reports Browser / Host / RPC / Runtime / System / Process / Docker sources.
- **Real host network in Host Mount Mode**: `/proc/net` is net-namespace scoped, so a `/host/proc` bind still shows the container's interfaces — v0.2.3 reads the host netns through a short-lived `--net=host` read-only probe (cached, falls back gracefully) and curates veth/br/docker noise. Disk dedup now uses `st_dev` and surfaces host data volumes (`/vol1` on fnOS).
- **Docker port chips** follow the visual rules: web = blue `🌐 host → container`, plain TCP = neutral `📋`, loopback = yellow `🔒 + Host only`, unpublished = gray `🔒 + Container only`; IPv4+IPv6 dual-stack renders once with an `IPv4 + IPv6` tag.

## Screenshots

<img width="1904" height="960" alt="dsh-side-monitor — system monitor drawer" src="https://github.com/user-attachments/assets/55764a6a-89da-45cc-8ad0-722fd19262bc" />

## Features

### Overview

- **CPU / memory metric cards**: large percentage, sub-info, and an area-filled sparkline (fixed 0–100 axis).
- **Network primary-interface throughput / root-partition disk** lightweight KPIs.
- Sections below: system load, system info, disk partitions (multiple mount points), network interfaces (default-route + virtual-interface markers, RX/TX rates), Docker summary (total / running / stopped / issues).

### Processes

- Source label (host / current container).
- Search / sort / pagination run entirely in the Host RPC (scans all processes, then filters) — stays smooth with large process tables.
- Sort chips for CPU / memory / PID / name; cards show PID · PPID · user, click to expand RSS / uptime / command.
- List and aggregate views: group by name+command, expand to see the PID list, command, distinct users and total RSS.

### Docker (Containers)

- Container name / image / state / health (healthy/unhealthy/starting) / CPU% / memory / ports. Clean stops (exit 0) are shown as Stopped and never counted as issues; crashed containers show Crashed (137)-style badges.
- **Actionable ports**: published Web ports (with hostPort) open in a new tab on click; non-Web ports copy `host:port`; right-click menu offers HTTP/HTTPS open / copy address.
- Correct handling of `127.0.0.1` / `0.0.0.0` / explicit `hostIp` (IPv6 auto-bracketed); unpublished ports show 🔒 and cannot be opened; containers with failed stats show a ⚠ tooltip.

### UX & Reliability

- **Sidebar entry**: registered on the `sidebar.footer.action` slot — shows text when expanded, icon only when collapsed, highlighted while open.
- **Responsive**: a draggable right drawer on desktop (default 500px, range 360–800px, width persisted); switches to a full-screen page below 768px viewport, using Container Query to adapt to the panel's own width; mobile uses `100dvh` + safe-area insets.
- **Source identification**: auto-detects the environment (Host / Container); top badge + status line (per-module sources for overview / processes / Docker) + a “View data sources” dialog listing the real source paths with a consistency self-check.
- **Independent module state**: each module has its own error / updated-at; on failure the last good data is kept with a stale banner.
- **Protocol handshake**: RPC responses carry `protocolVersion` (v3) + `pluginVersion`; a mismatch shows a “version mismatch” banner and an About panel (Browser / Host / RPC versions, fine-grained status and capabilities) instead of undefined fields.
- Manual refresh (spinner animation) and a “copy diagnostics” action that generates a one-click diagnostic text.
- Polling stops/pauses when the panel is closed or the tab is hidden; each poll awaits the previous request (no re-entrancy).

## Installation

```sh
# install from a local directory
dsh plugin --profile web add /path/to/dsh-side-monitor
```

After installing, refresh the page — a “System Monitor” entry appears at the bottom of the left sidebar.

## Host Mount Mode

When DSH runs inside a container, the collectors read the container's own `/proc` (container view). To monitor the real host, add **read-only** mounts that expose the host's proc / sys / root filesystem at fixed paths:

```yaml
services:
  deepseek-harness:
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/host/root:ro
      - /var/run/docker.sock:/var/run/docker.sock
```

The collector auto-detects these paths (host view wins when present, container view otherwise); you can also set them explicitly via plugin config:

```text
procRoot: /host/proc
sysRoot:  /host/sys
fsRoot:   /host/root
```

Once mounted, overview / processes read host resources and the source label switches to “host view”. Note: `/proc`, `/sys`, and `/` **must be mounted read-only**.

## Refresh Intervals

| Data | Interval |
| --- | --- |
| CPU / memory / network / load / uptime | 2s |
| Disk | 10s (Host-side cache) |
| Process list | 3s (Host-side snapshot cache) |
| Docker list + stats | 5s (stats 3s cache) |

## Architecture

```text
Client UI (Sidebar Trigger + Monitor Drawer/Fullscreen + 3 Tabs)
        │  RPC: connection.rpc.call('/side-monitor', ...)
        ▼
Host Service (lib/collectors.js + lib/rpc.js)
  ├─ Environment        (mode / systemSource / processSource / dockerSource / hostname)
  ├─ Overview Collector (procRoot/stat|meminfo|loadavg|uptime|cpuinfo|sys/kernel/osrelease + fsRoot/etc/os-release + net/dev|net/route + mounts/statfs)
  ├─ Process Collector  (procRoot/<pid>/stat|status|cmdline, host-side search/sort/pagination, PPID included)
  ├─ Network Collector  (procRoot/net/dev sampled diff + procRoot/net/route default route + fib_trie/if_inet6 interface IPs)
  ├─ Disk Collector     (procRoot/mounts + statfs multi-mount, mountinfo major:minor dedup, 10s cache)
  └─ Docker Collector   (/var/run/docker.sock read-only Engine API, health + structured ports)
```

## Security

- The browser never touches the host filesystem or the Docker socket directly — all collection goes through the Host-side whitelisted RPC.
- The Host exposes only three read-only endpoints under `/side-monitor`: `overview` / `processes` / `containers`; permissions follow the standard DSH `trusted-host` role.
- No arbitrary command execution, no generic Docker API proxy, no control operations.
- In Host Mount Mode, `/host/proc`, `/host/sys`, and `/host/root` must be mounted read-only.

## Development

```sh
npm run check   # syntax check
npm test        # node:test unit tests (test/fixtures/proc are real /proc snapshots)
```


## Known Limitations

- The full host PID view is available via `pid: host` but is not forced by default; enabling it makes the consistency self-check report that the PID namespace is not isolated.
- Host/container process view switching, a settings page, historical trends, and native DSH Side Card integration are planned for later releases.

## Changelog

- **v0.2.2** — Reliability: network uses `/proc/net/dev` as source of truth (interfaces/traffic kept even when IP resolution fails); CPU distinguishes physical cores / logical CPUs; Docker port refinements (loopback locking, hostIp dedup, localized uptime); RPC version handshake; process aggregate view; mobile `100dvh` + safe areas; fixture unit tests and CI.
- **v0.2.1** — Host metric accuracy: load / uptime / CPU model / kernel / OS read from real host sources; process uptime uses host uptime; network IPs from `/proc/net/fib_trie` and `if_inet6`; disk dedup via mountinfo `major:minor`; source self-check.
- **v0.2.0** — Source identification, redesigned CPU/memory cards, actionable Docker ports, Host Mount Mode.
- **v0.1.0** — Initial release: responsive monitor panel.

## License

MIT
