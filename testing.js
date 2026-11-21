// Synthetic hotkey events for tests and automation.
import { ownValue } from './lookup.js'
import { normalizeKey, parseHotkey } from './parse.js'

// Reverse map: 'alt' -> 'Alt' (the KeyboardEvent.key value for that bare modifier).
// Used to populate the synthetic event's `.key` field so consumer handlers that
// inspect `e.key` see the same value they'd get from a real event.
const BARE_MOD_TO_KEY = {
  ctrl: 'Control',
  shift: 'Shift',
  alt: 'Alt',
  meta: 'Meta',
}

// `code` <-> `key` for the synthetic event, so trigger(router, 'ctrl+k') also fires
// a `ctrl+code:KeyK` binding and the reverse. US layout, like any
// automation that has to guess what a physical key types.
const CODE_TO_KEY = {
  Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Slash: '/', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
  Space: ' ', Enter: 'Enter', NumpadEnter: 'Enter', Tab: 'Tab', Escape: 'Escape',
  Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
}
const KEY_TO_CODE = {}
for (const [code, key] of Object.entries(CODE_TO_KEY)) {
  KEY_TO_CODE[normalizeKey(key)] ??= code
}

function keyForCode(code) {
  if (!code) return null
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1].toLowerCase()
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)
  if (digit) return digit[1]
  if (/^F\d{1,2}$/.test(code)) return code
  return ownValue(CODE_TO_KEY, code) ?? null
}

function codeForKey(key) {
  if (!key) return null
  if (/^[a-z]$/.test(key)) return 'Key' + key.toUpperCase()
  if (/^\d$/.test(key)) return 'Digit' + key
  if (/^f\d{1,2}$/.test(key)) return key.toUpperCase()
  return ownValue(KEY_TO_CODE, key) ?? null
}

/**
 * Programmatically fire the binding a real keypress of `hotkeyStr` would
 * fire. Used by tests and automation; not a typical app-runtime path. The
 * synthetic event carries both `key` and `code` (US layout), so key-based
 * and `code:` bindings both match, and the same guards apply as for a real
 * event: `when`, `ignoreInput`/`allowIn` (pass `target` to fire "from" an
 * element), priority, `once`, and `pause()`. Returns `true` if a handler ran.
 *
 * @param {Pick<import('./core.js').Router, 'dispatch'>} router
 * @param {string} hotkeyStr
 * @param {{ type?: 'keydown' | 'keyup', target?: EventTarget | null }} [opts]
 * @returns {boolean}
 */
export function trigger(router, hotkeyStr, { type: forcedType, target = null } = {}) {
  const { combo, type } = parseHotkey(hotkeyStr)
  const actualType = forcedType || type

  // Fill `.key` from bareModifier when the binding is bare-modifier-only;
  // otherwise from combo.key, or the key a `code:` value types.
  const eventKey = combo.bareModifier
    ? ownValue(BARE_MOD_TO_KEY, combo.bareModifier)
    : combo.key ?? keyForCode(combo.code)
  const eventCode = combo.bareModifier
    ? null
    : combo.code ?? codeForKey(combo.key)

  // For bare-modifier keyup, real KeyboardEvents have the corresponding
  // modifier flag FALSE (the modifier just released). Mirror that so
  // automation handlers that inspect e.altKey / e.ctrlKey / etc. see the
  // same value they'd see from a real event.
  let altKey = !!combo.alt
  let ctrlKey = !!combo.ctrl
  let shiftKey = !!combo.shift
  let metaKey = !!combo.meta
  if (combo.bareModifier && actualType === 'keyup') {
    if (combo.bareModifier === 'alt') altKey = false
    else if (combo.bareModifier === 'ctrl') ctrlKey = false
    else if (combo.bareModifier === 'shift') shiftKey = false
    else if (combo.bareModifier === 'meta') metaKey = false
  }

  const e = {
    type: actualType,
    key: eventKey,
    code: eventCode,
    ctrlKey, shiftKey, altKey, metaKey,
    repeat: false,
    isComposing: false,
    getModifierState() { return false },
    preventDefault() { },
    stopPropagation() { },
    stopImmediatePropagation() { },
    target,
  }

  return router.dispatch(e, actualType)
}
