# PHASE 1 验收记录（2026-08-18 02:4x）

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| Host 加载 v0.2.2 | ✅ | RPC: protocolVersion=3, pluginVersion=0.2.2 |
| /host/proc /host/sys /host/root 只读挂载 | ✅ | ls -ld 三者均为宿主目录；recreate.sh 中全部 :ro |
| 容器完整重建 | ✅ | 旧 505af1e41a4d → 新 da5e72ac8b51（2026-08-18 01:58） |
| 主机名 | ✅ | PC9527-fnOS（/host/root/etc/hostname） |
| OS / 内核 | ✅ | Debian 12（fnOS 基础系统）/ 6.18.18.c952-trim |
| CPU | ✅ | i5-6200U @ 2.3GHz · 4 逻辑核 · 物理 2 |
| 内存 | ✅ | 7.54GB 宿主内存（usage ~55%） |
| Uptime | ✅ | ~3.5 天（宿主 /host/proc/uptime） |
| 网络 | ✅ | 主网卡 enx6c1ff721efa2 · 192.168.5.22 · 真实速率（UI 确认 21/9 KB/s） |
| 进程 | ✅ | 442 个宿主进程（含 tailscaled/dockerd），source=host |
| Docker | ✅ | 18 个（17 运行 / 1 停止），source=host |
| 磁盘 | ✅ | / ext4 86.6% · /vol1 btrfs 62.3% 174GB |
| Browser/Host/RPC | ✅ | 0.2.2 / 0.2.2 / v3（红条消失） |
| Header | ✅ | hostname 显示 PC9527-fnOS；Container/Host 分离徽标为 v0.2.3 UI 项 |

## 修复提交
- f888a99 fix: v0.2.2 宿主机采集收口 — 宿主 netns 网络快照、磁盘 st_dev 去重与数据卷
- 说明：/proc/net 为 netns 作用域，经 /host/proc 仍读到容器接口；改为 --net=host
  只读探测容器获取真实宿主 netns（5s 缓存 + 并发合并，失败回退），宿主模式裁剪
  veth/br-/docker0/lo 噪音；磁盘去重改为 statSync st_dev（两种模式均正确），
  宿主模式附加 /vol1 数据卷并以 statfs 真实类型标注。
