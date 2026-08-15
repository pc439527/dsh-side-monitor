# dsh-side-monitor

DSH 系统监控侧边插件（v0.1.0）。在 DSH 左侧 Sidebar 底部提供一个「系统监控」入口，点击后打开右侧监控面板，实时展示宿主机（DSH 所在主机）的系统概览、进程列表与 Docker 容器状态。

## 特性

- **Sidebar 入口**：注册到 `sidebar.footer.action` 插槽，展开时显示「系统监控」文字，折叠时仅显示图标；打开后高亮。
- **右侧 Drawer**：固定右侧面板（约 520px，窄屏自适应），暗色科技风，与 DSH 主题一致。
- **三个模块**：
  - **概览**：CPU / 内存 / 网络吞吐 / 根分区磁盘 / 负载(1m/5m/15m) / Uptime / 系统信息 / 网络接口 / Docker 汇总。
  - **进程**：PID / 进程名 / 用户 / CPU% / 内存% / 命令，支持按 CPU、内存排序与关键字搜索。
  - **Docker**：容器名 / 镜像 / 状态 / 运行时长 / CPU% / 内存 / 端口映射，含汇总计数。
- **只读优先**：第一版不做任何控制操作。
- **低侵入**：通过 DSH Host + Client 双端插件机制接入，不修改核心代码。

## 架构

```text
Client UI (Sidebar Trigger + Monitor Drawer + 3 Tabs)
        │  RPC: connection.rpc.call('/side-monitor', ...)
        ▼
Host Service (lib/collectors.js + lib/rpc.js)
  ├─ Overview Collector   (os + /proc/stat|meminfo|loadavg|uptime|net/dev + df)
  ├─ Process Collector    (/proc/<pid>/stat|status|cmdline)
  ├─ Network Collector    (/proc/net/dev 采样差分)
  ├─ Disk Collector       (df -Pk /，10s 缓存)
  └─ Docker Collector     (/var/run/docker.sock 只读 Engine API)
```

## 安装

```sh
dsh plugin --profile web add <本目录路径>
```

## 刷新频率

- CPU / 内存 / 网络 / 负载 / Uptime：2s
- 磁盘：10s（Host 端缓存）
- 进程列表：3s
- Docker 列表 + stats：5s
- 面板关闭或浏览器标签页隐藏时停止/暂停轮询

## 安全说明

- 浏览器端不直接访问宿主机文件系统或 Docker Socket。
- Host 端仅暴露白名单 RPC（`/side-monitor` 的 `overview` / `processes` / `containers` 三个只读端点）；权限沿用 DSH 标准 `trusted-host`（loopback + 配置的 `--trusted-host`），与 GUI/API 一致。
- 不提供任意命令执行能力，不代理任意 Docker API 路径。
- Docker 采集仅访问 `/containers/json` 与 `/containers/{id}/stats`（只读，id 校验为十六进制）。

## 已知限制

- 若 DSH 运行在容器内，概览/进程采集到的是容器内资源（进程为容器 PID 命名空间），而 Docker 模块展示的是宿主机容器（依赖 `/var/run/docker.sock` 挂载）。
- v0.1.0 仅支持 Linux 宿主机。
