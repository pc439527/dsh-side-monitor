#!/usr/bin/env node
/**
 * build-client.mjs — bundle the browser half (src/client/*) into lib/client.js.
 *
 *   node tools/build-client.mjs            # write lib/client.js
 *   node tools/build-client.mjs --check    # exit 1 when lib/client.js is stale
 *
 * The output is a single IIFE script: the DSH browser module table loads it
 * with window.__ModuleLoader__.load, so it must not contain ES imports.
 * Generated parts (CLIENT_VERSION, i18n dictionary) are produced by
 * tools/sync-generated.mjs on the SOURCE file before bundling.
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const ENTRY = new URL('../src/client/index.js', import.meta.url).pathname
const OUT = new URL('../lib/client.js', import.meta.url).pathname
const check = process.argv.includes('--check')

const result = await build({
  entryPoints: [ENTRY],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2019',
  charset: 'utf8',
  legalComments: 'none',
  write: false,
  logLevel: 'silent',
})
const text = result.outputFiles[0].text

if (check) {
  let current = ''
  try { current = readFileSync(OUT, 'utf8') } catch { /* missing */ }
  if (current !== text) {
    console.error('DRIFT: lib/client.js is not the current build of src/client. Run: node tools/build-client.mjs')
    process.exit(1)
  }
  console.log('ok: lib/client.js matches src/client build')
} else {
  writeFileSync(OUT, text)
  console.log('built lib/client.js (' + text.length + ' bytes)')
}
