import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createRpcHandler,
  registerSideMonitorRpc,
  endpointFromPath,
  ok,
  err,
  PROTOCOL_VERSION,
  PLUGIN_VERSION,
  ENDPOINTS,
  RPC_CHANNEL,
} from '../lib/rpc.js'

const collector = {
  overview: async () => ({ fake: 'overview' }),
  processes: async () => ({ fake: 'processes' }),
  containers: async () => ({ fake: 'containers' }),
  metaInfo: async () => ({
    status: { mode: 'host', systemSource: 'host', processSource: 'host', dockerSource: 'unavailable', hostMetrics: false, networkProbe: 'container-netns', consistency: { ok: true, warnings: [] } },
    capabilities: { hostMount: false, dockerSocket: false, hostNetNsProbe: false, processAggregate: true, containerStats: false },
  }),
}

const TEST_META = {
  status: { mode: 'host', systemSource: 'host', processSource: 'host', dockerSource: 'unavailable', hostMetrics: false, networkProbe: 'container-netns', consistency: { ok: true, warnings: [] } },
  capabilities: { hostMount: false, dockerSocket: false, hostNetNsProbe: false, processAggregate: true, containerStats: false },
}

/** Minimal async-iterable node request double for the wire tests. */
function fakeReq({ method = 'POST', url = '/side-monitor/meta', contentType = 'application/json', body = null }) {
  const chunks = body === null ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]
  return {
    method,
    url,
    headers: contentType === null ? {} : { 'content-type': contentType },
    async *[Symbol.asyncIterator]() { for (const c of chunks) yield c }
  }
}

function fakeRes() {
  const res = { status: 0, headers: {}, body: null,
    writeHead(code, headers) { res.status = code; res.headers = headers || {} },
    setHeader() {}
  }
  res.end = (b) => { res.body = b === undefined ? null : b }
  return res
}

/** Drive one registered route handler with the doubles; returns the res capture. */
async function serve(handler, req) {
  const res = fakeRes()
  await handler(req, res)
  return res
}

/** Fake plugin ctx recording the registered route and running effects eagerly. */
function fakeCtx() {
  const registered = [];
  return {
    registered,
    connection: { requestRejection: () => undefined },
    webServer: { register: (route) => { registered.push(route); return async () => {} } },
    effect: (fn) => { fn(); return () => {} }
  }
}

test('RPC meta exposes version inside the value payload (never top-level)', async () => {
  const handler = createRpcHandler(collector)
  const result = await handler(ENDPOINTS.meta, {})
  assert.equal(result.ok, true)
  assert.equal(result.value.protocolVersion, PROTOCOL_VERSION)
  assert.equal(result.value.pluginVersion, PLUGIN_VERSION)
  // The result envelope is exactly { ok, value } — versions must NOT live at the top.
  assert.equal('protocolVersion' in result, false)
  assert.equal('pluginVersion' in result, false)
  assert.ok(result.value.runtimeId)
  assert.equal(typeof result.value.startedAt, 'number')
  assert.ok(result.value.nodeVersion)
  assert.ok(result.value.platform && result.value.arch)
  // v0.3: fine-grained status + capabilities travel inside the value payload
  assert.equal(result.value.status.mode, TEST_META.status.mode)
  assert.equal(result.value.status.systemSource, TEST_META.status.systemSource)
  assert.equal(result.value.capabilities.processAggregate, true)
  assert.equal(result.value.capabilities.dockerSocket, false)
})

test('RPC meta works without collector.metaInfo (backward compatible)', async () => {
  const plain = { overview: async () => ({}), processes: async () => ({}), containers: async () => ({}) }
  const handler = createRpcHandler(plain)
  const result = await handler(ENDPOINTS.meta, {})
  assert.equal(result.ok, true)
  assert.equal(result.value.protocolVersion, PROTOCOL_VERSION)
  assert.equal('status' in result.value, false)
  assert.equal('capabilities' in result.value, false)
})

test('ok/err return the standard result shapes', () => {
  assert.deepEqual(ok({ a: 1 }), { ok: true, value: { a: 1 } })
  assert.deepEqual(Object.keys(ok(1)).sort(), ['ok', 'value'])
  const e = err('internal', 'boom')
  assert.equal(e.ok, false)
  assert.equal(e.error.code, 'internal')
  assert.equal(e.error.message, 'boom')
  assert.deepEqual(Object.keys(e).sort(), ['error', 'ok'])
  assert.equal('protocolVersion' in e, false)
  assert.equal('pluginVersion' in e, false)
})

test('unknown endpoint returns an error result (standard shape)', async () => {
  const handler = createRpcHandler(collector)
  const r = await handler('nope', {})
  assert.equal(r.ok, false)
  assert.ok(r.error.message.includes('unknown endpoint'))
})

test('endpoints route through the collector', async () => {
  const handler = createRpcHandler(collector)
  assert.deepEqual(await handler(ENDPOINTS.overview, {}), { ok: true, value: { fake: 'overview' } })
  assert.deepEqual(await handler(ENDPOINTS.processes, {}), { ok: true, value: { fake: 'processes' } })
  assert.deepEqual(await handler(ENDPOINTS.containers, {}), { ok: true, value: { fake: 'containers' } })
})

test('handler tolerates the DSH 0.2 (endpoint, payload, signal, peer) call', async () => {
  const handler = createRpcHandler(collector)
  const signal = new AbortController().signal
  assert.deepEqual(await handler(ENDPOINTS.overview, {}, signal, {}), { ok: true, value: { fake: 'overview' } })
})

test('endpoint paths resolve strictly inside the channel', () => {
  assert.equal(endpointFromPath(RPC_CHANNEL, '/side-monitor/meta'), 'meta')
  assert.equal(endpointFromPath(RPC_CHANNEL, '/side-monitor/overview'), 'overview')
  assert.equal(endpointFromPath(RPC_CHANNEL, '/side-monitor'), undefined)
  assert.equal(endpointFromPath(RPC_CHANNEL, '/side-monitor/'), undefined)
  assert.equal(endpointFromPath(RPC_CHANNEL, '/side-monitor/../etc/passwd'), undefined)
  assert.equal(endpointFromPath('/api', '/side-monitor/meta'), undefined)
})

test('host registration mounts the channel route through webServer (open-in-app pattern)', () => {
  const ctx = fakeCtx()
  registerSideMonitorRpc(ctx, collector)
  assert.equal(ctx.registered.length, 1)
  const route = ctx.registered[0]
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, RPC_CHANNEL)
  assert.equal(typeof route.handler, 'function')
})

test('route honors the DSH 0.2 client wire', async () => {
  const ctx = fakeCtx()
  registerSideMonitorRpc(ctx, collector)
  const route = ctx.registered[0]

  const res = await serve(route.handler, fakeReq({
    body: { type: 'client-request', rpcId: 't1', method: 'meta', payload: {} },
  }))
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'application/json')
  const envelope = JSON.parse(res.body)
  assert.equal(envelope.type, 'server-response')
  assert.equal(envelope.rpcId, 't1')
  assert.equal(envelope.result.ok, true)
  assert.equal(envelope.result.value.protocolVersion, PROTOCOL_VERSION)

  // rpcId echoes the caller's id; known endpoints answer on the same envelope.
  const res2 = await serve(route.handler, fakeReq({
    url: '/side-monitor/containers',
    body: { type: 'client-request', rpcId: 't2', method: 'containers', payload: { stats: false } },
  }))
  const env2 = JSON.parse(res2.body)
  assert.equal(env2.rpcId, 't2')
  assert.deepEqual(env2.result.value, { fake: 'containers' })
})

test('route defends the wire: method, media type, envelope, trust fence', async () => {
  const ctx = fakeCtx()
  registerSideMonitorRpc(ctx, collector)
  const route = ctx.registered[0]

  // GET is not the wire.
  const resGet = await serve(route.handler, fakeReq({ method: 'GET', body: null }))
  assert.equal(resGet.status, 404)

  // Non-JSON media type.
  const resMedia = await serve(route.handler, fakeReq({ contentType: 'text/plain', body: '{}' }))
  assert.equal(resMedia.status, 415)

  // Malformed envelope -> 200 with an error result (Connection mirrors this).
  const resBad = await serve(route.handler, fakeReq({ body: { nope: 1 } }))
  assert.equal(resBad.status, 200)
  const envBad = JSON.parse(resBad.body)
  assert.equal(envBad.result.ok, false)
  assert.equal(envBad.result.error.code, 'gateway/bad-request')

  // Method/endpoint mismatch.
  const resSwap = await serve(route.handler, fakeReq({
    url: '/side-monitor/meta',
    body: { type: 'client-request', rpcId: 'x', method: 'overview', payload: null },
  }))
  const envSwap = JSON.parse(resSwap.body)
  assert.equal(envSwap.result.ok, false)
  assert.ok(envSwap.result.error.message.includes('does not match endpoint'))

  // Trust fence: rejected before anything is reachable.
  const guarded = fakeCtx()
  guarded.connection = { requestRejection: () => 403 }
  assert.equal(guarded.registered.length, 0)
  registerSideMonitorRpc(guarded, collector)
  const resGuard = await serve(guarded.registered[0].handler, fakeReq({ body: { type: 'client-request', rpcId: 'y', method: 'meta', payload: {} } }))
  assert.equal(resGuard.status, 403)
})