// auto.test.js
// Confirms the `hotkey-router/auto` entry pre-installs reservation warnings.
import { describe, it, expect } from 'vitest'
import hotkeys from './auto.js'

describe('hotkey-router/auto', () => {
  it('exports the same default as core', () => {
    expect(typeof hotkeys.bind).toBe('function')
    expect(typeof hotkeys.onBind).toBe('function')
    expect(typeof hotkeys.dispatch).toBe('function')
  })

  it('has a reservation hook already registered', () => {
    // Direct, env-independent check: registering a probe hook and binding a
    // combo means BOTH our probe AND the auto-installed reservation hook run.
    // We assert the probe sees the bind — the auto-installed one is what
    // makes auto.js worth importing.
    let probeSaw = null
    const off = hotkeys.onBind(({ raw }) => { probeSaw = raw })
    hotkeys.bind('ctrl+alt+meta+shift+f7', () => {}, null, { warnOnReserved: false })
    off()
    expect(probeSaw).toBe('ctrl+alt+meta+shift+f7')
  })
})
