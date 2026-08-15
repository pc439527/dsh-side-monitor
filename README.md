# dsh-side-monitor

DSH 系统监控侧边插件（v0.2.0）。在 DSH 左侧 Sidebar 底部提供一个「系统监控」入口，点击后打开右侧监控面板，实时展示宿主机（DSH 所在主机）的系统概览、进程列表与 Docker 容器状态。

## 特性

- **Sidebar 入口**：注册到 `sidebar.footer.action` 插槽，展开时显示「系统监控」文字，折叠时仅显示图标；打开后高亮。
- **右侧 Drawer / 移动端全屏**：桌面端为可拖动宽度的右侧面板（默认 500px，范围 360–800px，宽度持久化）；viewport < 768px 时自动切换为全屏页面，不再三栏挤占。采用 **Container Query** 按面板自身宽度自适应。
- **采集来源标识**：自动识别运行环境（Host / Container），并明确区分「系统数据 / 进程数据 / Docker」各自的来源（当前 DSH 容器 vs 宿主机），顶部徽标 + 状态行「容器视角 / 宿主机视角」+ 「查看采集来源」弹窗三层呈现。
- **三个模块，状态彼此独立**（各自 error / 更新时间，请求失败保留最后成功数据并显示 stale 横幅）：
  - **概览**：CPU / 内存 两张强卡片（大百分比 + 副信息 + 面积填充 Sparkline，固定 0–100 纵轴，无圆环）；网络主接口吞吐 / 根分区磁盘 两张轻量 KPI；下方以 section 呈现系统负载、系统信息、磁盘分区（多挂载点）、网络接口（默认路由 + 虚拟接口标记）、Docker 汇总（总数/运行/异常）。
  - **进程**：来源标识（宿主机/当前容器）；搜索 / 排序 / 分页全部下沉到 Host RPC（扫描全部进程后再过滤）；CPU / 内存 / PID / 名称排序 Chip；卡片显示 PID · PPID · 用户，点击展开 RSS / 运行时长 / 命令。
  - **Docker**：容器名 / 镜像 / 状态 / health（healthy/unhealthy/starting）/ CPU% / 内存 / 端口；**端口可操作**——识别为 Web 的端口点击新标签页打开（使用 `window.location.hostname`），非 Web 端口点击复制 `host:port`，右键弹出 HTTP/HTTPS 打开 / 复制地址菜单；无端口时显示「无端口映射」而非空 Chip。
- **状态反馈**：顶部实时状态行，手动刷新（旋转动画），「复制诊断信息」菜单（一键生成诊断文本贴给 DSH Agent）。
- **只读优先**：不做任何控制操作；不提供 docker restart/stop、process kill、exec、shell。
- **低侵入**：通过 DSH Host + Client 双端插件机制接入，不修改核心代码。

## Host Mount Mode（宿主机采集）

DSH 运行在容器内时，默认读取的是容器自身的 `/proc`（容器视角）。要监控真正的宿主机，请为 DSH 容器增加**只读**挂载，把宿主机的 proc / sys / 根文件系统暴露到固定路径：

```yaml
services:
  deepseek-harness:
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/host/root:ro
      - /var/run/docker.sock:/var/run/docker.sock
```

Collector 会自动检测这些路径（存在则优先使用宿主视角，否则回退容器视角），也可通过插件 config 显式指定：

```text
procRoot: /host/proc
sysRoot:  /host/sys
fsRoot:   /host/root
```

挂载后，概览 / 进程读取宿主机资源，顶部来源标识自动变为「宿主机视角」。注意：`/proc`、`/sys`、`/` **必须只读挂载**。

## 架构

```text
Client UI (Sidebar Trigger + Monitor Drawer/Fullscreen + 3 Tabs)
        │  RPC: connection.rpc.call('/side-monitor', ...)
        ▼
Host Service (lib/collectors.js + lib/rpc.js)
  ├─ Environment        (mode / systemSource / processSource / dockerSource / hostname)
  ├─ Overview Collector (os + procRoot/stat|meminfo|loadavg|uptime|net/dev|net/route + mounts/statfs)
  ├─ Process Collector  (procRoot/<pid>/stat|status|cmdline，Host 端搜索/排序/分页，含 PPID)
  ├─ Network Collector  (procRoot/net/dev 采样差分 + procRoot/net/route 默认路由)
  ├─ Disk Collector     (procRoot/mounts + statfs 多挂载点，同设备去重，10s 缓存)
  └─ Docker Collector   (/var/run/docker.sock 只读 Engine API，health + 结构化端口)
```

## 安装

```sh
dsh plugin --profile web add <本目录路径>
```

## 刷新频率

- CPU / 内存 / 网络 / 负载 / Uptime：2s
- 磁盘：10s（Host 端缓存）
- 进程列表：3s（Host 端 Snapshot Cache）
- Docker 列表 + stats：5s（stats 3s 缓存）
- 面板关闭或浏览器标签页隐藏时停止/暂停轮询；同一轮询 await 上一请求，禁止重入

## 安全说明

- 浏览器端不直接访问宿主机文件系统或 Docker Socket。
- Host 端仅暴露白名单 RPC（`/side-monitor` 的 `overview` / `processes` / `containers` 三个只读端点）；权限沿用 DSH 标准 `trusted-host`。
- 不提供任意命令执行、任意 Docker API 代理、控制操作。
- Host Mount Mode 的 `/host/proc`、`/host/sys`、`/host/root` 必须只读挂载。

## 已知限制

- 完整宿主 PID 视图可进一步通过 `pid: host` 获得，但默认不强制开启。
- 宿主机网络接口的 IP 列表当前仍来自容器视角（`os.networkInterfaces()`）；吞吐/默认路由来自 procRoot。完整宿主机网络留待 v0.2.1。
- 宿主/容器进程双视角切换、设置页、历史趋势、DSH 原生 Side Card 集成留待后续版本。
