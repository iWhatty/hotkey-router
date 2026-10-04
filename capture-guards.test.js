// capture-guards.test.js
// Per-binding capture phase, the AltGr and IME guards, and comboFromEvent.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import hotkeys, { comboFromEvent, parseHotkey } from './hotkey-router.js'

function keyEvent(type, init = {}, { altGraph = false } = {}) {
  const e = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
  if (altGraph) {
    Object.defineProperty(e, 'getModifierState', { value: (k) => k === 'AltGraph' })
  }
  return e
}

describe('per-binding capture phase', () => {
  let page
  let pageHandler

  beforeEach(() => {
    hotkeys.destroy()
    hotkeys.init({ target: window })
    hotkeys.resume()
    hotkeys.ignoreInput(false)
    page = document.createElement('div')
    document.body.appendChild(page)
    // The page's own shortcut: handles the key and stops it bubbling, as an
    // editor keymap (ProseMirror, Google Docs) would.
    pageHandler = vi.fn((e) => e.stopPropagation())
    page.addEventListener('keydown', pageHandler)
  })

  afterEach(() => {
    page.remove()
    hotkeys.destroy()
  })

  it('a bubble-phase binding never sees a key the page stopped', () => {
    const fn = vi.fn()
    hotkeys.bind('ctrl+shift+code:Period', fn)
    page.dispatchEvent(keyEvent('keydown', { key: '>', code: 'Period', ctrlKey: true, shiftKey: true }))
    expect(pageHandler).toHaveBeenCalledTimes(1)
    expect(fn).not.toHaveBeenCalled()
  })

  it('a capture binding runs first and can keep the page from handling the key', () => {
    const fn = vi.fn()
    hotkeys.bind('ctrl+shift+code:Period', fn, null, { capture: true, preventDefault: true, stopPropagation: true })
    const e = keyEvent('keydown', { key: '>', code: 'Period', ctrlKey: true, shiftKey: true })
    page.dispatchEvent(e)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(pageHandler).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(true)
  })

  it('a capture binding whose when() is false leaves the event alone for the page', () => {
    const fn = vi.fn()
    hotkeys.bind('ctrl+shift+code:Period', fn, null, { capture: true, preventDefault: true, stopPropagation: true, when: () => false })
    const e = keyEvent('keydown', { key: '>', code: 'Period', ctrlKey: true, shiftKey: true })
    page.dispatchEvent(e)
    expect(fn).not.toHaveBeenCalled()
    expect(pageHandler).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(false)
  })

  it('handles each binding exactly once (no double fire across the two listeners)', () => {
    const bubble = vi.fn()
    const capture = vi.fn()
    hotkeys.bind('ctrl+code:KeyK', bubble)
    hotkeys.bind('ctrl+code:KeyJ', capture, null, { capture: true })
    window.dispatchEvent(keyEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true }))
    window.dispatchEvent(keyEvent('keydown', { key: 'j', code: 'KeyJ', ctrlKey: true }))
    expect(bubble).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it('init({ capture: true }) still handles every binding', () => {
    hotkeys.destroy()
    hotkeys.init({ target: window, capture: true })
    const fn = vi.fn()
    hotkeys.bind('ctrl+code:KeyK', fn)
    window.dispatchEvent(keyEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true }))
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('AltGr and IME guards', () => {
  beforeEach(() => {
    hotkeys.destroy()
    hotkeys.init({ target: window })
    hotkeys.resume()
    hotkeys.ignoreInput(false)
  })
  afterEach(() => hotkeys.destroy())

  it('skips an AltGr keystroke that types a character (Polish AltGr+, = "<")', () => {
    const fn = vi.fn()
    hotkeys.bind('ctrl+alt+code:Comma', fn, null, { preventDefault: true })
    const e = keyEvent('keydown', { key: '<', code: 'Comma', ctrlKey: true, altKey: true }, { altGraph: true })
    window.dispatchEvent(e)
    expect(fn).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false) // the character still gets typed
  })

  it('still fires on a real Ctrl+Alt press (no AltGraph state)', () => {
    const fn = vi.fn()
    hotkeys.bind('ctrl+alt+code:Comma', fn)
    window.dispatchEvent(keyEvent('keydown', { key: ',', code: 'Comma', ctrlKey: true, altKey: true }))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('altGraph: true opts back in', () => {
    const fn = vi.fn()
    hotkeys.bind('ctrl+alt+code:Comma', fn, null, { altGraph: true })
    window.dispatchEvent(keyEvent('keydown', { key: '<', code: 'Comma', ctrlKey: true, altKey: true }, { altGraph: true }))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('skips keys during IME composition unless composing: true', () => {
    const skip = vi.fn()
    hotkeys.bind('ctrl+code:KeyK', skip)
    window.dispatchEvent(keyEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, isComposing: true }))
    expect(skip).not.toHaveBeenCalled()

    const take = vi.fn()
    hotkeys.bind('ctrl+code:KeyJ', take, null, { composing: true })
    window.dispatchEvent(keyEvent('keydown', { key: 'j', code: 'KeyJ', ctrlKey: true, isComposing: true }))
    expect(take).toHaveBeenCalledTimes(1)
  })
})

describe('comboFromEvent (for a key recorder)', () => {
  it('records physical keys by default', () => {
    expect(comboFromEvent(keyEvent('keydown', { key: '>', code: 'Period', ctrlKey: true, shiftKey: true }))).toBe('ctrl+shift+code:Period')
    expect(comboFromEvent(keyEvent('keydown', { key: 'k', code: 'KeyK', altKey: true, shiftKey: true }))).toBe('alt+shift+code:KeyK')
  })
  it('can record the character instead', () => {
    expect(comboFromEvent(keyEvent('keydown', { key: 'K', code: 'KeyK', ctrlKey: true }), { physical: false })).toBe('ctrl+k')
  })
  it('writes the primary modifier as mod when asked (Ctrl outside macOS)', () => {
    expect(comboFromEvent(keyEvent('keydown', { key: '.', code: 'Period', ctrlKey: true, shiftKey: true }), { useMod: true })).toBe('mod+shift+code:Period')
  })
  it('returns null while only a modifier is held', () => {
    expect(comboFromEvent(keyEvent('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true }))).toBeNull()
  })
  it('produces strings the router can parse back', () => {
    const s = comboFromEvent(keyEvent('keydown', { key: '>', code: 'Period', ctrlKey: true, shiftKey: true }))
    expect(parseHotkey(s).combo).toMatchObject({ ctrl: true, shift: true, code: 'Period' })
  })
})
