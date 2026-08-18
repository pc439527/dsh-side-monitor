# dsh-side-monitor

DSH（DeepSeek Harness）Web 的**只读系统监控**插件：在左侧 Sidebar 底部提供「系统监控」入口，点击打开右侧监控面板，实时展示**宿主机**（DSH 所在主机）的系统概览、进程列表与 Docker 容器状态。

[![CI](https://github.com/pc439527/dsh-side-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/pc439527/dsh-side-monitor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 全程只读：不提供 docker restart/stop、process kill、exec、shell 等任何控制操作，适合随手查资源、排障和观察容器状态。

## v0.3.0 — 停止/异常语义拆分、性能、能力与 CI 漂移检查

- **Docker 停止/异常语义拆分**：正常停止（退出码 0）的容器现在只算「已停止」，不再计入「异常」；异常只统计真正的问题——不健康、健康检查中、重启中（崩溃循环）、dead、或非零退出。概览与 Docker 页都展示独立的 **总数 / 运行 / 已停止 / 异常** 徽标与筛选，崩溃容器显示退出码（已崩溃 (137)）。
- **宿主网络探测性能优化**：`--net=host` 探测从 5s 一次降到最多 15s 一次，且不再阻塞概览轮询——缓存未过期直接复用，过期时后台刷新；并加了基线保护，避免容器 netns 回退与宿主 netns 计数器互相差分产生错误速率。
- **Client 版本自动同步**：`lib/client.js` 的 `CLIENT_VERSION` 由 `tools/sync-generated.mjs`（取代 `tools/convert-i18n.mjs`）从 `package.json` 重新生成，同时重新生成内联 i18n 字典并做「禁止字符串拼接」lint；CI 通过 `npm run check:gen` 对任何漂移直接报错。
- **i18n 禁止字符串拼接**：所有可见句子都是带占位符的完整消息，客户端不再有 `t("a") + t("b")` 拼接，生成器内置 lint 强制约束。
- **文案与 Header 打磨**：接口表 `接收/发送` -> `RX/TX`；`DSH Container` -> `DSH running in container`（`DSH on host` -> `DSH running on host`）；Header 下方的状态行不再重复数据来源（此前与徽标的 `Host view` 重复），视角文案修正为正确空格的 `Host view`（不再是 `Hostview`）。
- **meta 状态细分 + capabilities**：`meta` 端点新增细粒度状态（运行模式、各数据来源、网络探测、一致性）与宿主能力（Host Mount、Docker Socket、宿主 netns 探测、进程聚合、容器实时统计），在「关于」弹窗新增 状态/能力 区块展示。
- **进程聚合详情**：聚合卡片展开后展示命令、去重用户与总 RSS。
- **内存图透明度**：内存 Sparkline 填充透明度调高（0.2，CPU 为 0.12）更清晰；Docker 卡片进一步压缩。

## v0.2.3 — 完整中英文 & 宿主机网络

- **完整中英文双语 UI（zh-CN / en-US）**：默认简体中文（不跟随浏览器），右上角菜单「⋯ → 语言」即时切换，语言持久化在 `dsh-side-monitor:language`。Header / Tab / 卡片 / 进程 / Docker / Toast / 错误 / Tooltip / 诊断信息全部翻译（字典在 `lib/i18n.js`，由 `tools/sync-generated.mjs` 生成进客户端包）。
- **Header** 改为展示数据来源徽标（`宿主数据` / `Host Data`），副标题带运行环境说明（`PC9527-fnOS · DSH 运行于容器`）；**关于** 展示 Browser / Host / RPC / 运行环境 / 系统 / 进程 / Docker 数据来源。
- **宿主模式真实网络**：`/proc/net` 是 netns 作用域，挂载 `/host/proc` 仍看到容器接口 —— v0.2.3 通过短暂 `--net=host` 只读探测容器读取真实宿主 netns（带缓存、失败自动回退），并裁剪 veth/br/docker 噪音；磁盘去重改用 `st_dev` 并展示宿主数据卷（fnOS 的 `/vol1`）。
- **Docker 端口徽标视觉规则**：Web = 蓝色 `🌐 宿主 → 容器`，普通 TCP = 中性灰 `📋`，Loopback = 黄色 `🔒 + 仅宿主机`，未发布 = 灰黄 `🔒 + 容器内`；IPv4+IPv6 双栈合并为单个徽标并带 `IPv4 + IPv6` 标记。

## 截图

<img width="1904" height="960" alt="dsh-side-monitor 系统监控面板" src="https://github.com/user-attachments/assets/55764a6a-89da-45cc-8ad0-722fd19262bc" />

## 功能特性

### 概览（Overview）

- **CPU / 内存两张强卡片**：大百分比 + 副信息 + 面积填充 Sparkline（固定 0–100 纵轴）。
- **网络主接口吞吐 / 根分区磁盘**两张轻量 KPI。
- 下方 section 呈现：系统负载、系统信息、磁盘分区（多挂载点）、网络接口（默认路由 + 虚拟接口标记、RX/TX 速率）、Docker 汇总（总数 / 运行 / 已停止 / 异常）。

### 进程（Processes）

- 来源标识（宿主机 / 当前容器）。
- 搜索 / 排序 / 分页全部下沉到 Host RPC（扫描全部进程后再过滤），数据量大也不卡浏览器。
- CPU / 内存 / PID / 名称排序 Chip；卡片显示 PID · PPID · 用户，点击展开 RSS / 运行时长 / 命令。
- 「列表 / 聚合」双视图：按 name+command 分组，展开查看 PID 列表、命令、去重用户与总 RSS。

### Docker（Containers）

- 容器名 / 镜像 / 状态 / health（healthy/unhealthy/starting）/ CPU% / 内存 / 端口。正常停止（退出码 0）显示为「已停止」且不计入异常；崩溃容器显示「已崩溃 (137)」徽标。
- **端口可操作**：已发布（有 hostPort）的 Web 端口点击在新标签页打开；非 Web 端口点击复制 `host:port`；右键弹出 HTTP/HTTPS 打开 / 复制地址菜单。
- 正确处理 `127.0.0.1` / `0.0.0.0` / 指定 `hostIp`（IPv6 自动加方括号）；未发布端口显示 🔒 且禁止打开；stats 失败容器显示 ⚠ tooltip。

### 体验与可靠性

- **Sidebar 入口**：注册到 `sidebar.footer.action` 插槽，展开时显示文字、折叠时仅图标，打开后高亮。
- **响应式**：桌面端为可拖动宽度的右侧 Drawer（默认 500px，范围 360–800px，宽度持久化）；viewport < 768px 时自动切换为全屏页面，采用 Container Query 按面板自身宽度自适应，移动端 `100dvh` + 安全区适配。
- **采集来源标识**：自动识别运行环境（Host / Container），顶部徽标 + 状态行（概览 / 进程 / Docker 分别标注来源）+「查看采集来源」弹窗（逐项展示真实来源路径 + 一致性自检）。
- **状态独立**：三个模块各自 error / 更新时间，请求失败保留最后成功数据并显示 stale 横幅。
- **版本握手**：RPC 响应携带 `protocolVersion`（v3）+ `pluginVersion`；不匹配时显示「版本不一致」横幅与「关于」面板（Browser / Host / RPC 版本），避免旧 Host 导致的 undefined 字段。
- 手动刷新（旋转动画）、「复制诊断信息」一键生成诊断文本。
- 面板关闭或浏览器标签页隐藏时停止/暂停轮询；同一轮询 await 上一请求，禁止重入。

## 安装

```sh
# 本地目录安装
dsh plugin --profile web add /path/to/dsh-side-monitor
```

安装后刷新页面，左侧 Sidebar 底部出现「系统监控」入口。

## 宿主机采集（Host Mount Mode）

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

## 刷新频率

| 数据 | 频率 |
| --- | --- |
| CPU / 内存 / 网络 / 负载 / Uptime | 2s |
| 磁盘 | 10s（Host 端缓存） |
| 进程列表 | 3s（Host 端 Snapshot Cache） |
| Docker 列表 + stats | 5s（stats 3s 缓存） |

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

## 安全说明

- 浏览器端不直接访问宿主机文件系统或 Docker Socket，所有采集经 Host 端白名单 RPC。
- Host 端仅暴露 `/side-monitor` 三个只读端点：`overview` / `processes` / `containers`；权限沿用 DSH 标准 `trusted-host`。
- 不提供任意命令执行、任意 Docker API 代理或任何控制操作。
- Host Mount Mode 的 `/host/proc`、`/host/sys`、`/host/root` 必须只读挂载。

## 开发

```sh
npm run check   # 语法检查
npm test        # node:test 单元测试（test/fixtures/proc 为真实 /proc 快照）
```

CI：GitHub Actions（Node 20 / 22）自动运行 check + test。

## 已知限制

- 完整宿主 PID 视图可通过 `pid: host` 获得，但默认不强制开启；开启后一致性自检会提示 PID 命名空间未隔离。
- 宿主 / 容器进程双视角切换、设置页、历史趋势、DSH 原生 Side Card 集成留待后续版本。

## 更新日志

- **v0.2.2** 可靠性收口：网络以 `/proc/net/dev` 为事实源（IP 解析失败仍保留接口与流量）；CPU 区分物理核心 / 逻辑 CPU；Docker 端口细化（loopback 锁定、hostIp 去重、uptime 中文化）；RPC 版本握手；进程聚合视图；移动端 `100dvh` + 安全区；fixture 单元测试与 CI。
- **v0.2.1** 宿主机指标准确性：负载 / 运行时长 / CPU 核心与型号 / 内核 / OS 改读宿主机真实来源；进程运行时长统一宿主机 uptime；网络 IP 改自 `/proc/net/fib_trie` 与 `if_inet6`；磁盘去重改用 mountinfo `major:minor`；来源自检。
- **v0.2.0** 采集来源标识、CPU / 内存卡片重做、Docker 端口可操作、Host Mount 模式。
- **v0.1.0** 首个版本：响应式监控面板。

## License

MIT
