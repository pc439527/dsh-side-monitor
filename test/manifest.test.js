import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RPC_CHANNEL, PROTOCOL_VERSION } from '../lib/rpc.js'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

test('client manifest targets the DSH 0.2 web client', () => {
  assert.equal(pkg.dsh.client.platform, 'web')
  const inject = pkg.dsh.client.inject
  assert.ok(Array.isArray(inject) && inject.length > 0)
  // @deepseek-ai/dsh-client-runtime stopped at 0.1.1-rc.2; the 0.2 slots
  // service ships in @deepseek-ai/dsh-client-ui-renderer.
  assert.equal(inject.includes('@deepseek-ai/dsh-client-runtime'), false)
  for (const name of [
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-renderer',
    '@deepseek-ai/dsh-client-ui-sidebar',
  ]) {
    assert.ok(inject.includes(name), 'dsh.client.inject must name ' + name)
  }
})

test('peerDependencies target the installed DSH 0.2 line', () => {
  const peers = pkg.peerDependencies
  assert.equal('@deepseek-ai/dsh-client-runtime' in peers, false)
  for (const name of ['@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-ui-renderer']) {
    assert.equal(peers[name], '^0.2.0-rc.2', name)
  }
  assert.equal(peers['@deepseek-ai/cordis'], '~4.0.4')
  assert.equal(peers.react, '^18.2.0')
  assert.equal(peers['react-dom'], '^18.2.0')
})

test('browser half registers slots instead of a second document.body app', () => {
  assert.ok(client.includes('window.__ModuleLoader__.load({'))
  assert.ok(client.includes('ctx.slots.inject("sidebar.footer.action"'))
  assert.ok(client.includes('ctx.slots.inject("shell.overlay"'))
  // No second React application: the 0.2 UI guide forbids appending one to
  // document.body. createRoot/react-dom/client must not appear at all.
  assert.equal(/createRoot\s*\(/.test(client), false)
  assert.equal(client.includes('require("react-dom/client")'), false)
  // The clipboard fallback is the only document.body appendChild left.
  assert.equal(client.split('document.body.appendChild').length - 1, 1)
})

test('generated client version matches package.json', () => {
  const m = client.match(/var CLIENT_VERSION = "([^"]+)";/)
  assert.ok(m, 'CLIENT_VERSION anchor present')
  assert.equal(m[1], pkg.version)
})

test('browser and host halves agree on channel and protocol version', () => {
  const channel = client.match(/var RPC_CHANNEL = "([^"]+)";/)
  assert.ok(channel, 'RPC_CHANNEL anchor present')
  assert.equal(channel[1], RPC_CHANNEL)
  const protocol = client.match(/var PROTOCOL_VERSION = (\d+);/)
  assert.ok(protocol, 'PROTOCOL_VERSION anchor present')
  assert.equal(Number(protocol[1]), PROTOCOL_VERSION)
})

test('no removed 0.1.x theme token is referenced', () => {
  // --dsw-specific-surface-fill was dropped; 0.2 uses --dsw-specific-menu.
  assert.equal(client.includes('--dsw-specific-surface-fill'), false)
})
