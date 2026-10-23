// parse.js
// The one hotkey-string parser. The core router binds with it; sites,
// validate and format read combos with it, so `opt`, `ctrl++`, `^k` and
// `mod` mean the same thing everywhere. No state, no side effects.

import { detectPlatform } from './platform.js'

// `mod` is the platform's primary modifier: meta on macOS, ctrl elsewhere.
const DEFAULT_PLATFORM = detectPlatform()

const modifierTokens = new Set(['ctrl', 'shift', 'alt', 'meta', 'mod'])

const ahkPrefixMap = new Map([
  ['^', 'ctrl'],  // Ctrl
  ['!', 'alt'],   // Alt
  ['+', 'shift'], // Shift
  ['#', 'meta'],  // Win / Command
])

export const keyAliases = Object.freeze({
  // common
  esc: 'escape',
  escape: 'escape',
  space: ' ',
  spacebar: ' ',
  enter: 'enter',
  return: 'enter',
  del: 'delete',
  delete: 'delete',
  backspace: 'backspace',
  tab: 'tab',

  // arrows
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',

  // navigation
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
  pgup: 'pageup',
  pgdn: 'pagedown',

  // modifiers (words)
  cmd: 'meta',
  command: 'meta',
  win: 'meta',
  meta: 'meta',
  control: 'ctrl',
  ctrl: 'ctrl',
  option: 'alt',
  opt: 'alt',
  alt: 'alt',
  shift: 'shift',

  // modifiers (symbols)
  '⌘': 'meta',
  '⌃': 'ctrl',
  '⌥': 'alt',
  '⇧': 'shift',

  // cross-platform "mod", resolved per platform while parsing
  mod: 'mod',

  // plus key ergonomics
  plus: '+',
})

export function normalizeKey(key) {
  const original = String(key ?? '')
  // A lone space IS the spacebar key — `.trim()` would erase it to '', so guard
  // on the ORIGINAL before trimming. (The `space`/`spacebar` aliases resolve to
  // ' ' and land here; without this, `space` bindings collapse to no base key.)
  if (original === ' ') return ' '
  const trimmed = original.trim()
  const k = trimmed.toLowerCase()
  return keyAliases[k] ?? k
}

function isModifierToken(token) {
  return modifierTokens.has(normalizeKey(token))
}

// Matches `code:KeyX` (case-sensitive value). Used to extract code tokens BEFORE
// the rest of the parser lowercases everything, since KeyboardEvent.code values
// are camelCase (KeyA, Digit1, ArrowLeft) and must be preserved.
const CODE_TOKEN_RE = /(^|\+)code:([A-Za-z][A-Za-z0-9_]*)/

/**
 * Lenient parse: never throws. `error` holds the message `parseHotkey` would
 * throw; the combo is filled in as far as the string allows.
 *
 * @param {string} hotkeyStr
 * @param {{ platform?: string | null }} [opts]
 */
export function readHotkey(hotkeyStr, { platform = DEFAULT_PLATFORM } = {}) {
  const raw = String(hotkeyStr || '').trim()
  let error = null
  const fail = (msg) => { error = error || `Invalid hotkey "${hotkeyStr}": ${msg}` }

  // Detect ' up' suffix case-insensitively so 'Alt UP' works the same as 'alt up'.
  const isUp = /\s+up$/i.test(raw)
  const baseRaw = isUp ? raw.replace(/\s+up$/i, '').trim() : raw

  const combo = {
    ctrl: false, shift: false, alt: false, meta: false,
    key: null, code: null, bareModifier: null,
  }
  const setMod = (mod) => {
    if (mod === 'mod') combo[platform === 'mac' ? 'meta' : 'ctrl'] = true
    else combo[mod] = true
  }

  // --- AHK-style prefix modifiers ---
  // Examples:
  //  ^k    => ctrl+k
  //  !k    => alt+k
  //  +k    => shift+k
  //  #k    => meta+k
  //  ^!k   => ctrl+alt+k
  //  !code:KeyX => alt+code:KeyX
  //
  // We strip these BEFORE both the code-token extraction AND the lowercase
  // pass, because the AHK prefix chars (^ ! + #) are case-stable, and the
  // remainder may contain a case-sensitive `code:KeyX` token that must survive.
  let stripped = baseRaw
  while (stripped.length) {
    const mod = ahkPrefixMap.get(stripped[0]) ?? null
    if (!mod) break
    setMod(mod)
    stripped = stripped.slice(1).trimStart()
  }

  // Pull out a code:XXX token before lowercasing; preserve the camelCase value.
  // Reject multiple code: tokens to avoid silent loss of intent.
  const codeMatches = stripped.match(/code:[A-Za-z][A-Za-z0-9_]*/g)
  if (codeMatches && codeMatches.length > 1) {
    fail(`multiple code: tokens not supported (got ${codeMatches.length}).`)
  }
  let codeValue = null
  const scrubbed = stripped.replace(CODE_TOKEN_RE, (_, sep, val) => {
    codeValue = val
    return sep + '__code__'
  })

  const cleanStr = scrubbed.toLowerCase()

  // Allow plus key:
  //  - "ctrl++" => ctrl + "+"
  //  - "++"     => shift + "+" (AHK '+' prefix sets shift, remaining '+' becomes the base key)
  // `split('+')` produces empties; we keep that signal.
  const rawParts = cleanStr.split('+').map((p) => p.trim())
  const parts = rawParts.filter(Boolean)
  const impliedPlusKey = rawParts.some((p) => p === '') && cleanStr.includes('++')

  // Enforce: modifiers must come before the base key.
  // Example: "ctrl+k" ✅  |  "k+ctrl" ❌
  // We ignore the special "+ key" case (ctrl++) since it has no explicit base token.
  if (!impliedPlusKey) {
    let seenBase = false
    for (const part of parts) {
      if (isModifierToken(part)) {
        if (seenBase) fail('modifiers must come before the base key (e.g. "ctrl+k", not "k+ctrl")')
      } else {
        seenBase = true
      }
    }
  }

  // Continue parsing the remaining tokens (words/symbols/aliases)
  for (const part of parts) {
    if (part === '__code__') {
      combo.code = codeValue
      continue
    }
    const actual = keyAliases[part] ?? part
    if (modifierTokens.has(actual)) setMod(actual)
    else combo.key = normalizeKey(actual)
  }

  if (!combo.key && !combo.code && impliedPlusKey) combo.key = '+'

  // If no base key/code is set, this might be a bare-modifier binding ('alt' / 'ctrl').
  // Allow exactly ONE modifier with no other tokens. Multi-modifier bare bindings
  // (e.g. 'ctrl+alt') are intentionally rejected — add a base key for those.
  if (!combo.key && !combo.code) {
    const modCount =
      (combo.ctrl ? 1 : 0) + (combo.shift ? 1 : 0) +
      (combo.alt ? 1 : 0) + (combo.meta ? 1 : 0)

    if (modCount === 1) {
      combo.bareModifier =
        combo.ctrl ? 'ctrl' :
        combo.shift ? 'shift' :
        combo.alt ? 'alt' : 'meta'
    } else if (modCount > 1) {
      fail('multi-modifier bare bindings not supported. Add a base key (e.g. "ctrl+alt+x").')
    } else {
      error = error || `Invalid hotkey "${hotkeyStr}" (missing base key)`
    }
  }

  return { combo, type: isUp ? 'keyup' : 'keydown', raw: hotkeyStr, error }
}

/**
 * Parse a hotkey string into modifier flags plus a `key` (normalized
 * `KeyboardEvent.key`), a `code` (`KeyboardEvent.code`) or a bare modifier.
 * `mod` resolves for `opts.platform` (default: this machine). Throws on
 * strings the router can't bind.
 *
 * @param {string} hotkeyStr
 * @param {{ platform?: 'mac' | 'windows' | 'linux' | 'chromeos' | null }} [opts]
 * @returns {{
 *   combo: { ctrl: boolean, shift: boolean, alt: boolean, meta: boolean, key: string | null, code: string | null, bareModifier: 'ctrl' | 'shift' | 'alt' | 'meta' | null },
 *   type: 'keydown' | 'keyup',
 *   raw: string
 * }}
 */
export function parseHotkey(hotkeyStr, opts) {
  const { combo, type, raw, error } = readHotkey(hotkeyStr, opts)
  if (error) throw new Error(error)
  return { combo, type, raw }
}

// --- shifted punctuation -----------------------------------------------------

// Punctuation whose Shift character differs on a US layout. With Shift held,
// `event.key` is the shifted character, so a key-based `ctrl+shift+,` waits
// for a ',' that never arrives (the event says '<').
const SHIFTED_PUNCT = {
  ',': ['<', 'Comma'], '.': ['>', 'Period'], '/': ['?', 'Slash'],
  ';': [':', 'Semicolon'], "'": ['"', 'Quote'], '[': ['{', 'BracketLeft'],
  ']': ['}', 'BracketRight'], '\\': ['|', 'Backslash'], '-': ['_', 'Minus'],
  '=': ['+', 'Equal'], '`': ['~', 'Backquote'],
}

/**
 * For a key-based combo with Shift and one of `, . / ; ' [ ] \ - = \``, the
 * message explaining it never fires on US layouts and the `code:` spelling
 * to bind instead (written the way the input was). Null for anything else,
 * including strings that do not parse.
 *
 * @param {string} hotkeyStr
 * @returns {{ message: string, suggestion: string } | null}
 */
export function shiftedPunctuationHint(hotkeyStr) {
  const { combo, type, error } = readHotkey(hotkeyStr)
  if (error || !combo.shift || combo.code) return null
  const shifted = SHIFTED_PUNCT[combo.key]
  if (!shifted) return null
  const [typed, code] = shifted

  // The base key is the last character before any ' up'; swap just that.
  const base = String(hotkeyStr).trim().replace(/\s+up$/i, '')
  const suggestion = base.slice(0, -1) + 'code:' + code + (type === 'keyup' ? ' up' : '')
  return {
    message: `"${hotkeyStr}" never fires on US layouts: Shift turns "${combo.key}" into "${typed}". Bind "${suggestion}" instead.`,
    suggestion,
  }
}

// --- canonical lookup names (reservation + site tables) ----------------------

// Punctuation typed as `event.key` maps to the names the data tables use for
// `code:` values, so `meta+shift+/` and `meta+shift+code:Slash` find the same
// row. `+` is Shift+= on most layouts, and browsers treat Ctrl++ as Ctrl+=
// (zoom in), so it looks up as `equal`.
const PUNCT_NAMES = {
  '.': 'period', ',': 'comma', ';': 'semicolon', "'": 'quote', '/': 'slash',
  '\\': 'backslash', '[': 'bracketleft', ']': 'bracketright', '-': 'minus',
  '=': 'equal', '`': 'backquote', ' ': 'space', '+': 'equal',
}

/** `KeyA` -> `a`, `Digit1`/`Numpad1` -> `1`, `ArrowLeft` -> `arrowleft`. */
export function codeToBase(code) {
  if (!code) return null
  const letter = /^Key([A-Za-z])$/.exec(code)
  if (letter) return letter[1].toLowerCase()
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)
  if (digit) return digit[1]
  return code.toLowerCase()
}

/** `'.'` -> `period`, `'Esc'` -> `escape`, `'K'` -> `k`. */
export function keyToBase(key) {
  if (key == null || key === '') return null
  if (PUNCT_NAMES[key]) return PUNCT_NAMES[key]
  const k = normalizeKey(key)
  return PUNCT_NAMES[k] || k || null
}

/**
 * The canonical lookup key for a parsed combo: modifiers in the order ctrl,
 * meta, alt, shift, then the base name (`ctrl+shift+period`). Null for a bare
 * modifier or no key.
 *
 * @param {{ ctrl?: boolean, meta?: boolean, alt?: boolean, shift?: boolean, key?: string | null, code?: string | null, bareModifier?: string | null } | null} combo
 * @returns {string | null}
 */
export function lookupKey(combo) {
  if (!combo || combo.bareModifier) return null
  const base = combo.code ? codeToBase(combo.code) : keyToBase(combo.key)
  if (!base) return null
  const parts = []
  if (combo.ctrl) parts.push('ctrl')
  if (combo.meta) parts.push('meta')
  if (combo.alt) parts.push('alt')
  if (combo.shift) parts.push('shift')
  parts.push(base)
  return parts.join('+')
}
