# dsh-side-monitor

DSH 系统监控侧边插件（v0.2.2）。在 DSH 左侧 Sidebar 底部提供一个「系统监控」入口，点击后打开右侧监控面板，实时展示宿主机（DSH 所在主机）的系统概览、进程列表与 Docker 容器状态。

## 特性

- **Sidebar 入口**：注册到 `sidebar.footer.action` 插槽，展开时显示「系统监控」文字，折叠时仅显示图标；打开后高亮。
- **右侧 Drawer / 移动端全屏**：桌面端为可拖动宽度的右侧面板（默认 500px，范围 360–800px，宽度持久化）；viewport < 768px 时自动切换为全屏页面，不再三栏挤占。采用 **Container Query** 按面板自身宽度自适应。
- **采集来源标识**：自动识别运行环境（Host / Container），并明确区分「系统数据 / 进程数据 / Docker」各自的来源（当前 DSH 容器 vs 宿主机），顶部徽标 + 状态行（概览 / 进程 / Docker 分别标注各自来源）+ 「查看采集来源」弹窗（逐项展示真实来源路径 + 一致性自检）三层呈现。
- **三个模块，状态彼此独立**（各自 error / 更新时间，请求失败保留最后成功数据并显示 stale 横幅）：
  - **概览**：CPU / 内存 两张强卡片（大百分比 + 副信息 + 面积填充 Sparkline，固定 0–100 纵轴，无圆环）；网络主接口吞吐 / 根分区磁盘 两张轻量 KPI；下方以 section 呈现系统负载、系统信息、磁盘分区（多挂载点）、网络接口（默认路由 + 虚拟接口标记）、Docker 汇总（总数/运行/异常）。
  - **进程**：来源标识（宿主机/当前容器）；搜索 / 排序 / 分页全部下沉到 Host RPC（扫描全部进程后再过滤）；CPU / 内存 / PID / 名称排序 Chip；卡片显示 PID · PPID · 用户，点击展开 RSS / 运行时长 / 命令。
  - **Docker**：容器名 / 镜像 / 状态 / health（healthy/unhealthy/starting）/ CPU% / 内存 / 端口；**端口可操作**——已发布（有 hostPort）的 Web 端口点击新标签页打开，非 Web 端口点击复制 `host:port`，右键弹出 HTTP/HTTPS 打开 / 复制地址菜单；正确处理 `127.0.0.1` / `0.0.0.0` / 指定 `hostIp`（IPv6 自动加方括号）；未发布端口显示 🔒 且禁止打开；stats 失败容器显示 ⚠ tooltip；无端口时显示「无端口映射」而非空 Chip。
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
  ├─ Overview Collector (procRoot/stat|meminfo|loadavg|uptime|cpuinfo|sys/kernel/osrelease + fsRoot/etc/os-release + net/dev|net/route + mounts/statfs)
  ├─ Process Collector  (procRoot/<pid>/stat|status|cmdline，Host 端搜索/排序/分页，含 PPID)
  ├─ Network Collector  (procRoot/net/dev 采样差分 + procRoot/net/route 默认路由 + fib_trie/if_inet6 接口 IP)
  ├─ Disk Collector     (procRoot/mounts + statfs 多挂载点，mountinfo major:minor 同设备去重，10s 缓存)
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

## v0.2.1 变更（宿主机指标准确性）

- 负载 / 运行时长 / CPU 核心与型号 / 内核 / 操作系统改读宿主机真实来源（`/host/proc/loadavg`、`/host/proc/uptime`、`/host/proc/cpuinfo`、`/host/proc/sys/kernel/osrelease`、`/host/root/etc/os-release`），不再依赖 `os.*`。
- 进程运行时长统一使用宿主机 uptime。
- 网络接口 IP 不再使用 `os.networkInterfaces()`：IPv4 来自 `/proc/net/fib_trie`（本地 `/32`）映射 `/proc/net/route` 已连接子网，IPv6 来自 `/proc/net/if_inet6`。
- 磁盘同设备去重改用 `/proc/self/mountinfo` 的 `major:minor`（原为 total|used 大小去重）。
- Docker stats 返回明确状态/错误，失败容器展示 `statsError`（⚠ tooltip）；未发布（无 hostPort）端口禁止打开。
- 端口打开正确处理 `127.0.0.1` / `0.0.0.0` / 指定 `hostIp`。
- Docker Tab 状态栏按 `dockerSource` 标注；iPhone 等触屏小屏用 `screen.width`/touch 辅助判定全屏。
- 「采集来源」弹窗逐项展示真实来源路径；新增宿主机/容器数据一致性自检（只读挂载 + PID 命名空间隔离）。

## v0.2.2 变更（可靠性收口）

- 网络接口以 `/proc/net/dev` 为事实源：即使 IP 解析失败（fib_trie / if_inet6）也保留接口与流量，IP 可为 null；首次采样无差值时返回 null，UI 显示「正在采样…」而非假 0。
- CPU 区分物理核心 / 逻辑 CPU（`physicalCores` / `cpuCores`），UI 不再把逻辑 CPU 写成「核心数」。
- Docker 端口：`127.0.0.1` / `::1` 标记「仅宿主机本地」并锁定（禁止用远端 hostname 打开）；去重 key 加入 `hostIp`（IPv4/IPv6 多地址绑定不再误合并）；up 时间中文化（如「已运行 20 小时」）。
- RPC 版本握手：响应携带 `protocolVersion`（v3）+ `pluginVersion`；客户端不匹配时显示「版本不一致」横幅与「关于」面板（Browser/Host/RPC 版本），避免旧 Host 导致的 undefined 字段。
- 进程页新增「列表 / 聚合」视图：按 name+command 分组（Host 端全量分组），展开查看 PID 列表，保持只读。
- 移动端改用 `100dvh` + `env(safe-area-inset-bottom)`，iOS Safari 地址栏收展更自然。
- 新增 fixture 单元测试（`npm test`，node:test + test/fixtures/proc）与 GitHub Actions CI（Node 20/22）。

## 已知限制

- 完整宿主 PID 视图可进一步通过 `pid: host` 获得，但默认不强制开启；开启后一致性自检会提示 PID 命名空间未隔离。
- 宿主/容器进程双视角切换、设置页、历史趋势、DSH 原生 Side Card 集成留待后续版本。
