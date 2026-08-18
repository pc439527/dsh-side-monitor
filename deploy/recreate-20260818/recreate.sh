#!/bin/bash
# Auto-generated from `docker inspect deepseek-harness` — do not hand-edit.
# Generated: 2026-08-18T01:54:39.967Z
# Adds the Host Mount Mode binds (all :ro) for dsh-side-monitor v0.2.2.
set -u
LOG=/data/opt/dsh-side-monitor/deploy/recreate-20260818/recreate.log
exec >> "$LOG" 2>&1
echo "=== recreate start $(date -Is) ==="
docker inspect deepseek-harness > /data/opt/dsh-side-monitor/deploy/recreate-20260818/inspect-before.json 2>/dev/null || true
echo "--- removing old container ---"
docker rm -f deepseek-harness || true
echo "--- starting new container ---"
docker run -d \
  --name deepseek-harness \
  --restart unless-stopped \
  --log-opt max-size=100m --log-opt max-file=5 \
  --shm-size 67108864 \
  -p 3080:3081 \
  -e 'HOME=/data' \
  -e 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' \
  -e 'NODE_VERSION=22.23.2' \
  -e 'YARN_VERSION=1.22.22' \
  -w '/workspace' \
  --entrypoint 'docker-entrypoint.sh' \
  -v '/usr/bin/docker:/usr/local/bin/docker:ro' \
  -v '/usr/libexec/docker/cli-plugins:/usr/local/libexec/docker/cli-plugins:ro' \
  -v '/var/run/docker.sock:/var/run/docker.sock' \
  -v '/vol1/1000/deepseekharness/home:/data' \
  -v '/vol1/1000/deepseekharness/workspace:/workspace' \
  -v '/opt:/data/opt' \
  -v '/proc:/host/proc:ro' \
  -v '/sys:/host/sys:ro' \
  -v '/:/host/root:ro' \
  'deepseek-harness:0.1.0-rc.6-tailscale-persist' \
  'sh' \
  '-lc' \
  'socat TCP-LISTEN:3081,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:3080 & exec dsh web --host 127.0.0.1 --port 3080 --trusted-host 192.168.5.22:3080 --trusted-host 100.76.118.33:3080 --trusted-host pc9527-fnos.taild585a9.ts.net:8443'
rc=$?
echo "--- docker run rc=$rc ---"
sleep 6
docker ps -a --filter name=deepseek-harness --format '{{.ID}}  {{.Status}}  {{.Ports}}'
echo "--- waiting for boot ---"
for i in $(seq 1 30); do
  st=$(docker inspect -f '{{.State.Status}}' deepseek-harness 2>/dev/null || echo gone)
  echo "[$i] status=$st"
  [ "$st" = "running" ] && break
  sleep 2
done
echo "--- boot log tail ---"
docker logs --tail 25 deepseek-harness 2>&1 || true
echo "=== recreate end $(date -Is) ==="
