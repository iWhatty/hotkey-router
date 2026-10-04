// validate.js
// Check a hotkey before an app saves it, e.g. from a "press your keys"
// recorder. Returns plain-language reasons the app can show as they are.
//
//   import { comboFromEvent } from 'hotkey-router'
//   import { validateCombo } from 'hotkey-router/validate'
//
//   const combo = comboFromEvent(e, { useMod: true })   // 'mod+shift+code:Period'
//   const { ok, reasons } = validateCombo(combo, { requirePrimary: true, minModifiers: 2 })
//
// Errors make `ok` false (the combo would not work, or breaks a rule the
// app asked for). Warnings leave `ok` true (it works, with a caveat worth
// telling the user: AltGr on some layouts, sites that use the same keys).
//
// Data: data/browser-hotkeys.json (keys the browser or OS take before the
// page sees them) and data/site-hotkeys.runtime.json (keys popular sites use).

import { lookupReservation, severityIsHard } from './reservations.js'
import { parseComboString, listSites } from './sites.js'

const ALL_PLATFORMS = ['mac', 'windows', 'linux']
const ALL_BROWSERS = ['chrome', 'firefox', 'edge', 'safari']
const PLATFORM_LABEL = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }
const BROWSER_LABEL = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge', safari: 'Safari' }
// Runtime site rows: [windows, mac, chromeos, action, verified]
const SITE_COL = { windows: 0, mac: 1, linux: 0 }

/**
 * @typedef {{
 *   code: 'invalid' | 'no-key' | 'no-modifier' | 'alt-only' | 'needs-primary' |
 *         'too-few-modifiers' | 'taken' | 'reserved' | 'reserved-soft' |
 *         'altgr' | 'site-conflict',
 *   severity: 'error' | 'warning',
 *   message: string,
 *   platforms?: string[],
 *   details?: object
 * }} ComboReason
 */

/**
 * @param {string} combo  hotkey string, e.g. `mod+shift+code:Period`
 * @param {{
 *   platforms?: Array<'mac' | 'windows' | 'linux'>,
 *   browsers?: Array<'chrome' | 'firefox' | 'edge' | 'safari'>,
 *   requirePrimary?: boolean,  // must include Ctrl (Cmd on macOS)
 *   minModifiers?: number,     // default 1
 *   taken?: string[],          // combos the app already uses
 *   sites?: boolean,           // warn about sites that use the keys (default true)
 * }} [opts]
 * @returns {{ ok: boolean, reasons: ComboReason[], lookupKeys: Record<string, string> }}
 */
export function validateCombo(combo, {
  platforms = ALL_PLATFORMS,
  browsers = ALL_BROWSERS,
  requirePrimary = false,
  minModifiers = 1,
  taken = [],
  sites = true,
} = {}) {
  /** @type {ComboReason[]} */
  const reasons = []
  const lookupKeys = {}
  const add = (reason) => {
    const same = reasons.find((r) => r.code === reason.code && r.message === reason.message)
    if (same) {
      for (const p of reason.platforms || []) if (!same.platforms?.includes(p)) same.platforms = [...(same.platforms || []), p]
      return
    }
    reasons.push(reason)
  }

  if (typeof combo !== 'string' || !combo.trim()) {
    return { ok: false, reasons: [{ code: 'invalid', severity: 'error', message: 'No keys were recorded.' }], lookupKeys }
  }

  for (const platform of platforms) {
    let parsed
    try {
      parsed = parseComboString(combo, platform)
    } catch {
      parsed = null
    }
    if (!parsed) {
      add({ code: 'invalid', severity: 'error', message: 'These keys could not be read.', platforms: [platform] })
      continue
    }
    if (!parsed.base) {
      add({ code: 'no-key', severity: 'error', message: 'Add a key to the modifiers, for example a letter or punctuation key.', platforms: [platform] })
      continue
    }
    const mods = ['ctrl', 'meta', 'alt', 'shift'].filter((m) => parsed[m])
    const key = [...mods, parsed.base].join('+')
    lookupKeys[platform] = key

    if (mods.length === 0) {
      add({ code: 'no-modifier', severity: 'error', message: 'Use at least one modifier (Ctrl, Alt, Shift or Cmd), or the key would fire while typing.', platforms: [platform] })
    }
    if (platform !== 'mac' && mods.length === 1 && parsed.alt) {
      add({ code: 'alt-only', severity: 'error', message: 'Alt on its own moves focus to the browser menu when released. Add Ctrl or Shift.', platforms: [platform] })
    }
    const primary = platform === 'mac' ? parsed.meta : parsed.ctrl
    if (requirePrimary && !primary) {
      add({ code: 'needs-primary', severity: 'error', message: `Include ${platform === 'mac' ? 'Cmd' : 'Ctrl'}.`, platforms: [platform] })
    }
    if (mods.length > 0 && mods.length < minModifiers) {
      add({ code: 'too-few-modifiers', severity: 'error', message: `Use at least ${minModifiers} modifiers together.`, platforms: [platform] })
    }

    for (const other of taken) {
      let otherKey = null
      try {
        const o = parseComboString(other, platform)
        if (o?.base) otherKey = [...['ctrl', 'meta', 'alt', 'shift'].filter((m) => o[m]), o.base].join('+')
      } catch { /* ignore unreadable entries */ }
      if (otherKey === key) {
        add({ code: 'taken', severity: 'error', message: 'These keys are already used for something else here.', platforms: [platform], details: { combo: other } })
      }
    }

    const shape = { ctrl: parsed.ctrl, meta: parsed.meta, alt: parsed.alt, shift: parsed.shift, key: parsed.base, code: null, bareModifier: null }
    for (const browser of browsers) {
      if (platform !== 'mac' && browser === 'safari') continue
      const hit = lookupReservation(shape, { platform, browser })
      if (!hit) continue
      const where = hit.source === 'system' ? PLATFORM_LABEL[platform] : `${BROWSER_LABEL[browser]} on ${PLATFORM_LABEL[platform]}`
      if (severityIsHard(hit.severity)) {
        add({ code: 'reserved', severity: 'error', message: `${where} uses these keys (${hit.action}), so a page never sees them.`, platforms: [platform], details: { browser, action: hit.action } })
      } else {
        add({ code: 'reserved-soft', severity: 'warning', message: `${where} uses these keys in some situations (${hit.action}).`, platforms: [platform], details: { browser, action: hit.action, severity: hit.severity } })
      }
    }

    if (platform === 'windows' && parsed.ctrl && parsed.alt && !parsed.meta) {
      add({ code: 'altgr', severity: 'warning', message: 'On some keyboard layouts Ctrl+Alt acts as AltGr and types characters; those keystrokes are skipped.', platforms: [platform] })
    }

    if (sites) {
      const col = SITE_COL[platform]
      const names = []
      for (const site of listSites()) {
        if (site.shortcuts.some((row) => row[col] === key)) names.push(site.name)
      }
      if (names.length) {
        add({ code: 'site-conflict', severity: 'warning', message: `Also used by ${names.join(', ')}.`, platforms: [platform], details: { sites: names } })
      }
    }
  }

  return { ok: !reasons.some((r) => r.severity === 'error'), reasons, lookupKeys }
}
