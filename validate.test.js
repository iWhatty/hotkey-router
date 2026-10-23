// validate.test.js
import { describe, it, expect } from 'vitest'
import { validateCombo } from './validate.js'

const codes = (r) => r.reasons.map((x) => x.code)

describe('validateCombo', () => {
  it('accepts a clean chord with no reasons', () => {
    const r = validateCombo('mod+shift+code:Semicolon', { requirePrimary: true, minModifiers: 2 })
    expect(r.ok).toBe(true)
    expect(r.reasons).toEqual([])
    expect(r.lookupKeys).toEqual({ mac: 'meta+shift+semicolon', windows: 'ctrl+shift+semicolon', linux: 'ctrl+shift+semicolon' })
  })

  it('rejects empty input and a missing base key', () => {
    expect(codes(validateCombo(''))).toEqual(['invalid'])
    expect(validateCombo('ctrl+shift').ok).toBe(false)
    expect(codes(validateCombo('ctrl+shift'))).toContain('no-key')
  })

  it('rejects a plain key and an Alt-only chord on Windows/Linux', () => {
    expect(codes(validateCombo('code:KeyK'))).toContain('no-modifier')
    const alt = validateCombo('alt+code:Period')
    expect(alt.ok).toBe(false)
    const altOnly = alt.reasons.find((x) => x.code === 'alt-only')
    expect(altOnly.platforms.sort()).toEqual(['linux', 'windows'])
  })

  it('applies the app policy: primary modifier and modifier count', () => {
    expect(codes(validateCombo('alt+shift+code:KeyK', { requirePrimary: true }))).toContain('needs-primary')
    expect(codes(validateCombo('mod+code:KeyK', { minModifiers: 2 }))).toContain('too-few-modifiers')
  })

  it('rejects keys the app already uses, compared per platform', () => {
    const r = validateCombo('ctrl+shift+code:Space', { platforms: ['windows'], taken: ['mod+shift+code:Space'] })
    expect(codes(r)).toContain('taken')
  })

  it('rejects Cmd+Shift+/ on a Mac (Help menu search), not on Windows', () => {
    const r = validateCombo('mod+shift+code:Slash', { platforms: ['mac', 'windows'], browsers: ['chrome'] })
    expect(r.ok).toBe(false)
    const hit = r.reasons.find((x) => x.code === 'reserved')
    expect(hit.platforms).toEqual(['mac'])
    expect(hit.details.action).toMatch(/help menu/i)
  })

  it('rejects keys the browser takes before the page (hard reservation)', () => {
    const r = validateCombo('mod+code:KeyT', { platforms: ['windows'], browsers: ['chrome'] })
    expect(r.ok).toBe(false)
    expect(r.reasons.find((x) => x.code === 'reserved').message).toMatch(/Chrome on Windows/)
  })

  it('warns, without failing, about AltGr and about sites that use the keys', () => {
    const altgr = validateCombo('ctrl+alt+code:Comma', { platforms: ['windows'] })
    expect(altgr.ok).toBe(true)
    expect(codes(altgr)).toContain('altgr')
    expect(altgr.reasons.find((x) => x.code === 'site-conflict').message).toMatch(/Google Docs/)

    const docs = validateCombo('mod+shift+code:Period', { platforms: ['windows'] })
    expect(docs.ok).toBe(true)
    expect(docs.reasons.find((x) => x.code === 'site-conflict').details.sites).toContain('Google Docs')
  })

  it('can skip the site warnings', () => {
    expect(codes(validateCombo('mod+shift+code:Period', { platforms: ['windows'], sites: false }))).not.toContain('site-conflict')
  })
})

describe('validateCombo messages and platforms', () => {
  const reason = (r, code) => r.reasons.find((x) => x.code === code)

  it('names the primary modifier per platform', () => {
    const r = validateCombo('alt+shift+code:KeyK', { requirePrimary: true, sites: false })
    const msgs = r.reasons.filter((x) => x.code === 'needs-primary')
    expect(msgs.find((x) => x.platforms.includes('mac')).message).toBe('Include Cmd.')
    expect(msgs.find((x) => x.platforms.includes('windows')).message).toBe('Include Ctrl.')
    expect(msgs.find((x) => x.platforms.includes('windows')).platforms.sort()).toEqual(['linux', 'windows'])
  })

  it('lists modifiers in the platform words when every platform agrees', () => {
    expect(reason(validateCombo('code:KeyK', { platforms: ['mac'] }), 'no-modifier').message).toMatch(/\(Cmd, Option, Control or Shift\)/)
    expect(reason(validateCombo('code:KeyK', { platforms: ['windows', 'linux'] }), 'no-modifier').message).toMatch(/\(Ctrl, Alt or Shift\)/)
    const mixed = reason(validateCombo('code:KeyK'), 'no-modifier')
    expect(mixed.message).toMatch(/\(Ctrl, Alt, Shift or Cmd\)/)
    expect(mixed.platforms.sort()).toEqual(['linux', 'mac', 'windows'])
  })

  it('Option alone is fine on a Mac; Alt alone is not on Windows/Linux', () => {
    const r = validateCombo('alt+code:KeyK', { platforms: ['mac'], sites: false })
    expect(codes(r)).not.toContain('alt-only')
    expect(reason(validateCombo('alt+code:KeyK', { platforms: ['linux'] }), 'alt-only').message).toBe(
      'Alt on its own moves focus to the browser menu when released. Add Ctrl or Shift.'
    )
  })

  it('accepts every parser spelling: opt, AHK prefixes, key-based', () => {
    expect(validateCombo('mod+opt+code:KeyK', { platforms: ['mac'], sites: false }).lookupKeys.mac).toBe('meta+alt+k')
    expect(validateCombo('^+code:Semicolon', { platforms: ['windows'] }).lookupKeys.windows).toBe('ctrl+shift+semicolon')
    expect(validateCombo('ctrl+shift+;', { platforms: ['windows'] }).lookupKeys.windows).toBe('ctrl+shift+semicolon')
  })

  it('a bare modifier is a missing key, not unreadable', () => {
    expect(codes(validateCombo('shift'))).toEqual(['no-key'])
  })

  it('taken compares across spellings and ignores unreadable entries', () => {
    const r = validateCombo('ctrl+shift+code:KeyK', { platforms: ['windows'], taken: ['', 'ctrl+shift+k'], sites: false })
    expect(reason(r, 'taken').details.combo).toBe('ctrl+shift+k')
    expect(codes(validateCombo('mod+code:KeyK', { platforms: ['mac'], taken: ['mod+code:KeyK'], sites: false }))).toContain('taken')
    expect(codes(validateCombo('ctrl+code:KeyK', { platforms: ['mac'], taken: ['mod+code:KeyK'], sites: false }))).not.toContain('taken')
  })

  it('skips Safari off macOS, and labels the browser and OS', () => {
    const r = validateCombo('mod+code:KeyT', { platforms: ['windows'], browsers: ['safari'] })
    expect(codes(r)).not.toContain('reserved')
    const mac = validateCombo('mod+code:KeyT', { platforms: ['mac'], browsers: ['safari'] })
    expect(reason(mac, 'reserved').message).toMatch(/Safari on macOS/)
  })

  it('system reservations name the OS only', () => {
    const r = validateCombo('mod+code:Space', { platforms: ['mac'], browsers: ['chrome'] })
    const hit = reason(r, 'reserved')
    expect(hit.message).toMatch(/^macOS uses these keys/)
  })

  it('minModifiers counts every modifier', () => {
    expect(codes(validateCombo('mod+alt+shift+code:KeyK', { minModifiers: 3, sites: false }))).not.toContain('too-few-modifiers')
    expect(reason(validateCombo('mod+shift+code:KeyK', { minModifiers: 3, sites: false }), 'too-few-modifiers').message).toBe('Use at least 3 modifiers together.')
  })
})

describe('validateCombo shifted punctuation', () => {
  it('rejects a key-based shift+punctuation combo and names the code: form', () => {
    const r = validateCombo('ctrl+shift+,', { sites: false })
    expect(r.ok).toBe(false)
    const reason = r.reasons.find((x) => x.code === 'shifted-punctuation')
    expect(reason.message).toContain('ctrl+shift+code:Comma')
  })

  it('accepts the code: form and unshifted punctuation', () => {
    expect(codes(validateCombo('ctrl+shift+code:Comma', { sites: false }))).not.toContain('shifted-punctuation')
    expect(codes(validateCombo('ctrl+alt+,', { sites: false }))).not.toContain('shifted-punctuation')
  })
})
