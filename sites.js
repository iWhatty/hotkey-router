// sites.js
// Website shortcut awareness for hotkey-router.
//
// Apps that bind hotkeys on other people's pages (browser extensions,
// embedded widgets) collide with the page's own shortcuts: Google Docs uses
// Ctrl+Shift+. for font size, GitHub for "quote". Those keys DO reach the
// page (unlike the browser/OS keys in data/browser-hotkeys.json), so the
// app has a choice. This module looks the page up in data/site-hotkeys.json
// and builds a `when()` gate that yields to the site unless the user is
// focused on the app:
//
//   import hotkeys from 'hotkey-router'
//   import { siteAware } from 'hotkey-router/sites'
//
//   hotkeys.bind('mod+shift+code:Period', next, null, {
//     capture: true,             // see the key before the page's editor
//     preventDefault: true,
//     stopPropagation: true,     // when we do take it, the page doesn't
//     when: siteAware('mod+shift+code:Period', { engaged: () => popupIsOpen() }),
//   })
//
// On a site that uses the chord, the gate returns engaged(); elsewhere it
// returns true. When it returns false, hotkey-router leaves the event alone
// and the site's shortcut runs.
//
// Data: data/site-hotkeys.runtime.json (compact projection of the sourced
// table in data/site-hotkeys.json), human reference docs/site-hotkeys.md.
// Self-contained (no import of the core router), so importing it never
// creates a second router instance.

import SITE_DATA from './data/site-hotkeys.runtime.json' with { type: 'json' }

// Runtime row layout: [windows, mac, chromeos, action, verified (1 or 0)]
const COL = { windows: 0, mac: 1, chromeos: 2, action: 3, verified: 4 }

const SUPPORTED_SCHEMA = '1.0'
const SCHEMA_OK = SITE_DATA?.version?.schema === SUPPORTED_SCHEMA

/** @typedef {'mac' | 'windows' | 'linux' | 'chromeos'} SitePlatform */

/**
 * @param {Navigator | null} [nav]
 * @returns {SitePlatform | null}
 */
export function detectSitePlatform(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  if (!nav) return null
  const ua = nav.userAgent || ''
  if (/\bCrOS\b/.test(ua)) return 'chromeos'
  const platform = nav.userAgentData?.platform || nav.platform || ''
  if (/Mac|iPhone|iPad|iPod/i.test(platform)) return 'mac'
  if (/Win/i.test(platform)) return 'windows'
  if (/Linux|X11|Chrome OS/i.test(platform)) return /Chrome OS/i.test(platform) ? 'chromeos' : 'linux'
  return null
}

// --- combo -> canonical lookup key -------------------------------------------

const PUNCT_KEYS = {
  '.': 'period', ',': 'comma', ';': 'semicolon', "'": 'quote', '/': 'slash',
  '\\': 'backslash', '[': 'bracketleft', ']': 'bracketright', '-': 'minus',
  '=': 'equal', '`': 'backquote', ' ': 'space',
}
const NAMED_KEYS = new Set([
  'period', 'comma', 'semicolon', 'quote', 'slash', 'backslash', 'bracketleft',
  'bracketright', 'minus', 'equal', 'backquote', 'enter', 'space', 'tab',
  'backspace', 'delete', 'escape', 'arrowup', 'arrowdown', 'arrowleft',
  'arrowright', 'home', 'end', 'pageup', 'pagedown',
])
const KEY_ALIASES = { esc: 'escape', del: 'delete', spacebar: 'space', return: 'enter', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' }

function codeToBase(code) {
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1].toLowerCase()
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)
  if (digit) return digit[1]
  return code.toLowerCase()
}

function keyToBase(key) {
  if (key == null) return null
  if (PUNCT_KEYS[key]) return PUNCT_KEYS[key]
  const k = String(key).toLowerCase()
  if (KEY_ALIASES[k]) return KEY_ALIASES[k]
  if (/^[a-z0-9]$/.test(k) || /^f\d{1,2}$/.test(k) || NAMED_KEYS.has(k)) return k
  return k
}

/**
 * Parse a hotkey string (`mod+shift+code:Period`, `ctrl+alt+,`) into modifier
 * flags and a canonical base key name (`period`), resolving `mod` for the
 * platform. Shared with validate.js.
 *
 * @param {string} str
 * @param {SitePlatform} platform
 * @returns {{ ctrl: boolean, meta: boolean, alt: boolean, shift: boolean, base: string | null }}
 */
export function parseComboString(str, platform) {
  const flags = { ctrl: false, meta: false, alt: false, shift: false }
  let base = null
  const tokens = String(str).trim().toLowerCase().replace(/\s+up$/, '').split('+')
  // A trailing empty token means the key itself was '+'.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '' && i === tokens.length - 1) { base = 'equal'; continue }
    if (t === 'mod') flags[platform === 'mac' ? 'meta' : 'ctrl'] = true
    else if (t === 'ctrl' || t === 'control') flags.ctrl = true
    else if (t === 'cmd' || t === 'command' || t === 'meta' || t === 'win') flags.meta = true
    else if (t === 'alt' || t === 'option' || t === 'opt') flags.alt = true
    else if (t === 'shift') flags.shift = true
    else if (t.startsWith('code:')) base = codeToBase(String(str).match(/code:([A-Za-z0-9_]+)/)[1])
    else base = keyToBase(t)
  }
  return { ...flags, base }
}

/**
 * The canonical lookup key for a combo on a platform (`ctrl+shift+period`).
 * Accepts a hotkey string or a parsed combo from hotkey-router (`onBind`).
 *
 * @param {string | { ctrl?: boolean, meta?: boolean, alt?: boolean, shift?: boolean, key?: string, code?: string }} combo
 * @param {SitePlatform} [platform]
 * @returns {string | null}
 */
export function siteLookupKey(combo, platform = detectSitePlatform() || 'windows') {
  const c = typeof combo === 'string'
    ? parseComboString(combo, platform)
    : { ...combo, base: combo?.code ? codeToBase(combo.code) : keyToBase(combo?.key) }
  if (!c?.base) return null
  const parts = []
  if (c.ctrl) parts.push('ctrl')
  if (c.meta) parts.push('meta')
  if (c.alt) parts.push('alt')
  if (c.shift) parts.push('shift')
  parts.push(c.base)
  return parts.join('+')
}

// --- site matching ------------------------------------------------------------

function hostMatches(pattern, host) {
  if (pattern === '*') return true
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1) // ".atlassian.net"
    return host.endsWith(suffix) && host.length > suffix.length
  }
  return host === pattern
}

function toUrl(url) {
  if (url instanceof URL) return url
  try {
    return new URL(String(url))
  } catch {
    return null
  }
}

/**
 * The researched sites whose hosts (and path prefixes, when listed) match a
 * URL. Defaults to the current page.
 *
 * @param {string | URL} [url]
 * @returns {Array<object>}
 */
export function matchSites(url = (typeof location !== 'undefined' ? location.href : '')) {
  if (!SCHEMA_OK) return []
  const u = toUrl(url)
  if (!u) return []
  const host = u.hostname.toLowerCase()
  return SITE_DATA.sites.filter((site) =>
    site.hosts.some((h) => hostMatches(h.toLowerCase(), host)) &&
    (!site.pathPrefixes?.length || site.pathPrefixes.some((p) => u.pathname.startsWith(p)))
  )
}

/**
 * @typedef {{
 *   siteId: string,
 *   siteName: string,
 *   action: string,
 *   verified: boolean,
 *   lookupKey: string
 * }} SiteConflict
 *
 * Sources for each row are in data/site-hotkeys.json (look it up by siteId).
 */

/**
 * The shortcuts on the page (or a given URL) that use the same chord.
 *
 * @param {string | object} combo  hotkey string or parsed combo
 * @param {{ url?: string | URL, platform?: SitePlatform, verifiedOnly?: boolean }} [opts]
 * @returns {SiteConflict[]}
 */
export function lookupSiteConflicts(combo, { url, platform, verifiedOnly = false } = {}) {
  const plat = platform || detectSitePlatform() || 'windows'
  const lookupKey = siteLookupKey(combo, plat)
  if (!lookupKey) return []
  const field = plat === 'mac' ? 'mac' : plat === 'chromeos' ? 'chromeos' : 'windows'
  const conflicts = []
  for (const site of matchSites(url)) {
    for (const row of site.shortcuts) {
      const verified = row[COL.verified] === 1
      if (verifiedOnly && !verified) continue
      const key = row[COL[field]] ?? (field === 'chromeos' ? row[COL.windows] : null)
      if (key === lookupKey) {
        conflicts.push({ siteId: site.id, siteName: site.name, action: row[COL.action], verified, lookupKey })
      }
    }
  }
  return conflicts
}

/**
 * A `when()` gate for a binding: true on sites that don't use the chord;
 * on sites that do, true only while `engaged(e)` says the user is focused
 * on the app. Conflicts are looked up once per page URL.
 *
 * @param {string | object} combo  the binding's hotkey string (or parsed combo)
 * @param {{
 *   engaged: (e?: KeyboardEvent) => boolean,
 *   url?: () => string,
 *   platform?: SitePlatform,
 *   verifiedOnly?: boolean,
 *   onYield?: (conflicts: SiteConflict[], e?: KeyboardEvent) => void
 * }} opts
 * @returns {(e?: KeyboardEvent) => boolean}
 */
export function siteAware(combo, { engaged, url, platform, verifiedOnly = false, onYield } = {}) {
  if (typeof engaged !== 'function') throw new Error('siteAware() needs an engaged() callback')
  const currentUrl = url || (() => (typeof location !== 'undefined' ? location.href : ''))
  let cachedUrl = null
  let cached = []
  return (e) => {
    const href = currentUrl()
    if (href !== cachedUrl) {
      cachedUrl = href
      cached = lookupSiteConflicts(combo, { url: href, platform, verifiedOnly })
    }
    if (!cached.length) return true
    if (engaged(e)) return true
    onYield?.(cached, e)
    return false
  }
}

/**
 * All researched sites, compact form: `{ id, name, hosts, pathPrefixes,
 * shortcuts: [windows, mac, chromeos, action, verified][] }`.
 */
export function listSites() {
  return SCHEMA_OK ? SITE_DATA.sites : []
}

export const SITE_DATA_RESEARCHED = SITE_DATA?.version?.researched
export const SITE_SCHEMA_VERSION = SITE_DATA?.version?.schema
