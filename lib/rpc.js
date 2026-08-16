/**
 * dsh-side-monitor — Host RPC contract + registration.
 *
 * Registers the /side-monitor loopback channel (the same pattern
 * dsh-notify-bark uses) so the browser drawer reads system data through the
 * Host only. The browser never touches /proc, df, or the Docker socket.
 * @module dsh-side-monitor/rpc
 */

import { createRequire } from 'node:module'

/** Logical RPC channel owned by this plugin. */
export const RPC_CHANNEL = '/side-monitor'

/** Bump on any breaking change to the response/payload contract. */
export const PROTOCOL_VERSION = 3

/** Plugin version from package.json (kept in sync by the release process). */
const require = createRequire(import.meta.url)
export const PLUGIN_VERSION = require('../package.json').version

/** Endpoints on the channel. */
export const ENDPOINTS = Object.freeze({
  overview: 'overview',
  processes: 'processes',
  containers: 'containers',
})

/** Success branch — carries the protocol/plugin version for the client handshake. */
export function ok(value) {
  return { ok: true, protocolVersion: PROTOCOL_VERSION, pluginVersion: PLUGIN_VERSION, value }
}

/** Error branch — also versioned. */
export function err(message) {
  return { ok: false, protocolVersion: PROTOCOL_VERSION, pluginVersion: PLUGIN_VERSION, error: { code: 'internal', message, details: {} } }
}

/**
 * Register the plugin's RPC channel through `ctx.inject` so a profile
 * without the connection service still boots (the drawer then just reports
 * "unavailable"). @param ctx - host plugin context. @param collector - the
 * system collector produced by createSystemCollector.
 */
export function registerSideMonitorRpc(ctx, collector) {
  ctx.inject(['connection'], (sctx) => {
    const handler = async (endpoint, payload) => {
      try {
        switch (endpoint) {
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

    sctx.effect(() => {
      // Read-only metrics: allow the same trusted hosts that already reach
      // the DSH GUI/API (sessions, workspaces, tools) — loopback + configured
      // --trusted-host authorities. No secrets or control operations here.
      const dispose = sctx.connection.rpc.handle(RPC_CHANNEL, handler, { authority: 'trusted-host' })
      return () => { void dispose() }
    }, 'side-monitor: rpc channel')
  })
}
