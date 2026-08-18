#!/bin/sh
# dsh-side-monitor container recreate helper — waits for GO flag, then recreates.
GO=/data/opt/dsh-side-monitor/deploy/recreate-20260818/GO
rm -f "$GO"
i=0
while [ $i -lt 120 ]; do
  [ -f "$GO" ] && break
  sleep 5
  i=$((i+1))
done
sleep 5
sh /data/opt/dsh-side-monitor/deploy/recreate-20260818/recreate.sh
