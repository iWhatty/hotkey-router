// reservations.js
// Browser/OS hotkey reservation lookup for hotkey-router.
//
// At bind time, we look up the requested combo against a table of known
// browser- and OS-level shortcuts and emit a console.warn/info if the host
// will intercept it before the page sees the keydown. Soft warning only —
// never throws, never blocks the bind.
//
// Data file: data/browser-hotkeys.json. Schema documented in that file's
// `$keyFormat` / `$comment` fields. Severity tiers determine warn vs info.

import HOTKEY_DATA from './data/browser-hotkeys.json' with { type: 'json' }

const SUPPORTED_SCHEMA = '1.0'

// Severities that mean "combo will not reach page world."
const HARD_SEVERITIES = new Set(['hard', 'os', 'menu-activation'])

// Severities that mean "combo fires in normal browsing, only intercepted in
// narrow contexts (find bar focused, text input focused, devtools open)."
const SOFT_SEVERITIES = new Set(['find-bar-only', 'compose', 'system-text', 'devtools-open'])

// --- platform / browser detection ---------------------------------------------

export function detectPlatform(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  if (!nav) return null
  const platform = nav.platform || ''
  if (/Mac|iPhone|iPad|iPod/.test(platform)) return 'mac'
  if (/Win/i.test(platform)) return 'windows'
  if (/Linux|X11/i.test(platform)) return 'linux'
  // Fall back to userAgent sniffing when navigator.platform is unhelpful
  // (e.g. some Chromium builds report empty platform).
  const ua = nav.userAgent || ''
  if (/Mac OS X/i.test(ua)) return 'mac'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Linux|X11/i.test(ua)) return 'linux'
  return null
}

export function detectBrowser(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  if (!nav) return null
  const ua = nav.userAgent || ''
  // Order matters: Edge UA contains 'Chrome', Chrome UA contains 'Safari'.
  if (/Edg\//.test(ua)) return 'edge'
  if (/Firefox/.test(ua)) return 'firefox'
  if (/Chrome/.test(ua)) return 'chrome'
  if (/Safari/.test(ua)) return 'safari'
  return null
}

// --- data normalization -------------------------------------------------------

// Canonical modifier order for lookup keys: ctrl, meta, alt, shift, key.
// The data file mostly follows this but has at least one entry that doesn't
// (`ctrl+shift+alt+r` on Linux). Normalize both sides at load and lookup so
// minor inconsistencies don't cause silent misses.
function canonicalize(rawKey) {
  const parts = String(rawKey).toLowerCase().split('+').map(p => p.trim()).filter(Boolean)
  if (!parts.length) return ''
  const base = parts[parts.length - 1]
  const mods = new Set(parts.slice(0, -1))
  const out = []
  if (mods.has('ctrl')) out.push('ctrl')
  if (mods.has('meta')) out.push('meta')
  if (mods.has('alt')) out.push('alt')
  if (mods.has('shift')) out.push('shift')
  out.push(base)
  return out.join('+')
}

// Resolve $ref pointers ("$ref:platforms.windows.browsers.chrome") used by
// the Linux section to dedupe against Windows browser tables.
function resolveRef(value, root) {
  if (typeof value !== 'string' || !value.startsWith('$ref:')) return value
  const path = value.slice('$ref:'.length).split('.')
  let node = root
  for (const step of path) node = node?.[step]
  return node
}

function normalizeTable(table) {
  if (!table || typeof table !== 'object') return null
  const out = Object.create(null)
  for (const [k, v] of Object.entries(table)) {
    if (!v || typeof v !== 'object' || !('severity' in v)) continue
    out[canonicalize(k)] = v
  }
  return out
}

// Precompute normalized lookup tables once at module load. Browsers ship the
// table inline; this keeps per-bind lookup to two Map-ish reads.
function buildIndex(data) {
  const idx = { platforms: {} }
  const platforms = data?.platforms || {}
  for (const [platform, pdata] of Object.entries(platforms)) {
    const browsers = {}
    for (const [name, btable] of Object.entries(pdata.browsers || {})) {
      browsers[name] = normalizeTable(resolveRef(btable, data))
    }
    idx.platforms[platform] = {
      browsers,
      system: normalizeTable(pdata.system),
    }
  }
  return idx
}

const SCHEMA_OK = HOTKEY_DATA?.version?.schema === SUPPORTED_SCHEMA
const INDEX = SCHEMA_OK ? buildIndex(HOTKEY_DATA) : { platforms: {} }

// --- lookup-key construction --------------------------------------------------

// Strip a `KeyboardEvent.code` value down to the bare letter/digit used in the
// data tables. `KeyA` -> `a`, `Digit1` -> `1`. Other codes (`ArrowLeft`,
// `Space`, `F5`) are lowercased as a best-effort fallback.
function codeToKey(code) {
  if (!code) return null
  const letter = /^Key([A-Za-z])$/.exec(code)
  if (letter) return letter[1].toLowerCase()
  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]
  return code.toLowerCase()
}

// Build the canonical lookup key from a hotkey-router parsed combo. Mirrors
// WebRadar's `lookupKey()` but works against the parsed structure rather than
// the raw string, so `mod` is already resolved and `code:KeyX` is normalized.
export function lookupKeyFromCombo(combo) {
  if (!combo) return null
  if (combo.bareModifier) return null // bare modifiers aren't tracked in the data
  const base = combo.code ? codeToKey(combo.code) : combo.key
  if (!base) return null
  const parts = []
  if (combo.ctrl) parts.push('ctrl')
  if (combo.meta) parts.push('meta')
  if (combo.alt) parts.push('alt')
  if (combo.shift) parts.push('shift')
  parts.push(base)
  return parts.join('+')
}

// --- public lookup ------------------------------------------------------------

/**
 * @typedef {'mac' | 'windows' | 'linux'} Platform
 * @typedef {'chrome' | 'firefox' | 'safari' | 'edge'} Browser
 * @typedef {'hard' | 'hard-fullscreen' | 'soft' | 'soft-warn'} Severity
 *
 * @typedef {{
 *   source: 'browser' | 'system',
 *   platform: Platform,
 *   browser: Browser | undefined,
 *   lookupKey: string,
 *   action: string,
 *   severity: Severity
 * }} Reservation
 */

/**
 * Look up whether a parsed hotkey combo is reserved by the host platform
 * or browser. Returns `null` when not reserved or when the data table
 * hasn't loaded.
 *
 * @param {object | null} combo  parsed combo from `hotkey-router`'s `parseHotkey`
 * @param {{ platform?: Platform, browser?: Browser }} [opts]
 * @returns {Reservation | null}
 */
export function lookupReservation(combo, { platform, browser } = {}) {
  if (!SCHEMA_OK) return null
  const lookupKey = lookupKeyFromCombo(combo)
  if (!lookupKey) return null

  const pdata = platform && INDEX.platforms[platform]
  if (!pdata) return null

  const btable = browser ? pdata.browsers?.[browser] : null
  const bclaim = btable?.[lookupKey]
  if (bclaim) {
    return {
      source: 'browser',
      platform,
      browser,
      lookupKey,
      action: bclaim.action,
      severity: bclaim.severity,
    }
  }
  const sclaim = pdata.system?.[lookupKey]
  if (sclaim) {
    return {
      source: 'system',
      platform,
      browser,
      lookupKey,
      action: sclaim.action,
      severity: sclaim.severity,
    }
  }
  return null
}

// --- warning emission ---------------------------------------------------------

const PLATFORM_LABEL = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }

/** @param {Severity | string} severity @returns {boolean} */
export function severityIsHard(severity) {
  return HARD_SEVERITIES.has(severity)
}

/** @param {Severity | string} severity @returns {boolean} */
export function severityIsSoft(severity) {
  return SOFT_SEVERITIES.has(severity)
}

/**
 * Render a console-friendly warning string for a reservation.
 *
 * @param {Reservation} reservation
 * @param {string} rawHotkey
 * @returns {string}
 */
export function formatReservationWarning(reservation, rawHotkey) {
  const platformLabel = PLATFORM_LABEL[reservation.platform] || reservation.platform
  const sourceLabel = reservation.source === 'browser'
    ? `${reservation.browser} on ${platformLabel}`
    : `${platformLabel}`
  const tag = severityIsHard(reservation.severity)
    ? 'will not fire'
    : 'fires in normal browsing'
  return `[hotkey-router] "${rawHotkey}" (${reservation.lookupKey}) reserved by ${sourceLabel}: "${reservation.action}" [${reservation.severity}] — ${tag}.`
}

/**
 * Emit a reservation warning via the given console (or the global `console`
 * by default). Hard reservations log via `warn`; soft ones via `info`.
 *
 * @param {Reservation} reservation
 * @param {string} rawHotkey
 * @param {Console} [console_]
 * @returns {void}
 */
export function emitReservationWarning(reservation, rawHotkey, console_ = console) {
  const msg = formatReservationWarning(reservation, rawHotkey)
  const fn = severityIsHard(reservation.severity) ? console_.warn : console_.info
  fn.call(console_, msg)
}

// --- installer ----------------------------------------------------------------
//
// Wire reservation warnings into a hotkey-router instance. Importing this
// function is the opt-in: bundlers that don't see this import tree-shake the
// entire ~5 KB data table out of the build.
//
//   import hotkeys from 'hotkey-router'
//   import { installReservationWarnings } from 'hotkey-router/reservations'
//   installReservationWarnings(hotkeys)
//
// Returns an `uninstall()` function. Per-bind opt-out still works:
//   hotkeys.bind('meta+shift+f', fn, null, { warnOnReserved: false })
//
// Options:
//   platform — override auto-detected 'mac' | 'windows' | 'linux'
//   browser  — override auto-detected 'firefox' | 'chrome' | 'safari' | 'edge'
//   console  — inject a custom console-like object (used by tests)
/**
 * @param {object} hotkeys  a hotkey-router default-export instance
 * @param {{
 *   platform?: Platform,
 *   browser?: Browser,
 *   console?: Console
 * }} [opts]
 * @returns {() => void} uninstall function
 */
export function installReservationWarnings(hotkeys, opts = {}) {
  if (!hotkeys || typeof hotkeys.onBind !== 'function') {
    throw new TypeError(
      'installReservationWarnings(hotkeys) requires a hotkey-router instance with onBind() (>= v0.2.0)'
    )
  }
  const platform = opts.platform !== undefined ? opts.platform : detectPlatform()
  const browser = opts.browser !== undefined ? opts.browser : detectBrowser()
  const console_ = opts.console || console

  return hotkeys.onBind(({ combo, raw, options }) => {
    if (options?.warnOnReserved === false) return
    if (!platform || !browser) return
    const reservation = lookupReservation(combo, { platform, browser })
    if (reservation) emitReservationWarning(reservation, raw, console_)
  })
}

export const SCHEMA_VERSION = HOTKEY_DATA?.version?.schema
export const DATA_GENERATED = HOTKEY_DATA?.version?.generated
export { HOTKEY_DATA }
