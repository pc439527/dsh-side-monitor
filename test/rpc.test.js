import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRpcHandler, ok, err, PROTOCOL_VERSION, PLUGIN_VERSION, ENDPOINTS } from '../lib/rpc.js'

const collector = {
  overview: async () => ({ fake: 'overview' }),
  processes: async () => ({ fake: 'processes' }),
  containers: async () => ({ fake: 'containers' }),
  metaInfo: async () => ({
    status: { mode: 'host', systemSource: 'host', processSource: 'host', dockerSource: 'unavailable', hostMetrics: false, networkProbe: 'container-netns', consistency: { ok: true, warnings: [] } },
    capabilities: { hostMount: false, dockerSocket: false, hostNetNsProbe: false, processAggregate: true, containerStats: false },
  }),
}

test('RPC meta exposes version inside the value payload (never top-level)', async () => {
  const handler = createRpcHandler(collector)
  const result = await handler(ENDPOINTS.meta, {})
  assert.equal(result.ok, true)
  assert.equal(result.value.protocolVersion, PROTOCOL_VERSION)
  assert.equal(result.value.pluginVersion, PLUGIN_VERSION)
  // DSH rpcResultSchema strips unknown top-level fields — versions must NOT live there.
  assert.equal('protocolVersion' in result, false)
  assert.equal('pluginVersion' in result, false)
  // runtime identity present
  assert.ok(result.value.runtimeId)
  assert.equal(typeof result.value.startedAt, 'number')
  assert.ok(result.value.nodeVersion)
  assert.ok(result.value.platform && result.value.arch)
  // v0.3: fine-grained status + capabilities travel inside the value payload
  assert.equal(result.value.status.mode, 'host')
  assert.equal(result.value.status.systemSource, 'host')
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

test('ok/err return the standard RpcResult shapes', () => {
  assert.deepEqual(ok({ a: 1 }), { ok: true, value: { a: 1 } })
  assert.deepEqual(Object.keys(ok(1)).sort(), ['ok', 'value'])
  const e = err('boom')
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
