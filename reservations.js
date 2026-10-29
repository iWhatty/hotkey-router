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
import { lookupKey } from './parse.js'
import { detectPlatform, detectBrowser, platformLabel } from './platform.js'

const SUPPORTED_SCHEMA = '1.0'

// Severities that mean "combo will not reach page world."
const HARD_SEVERITIES = new Set(['hard', 'os', 'menu-activation'])

// Severities that mean "combo fires in normal browsing, only intercepted in
// narrow contexts (find bar focused, text input focused, devtools open)", or
// "the page sees it first and preventDefault() keeps the browser out"
// (preventable).
const SOFT_SEVERITIES = new Set(['find-bar-only', 'compose', 'system-text', 'devtools-open', 'preventable'])

// --- platform / browser detection ---------------------------------------------
// One shared detector (platform.js). Here ChromeOS reports as 'linux': the
// table has mac/windows/linux sections only.
export { detectPlatform, detectBrowser }

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

// Build the canonical lookup key from a hotkey-router parsed combo
// (`ctrl+meta+alt+shift+base`), so `mod` is already resolved and
// `code:KeyX`, `code:Slash` and `/` all reach the data's names. The same
// function sites.js uses (parse.js).
export const lookupKeyFromCombo = lookupKey

// --- public lookup ------------------------------------------------------------

/**
 * @typedef {'mac' | 'windows' | 'linux'} Platform
 * @typedef {'chrome' | 'firefox' | 'safari' | 'edge'} Browser
 * @typedef {'hard' | 'os' | 'menu-activation' | 'find-bar-only' | 'compose' | 'system-text' | 'devtools-open' | 'preventable'} Severity
 *   hard tiers (never reach the page): hard, os, menu-activation; the rest are soft
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
 * @param {{ preventDefault?: boolean }} [bindOptions]  the binding's options
 * @returns {string}
 */
export function formatReservationWarning(reservation, rawHotkey, bindOptions) {
  const where = platformLabel(reservation.platform)
  const sourceLabel = reservation.source === 'browser'
    ? `${reservation.browser} on ${where}`
    : where
  const tag = severityIsHard(reservation.severity)
    ? 'will not fire'
    : reservation.severity === 'preventable'
      ? (bindOptions?.preventDefault
          ? 'fires first; preventDefault keeps the browser out'
          : 'fires, and the browser acts too; bind with preventDefault: true')
      : 'fires in normal browsing'
  return `[hotkey-router] "${rawHotkey}" (${reservation.lookupKey}) reserved by ${sourceLabel}: "${reservation.action}" [${reservation.severity}] — ${tag}.`
}

/**
 * Emit a reservation warning via the given console (or the global `console`
 * by default). Hard reservations log via `warn`; soft ones via `info`, except
 * a preventable key bound without `preventDefault`, where the browser's
 * action runs too: that logs via `warn`.
 *
 * @param {Reservation} reservation
 * @param {string} rawHotkey
 * @param {Console} [console_]
 * @param {{ preventDefault?: boolean }} [bindOptions]  the binding's options
 * @returns {void}
 */
export function emitReservationWarning(reservation, rawHotkey, console_ = console, bindOptions) {
  const msg = formatReservationWarning(reservation, rawHotkey, bindOptions)
  const loud = severityIsHard(reservation.severity) ||
    (reservation.severity === 'preventable' && !bindOptions?.preventDefault)
  const fn = loud ? console_.warn : console_.info
  fn.call(console_, msg)
}

// --- installer ----------------------------------------------------------------
//
// Wire reservation warnings into a hotkey-router instance. Importing this
// function is the opt-in: bundlers that don't see this import tree-shake the
// entire data table out of the build (this module minified: ~23 KB,
// ~5.5 KB gzipped; measured 0.3.2).
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
    if (reservation) emitReservationWarning(reservation, raw, console_, options)
  })
}

export const SCHEMA_VERSION = HOTKEY_DATA?.version?.schema
export const DATA_GENERATED = HOTKEY_DATA?.version?.generated
export { HOTKEY_DATA }
