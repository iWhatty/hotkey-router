// hotkey-router.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import hotkeys from './hotkey-router'

describe('hotkey-router', () => {
  let log

  const dispatch = (type, key, opts = {}) => {
    // Dispatch on window because hotkey-router binds to `window` by default.
    const event = new KeyboardEvent(type, { key, ...opts, bubbles: true })
    window.dispatchEvent(event)
  }

  beforeEach(() => {
    log = vi.fn()

    // Ensure a clean slate and listeners are attached for every test.
    // (hotkeys.destroy() removes listeners + clears state)
    hotkeys.destroy()
    hotkeys.init({ target: window, capture: false })

    hotkeys.resume()
    hotkeys.ignoreInput(true)
  })

  afterEach(() => {
    hotkeys.destroy()
  })

  it('binds a keydown hotkey', () => {
    hotkeys.bind('ctrl+k', log)
    dispatch('keydown', 'k', { ctrlKey: true })
    expect(log).toHaveBeenCalledOnce()
  })

  it('binds a keyup hotkey with " up" suffix', () => {
    hotkeys.bind('ctrl+k up', log)
    dispatch('keyup', 'k', { ctrlKey: true })
    expect(log).toHaveBeenCalledOnce()
  })

  it('ignores wrong modifiers', () => {
    hotkeys.bind('ctrl+k', log)
    dispatch('keydown', 'k') // missing ctrl
    expect(log).not.toHaveBeenCalled()
  })

  it('registerPlugin binds multiple hotkeys and returned unregister cleans them up', () => {
    const unregister = hotkeys.registerPlugin('demo', {
      'alt+1': log,
      'alt+2 up': log,
    })

    dispatch('keydown', '1', { altKey: true })
    dispatch('keyup', '2', { altKey: true })
    expect(log).toHaveBeenCalledTimes(2)

    unregister()
    dispatch('keydown', '1', { altKey: true })
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('unregisterPlugin(name) removes plugin bindings without touching others', () => {
    hotkeys.registerPlugin('demo', { 'alt+x': log })
    hotkeys.bind('alt+x', () => { }) // non-plugin binding on same hotkey

    hotkeys.unregisterPlugin('demo')
    dispatch('keydown', 'x', { altKey: true })

    // Should have fired the non-plugin binding, not the plugin log
    expect(log).not.toHaveBeenCalled()
  })

  it('can pause and resume', () => {
    hotkeys.bind('ctrl+x', log)
    hotkeys.pause()

    dispatch('keydown', 'x', { ctrlKey: true })
    expect(log).not.toHaveBeenCalled()

    hotkeys.resume()
    dispatch('keydown', 'x', { ctrlKey: true })
    expect(log).toHaveBeenCalledOnce()
  })

  it('blocks events inside inputs by default', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    hotkeys.bind('ctrl+a', log)
    input.focus()

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })
    )

    expect(log).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('ignoreInput(false) allows events inside inputs', () => {
    const input = document.createElement('textarea')
    document.body.appendChild(input)

    hotkeys.ignoreInput(false)
    hotkeys.bind('ctrl+a', log)
    input.focus()

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })
    )

    expect(log).toHaveBeenCalledOnce()
    document.body.removeChild(input)
  })

  it('allowIn() overrides input blocking per-binding', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    hotkeys.bind('ctrl+k', log, null, {
      allowIn: () => true,
    })

    input.focus()
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    )

    expect(log).toHaveBeenCalledOnce()
    document.body.removeChild(input)
  })

  it('when() gates a binding', () => {
    let enabled = false

    hotkeys.bind('ctrl+d', log, null, {
      when: () => enabled,
    })

    dispatch('keydown', 'd', { ctrlKey: true })
    expect(log).not.toHaveBeenCalled()

    enabled = true
    dispatch('keydown', 'd', { ctrlKey: true })
    expect(log).toHaveBeenCalledOnce()
  })

  it('once removes the binding after first run', () => {
    hotkeys.bind('ctrl+s', log, null, { once: true })

    dispatch('keydown', 's', { ctrlKey: true })
    dispatch('keydown', 's', { ctrlKey: true })

    expect(log).toHaveBeenCalledTimes(1)
  })

  it('priority chooses the highest priority handler', () => {
    const low = vi.fn()
    const high = vi.fn()

    hotkeys.bind('escape', low, null, { priority: 0 })
    hotkeys.bind('escape', high, null, { priority: 100 })

    dispatch('keydown', 'Escape')
    expect(high).toHaveBeenCalledOnce()
    expect(low).not.toHaveBeenCalled()
  })

  it('ties in priority go to newest binding', () => {
    const first = vi.fn()
    const second = vi.fn()

    hotkeys.bind('escape', first, null, { priority: 10 })
    hotkeys.bind('escape', second, null, { priority: 10 })

    dispatch('keydown', 'Escape')
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('keydown ignores auto-repeat by default', () => {
    hotkeys.bind('j', log)

    dispatch('keydown', 'j', { repeat: true })
    expect(log).not.toHaveBeenCalled()

    dispatch('keydown', 'j', { repeat: false })
    expect(log).toHaveBeenCalledOnce()
  })

  it('repeat: true allows repeated keydown events', () => {
    hotkeys.bind('j', log, null, { repeat: true })

    dispatch('keydown', 'j', { repeat: true })
    dispatch('keydown', 'j', { repeat: true })
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('supports AHK-style modifiers: ^k == ctrl+k', () => {
    hotkeys.bind('^k', log)
    dispatch('keydown', 'k', { ctrlKey: true })
    expect(log).toHaveBeenCalledOnce()
  })

  it('supports AHK-style modifiers: ^!k == ctrl+alt+k', () => {
    hotkeys.bind('^!k', log)
    dispatch('keydown', 'k', { ctrlKey: true, altKey: true })
    expect(log).toHaveBeenCalledOnce()
  })

  it('enforces modifier-first ordering (k+ctrl throws)', () => {
    expect(() => hotkeys.bind('k+ctrl', log)).toThrow()
  })

  it('trigger() runs the handler and returns true', () => {
    hotkeys.bind('ctrl+k', log)
    const ran = hotkeys.trigger('ctrl+k')
    expect(ran).toBe(true)
    expect(log).toHaveBeenCalledOnce()
  })

  it('trigger() returns false when no binding matches', () => {
    const ran = hotkeys.trigger('ctrl+q')
    expect(ran).toBe(false)
  })

  // =========================================================================
  // Bare-modifier bindings — hold-Alt-as-mode UX patterns
  // =========================================================================
  describe('bare-modifier bindings', () => {
    it('binds bare alt keydown', () => {
      hotkeys.bind('alt', log)
      dispatch('keydown', 'Alt', { altKey: true })
      expect(log).toHaveBeenCalledOnce()
    })

    it('binds bare alt keyup with " up" suffix', () => {
      hotkeys.bind('alt up', log)
      // On Alt keyup, altKey is false (Alt has just been released).
      dispatch('keyup', 'Alt', { altKey: false })
      expect(log).toHaveBeenCalledOnce()
    })

    it('keydown and keyup are separate bindings', () => {
      const downLog = vi.fn()
      const upLog = vi.fn()
      hotkeys.bind('alt', downLog)
      hotkeys.bind('alt up', upLog)

      dispatch('keydown', 'Alt', { altKey: true })
      expect(downLog).toHaveBeenCalledOnce()
      expect(upLog).not.toHaveBeenCalled()

      dispatch('keyup', 'Alt', { altKey: false })
      expect(downLog).toHaveBeenCalledOnce()
      expect(upLog).toHaveBeenCalledOnce()
    })

    it('does not collide with chord bindings on the same modifier', () => {
      const bareLog = vi.fn()
      const chordLog = vi.fn()
      hotkeys.bind('alt', bareLog)
      hotkeys.bind('alt+x', chordLog)

      // Bare-Alt press (no other key)
      dispatch('keydown', 'Alt', { altKey: true })
      expect(bareLog).toHaveBeenCalledOnce()
      expect(chordLog).not.toHaveBeenCalled()

      // Now press X with Alt held
      dispatch('keydown', 'x', { altKey: true })
      expect(chordLog).toHaveBeenCalledOnce()
      expect(bareLog).toHaveBeenCalledOnce() // still 1, not re-fired
    })

    it('respects the default repeat: false (held Alt fires only once)', () => {
      hotkeys.bind('alt', log)

      dispatch('keydown', 'Alt', { altKey: true, repeat: false })
      dispatch('keydown', 'Alt', { altKey: true, repeat: true })
      dispatch('keydown', 'Alt', { altKey: true, repeat: true })
      expect(log).toHaveBeenCalledOnce()
    })

    it('supports bare ctrl, shift, meta as well', () => {
      const ctrlLog = vi.fn()
      const shiftLog = vi.fn()
      const metaLog = vi.fn()
      hotkeys.bind('ctrl', ctrlLog)
      hotkeys.bind('shift', shiftLog)
      hotkeys.bind('meta', metaLog)

      dispatch('keydown', 'Control', { ctrlKey: true })
      dispatch('keydown', 'Shift', { shiftKey: true })
      dispatch('keydown', 'Meta', { metaKey: true })

      expect(ctrlLog).toHaveBeenCalledOnce()
      expect(shiftLog).toHaveBeenCalledOnce()
      expect(metaLog).toHaveBeenCalledOnce()
    })

    it('rejects multi-modifier bare bindings with a clear error', () => {
      expect(() => hotkeys.bind('ctrl+alt', log)).toThrow(/multi-modifier bare/i)
    })

    it('unbind removes a bare-modifier binding', () => {
      hotkeys.bind('alt', log)
      hotkeys.unbind('alt')

      dispatch('keydown', 'Alt', { altKey: true })
      expect(log).not.toHaveBeenCalled()
    })

    it('trigger() works on bare-modifier bindings', () => {
      hotkeys.bind('alt', log)
      const ran = hotkeys.trigger('alt')
      expect(ran).toBe(true)
      expect(log).toHaveBeenCalledOnce()
    })
  })

  // =========================================================================
  // code:-based matching — cross-platform Alt+letter (macOS Option remap)
  // =========================================================================
  describe('code:-based matching', () => {
    it('matches alt+code:KeyX even when e.key has been remapped (macOS Option+X)', () => {
      hotkeys.bind('alt+code:KeyX', log)

      // Simulate macOS Option+X: e.key === '≈', e.code === 'KeyX'
      dispatch('keydown', '≈', { altKey: true, code: 'KeyX' })
      expect(log).toHaveBeenCalledOnce()
    })

    it('matches when both code and key would resolve (regular Linux/Windows alt+x)', () => {
      hotkeys.bind('alt+code:KeyX', log)

      // On Win/Linux, Alt+X gives e.key === 'x' AND e.code === 'KeyX'
      dispatch('keydown', 'x', { altKey: true, code: 'KeyX' })
      expect(log).toHaveBeenCalledOnce()
    })

    it('does not fire on a different physical key with the same modifiers', () => {
      hotkeys.bind('alt+code:KeyX', log)

      dispatch('keydown', 'z', { altKey: true, code: 'KeyZ' })
      expect(log).not.toHaveBeenCalled()
    })

    it('does not fire without the required modifier', () => {
      hotkeys.bind('alt+code:KeyX', log)

      dispatch('keydown', 'x', { altKey: false, code: 'KeyX' })
      expect(log).not.toHaveBeenCalled()
    })

    it('preserves camelCase in code values (KeyX vs keyx)', () => {
      hotkeys.bind('alt+code:KeyX', log)

      // The bundle should compare case-sensitively. e.code is always camelCase.
      dispatch('keydown', '≈', { altKey: true, code: 'KeyX' })
      dispatch('keydown', '≈', { altKey: true, code: 'keyx' }) // wrong case
      expect(log).toHaveBeenCalledOnce()
    })

    it('keyup form works: code:KeyX up', () => {
      hotkeys.bind('alt+code:KeyX up', log)

      dispatch('keyup', '≈', { altKey: true, code: 'KeyX' })
      expect(log).toHaveBeenCalledOnce()
    })

    it('key-based and code-based bindings can coexist; code-based wins by recency', () => {
      const keyBased = vi.fn()
      const codeBased = vi.fn()
      hotkeys.bind('alt+x', keyBased)
      hotkeys.bind('alt+code:KeyX', codeBased) // bound second

      // On Linux/Win where both would technically match (e.key='x' AND e.code='KeyX'),
      // the more-recently-bound one wins (priority tie -> recency).
      dispatch('keydown', 'x', { altKey: true, code: 'KeyX' })
      expect(codeBased).toHaveBeenCalledOnce()
      expect(keyBased).not.toHaveBeenCalled()
    })

    it('priority overrides recency between key-based and code-based bindings', () => {
      const keyBased = vi.fn()
      const codeBased = vi.fn()
      hotkeys.bind('alt+x', keyBased, null, { priority: 100 })
      hotkeys.bind('alt+code:KeyX', codeBased)

      dispatch('keydown', 'x', { altKey: true, code: 'KeyX' })
      expect(keyBased).toHaveBeenCalledOnce()
      expect(codeBased).not.toHaveBeenCalled()
    })

    it('unbind removes a code-based binding', () => {
      hotkeys.bind('alt+code:KeyX', log)
      hotkeys.unbind('alt+code:KeyX')

      dispatch('keydown', '≈', { altKey: true, code: 'KeyX' })
      expect(log).not.toHaveBeenCalled()
    })

    it('combines AHK-style prefix with code: token', () => {
      // "!code:KeyX" should mean alt+code:KeyX
      hotkeys.bind('!code:KeyX', log)
      dispatch('keydown', '≈', { altKey: true, code: 'KeyX' })
      expect(log).toHaveBeenCalledOnce()
    })

    it('combines multiple AHK-style prefixes with code: token', () => {
      // "^!code:KeyX" should mean ctrl+alt+code:KeyX
      hotkeys.bind('^!code:KeyX', log)
      dispatch('keydown', '≈', { ctrlKey: true, altKey: true, code: 'KeyX' })
      expect(log).toHaveBeenCalledOnce()
    })

    it('rejects multiple code: tokens with a clear error', () => {
      expect(() =>
        hotkeys.bind('alt+code:KeyA+code:KeyB', log)
      ).toThrow(/multiple code: tokens/i)
    })
  })

  // =========================================================================
  // trigger() fidelity for the new binding shapes
  // =========================================================================
  describe('trigger() fidelity', () => {
    it('synthetic keyup event for bare-modifier has modifier flag false', () => {
      const seen = vi.fn()
      hotkeys.bind('alt up', (e) => seen(e.altKey))
      hotkeys.trigger('alt up')
      // Real Alt keyup has e.altKey === false (Alt has just been released).
      // The synthetic event must mirror that.
      expect(seen).toHaveBeenCalledWith(false)
    })

    it('synthetic keydown event for bare-modifier has modifier flag true', () => {
      const seen = vi.fn()
      hotkeys.bind('alt', (e) => seen(e.altKey))
      hotkeys.trigger('alt')
      expect(seen).toHaveBeenCalledWith(true)
    })

    it('synthetic event for code-based binding sets e.code', () => {
      const seen = vi.fn()
      hotkeys.bind('alt+code:KeyX', (e) => seen(e.code))
      hotkeys.trigger('alt+code:KeyX')
      expect(seen).toHaveBeenCalledWith('KeyX')
    })
  })

  // Regression: normalizeKey() used to .trim() before its `raw === ' '` guard,
  // so the `space`/`spacebar` aliases (which resolve to ' ') collapsed to '' —
  // any space binding threw "missing base key" / "multi-modifier bare bindings".
  describe('space key bindings', () => {
    it('binds a bare "space" without throwing and fires on the spacebar', () => {
      expect(() => hotkeys.bind('space', log)).not.toThrow()
      dispatch('keydown', ' ', { code: 'Space' })
      expect(log).toHaveBeenCalledOnce()
    })

    it('binds a multi-modifier space combo (the original repro) and fires it', () => {
      expect(() => hotkeys.bind('ctrl+shift+space', log)).not.toThrow()
      dispatch('keydown', ' ', { ctrlKey: true, shiftKey: true, code: 'Space' })
      expect(log).toHaveBeenCalledOnce()
    })

    it('accepts the "spacebar" alias too', () => {
      hotkeys.bind('alt+spacebar', log)
      dispatch('keydown', ' ', { altKey: true, code: 'Space' })
      expect(log).toHaveBeenCalledOnce()
    })
  })
})