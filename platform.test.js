// platform.test.js — the shared detector and parser
import { describe, it, expect } from 'vitest'
import { detectPlatform, detectBrowser, platformLabel, browserLabel } from './platform.js'
import { parseHotkey, readHotkey, lookupKey } from './parse.js'
import { detectPlatform as coreDetect } from './hotkey-router.js'
import { detectPlatform as reservationsDetect, lookupReservation } from './reservations.js'
import { detectSitePlatform, parseComboString, siteLookupKey } from './sites.js'

const CROS = { userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 15000.0.0)', platform: 'Linux x86_64' }

describe('detectPlatform', () => {
  it('is the same function everywhere', () => {
    expect(coreDetect).toBe(detectPlatform)
    expect(reservationsDetect).toBe(detectPlatform)
  })

  it('prefers userAgentData.platform over navigator.platform', () => {
    expect(detectPlatform({ userAgentData: { platform: 'macOS' }, platform: 'Win32', userAgent: '' })).toBe('mac')
    expect(detectPlatform({ userAgentData: { platform: 'Windows' }, platform: '', userAgent: '' })).toBe('windows')
  })

  it('falls back to navigator.platform when userAgentData has no answer', () => {
    expect(detectPlatform({ userAgentData: { platform: 'Android' }, platform: 'Linux armv8l', userAgent: '' })).toBe('linux')
    expect(detectPlatform({ platform: 'iPhone', userAgent: '' })).toBe('mac')
  })

  it('reports ChromeOS as linux unless asked', () => {
    expect(detectPlatform(CROS)).toBe('linux')
    expect(detectPlatform(CROS, { chromeos: true })).toBe('chromeos')
    expect(detectSitePlatform(CROS)).toBe('chromeos')
    expect(detectPlatform({ userAgentData: { platform: 'Chrome OS' }, userAgent: '' }, { chromeos: true })).toBe('chromeos')
  })

  it('returns null with nothing to go on', () => {
    expect(detectPlatform(null)).toBe(null)
    expect(detectPlatform({ platform: '', userAgent: '' })).toBe(null)
  })

  it('labels platforms and browsers', () => {
    expect(platformLabel('mac')).toBe('macOS')
    expect(platformLabel('chromeos')).toBe('ChromeOS')
    expect(browserLabel('edge')).toBe('Edge')
    expect(platformLabel('beos')).toBe('beos')
    expect(detectBrowser({ userAgent: 'Firefox/120' })).toBe('firefox')
  })
})

describe('one parser for router, sites and reservations', () => {
  it('opt is Alt in both the strict and the lenient parser', () => {
    expect(parseHotkey('opt+k').combo.alt).toBe(true)
    expect(parseComboString('opt+k', 'mac')).toMatchObject({ alt: true, base: 'k' })
  })

  it('ctrl++ is the + key; its lookup name is equal (Ctrl++ is zoom in like Ctrl+=)', () => {
    expect(parseHotkey('ctrl++').combo.key).toBe('+')
    expect(parseHotkey('ctrl+plus').combo.key).toBe('+')
    expect(parseComboString('ctrl++', 'windows').base).toBe('equal')
    expect(siteLookupKey('ctrl+plus', 'windows')).toBe('ctrl+equal')
    expect(lookupKey(parseHotkey('ctrl++').combo)).toBe('ctrl+equal')
  })

  it('AHK prefixes reach sites too', () => {
    expect(siteLookupKey('^+code:Period', 'windows')).toBe('ctrl+shift+period')
  })

  it('a combo the router refuses still parses leniently', () => {
    expect(() => parseHotkey('ctrl+shift')).toThrow(/bare/)
    expect(readHotkey('ctrl+shift').error).toMatch(/bare/)
    expect(parseComboString('ctrl+shift', 'windows')).toMatchObject({ ctrl: true, shift: true, base: null })
    expect(parseComboString('k+ctrl', 'windows')).toMatchObject({ ctrl: true, base: 'k' })
  })

  it('event.key and code: spellings give the same lookup key', () => {
    for (const [a, b] of [['meta+shift+/', 'meta+shift+code:Slash'], ['ctrl+1', 'ctrl+code:Digit1'], ['alt+esc', 'alt+code:Escape']]) {
      expect(lookupKey(parseHotkey(a).combo)).toBe(lookupKey(parseHotkey(b).combo))
    }
  })

  it('reservations read key-based punctuation through the same names', () => {
    const hit = lookupReservation(parseHotkey('meta+shift+/', { platform: 'mac' }).combo, { platform: 'mac', browser: 'chrome' })
    expect(hit?.action).toMatch(/help/i)
  })
})
