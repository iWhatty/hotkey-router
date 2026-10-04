// sites.test.js
import { describe, it, expect, vi } from 'vitest'
import FULL from './data/site-hotkeys.json' with { type: 'json' }
import {
  detectSitePlatform,
  siteLookupKey,
  matchSites,
  lookupSiteConflicts,
  siteAware,
  listSites,
  SITE_SCHEMA_VERSION,
} from './sites.js'

const DOCS = 'https://docs.google.com/document/d/abc/edit'
const SLIDES = 'https://docs.google.com/presentation/d/abc/edit'
const GITHUB = 'https://github.com/iWhatty/hotkey-router/issues/1'
const PLAIN = 'https://example.com/form'

describe('data', () => {
  it('loads the site table with every row in canonical notation', () => {
    expect(SITE_SCHEMA_VERSION).toBe('1.0')
    const KEY = /^(ctrl\+)?(meta\+)?(alt\+)?(shift\+)?([a-z0-9]|period|comma|semicolon|quote|slash|backslash|bracketleft|bracketright|minus|equal|backquote|enter|space|tab|backspace|delete|escape|arrowup|arrowdown|arrowleft|arrowright|home|end|pageup|pagedown|f\d{1,2})$/
    expect(listSites().length).toBe(FULL.sites.length)
    const sites = FULL.sites
    expect(sites.length).toBeGreaterThan(10)
    for (const site of sites) {
      expect(site.hosts.length, site.id).toBeGreaterThan(0)
      for (const s of site.shortcuts) {
        for (const p of ['windows', 'mac', 'chromeos']) {
          if (s[p] != null) expect(s[p], `${site.id} ${p}`).toMatch(KEY)
        }
      }
    }
  })
})

describe('detectSitePlatform', () => {
  it('detects ChromeOS from the user agent before the platform string', () => {
    expect(detectSitePlatform({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 15000.0.0)', platform: 'Linux x86_64' })).toBe('chromeos')
    expect(detectSitePlatform({ userAgent: '', platform: 'MacIntel' })).toBe('mac')
    expect(detectSitePlatform({ userAgent: '', platform: 'Win32' })).toBe('windows')
    expect(detectSitePlatform({ userAgent: '', platform: 'Linux x86_64' })).toBe('linux')
  })
})

describe('siteLookupKey', () => {
  it('resolves mod per platform and names physical punctuation keys', () => {
    expect(siteLookupKey('mod+shift+code:Period', 'windows')).toBe('ctrl+shift+period')
    expect(siteLookupKey('mod+shift+code:Period', 'mac')).toBe('meta+shift+period')
    expect(siteLookupKey('ctrl+alt+,', 'windows')).toBe('ctrl+alt+comma')
    expect(siteLookupKey('alt+shift+code:KeyK', 'linux')).toBe('alt+shift+k')
    expect(siteLookupKey('shift+ctrl+code:Digit1', 'windows')).toBe('ctrl+shift+1')
  })
  it('accepts a parsed combo (hotkey-router onBind shape)', () => {
    expect(siteLookupKey({ ctrl: true, shift: true, code: 'Comma' }, 'windows')).toBe('ctrl+shift+comma')
    expect(siteLookupKey({ meta: true, alt: true, key: '.' }, 'mac')).toBe('meta+alt+period')
  })
})

describe('matchSites', () => {
  it('matches by host and narrows by path prefix', () => {
    expect(matchSites(DOCS).map((s) => s.id)).toEqual(['google-docs'])
    expect(matchSites(SLIDES).map((s) => s.id)).toEqual(['google-slides'])
    expect(matchSites('https://docs.google.com/spreadsheets/d/x').map((s) => s.id)).toEqual([])
    expect(matchSites(PLAIN)).toEqual([])
  })
  it('handles wildcard subdomains (Atlassian) and any-host sites with paths (WordPress)', () => {
    expect(matchSites('https://acme.atlassian.net/wiki/spaces/X').map((s) => s.id)).toContain('confluence')
    expect(matchSites('https://atlassian.net/wiki/x').map((s) => s.id)).not.toContain('confluence')
    expect(matchSites('https://blog.example.org/wp-admin/post.php?post=1').map((s) => s.id)).toContain('gutenberg')
  })
  it('returns nothing for an unparseable URL', () => {
    expect(matchSites('not a url')).toEqual([])
  })
})

describe('lookupSiteConflicts', () => {
  it('finds Google Docs font size on Ctrl/Cmd+Shift+. and ,', () => {
    const win = lookupSiteConflicts('mod+shift+code:Period', { url: DOCS, platform: 'windows' })
    expect(win.map((c) => c.action).join(' ')).toMatch(/font size/i)
    const mac = lookupSiteConflicts('mod+shift+code:Comma', { url: DOCS, platform: 'mac' })
    expect(mac.length).toBeGreaterThan(0)
  })
  it('finds GitHub quote on Ctrl+Shift+. but not on Ctrl+Shift+,', () => {
    expect(lookupSiteConflicts('mod+shift+code:Period', { url: GITHUB, platform: 'windows' }).length).toBeGreaterThan(0)
    expect(lookupSiteConflicts('mod+shift+code:Comma', { url: GITHUB, platform: 'windows' })).toEqual([])
  })
  it('reports nothing on a site that is not in the table', () => {
    expect(lookupSiteConflicts('mod+shift+code:Period', { url: PLAIN, platform: 'windows' })).toEqual([])
  })
  it('can keep only verified rows', () => {
    const all = lookupSiteConflicts('mod+shift+code:Period', { url: 'https://linear.app/x', platform: 'windows' })
    const verified = lookupSiteConflicts('mod+shift+code:Period', { url: 'https://linear.app/x', platform: 'windows', verifiedOnly: true })
    expect(all.length).toBeGreaterThanOrEqual(verified.length)
    expect(verified.every((c) => c.verified)).toBe(true)
  })
})

describe('siteAware', () => {
  it('fires everywhere except clash sites, where it needs engagement', () => {
    let href = PLAIN
    let engaged = false
    const onYield = vi.fn()
    const when = siteAware('mod+shift+code:Period', { engaged: () => engaged, url: () => href, platform: 'windows', onYield })

    expect(when()).toBe(true) // no clash: works as usual

    href = DOCS
    expect(when()).toBe(false) // Docs owns the chord: yield
    expect(onYield).toHaveBeenCalledTimes(1)
    expect(onYield.mock.calls[0][0][0].siteId).toBe('google-docs')

    engaged = true
    expect(when()).toBe(true) // user is in the app: take it
  })
  it('requires an engaged callback', () => {
    expect(() => siteAware('mod+shift+code:Period', {})).toThrow(/engaged/)
  })
})
