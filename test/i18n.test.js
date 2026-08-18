import { test } from 'node:test'
import assert from 'node:assert/strict'
import { messages, t, resolveLanguage, validateTables, LANGUAGES, LANGUAGE_KEY } from '../lib/i18n.js'

test('i18n: zh-CN and en-US carry identical key sets', () => {
  const r = validateTables()
  assert.equal(r.ok, true, 'key parity: ' + JSON.stringify(r))
})

test('i18n: every value is a non-empty string', () => {
  for (const lang of LANGUAGES) {
    for (const [k, v] of Object.entries(messages[lang])) {
      assert.equal(typeof v, 'string', lang + '/' + k)
      assert.ok(v.length > 0, lang + '/' + k + ' is empty')
    }
  }
})

test('i18n: t() fills placeholders and falls back to zh-CN', () => {
  assert.equal(t('zh-CN', 'secondsAgo', { sec: 30 }), '30 秒前')
  assert.equal(t('en-US', 'secondsAgo', { sec: 30 }), '30 seconds ago')
  assert.equal(t('en-US', 'uptimeFull', { d: 2, hh: 3, mm: 5 }), '2d 3h 5m')
  // unknown lang falls back to zh-CN; unknown key returns the key
  assert.equal(t('xx-XX', 'monitorTitle'), '系统监控')
  assert.equal(t('zh-CN', 'no-such-key'), 'no-such-key')
})

test('i18n: default language is zh-CN regardless of storage', () => {
  assert.equal(resolveLanguage(null), 'zh-CN')
  assert.equal(resolveLanguage({ getItem: () => 'en-US' }), 'en-US')
  assert.equal(resolveLanguage({ getItem: () => 'bogus' }), 'zh-CN')
  assert.equal(LANGUAGE_KEY, 'dsh-side-monitor:language')
})
