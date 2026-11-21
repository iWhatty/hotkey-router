// reservations.js
// Browser/OS hotkey reservation lookup for hotkey-router.
//
// Data file: data/browser-hotkeys.json. Schema documented in that file's
// `$keyFormat` / `$comment` fields. Bind warnings live in hotkey-router/dev.

import { ownValue } from './lookup.js'
import HOTKEY_DATA from './data/browser-hotkeys.json' with { type: 'json' }
import { lookupKey, readHotkey } from './parse.js'
import { detectPlatform, detectBrowser } from './platform.js'

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

// A data row's key as the same lookup key a parsed combo gets (parse.js
// `lookupKey`): modifiers in canonical order and key names resolved, so a
// row written `ctrl+shift+esc` or `meta+ctrl+q` matches `ctrl+shift+escape`
// and `ctrl+meta+q`. The data's base names (`period`, `slash`) read as
// `event.key` names and come back unchanged.
function canonicalize(rawKey) {
  return lookupKey(readHotkey(rawKey).combo) || ''
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
  const idx = { platforms: Object.create(null) }
  const platforms = data?.platforms || {}
  for (const [platform, pdata] of Object.entries(platforms)) {
    const browsers = Object.create(null)
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
const INDEX = SCHEMA_OK ? buildIndex(HOTKEY_DATA) : { platforms: Object.create(null) }

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

  const pdata = platform && ownValue(INDEX.platforms, platform)
  if (!pdata) return null

  const btable = browser ? ownValue(pdata.browsers, browser) : null
  const bclaim = ownValue(btable, lookupKey)
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
  const sclaim = ownValue(pdata.system, lookupKey)
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

/** @param {Severity | string} severity @returns {boolean} */
export function severityIsHard(severity) {
  return HARD_SEVERITIES.has(severity)
}

/** @param {Severity | string} severity @returns {boolean} */
export function severityIsSoft(severity) {
  return SOFT_SEVERITIES.has(severity)
}

export const SCHEMA_VERSION = HOTKEY_DATA?.version?.schema
export const DATA_GENERATED = HOTKEY_DATA?.version?.generated
/**
 * The bundled table as loaded from data/browser-hotkeys.json.
 *
 * @type {{ version: { schema: string, generated: string, sources: string[] }, platforms: Record<string, object> } & Record<string, any>}
 */
const BUNDLED_DATA = HOTKEY_DATA
export { BUNDLED_DATA as HOTKEY_DATA }
