# dsh-side-monitor — v0.2.2 Host Mount 重建包（2026-08-18）

本次重建为 deepseek-harness 容器增加 Host Mount Mode 三个只读挂载：

    /proc            -> /host/proc    (ro)
    /sys             -> /host/sys     (ro)
    /                -> /host/root    (ro)

容器其余配置（镜像、Cmd、Env、端口 3080->3081、日志、重启策略、原有挂载）均从
`docker inspect deepseek-harness` 逐项复制，未做任何其他改动。

## 文件

- recreate.sh       由 inspect JSON 程序化生成的完整重建脚本（含日志输出）
- inspect-before.json  重建前容器完整配置备份（可据此手动恢复）
- verify.sh         重建后在容器内运行的验收脚本（挂载 + RPC + 宿主数据）
- recreate.log      重建过程日志（helper 容器写入）

## 手动恢复（万一需要）

    docker rm -f deepseek-harness
    sh /opt/dsh-side-monitor/deploy/recreate-20260818/recreate.sh

（宿主机视角路径为 /opt/dsh-side-monitor/...，容器内为 /data/opt/dsh-side-monitor/...）

## 验收标准（PHASE 1）

- RPC: protocolVersion=3, pluginVersion=0.2.2
- environment.mode=host, hostname=fnOS 真实主机名
- systemSource/processSource=host, dockerSource=host
- CPU/内存/网络/磁盘/进程均为宿主数据

## 触发机制（2026-08-18 更新）

helper 容器（dsh-recreate-helper）改为等待 GO 标志文件：

    touch /data/opt/dsh-side-monitor/deploy/recreate-20260818/GO          # 触发重建（5 秒后执行 rm + run）
    rm -f /data/opt/dsh-side-monitor/deploy/recreate-20260818/GO          # 取消重建（helper 最多等 10 分钟）

重建全程日志：/data/opt/dsh-side-monitor/deploy/recreate-20260818/recreate.log
重建后验收：sh /data/opt/dsh-side-monitor/deploy/recreate-20260818/verify.sh
