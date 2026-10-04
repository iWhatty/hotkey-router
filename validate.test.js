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
