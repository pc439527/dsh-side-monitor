/**
 * dsh-side-monitor — Host half.
 *
 * Mounts one thing: the read-only system/process/docker collector behind the
 * /side-monitor loopback RPC. The browser half (the ./client entry) registers
 * the sidebar trigger and the right monitor drawer. @module dsh-side-monitor
 */
import { createSystemCollector } from './collectors.js'
import { registerSideMonitorRpc } from './rpc.js'

/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
export const name = 'side-monitor'

/** No hard required services: connection is awaited through ctx.inject inside apply. */
export const inject = []

/**
 * Plugin entry.
 * @param ctx - plugin context.
 * @param config - composition-layer overrides (reserved; e.g. processLimit).
 */
export function apply(ctx, config = {}) {
  const collector = createSystemCollector(config)
  registerSideMonitorRpc(ctx, collector)
}
