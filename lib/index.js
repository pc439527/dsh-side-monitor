/**
 * dsh-side-monitor — Host half.
 *
 * Mounts one thing: the read-only system/process/docker collector behind the
 * /side-monitor RPC channel (registered through DSH Connection, so only
 * authenticated requests reach it). The browser half (the ./client entry)
 * registers the sidebar trigger (sidebar.footer.action) and the monitor drawer
 * (shell.overlay). @module dsh-side-monitor
 */
import { createSystemCollector } from './collectors.js'
import { registerSideMonitorRpc } from './rpc.js'

/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
export const name = 'side-monitor'

/**
 * Required services, mirroring the shipped Host plugins that mount Web routes
 * (dsh-host-open-in-app): the connection service owns the RPC channel and the
 * web carrier mounts it. DSH web profiles provide both through dsh-web-app.
 */
export const inject = ['connection', 'webServer']

/**
 * Plugin entry.
 * @param ctx - plugin context.
 * @param config - composition-layer overrides (reserved; e.g. processLimit).
 */
export function apply(ctx, config = {}) {
  const collector = createSystemCollector(config)
  registerSideMonitorRpc(ctx, collector)
}
