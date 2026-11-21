import { ownValue } from './lookup.js'
import { readHotkey } from './parse.js'

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
// Digits too: Shift+1 types '!' on US layouts.
for (let d = 0; d < 10; d++) SHIFTED_PUNCT[d] = [')!@#$%^&*('[d], 'Digit' + d]

/**
 * For a key-based combo with Shift and one of `, . / ; ' [ ] \ - = \``, the
 * message explaining it never fires on US layouts and the `code:` spelling
 * to bind instead (written the way the input was). Null for anything else,
 * including strings that do not parse.
 *
 * @param {string} hotkeyStr
 * @param {Pick<ReturnType<typeof readHotkey>, 'combo' | 'type'> & { error?: string | null }} [parsed]
 * @returns {{ message: string, suggestion: string } | null}
 */
export function shiftedPunctuationHint(hotkeyStr, { combo, type, error } = readHotkey(hotkeyStr)) {
  if (error || !combo.shift || combo.code) return null
  const shifted = ownValue(SHIFTED_PUNCT, combo.key)
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
