import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import hotkeys, { comboFromEvent, detectPlatform, parseHotkey } from 'hotkey-router'
import auto from 'hotkey-router/auto'
import { createRouter } from 'hotkey-router/core'
import { installDevWarnings } from 'hotkey-router/dev'
import { formatCombo } from 'hotkey-router/format'
import { HOTKEY_DATA, lookupReservation } from 'hotkey-router/reservations'
import { siteAware } from 'hotkey-router/sites'
import { trigger } from 'hotkey-router/testing'
import { validateCombo } from 'hotkey-router/validate'

const [version, runtime] = process.argv.slice(2)
assert.equal(process.version, runtime)
const manifest = JSON.parse(readFileSync(new URL('./node_modules/hotkey-router/package.json', import.meta.url)))
assert.equal(manifest.version, version)

const require = createRequire(import.meta.url)
const commonjs = require('hotkey-router')
assert.deepEqual(commonjs.parseHotkey('ctrl+k'), parseHotkey('ctrl+k'))
assert.equal(auto, hotkeys)
assert.equal(comboFromEvent({ key: 'k', code: 'KeyK', ctrlKey: true }), 'ctrl+code:KeyK')
assert.equal(detectPlatform({ platform: 'Win32', userAgent: '' }), 'windows')
assert.equal(typeof formatCombo, 'function')
assert.equal(typeof siteAware, 'function')

const router = createRouter()
for (const name of ['trigger', 'comboFromEvent', 'detectPlatform', 'parseHotkey']) {
  assert.equal(name in router, false)
}
let fired = 0
router.bind('ctrl+code:KeyK', () => { fired++ })
assert.equal(trigger(router, 'ctrl+k'), true)
assert.equal(fired, 1)

const warnings = []
const off = installDevWarnings(router, {
  platform: 'windows', browser: 'chrome',
  console: { warn: (message) => warnings.push(message), info: (message) => warnings.push(message) },
})
router.bind('ctrl+t', () => {})
router.bind('shift+1', () => {})
off()
assert.equal(warnings.length, 2)
assert.match(warnings[0], /New tab/)
assert.match(warnings[1], /shift\+code:Digit1/)
assert.ok(validateCombo('shift+1').reasons.some(({ code }) => code === 'shifted-punctuation'))

const raw = require('hotkey-router/data/browser-hotkeys.json')
assert.equal(HOTKEY_DATA.version.schema, raw.version.schema)
assert.equal('sources' in HOTKEY_DATA.version, false)
assert.ok(raw.version.sources.length > 0)
assert.equal(lookupReservation(parseHotkey('ctrl+shift+i').combo, { platform: 'linux', browser: 'chrome' })?.severity, 'hard')
console.log(`Packed runtime exports passed on ${process.version}`)
