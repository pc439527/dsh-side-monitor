#!/bin/sh
# PHASE 1 acceptance — run inside the deepseek-harness container (node fetch; no curl dependency)
set -u
probe() { node -e "
const probe = async (ep, payload) => {
  const res = await fetch('http://127.0.0.1:3080/side-monitor/' + ep, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'acc-' + ep, method: ep, payload })
  });
  return res.json();
};
(async () => {
  const r = await probe(process.argv[1], JSON.parse(process.argv[2] || '{}'));
  console.log(JSON.stringify(r.result, null, 1));
})().catch(e => { console.error(e); process.exit(1) });
" "$1" "$2"; }
echo '=== [1] host mounts ==='
ls -ld /host/proc /host/sys /host/root 2>&1
echo '=== [2] fnOS host facts ==='
echo -n 'hostname : '; cat /host/root/etc/hostname 2>/dev/null
echo -n 'os       : '; grep PRETTY_NAME /host/root/etc/os-release 2>/dev/null
echo -n 'loadavg  : '; cat /host/proc/loadavg 2>/dev/null
echo -n 'uptime   : '; cat /host/proc/uptime 2>/dev/null
echo '=== [3] RPC overview (handshake + host data) ==='
probe overview '{}'
echo '=== [4] processes ==='
probe processes '{"limit":3}'
echo '=== [5] docker ==='
probe containers '{}'
echo '=== done ==='
