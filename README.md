# dsh-side-monitor

A **read-only system monitor** for DeepSeek Harness (DSH) Web: a “System Monitor” entry in the left sidebar footer opens a right-side monitor drawer that shows live **host** (the machine DSH runs on) overview, process list, and Docker container status.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

> Read-only by design: no docker restart/stop, no process kill, no exec, no shell. Built for quick resource checks, troubleshooting, and container observation.
## v0.7.0 — Accuracy fixes, fixed-cadence sampler, build pipeline

**Data correctness (the reported symptoms, and their root causes)**
- **"Host" vs "container" contradiction**: a `/proc` that is literally `/proc` does not prove DSH runs in a container. DSH on bare metal has no `/host/proc` and was mislabelled "container" while its own process list showed `dockerd` / `tailscaled`. The source label is now `viewIsHost = hostMetrics || detectMode() === 'host'`, applied consistently to `systemSource`, `processSource` and the process/container payload `source`.
- **CPU jitter (6.8% ↔ 17.7%)**: CPU / disk-IO / network / swap rates are stateful, and the 2 s history sampler plus the browser poll were both diffing them at uneven intervals. A new **fixed-cadence sampler** (`lib/sampler.js`) solely owns the previous raw counters and the single 2 s loop; `overview()` returns the latest snapshot and never does rate maths on the request path. The history ring is fed by the same clock via `subscribeMetrics()`.
- **Docker CPU/memory showing "—"**: awaiting one-shot stats for every container took >10 s (26 containers, concurrency 4). Stats are now collected **in the background**, only while someone is on the Docker view (30 s window), with the Host computing CPU% from its own cumulative totals (Docker's `precpu_stats` is not reliable across separate one-shot requests; it is used only for the very first sample so values appear immediately). `containers` returns the cache instantly (~35 ms) plus `statsAgeMs`.
- **Disk partitions**: `efivarfs` added to the pseudo-filesystem list, and `/sys`, `/proc`, `/dev`, `/run` prefixes are filtered, so `/sys/firmware/efi/efivars` no longer appears. Mounts now report `avail`, and usage follows **df semantics** — `used / (used + avail)` instead of `used / total`, which matters on ext4 with reserved blocks.
- **Temperature names**: `/sys/class/hwmon` chip `name` plus `temp*_label` are read alongside `thermal_zone*/type`, and sensors get a localisable key — `x86_pkg_temp`/`coretemp` → "CPU 封装" (CPU package), `acpitz` → "主板 ACPI" (Mainboard ACPI), `nvme` → "NVMe 固态".
- **Swap card**: shows swap-in / swap-out rates from `/proc/vmstat` (`pswpin`/`pswpout`) instead of a permanently empty chart.
- **New data**: `cpuTimes` (user / system / irq / iowait / steal / idle composition) for the CPU-time donut, and `swapIo` rates.
- **Diagnostics**: `buildDiagnostic` no longer throws on a null `cpuUsage` before the first sample.

**UI**
- Alert bar for disk ≥ 90%, swap ≥ 50% with memory ≥ 85%, temperature ≥ 85 °C, and unhealthy containers (thresholds computed in the browser).
- Last-viewed tab is remembered (`localStorage`, storage failures ignored).
- Mini-chart history is prefilled from the `history` endpoint, so switching views no longer starts from an empty sparkline.
- Missing values show "采样中…" (sampling) instead of "—".

**Engineering**
- The browser half moved to `src/client/` and is bundled with esbuild into `lib/client.js` (single IIFE for the DSH module table). `npm run check:gen` verifies both the generated i18n/version parts and bundle drift.

## v0.6.0 — Section rail, richer host metrics, history

- **Left section rail** inside the main panel (概览 / 性能 / 进程 / Docker / 硬件与系统). Narrow screens (<768px) turn the rail into a horizontal strip.
- **Performance view**: 10-minute server-side history (2 s samples, in memory only) with 1 / 5 / 10 minute windows; CPU, memory, swap, load, network and disk IO trends; per-core CPU bars.
- **Overview** adds swap, threads / runnable tasks, disk IO rates and a memory breakdown (free / buffers / cached / available).
- **Hardware & system** adds CPU clock and thermal sensors (shows "no sensor" when none are readable).
- **Docker** adds a daemon summary card (`/info` and `/version`, read-only).
- RPC protocol **v4** (additive): new endpoints `history` and `dockerInfo`; `meta.capabilities` gains `swap`, `perCpu`, `diskIo`, `temperature`, `history`, `dockerInfo`. Still read-only.

## v0.5.0 — System Monitor as a main panel

- **Entry moved to the navigation group** beside Plugins and Automation tasks, using the same `sidebar.panellist` seat as the context-insight plugin. The old footer trigger is gone.
- **The monitor is a main-panel page** (keyed `main` slot, key `dsh-side-monitor`) instead of a right-side drawer. Page header, tabs (Overview / Processes / Docker), scrollable body and responsive cards follow the context-insight layout. The width drag handle and drawer animation were removed.
- The row label is a thunk (`t("monitorTitle")`), so it follows the panel language without re-registration.
- Fixed a blank page: the page component was passed as a string tag, which React rendered as an unknown element.

## v0.4.0 — DSH 0.2.0-rc.2 compat pass

- **Verified against DeepSeek Harness 0.2.0-rc.2**: the `sidebar.footer.action` slot (`ctx.slots.inject` + `ctx.slots.register`), the `ctx.connection.rpc.call` browser contract and the Host route-mount registration all match the 0.2 runtime (the /side-monitor endpoints were driven end-to-end against a live boot: token exchange, session cookie, meta / overview responses).
- **The drawer is now a `shell.overlay` slot entry** instead of a second React root appended to `document.body`. The 0.2 UI guide forbids a plugin-owned app root; the shell's frame-wide floating layer gives the drawer the host theme, light/dark switching and stacking for free, and it is click-through until the drawer's own box (which opts back into pointer events) is hit — the rest of the app stays usable while the monitor is open.
- **Host channel registration follows the shipped route-mount pattern**: the bundled `dsh-host-open-in-app` is the live proof of how 0.2 plugins serve browser routes. Reaching the carrier through `connection.rpc.handle()` (the 0.1.x way) does not work: the facade mounts its route through `owner.webServer`, and cordis 4 refuses that read on the shadow-bound context the facade ends up with (even when the plugin declares it), so the channel silently never mounted and the drawer reported 'transport failure ... HTTP 405'. v0.4.0 instead declares `inject = ['connection', 'webServer']` and registers its own `POST /side-monitor/<endpoint>` prefix route, fenced by `connection.requestRejection` before anything is reachable, speaking the exact 0.2 client wire (`client-request` / `server-response` envelopes).
- **Manifest fixed**: `dsh.client.inject` and `peerDependencies` dropped `@deepseek-ai/dsh-client-runtime` (it stopped publishing at 0.1.1-rc.2). `inject` now names the modules whose seats and services the panel uses — `@deepseek-ai/dsh-client-connection`, `@deepseek-ai/dsh-client-ui-layout` (declares `shell.overlay`), `@deepseek-ai/dsh-client-ui-renderer` (provides the `slots` service) and `@deepseek-ai/dsh-client-ui-sidebar` (declares `sidebar.footer.action`); `peerDependencies` pin `@deepseek-ai/dsh-client-connection` and `@deepseek-ai/dsh-client-ui-renderer` to the `^0.2.0-rc.2` line and `@deepseek-ai/cordis` to `~4.0.4`.
- **Theme tokens refreshed**: the removed `--dsw-specific-surface-fill` is replaced by `--dsw-specific-menu` (dropdown, port menu, modal) and the dedicated `--dsw-alias-toast-bg` / `--dsw-alias-toast-label` pair; the drawer shadow uses `--dsw-elevation-panel` instead of a literal.
- **Regression tests** now guard the manifest, the wire contract on the mounted route (trust fence, media type, envelope validation, rpcId echo), the `shell.overlay` registration and the absence of a `document.body` React root.

> The panel still ships its own zh-CN / en-US dictionary and language switcher (`dsh-side-monitor:language`) rather than the 0.2 Client locale service. Migrating to `ctx.locale` — so the panel follows **Settings → General** and registers in the language catalog — is planned for a later release.

## v0.3.1 — DSH 0.1.1-rc.2 compat pass

- **Verified against DeepSeek Harness 0.1.1-rc.2**: the `sidebar.footer.action` slot (`ctx.slots.inject` + `ctx.slots.register`), the `ctx.connection.rpc.call` browser contract and the Host `connection.rpc.handle` channel registration all match the 0.1.1-rc.2 runtime (live-tested: `/side-monitor` overview / processes / containers / meta return current data).
- **Dropped the stale `@deepseek-ai/dsh-client-ui-slots` reference**: the package no longer ships in DSH 0.1.1-rc.2 (its slot runtime merged into `@deepseek-ai/dsh-client-runtime`). Removed it from `dsh.client.inject` and from `peerDependencies` so fresh `dsh plugin` installs resolve cleanly instead of pulling the rc.6-era package.


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
| CPU / memory / network / load / uptime | 2s (fixed-cadence sampler) |
| Disk | 10s (Host-side cache) |
| Process list | 3s (Host-side snapshot cache) |
| Docker list | 5s (Host-side cache) |
| Docker stats | 5s background refresh, only while the Docker view is open (30s window); requests read the cache |

## Architecture

```text
Client UI (Sidebar Row + Monitor Main-Panel Page + 3 Tabs)
        │  RPC: connection.rpc.call('/side-monitor', ...)
        ▼
Host Service (lib/collectors.js + lib/rpc.js + lib/sampler.js)
  ├─ Environment        (mode / systemSource / processSource / dockerSource / hostname)
  ├─ Overview Collector (procRoot/stat|meminfo|loadavg|uptime|cpuinfo|sys/kernel/osrelease + fsRoot/etc/os-release + net/dev|net/route + mounts/statfs)
  ├─ Process Collector  (procRoot/<pid>/stat|status|cmdline, host-side search/sort/pagination, PPID included)
  ├─ Network Collector  (procRoot/net/dev sampled diff + procRoot/net/route default route + fib_trie/if_inet6 interface IPs)
  ├─ Disk Collector     (procRoot/mounts + statfs multi-mount, mountinfo major:minor dedup, 10s cache)
  └─ Docker Collector   (/var/run/docker.sock read-only Engine API, health + structured ports)
```

## Security

- The browser never touches the host filesystem or the Docker socket directly — all collection goes through the Host-side whitelisted RPC.
- The Host mounts a single prefix route under `/side-monitor` with three read-only endpoints: `overview` / `processes` / `containers`. Every request is fenced by `connection.requestRejection` — DSH Connection's Host/Origin trust fence (loopback plus configured `--trusted-host` authorities) and its browser-session authentication — before anything is reachable.
- No arbitrary command execution, no generic Docker API proxy, no control operations.
- In Host Mount Mode, `/host/proc`, `/host/sys`, and `/host/root` must be mounted read-only.

## Development

```sh
npm run check          # syntax check
npm test               # node:test unit tests (test/fixtures/proc are real /proc snapshots)
npm run build:client   # bundle src/client -> lib/client.js (esbuild)
npm run sync:gen       # regenerate generated i18n/version parts + rebuild
npm run check:gen      # fail on generated-part or bundle drift (use in CI)
```

Edit the browser half in `src/client/`; `lib/client.js` is a build artifact.


## Known Limitations

- The full host PID view is available via `pid: host` but is not forced by default; enabling it makes the consistency self-check report that the PID namespace is not isolated.
- Host/container process view switching, a settings page, historical trends, and native DSH Side Card integration are planned for later releases.

## Changelog

- **v0.4.0** — DSH 0.2.0-rc.2 compat pass: drawer moved to the `shell.overlay` slot (no `document.body` app root), Host `handle(channel, handler)` arity, manifest peer deps / `dsh.client.inject` retargeted to the 0.2 line, current theme tokens.
- **v0.3.x** — Stopped/issue split, host netns probe caching, client version auto-sync, i18n lint, 0.1.1-rc.2 compat.
- **v0.2.2** — Reliability: network uses `/proc/net/dev` as source of truth (interfaces/traffic kept even when IP resolution fails); CPU distinguishes physical cores / logical CPUs; Docker port refinements (loopback locking, hostIp dedup, localized uptime); RPC version handshake; process aggregate view; mobile `100dvh` + safe areas; fixture unit tests and CI.
- **v0.2.1** — Host metric accuracy: load / uptime / CPU model / kernel / OS read from real host sources; process uptime uses host uptime; network IPs from `/proc/net/fib_trie` and `if_inet6`; disk dedup via mountinfo `major:minor`; source self-check.
- **v0.2.0** — Source identification, redesigned CPU/memory cards, actionable Docker ports, Host Mount Mode.
- **v0.1.0** — Initial release: responsive monitor panel.

## License

MIT