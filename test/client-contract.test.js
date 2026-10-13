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

test('apply() fills main and sidebar.panellist, never document.body', () => {
  const { exports } = loadBundle()
  const injectedSeats = []
  const registrations = []
  const ctx = {
    connection: { rpc: {} },
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

  assert.deepEqual(injectedSeats, ['main', 'sidebar.panellist'])

  const page = registrations.find((r) => r.options.name === 'main')
  const row = registrations.find((r) => r.options.name === 'sidebar.panellist')
  assert.ok(page && row)
  // The nav row's id must equal the keyed page's key so selectPanel(id)
  // activates exactly that main-panel page (the context-insight pairing).
  assert.equal(page.options.key, 'dsh-side-monitor')
  assert.equal(row.options.id, 'dsh-side-monitor')
  // The row label is a thunk: live text follows the panel language.
  assert.equal(typeof row.options.label, 'function')
  assert.equal(typeof row.options.label(), 'string')
})

test('the main page renders the drawer body component, not a string tag', () => {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // A string first argument makes React render an unknown <MonitorDrawerBody>
  // element: the page would be blank. The component reference must be used.
  assert.ok(src.includes('h(MonitorDrawerBody, { page: true'))
  assert.equal(src.includes('h("MonitorDrawerBody"'), false)
})

test('the page root is a flow layout, not the old fixed drawer', () => {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.ok(src.includes('return h("div", { className: "dsm-page" },'))
  assert.equal(src.includes('dsm-root'), false)
  assert.equal(src.includes('openStore'), false)
  assert.equal(/\.dsm-root\{[^}]*position:(absolute|fixed)/.test(src), false)
  assert.equal(src.includes('.dsm-root-mobile'), false)
})
