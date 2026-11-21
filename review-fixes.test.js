// review-fixes.test.js
// Regressions from the 2026-11-14 review: each block is a bug that shipped
// in 0.5.1, proven with real-shaped events or real data rows.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRouter } from './core.js'
import { parseHotkey, keyToBase, lookupKey } from './parse.js'
import { shiftedPunctuationHint } from './shifted-punctuation.js'
import { lookupReservation } from './reservations.js'
import { validateCombo } from './validate.js'
import { matchSites } from './sites.js'
import { formatCombo } from './format.js'

const key = (k, init = {}) =>
  new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...init })

describe('review fixes', () => {
  let r
  const press = (k, init) => window.dispatchEvent(key(k, init))

  beforeEach(() => {
    r = createRouter({ target: window })
    r.init()
  })
  afterEach(() => {
    r.destroy()
    vi.restoreAllMocks()
  })

  describe('characters typed with Shift', () => {
    it("bind('?') fires on a real '?' keydown, which has shiftKey set", () => {
      const fn = vi.fn()
      r.bind('?', fn)
      press('?', { code: 'Slash', shiftKey: true })
      expect(fn).toHaveBeenCalledOnce()
    })

    it("works for '!' and '+', and for digits a layout types with Shift (AZERTY '1')", () => {
      const bang = vi.fn(), plus = vi.fn(), one = vi.fn()
      r.bind('!', bang)
      r.bind('+', plus)
      r.bind('1', one)
      press('!', { code: 'Digit1', shiftKey: true })
      press('+', { code: 'Equal', shiftKey: true })
      press('1', { code: 'Digit1', shiftKey: true })
      expect(bang).toHaveBeenCalledOnce()
      expect(plus).toHaveBeenCalledOnce()
      expect(one).toHaveBeenCalledOnce()
    })

    it('keeps modifiers other than Shift: ctrl+? fires on Ctrl+Shift+/', () => {
      const fn = vi.fn()
      r.bind('ctrl+?', fn)
      press('?', { code: 'Slash', shiftKey: true, ctrlKey: true })
      expect(fn).toHaveBeenCalledOnce()
      press('?', { code: 'Slash', shiftKey: true }) // no Ctrl: not this binding
      expect(fn).toHaveBeenCalledOnce()
    })

    it('an explicit shift+? binding still wins over ?', () => {
      const plain = vi.fn(), shifted = vi.fn()
      r.bind('shift+?', shifted)
      r.bind('?', plain)
      press('?', { code: 'Slash', shiftKey: true })
      expect(shifted).toHaveBeenCalledOnce()
      expect(plain).not.toHaveBeenCalled()
    })

    it('letters and Space keep Shift meaningful', () => {
      const k = vi.fn(), space = vi.fn()
      r.bind('k', k)
      r.bind('space', space)
      press('K', { code: 'KeyK', shiftKey: true })
      press(' ', { code: 'Space', shiftKey: true })
      expect(k).not.toHaveBeenCalled()
      expect(space).not.toHaveBeenCalled()
    })

    it('hints at code: for Shift plus a digit, which types a symbol on US layouts', () => {
      expect(shiftedPunctuationHint('shift+1')?.suggestion).toBe('shift+code:Digit1')
      expect(shiftedPunctuationHint('ctrl+shift+0 up')?.suggestion).toBe('ctrl+shift+code:Digit0 up')
    })
  })

  describe('parser strictness', () => {
    it('rejects two base keys, and a key together with a code:', () => {
      expect(() => parseHotkey('ctrl+a+b')).toThrow(/one base key/)
      expect(() => parseHotkey('ctrl+k+code:KeyA')).toThrow(/one base key/)
    })

    it('reads code: after a spaced +', () => {
      expect(parseHotkey('ctrl + code:KeyK').combo).toMatchObject({ ctrl: true, code: 'KeyK', key: null })
    })

    it('a lone AHK prefix character is the key itself, not a bare modifier', () => {
      expect(parseHotkey('+').combo).toMatchObject({ key: '+', shift: false, bareModifier: null })
      expect(parseHotkey('#').combo).toMatchObject({ key: '#', meta: false, bareModifier: null })
      expect(parseHotkey('!').combo).toMatchObject({ key: '!', alt: false, bareModifier: null })
      expect(parseHotkey('^').combo).toMatchObject({ key: '^', ctrl: false, bareModifier: null })
      expect(parseHotkey('^+').combo).toMatchObject({ ctrl: true, key: '+' })
      // unchanged
      expect(parseHotkey('++').combo).toMatchObject({ shift: true, key: '+' })
      expect(parseHotkey('!k').combo).toMatchObject({ alt: true, key: 'k' })
      expect(parseHotkey('^!code:KeyX').combo).toMatchObject({ ctrl: true, alt: true, code: 'KeyX' })
    })

    it('Object.prototype names are plain keys', () => {
      expect(parseHotkey('ctrl+constructor').combo.key).toBe('constructor')
      expect(parseHotkey('__proto__').combo.key).toBe('__proto__')
      expect(keyToBase('constructor')).toBe('constructor')
      expect(lookupKey(parseHotkey('ctrl+tostring').combo)).toBe('ctrl+tostring')
      expect(formatCombo('ctrl+constructor', { platform: 'windows' })).not.toMatch(/function|object/i)
      expect(formatCombo('ctrl+code:constructor', { platform: 'windows' })).toMatch(/constructor/i)
    })
  })

  describe('handlers', () => {
    it('bind() refuses a handler that is not a function', () => {
      expect(() => r.bind('k', undefined)).toThrow(TypeError)
      expect(() => r.bind('k', 'nope')).toThrow(TypeError)
    })

    it('registerPlugin() refuses a bad handler and binds nothing', () => {
      const fn = vi.fn()
      expect(() => r.registerPlugin('p', { j: fn, k: null })).toThrow(TypeError)
      press('j', { code: 'KeyJ' })
      expect(fn).not.toHaveBeenCalled()
      expect(() => r.registerPlugin('p', { j: fn })).not.toThrow()
    })
  })
})

describe('reservation table lookups', () => {
  it('finds rows written with esc and del', () => {
    expect(lookupReservation(parseHotkey('ctrl+shift+esc').combo, { platform: 'windows', browser: 'chrome' }))
      .toMatchObject({ source: 'system', severity: 'os' })
    expect(lookupReservation(parseHotkey('ctrl+alt+delete').combo, { platform: 'windows', browser: 'chrome' }))
      .toMatchObject({ source: 'system' })
    expect(lookupReservation(parseHotkey('meta+alt+escape').combo, { platform: 'mac', browser: 'chrome' }))
      .toMatchObject({ source: 'system' })
  })

  it('has Edge rows on macOS', () => {
    expect(lookupReservation(parseHotkey('meta+w').combo, { platform: 'mac', browser: 'edge' }))
      .toMatchObject({ source: 'browser', action: 'Close tab', severity: 'hard' })
    expect(lookupReservation(parseHotkey('meta+shift+u').combo, { platform: 'mac', browser: 'edge' }))
      .toMatchObject({ source: 'browser', action: 'Read Aloud toggle' })
  })

  it('ignores Object.prototype names for platform and browser', () => {
    const combo = parseHotkey('ctrl+w').combo
    expect(lookupReservation(combo, { platform: 'constructor', browser: 'chrome' })).toBeNull()
    expect(lookupReservation(combo, { platform: 'windows', browser: 'constructor' })?.source ?? null).not.toBe('browser')
  })
})

describe('validateCombo on strings the router refuses', () => {
  it('reports invalid instead of ok', () => {
    for (const s of ['k+ctrl', 'ctrl+code:KeyA+code:KeyB', 'ctrl+a+b']) {
      const { ok, reasons } = validateCombo(s)
      expect(ok, s).toBe(false)
      expect(reasons[0], s).toMatchObject({ code: 'invalid', severity: 'error' })
    }
  })

  it('validateCombo sees the esc rows too', () => {
    const { ok, reasons } = validateCombo('ctrl+shift+escape', { platforms: ['windows'], sites: false })
    expect(ok).toBe(false)
    expect(reasons.map((x) => x.code)).toContain('reserved')
  })
})

describe('site hosts', () => {
  it('Word for the web matches tenant SharePoint hosts', () => {
    expect(matchSites('https://contoso.sharepoint.com/:w:/r/sites/x').map((s) => s.id)).toContain('word-web')
  })
})
