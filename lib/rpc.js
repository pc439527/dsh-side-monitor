/**
 * dsh-side-monitor — Host RPC contract + registration.
 *
 * Registers the /side-monitor loopback channel (the same pattern
 * dsh-notify-bark uses) so the browser drawer reads system data through the
 * Host only. The browser never touches /proc, df, or the Docker socket.
 *
 * IMPORTANT (v0.2.3 hotfix): DSH's Connection RPC validates responses with a
 * Zod rpcResultSchema that only keeps { ok: true, value } or { ok: false,
 * error } — any extra top-level field (e.g. protocolVersion) is STRIPPED
 * before it reaches the browser. Version metadata therefore travels inside the
 * `meta` endpoint's value payload, never on the RpcResult top level.
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

// Host runtime identity — stable for the lifetime of this plugin instance.
const HOST_STARTED_AT = Date.now()
const RUNTIME_ID = crypto.randomUUID()

/**
 * Success branch — standard RpcResult shape { ok: true, value }.
 * Version metadata belongs in the meta endpoint's value, not here.
 */
export function ok(value) {
  return { ok: true, value }
}

/**
 * Error branch — standard RpcResult shape { ok: false, error }.
 */
export function err(message) {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

/**
 * Pure RPC handler for the /side-monitor channel. Exported separately from the
 * cordis registration so tests can exercise the wire contract directly.
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
          return err('unknown endpoint: ' + String(endpoint))
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }
}

/**
 * Register the plugin's RPC channel through `ctx.inject` so a profile
 * without the connection service still boots (the drawer then just reports
 * "unavailable"). @param ctx - host plugin context. @param collector - the
 * system collector produced by createSystemCollector.
 */
export function registerSideMonitorRpc(ctx, collector) {
  ctx.inject(['connection'], (sctx) => {
    const handler = createRpcHandler(collector)

    sctx.effect(() => {
      // Read-only metrics: allow the same trusted hosts that already reach
      // the DSH GUI/API (sessions, workspaces, tools) — loopback + configured
      // --trusted-host authorities. No secrets or control operations here.
      const dispose = sctx.connection.rpc.handle(RPC_CHANNEL, handler, { authority: 'trusted-host' })
      return () => { void dispose() }
    }, 'side-monitor: rpc channel')
  })
}
