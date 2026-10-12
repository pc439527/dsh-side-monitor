import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

/**
 * Load lib/client.js the way the browser module table does: capture the lazy
 * factory, materialize it (components are referenced, never rendered) and
 * return its exports plus the captured registration id.
 *
 * document.body is a throwing getter: the 0.2 UI contract forbids a plugin
 * from appending a second application to it, so any regression fails loudly
 * here rather than silently in the browser.
 */
function loadBundle() {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let def = null
  const document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, textContent: '' }),
    head: { appendChild() {} },
    get body() { throw new Error('client bundle touched document.body') },
  }
  const window = { __ModuleLoader__: { load: (d) => { def = d } } }
  const React = {
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    createElement: () => null,
  }
  vm.runInNewContext(src, { window, document, console })
  assert.ok(def, 'bundle registered a factory through window.__ModuleLoader__.load')
  const exports = def.factory((spec) => {
    assert.equal(spec, 'react', 'bundle requires only the react seed word')
    return React
  })
  return { id: def.id, exports }
}

test('client bundle registers under the package name and injects the 0.2 services', () => {
  const { id, exports } = loadBundle()
  assert.equal(id, 'dsh-side-monitor')
  // The bundle factory runs in its own VM realm, so copy into a host array.
  assert.deepEqual([...exports.inject], ['slots', 'connection'])
  assert.equal(typeof exports.apply, 'function')
})

test('apply() fills sidebar.footer.action and shell.overlay, never document.body', () => {
  const { exports } = loadBundle()
  const injectedSeats = []
  const registrations = []
  const ctx = {
    slots: {
      inject(seat, callback) {
        injectedSeats.push(seat)
        callback()
        return () => {}
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }

  exports.apply(ctx)

  assert.deepEqual(injectedSeats, ['sidebar.footer.action', 'shell.overlay'])

  const trigger = registrations.find((r) => r.options.name === 'sidebar.footer.action')
  const drawer = registrations.find((r) => r.options.name === 'shell.overlay')
  assert.ok(trigger && drawer)
  assert.equal(trigger.options.id, 'side-monitor')
  assert.equal(drawer.options.id, 'side-monitor')

  // The trigger and the drawer share one open/width store through their faces.
  const triggerFace = trigger.options.inject()
  const drawerFace = drawer.options.inject()
  assert.equal(typeof triggerFace.openStore.get().open, 'boolean')
  assert.equal(drawerFace.ctx, ctx)
  assert.equal(drawerFace.openStore, triggerFace.openStore)

  let notified = 0
  const unsubscribe = drawerFace.openStore.subscribe(() => { notified += 1 })
  drawerFace.openStore.update((s) => ({ open: !s.open, width: s.width }))
  assert.equal(drawerFace.openStore.get().open, true)
  assert.equal(notified, 1)
  unsubscribe()
})
