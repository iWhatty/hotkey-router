// format.js
// Show a hotkey to people: `mod+shift+code:Period` -> "Ctrl+Shift+." on
// Windows and Linux, "⇧⌘." (glyphs) or "Shift+Cmd+." (text) on macOS, plus
// keycap tokens with names a screen reader can say.
//
//   import { formatCombo, comboTokens, modifierLabel } from 'hotkey-router/format'
//
//   formatCombo('mod+shift+code:Period')                       // 'Ctrl+Shift+.'
//   formatCombo('mod+shift+code:Period', { platform: 'mac', style: 'glyphs' }) // '⇧⌘.'
//   comboTokens('mod+code:KeyK', { platform: 'mac' })
//   // [{ label: '⌘', name: 'Command', modifier: 'meta' }, { label: 'K', name: 'K', key: 'KeyK' }]
//   modifierLabel('alt', { platform: 'mac', style: 'both' })   // '⌥ Option'
//
// Modifier order. By default modifiers come in the platform's own order,
// whatever order the string was written in: on macOS Apple's ⌃⌥⇧⌘
// (Control, Option, Shift, Command), the order every Mac menu shows; on
// Windows, Linux and ChromeOS Win/Super/Search, Ctrl, Alt, Shift. Pass
// `{ order: 'combo' }` to keep the order the string was written in.
//
// Styles. 'text' (default for formatCombo): words joined by '+'. 'glyphs'
// (default for comboTokens): macOS modifier and key symbols (⌘ ⇧ ⌥ ⌃ ↩ ⌫ ←),
// joined with no separator; Windows, Linux and ChromeOS have no such
// symbols, so 'glyphs' there gives the same words as 'text'. 'both'
// (modifierLabel only): glyph and word, '⌥ Option'.
//
// Imports only the shared parser and detector, never the core router.

import { readHotkey, normalizeKey } from './parse.js'
import { detectPlatform, platformLabel, browserLabel } from './platform.js'

export { platformLabel, browserLabel }

/** @typedef {'mac' | 'windows' | 'linux' | 'chromeos'} FormatPlatform */
/** @typedef {'text' | 'glyphs'} FormatStyle */
/** @typedef {'ctrl' | 'alt' | 'shift' | 'meta'} Modifier */

// label: on-screen word; glyph: macOS symbol; name: what a screen reader says.
const MAC_MODIFIERS = {
  ctrl: { label: 'Control', glyph: '⌃', name: 'Control' },
  alt: { label: 'Option', glyph: '⌥', name: 'Option' },
  shift: { label: 'Shift', glyph: '⇧', name: 'Shift' },
  meta: { label: 'Cmd', glyph: '⌘', name: 'Command' },
}
const PC_MODIFIERS = {
  ctrl: { label: 'Ctrl', name: 'Control' },
  alt: { label: 'Alt', name: 'Alt' },
  shift: { label: 'Shift', name: 'Shift' },
  meta: { label: 'Win', name: 'Windows' },
}
const META_BY_PLATFORM = {
  linux: { label: 'Super', name: 'Super' },
  chromeos: { label: 'Search', name: 'Search' },
}

const ORDER = {
  mac: ['ctrl', 'alt', 'shift', 'meta'],
  pc: ['meta', 'ctrl', 'alt', 'shift'],
}

/**
 * Display names for `KeyboardEvent.code` values (the `code:` part of a
 * hotkey). `label` is the on-screen text, `name` what a screen reader says;
 * `mac`/`macName` replace them on macOS, `glyph` is the macOS symbol.
 * Letters (`KeyA`), digits (`Digit1`, `Numpad1`) and `F1`-`F24` are derived,
 * not listed.
 *
 * @type {Readonly<Record<string, Readonly<{ label: string, name: string, mac?: string, macName?: string, glyph?: string }>>>}
 */
export const KEY_LABELS = Object.freeze({
  Period: { label: '.', name: 'Period' },
  Comma: { label: ',', name: 'Comma' },
  Semicolon: { label: ';', name: 'Semicolon' },
  Quote: { label: "'", name: 'Quote' },
  Slash: { label: '/', name: 'Slash' },
  Backslash: { label: '\\', name: 'Backslash' },
  IntlBackslash: { label: '\\', name: 'Backslash' },
  BracketLeft: { label: '[', name: 'Left Bracket' },
  BracketRight: { label: ']', name: 'Right Bracket' },
  Minus: { label: '-', name: 'Minus' },
  Equal: { label: '=', name: 'Equals' },
  Backquote: { label: '`', name: 'Backquote' },
  Space: { label: 'Space', name: 'Space' },
  Enter: { label: 'Enter', name: 'Enter', mac: 'Return', glyph: '↩' },
  NumpadEnter: { label: 'Enter', name: 'Enter', mac: 'Enter', glyph: '⌤' },
  Tab: { label: 'Tab', name: 'Tab', glyph: '⇥' },
  Backspace: { label: 'Backspace', name: 'Backspace', mac: 'Delete', glyph: '⌫' },
  Delete: { label: 'Delete', name: 'Delete', mac: 'Forward Delete', glyph: '⌦' },
  Escape: { label: 'Esc', name: 'Escape', glyph: '⎋' },
  Insert: { label: 'Insert', name: 'Insert' },
  Home: { label: 'Home', name: 'Home', glyph: '↖' },
  End: { label: 'End', name: 'End', glyph: '↘' },
  PageUp: { label: 'Page Up', name: 'Page Up', glyph: '⇞' },
  PageDown: { label: 'Page Down', name: 'Page Down', glyph: '⇟' },
  ArrowUp: { label: 'Up', name: 'Up Arrow', glyph: '↑' },
  ArrowDown: { label: 'Down', name: 'Down Arrow', glyph: '↓' },
  ArrowLeft: { label: 'Left', name: 'Left Arrow', glyph: '←' },
  ArrowRight: { label: 'Right', name: 'Right Arrow', glyph: '→' },
  CapsLock: { label: 'Caps Lock', name: 'Caps Lock', glyph: '⇪' },
  ContextMenu: { label: 'Menu', name: 'Menu' },
  NumpadAdd: { label: 'Num +', name: 'Numpad Plus' },
  NumpadSubtract: { label: 'Num -', name: 'Numpad Minus' },
  NumpadMultiply: { label: 'Num *', name: 'Numpad Multiply' },
  NumpadDivide: { label: 'Num /', name: 'Numpad Divide' },
  NumpadDecimal: { label: 'Num .', name: 'Numpad Decimal' },
})

// `event.key` values (as the parser normalizes them) that name a code above.
const KEY_TO_CODE = {
  '.': 'Period', ',': 'Comma', ';': 'Semicolon', "'": 'Quote', '/': 'Slash',
  '\\': 'Backslash', '[': 'BracketLeft', ']': 'BracketRight', '-': 'Minus',
  '=': 'Equal', '`': 'Backquote', ' ': 'Space', enter: 'Enter', tab: 'Tab',
  backspace: 'Backspace', delete: 'Delete', escape: 'Escape', insert: 'Insert',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight', capslock: 'CapsLock', contextmenu: 'ContextMenu',
}

const KEY_NAMES = { '+': 'Plus', '*': 'Asterisk', '?': 'Question Mark', '!': 'Exclamation Mark' }

function resolvePlatform(platform) {
  return platform || detectPlatform(undefined, { chromeos: true }) || 'windows'
}

function modifierInfo(mod, platform) {
  if (platform === 'mac') return MAC_MODIFIERS[mod]
  if (mod === 'meta' && META_BY_PLATFORM[platform]) return META_BY_PLATFORM[platform]
  return PC_MODIFIERS[mod]
}

// A key or code as { label, name, glyph? } for the platform.
function keyInfo({ key, code }, platform) {
  const mac = platform === 'mac'
  let c = code
  if (!c && key != null) {
    c = KEY_TO_CODE[key]
    if (!c && /^[a-z]$/.test(key)) c = 'Key' + key.toUpperCase()
    if (!c && /^\d$/.test(key)) c = 'Digit' + key
    if (!c && /^f\d{1,2}$/.test(key)) c = key.toUpperCase()
  }
  if (c) {
    const known = KEY_LABELS[c]
    if (known) {
      const label = mac && known.mac ? known.mac : known.label
      return { label, name: mac && known.mac ? known.mac : known.name, glyph: mac ? known.glyph : undefined }
    }
    const letter = /^Key([A-Z])$/.exec(c)
    if (letter) return { label: letter[1], name: letter[1] }
    const digit = /^Digit(\d)$/.exec(c)
    if (digit) return { label: digit[1], name: digit[1] }
    const numpad = /^Numpad(\d)$/.exec(c)
    if (numpad) return { label: `Num ${numpad[1]}`, name: `Numpad ${numpad[1]}` }
    if (/^F\d{1,2}$/.test(c)) return { label: c, name: c }
    if (code) return { label: code, name: code }
  }
  // Any other `event.key` value: a character as typed, a word capitalized.
  const k = String(key ?? '')
  if (k.length === 1) return { label: k.toUpperCase(), name: KEY_NAMES[k] || k.toUpperCase() }
  const word = k.charAt(0).toUpperCase() + k.slice(1)
  return { label: word, name: word }
}

// Parse a string (or take a parsed combo) into ordered parts.
function partsOf(combo, platform, order) {
  let c = combo
  let written = null
  if (typeof combo === 'string') {
    c = readHotkey(combo, { platform }).combo
    if (order === 'combo') written = writtenModifiers(combo, platform)
  }
  if (!c) return null
  const mods = /** @type {Modifier[]} */ (['ctrl', 'alt', 'shift', 'meta'].filter((m) => c[m] || c.bareModifier === m))
  const sequence = written
    ? [...written.filter((m) => mods.includes(m)), ...mods.filter((m) => !written.includes(m))]
    : (platform === 'mac' ? ORDER.mac : ORDER.pc).filter((m) => mods.includes(m))
  const hasKey = !c.bareModifier && (c.key != null || c.code != null)
  return { mods: sequence, key: hasKey ? { key: c.key ?? null, code: c.code ?? null } : null }
}

// Modifiers in the order the string names them (`shift+mod+k` -> shift, meta).
function writtenModifiers(str, platform) {
  const out = []
  const raw = String(str).replace(/\s+up$/i, '')
  // AHK prefixes first, then '+'-separated tokens.
  let i = 0
  const ahk = { '^': 'ctrl', '!': 'alt', '+': 'shift', '#': 'meta' }
  while (i < raw.length && ahk[raw[i]] && raw[i + 1] !== undefined) {
    out.push(ahk[raw[i]])
    i++
  }
  for (const token of raw.slice(i).split('+')) {
    const t = normalizeKey(token)
    const m = t === 'mod' ? (platform === 'mac' ? 'meta' : 'ctrl') : t
    if (['ctrl', 'alt', 'shift', 'meta'].includes(m) && !out.includes(m)) out.push(m)
  }
  return out
}

/**
 * A modifier as this platform names it. Accepts `ctrl`, `alt`, `shift`,
 * `meta`, `mod` (Cmd on macOS, Ctrl elsewhere) and their aliases (`cmd`,
 * `option`, `opt`, `win`, `control`, `⌘`).
 *
 * @param {string} name
 * @param {{ platform?: FormatPlatform, style?: 'text' | 'glyphs' | 'both' }} [opts]
 * @returns {string}
 */
export function modifierLabel(name, { platform, style = 'text' } = {}) {
  const plat = resolvePlatform(platform)
  let mod = normalizeKey(name)
  if (mod === 'mod') mod = plat === 'mac' ? 'meta' : 'ctrl'
  const info = modifierInfo(mod, plat)
  if (!info) return String(name)
  if (style === 'glyphs' && info.glyph) return info.glyph
  if (style === 'both' && info.glyph) return `${info.glyph} ${info.label}`
  return info.label
}

/**
 * What a screen reader should say for a modifier: 'Command', 'Option',
 * 'Control', 'Shift', 'Alt', 'Windows', 'Super', 'Search'.
 *
 * @param {string} name
 * @param {{ platform?: FormatPlatform }} [opts]
 * @returns {string}
 */
export function modifierName(name, { platform } = {}) {
  const plat = resolvePlatform(platform)
  let mod = normalizeKey(name)
  if (mod === 'mod') mod = plat === 'mac' ? 'meta' : 'ctrl'
  return modifierInfo(mod, plat)?.name ?? String(name)
}

/**
 * The label for one key: a `code:` value (`code:Period`, `KeyK`) or an
 * `event.key` value (`.`, `k`, `Enter`, `ArrowUp`).
 *
 * @param {string} key
 * @param {{ platform?: FormatPlatform, style?: FormatStyle }} [opts]
 * @returns {string}
 */
export function keyLabel(key, { platform, style = 'text' } = {}) {
  const plat = resolvePlatform(platform)
  const info = keyInfo(toKeyRef(key), plat)
  return style === 'glyphs' && info.glyph ? info.glyph : info.label
}

function toKeyRef(key) {
  const s = String(key ?? '')
  const code = /^code:(.+)$/.exec(s)?.[1] ?? (/^[A-Z][A-Za-z0-9]+$/.test(s) && (KEY_LABELS[s] || /^(Key[A-Z]|Digit\d|Numpad\d|F\d{1,2})$/.test(s)) ? s : null)
  return code ? { code } : { key: normalizeKey(s) }
}

/**
 * @typedef {{
 *   label: string,
 *   name: string,
 *   modifier?: Modifier,
 *   key?: string
 * }} ComboToken
 *
 * `label` is what the keycap shows; `name` what a screen reader should say
 * (put it in visually hidden text or `aria-label` when `label` is a glyph).
 * `modifier` is set on modifier tokens; `key` on the base key token (the
 * `code` value, or the `event.key` value for key-based combos).
 */

/**
 * One keycap per key, modifiers first. Default style 'glyphs': ⌘ ⇧ ⌥ ⌃ on
 * macOS, words elsewhere.
 *
 * @param {string | object | null} combo  hotkey string or parsed combo
 * @param {{ platform?: FormatPlatform, style?: FormatStyle, order?: 'platform' | 'combo' }} [opts]
 * @returns {ComboToken[]}
 */
export function comboTokens(combo, { platform, style = 'glyphs', order = 'platform' } = {}) {
  if (combo == null || combo === '') return []
  const plat = resolvePlatform(platform)
  const parts = partsOf(combo, plat, order)
  if (!parts) return []
  const glyphs = style === 'glyphs' && plat === 'mac'
  const tokens = parts.mods.map((m) => {
    const info = modifierInfo(m, plat)
    return { label: glyphs ? info.glyph : info.label, name: info.name, modifier: m }
  })
  if (parts.key) {
    const info = keyInfo(parts.key, plat)
    tokens.push({ label: glyphs && info.glyph ? info.glyph : info.label, name: info.name, key: parts.key.code ?? parts.key.key })
  }
  return tokens
}

/**
 * A hotkey as one string: 'Ctrl+Shift+.' (text) or '⇧⌘.' (glyphs, macOS).
 * Empty string for an empty combo.
 *
 * @param {string | object | null} combo  hotkey string or parsed combo
 * @param {{
 *   platform?: FormatPlatform,
 *   style?: FormatStyle,
 *   order?: 'platform' | 'combo',
 *   separator?: string     // default '+' ('' for macOS glyphs)
 * }} [opts]
 * @returns {string}
 */
export function formatCombo(combo, { platform, style = 'text', order = 'platform', separator } = {}) {
  const plat = resolvePlatform(platform)
  const tokens = comboTokens(combo, { platform: plat, style, order })
  const sep = separator ?? (style === 'glyphs' && plat === 'mac' ? '' : '+')
  return tokens.map((t) => t.label).join(sep)
}

/**
 * The words for a list of modifiers, for sentences: ['ctrl', 'alt', 'shift']
 * -> 'Ctrl, Alt or Shift'.
 *
 * @param {string[]} names
 * @param {{ platform?: FormatPlatform, conjunction?: string }} [opts]
 * @returns {string}
 */
export function listModifiers(names, { platform, conjunction = 'or' } = {}) {
  const labels = names.map((n) => modifierLabel(n, { platform }))
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} ${conjunction} ${labels[labels.length - 1]}`
}
