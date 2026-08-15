# dsh-side-monitor

DSH 系统监控侧边插件（v0.2.0）。在 DSH 左侧 Sidebar 底部提供一个「系统监控」入口，点击后打开右侧监控面板，实时展示宿主机（DSH 所在主机）的系统概览、进程列表与 Docker 容器状态。

## 特性

- **Sidebar 入口**：注册到 `sidebar.footer.action` 插槽，展开时显示「系统监控」文字，折叠时仅显示图标；打开后高亮。
- **右侧 Drawer**：可拖动宽度的右侧面板（默认 500px，范围 360–800px，宽度持久化），暗色科技风，与 DSH 主题一致；采用 **Container Query** 按面板自身宽度自适应（而非浏览器 viewport）。
- **运行环境识别**：自动识别 Host / Container，并在标题区以徽标显示（Container 显示 12 位容器 ID，Host 显示主机名）；明确「容器内指标 vs 宿主机 Docker Engine」的边界。
- **三个模块，状态彼此独立**（各自的 error / 更新时间，互不影响；请求失败时保留最后成功数据并显示 stale 横幅）：
  - **概览**：CPU / 内存 / 网络主接口吞吐 / 根分区磁盘 四张 KPI 卡（Sparkline 固定 0–100 纵轴），下方以 section 呈现系统负载、系统信息、磁盘分区（多挂载点）、网络接口（含默认路由与虚拟接口标记）、Docker 汇总。
  - **进程**：搜索 / 排序 / 分页全部下沉到 Host RPC（扫描全部进程后再过滤，低 CPU 进程也能搜到）；CPU / 内存 / PID / 名称排序 Chip；宽面板用表格，窄面板自动切换为进程卡片，点击卡片展开 PID / PPID / USER / RSS / 运行时长 / 命令。
  - **Docker**：容器名 / 镜像 / 状态 / 运行时长 / CPU% / 内存 / 端口映射（结构化 Tag/Chip），含 health 状态（healthy / unhealthy / starting）；支持名称 / 镜像 / 端口搜索，与「全部 / 运行 / 异常」过滤。
- **状态反馈**：顶部实时状态行（● 实时 · N 秒前 / ● 数据中断 · 最后成功更新 N 秒前），手动刷新按钮（旋转动画），以及「复制诊断信息」菜单（一键生成诊断文本，直接贴给 DSH Agent）。
- **只读优先**：不做任何控制操作。
- **低侵入**：通过 DSH Host + Client 双端插件机制接入，不修改核心代码。

## 架构

```text
Client UI (Sidebar Trigger + Monitor Drawer + 3 Tabs)
        │  RPC: connection.rpc.call('/side-monitor', ...)
        ▼
Host Service (lib/collectors.js + lib/rpc.js)
  ├─ Overview Collector   (os + /proc/stat|meminfo|loadavg|uptime|net/dev|net/route + df -Pk)
  ├─ Process Collector    (/proc/<pid>/stat|status|cmdline，Host 端搜索/排序/分页)
  ├─ Network Collector    (/proc/net/dev 采样差分 + /proc/net/route 默认路由)
  ├─ Disk Collector       (df -Pk 全量多挂载点，同设备去重，10s 缓存)
  └─ Docker Collector     (/var/run/docker.sock 只读 Engine API，health + 结构化端口)
```

## 安装

```sh
dsh plugin --profile web add <本目录路径>
```

## 刷新频率

- CPU / 内存 / 网络 / 负载 / Uptime：2s
- 磁盘：10s（Host 端缓存）
- 进程列表：3s（Host 端 Snapshot Cache，搜索/排序命中缓存）
- Docker 列表 + stats：5s（stats 3s 缓存）
- 面板关闭或浏览器标签页隐藏时停止/暂停轮询；同一轮询 await 上一请求，禁止重入

## 安全说明

- 浏览器端不直接访问宿主机文件系统或 Docker Socket。
- Host 端仅暴露白名单 RPC（`/side-monitor` 的 `overview` / `processes` / `containers` 三个只读端点）；权限沿用 DSH 标准 `trusted-host`（loopback + 配置的 `--trusted-host`），与 GUI/API 一致。
- 不提供任意命令执行能力，不代理任意 Docker API 路径。
- Docker 采集仅访问 `/containers/json` 与 `/containers/{id}/stats`（只读，id 校验为十六进制）。

## 已知限制

- 若 DSH 运行在容器内，概览/进程采集到的是容器内资源（进程为容器 PID 命名空间），而 Docker 模块展示的是宿主机容器（依赖 `/var/run/docker.sock` 挂载）；顶部徽标已明确标识此场景。
- v0.2.0 仅支持 Linux 宿主机。
