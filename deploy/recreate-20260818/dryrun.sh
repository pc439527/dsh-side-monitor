#!/bin/bash
set -e
docker create \
  --name dsh-recreate-dryrun \
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
