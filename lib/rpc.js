/**
 * dsh-side-monitor — Host RPC contract + registration.
 *
 * Mounts POST /side-monitor/<endpoint> on the composition's webServer, the
 * same shape every shipped Host plugin that serves browser routes uses
 * (dsh-host-open-in-app): guard with Connection's trust fence + browser
 * authentication, then speak the Connection RPC wire.
 *
 * Why not connection.rpc.handle(): on DSH 0.2 that facade mounts its route
 * through owner.webServer — and cordis 4 refuses that read on the
 * shadow-bound context the facade ends up with (even when the plugin
 * declares webServer, the facade lands in one that has not), so the channel
 * silently never mounts and the drawer reports 'transport failure ... HTTP
 * 405'. Registering the prefix route directly is the working, shipped
 * pattern.
 *
 * Wire (matches the 0.2 browser half, dsh-client-connection):
 *   request  POST <channel>/<endpoint>   application/json
 *            { type: 'client-request', rpcId, method: <endpoint>, payload }
 *   response 200 { type: 'server-response', rpcId, result }
 *            result = { ok: true, value } | { ok: false, error: { code, message, details } }
 *
 * IMPORTANT: the result contract is exactly { ok, value } | { error } on every
 * DSH line (0.1.x and 0.2.x); version metadata travels inside the meta
 * endpoint's value payload, never on the result top level.
 * @module dsh-side-monitor/rpc
 */

import { createRequire } from 'node:module'
import crypto from 'node:crypto'

/** Logical RPC channel owned by this plugin. */
export const RPC_CHANNEL = '/side-monitor'

/** Bump on any breaking change to the response/payload contract. */
export const PROTOCOL_VERSION = 3

/** Plugin version from package.json (kept in sync by the release process). */
const require = createRequire(import.meta.url)
export const PLUGIN_VERSION = require('../package.json').version

/** Endpoints on the channel. */
export const ENDPOINTS = Object.freeze({
  meta: 'meta',
  overview: 'overview',
  processes: 'processes',
  containers: 'containers',
})


// one JSON POST body is bounded; collector payloads are tiny page requests
const MAX_BODY_BYTES = 1024 * 1024

/** endpoint segment characters — rejects traversal and empty segments */
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/

// Host runtime identity — stable for the lifetime of this plugin instance.
const HOST_STARTED_AT = Date.now()
const RUNTIME_ID = crypto.randomUUID()

/** Success branch — standard result shape { ok: true, value }. */
export function ok(value) {
  return { ok: true, value }
}

/** Error branch — standard result shape { ok: false, error }. */
export function err(code, message, details = {}) {
  return { ok: false, error: { code, message, details } }
}

/**
 * Pure RPC handler for the /side-monitor channel. Exported separately from
 * the cordis registration so tests can exercise the wire contract directly.
 *
 * DSH 0.2 invokes ConnectionRpcHandler as (endpoint, payload, signal, peer);
 * this handler reads only the first two, so both call shapes work.
 * @param collector - the system collector produced by createSystemCollector.
 */
export function createRpcHandler(collector) {
  return async (endpoint, payload) => {
    try {
      switch (endpoint) {
        case ENDPOINTS.meta:
          // v0.3: the value payload also carries fine-grained status
          // (per-source state + network probe + consistency) and the Host's
          // capabilities — both additive, so older browsers still work.
          return ok({
            protocolVersion: PROTOCOL_VERSION,
            pluginVersion: PLUGIN_VERSION,
            runtimeId: RUNTIME_ID,
            startedAt: HOST_STARTED_AT,
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            ...(collector.metaInfo ? await collector.metaInfo() : {}),
          })
        case ENDPOINTS.overview:
          return ok(await collector.overview())
        case ENDPOINTS.processes:
          return ok(await collector.processes(payload || {}))
        case ENDPOINTS.containers: {
          const withStats = !!(payload && payload.stats)
          return ok(await collector.containers(withStats))
        }
        default:
          return err('internal', 'unknown endpoint: ' + String(endpoint))
      }
    } catch (error) {
      return err('internal', error instanceof Error ? error.message : String(error))
    }
  }
}

/** Channel-relative endpoint of an absolute path, or undefined outside it. */
export function endpointFromPath(channel, pathname) {
  if (!pathname.startsWith(channel + '/')) return undefined
  const endpoint = pathname.slice(channel.length + 1)
  const segments = endpoint.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..' || !ENDPOINT_SEGMENT_PATTERN.test(segment)) return undefined
  }
  return endpoint
}

/** Read one buffered JSON body; undefined when oversized, null when not JSON. */
async function readJsonBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > MAX_BODY_BYTES) return { oversized: true }
  }
  try {
    return { value: JSON.parse(body) }
  } catch {
    return { value: null }
  }
}

/** Send the server-response envelope for one rpc result. */
function respondResult(res, rpcId, result) {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
}

/** Error result for an unusable request (HTTP still 200, mirroring Connection). */
function respondError(res, rawRpcId, code, message) {
  const rpcId = typeof rawRpcId === 'string' && rawRpcId.length > 0 ? rawRpcId : 'invalid-request'
  respondResult(res, rpcId, err(code, message, { issues: [] }))
}

/**
 * Register the plugin's RPC channel — the shape every shipped Host plugin
 * serving browser routes uses: the plugin declares inject = [webServer,
 * connection] (lib/index.js) and mounts its own prefix route, guarded by
 * Connection's trust fence and browser authentication before anything is
 * reachable. Unloading the plugin disposes the effect, which unregisters
 * the route.
 * @param ctx - host plugin context. @param collector - the system collector
 * produced by createSystemCollector.
 */
export function registerSideMonitorRpc(ctx, collector) {
  const handler = createRpcHandler(collector)
  ctx.effect(() => {
    const registered = ctx.webServer.register({
      kind: 'prefix',
      path: RPC_CHANNEL,
      handler: async (req, res) => {
        const rejection = ctx.connection.requestRejection(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
          return
        }
        const url = new URL(req.url || '/', 'http://dsh.local')
        const endpoint = endpointFromPath(RPC_CHANNEL, url.pathname)
        if (endpoint === undefined || req.method !== 'POST') {
          res.writeHead(404)
          res.end('not found')
          return
        }
        const header = req.headers['content-type'] || ''
        const mediaType = header.split(';')[0].trim().toLowerCase()
        if (mediaType !== 'application/json') {
          res.writeHead(415)
          res.end('content type must be application/json')
          return
        }
        const read = await readJsonBody(req)
        if (read.oversized) {
          res.writeHead(413)
          res.end('request body too large')
          return
        }
        if (read.value === null) {
          res.writeHead(400)
          res.end('body is not JSON')
          return
        }
        const body = read.value
        const isMessage = !!body && typeof body === 'object' && body.type === 'client-request'
          && typeof body.rpcId === 'string' && typeof body.method === 'string'
        if (!isMessage) {
          respondError(res, body && typeof body === 'object' ? body.rpcId : undefined,
            'gateway/bad-request', 'invalid client-request message')
          return
        }
        if (body.method !== endpoint) {
          respondError(res, body.rpcId, 'gateway/bad-request',
            'method ' + JSON.stringify(body.method) + ' does not match endpoint ' + JSON.stringify(endpoint))
          return
        }
        try {
          const result = await handler(endpoint, body.payload)
          respondResult(res, body.rpcId, result)
        } catch (error) {
          res.writeHead(500)
          res.end('handler failure: ' + String(error))
        }
      },
    })
    return () => { void registered() }
  }, 'side-monitor: rpc channel')
}
