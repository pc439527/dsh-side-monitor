#!/bin/sh
# Restart deepseek-harness so the running Host loads the fixed collectors.js.
GO=/data/opt/dsh-side-monitor/deploy/recreate-20260818/GO2
rm -f "$GO"
i=0
while [ $i -lt 60 ]; do
  [ -f "$GO" ] && break
  sleep 5
  i=$((i+1))
done
sleep 5
echo "=== restart at $(date -Is) ==="
docker restart deepseek-harness
sleep 20
docker ps --filter name=deepseek-harness --format '{{.ID}}  {{.Status}}  {{.Ports}}'
echo '--- boot log tail ---'
docker logs --tail 8 deepseek-harness 2>&1 | grep -vE 'usage-stats|modlens' || true
echo '=== restart done ==='
