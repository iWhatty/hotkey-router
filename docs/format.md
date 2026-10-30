# Showing a hotkey to people

`hotkey-router/format` turns a hotkey string, or a parsed combo, into what
people read: `Ctrl+Shift+.` on Windows and Linux, `⇧⌘.` or `Shift+Cmd+.` on
macOS, and keycaps with names a screen reader can say. It loads no data
tables and imports only the shared parser, never the router: about 8.6 KB
minified (~3.5 KB gzipped).

```js
import { formatCombo, comboTokens, modifierLabel } from 'hotkey-router/format'

formatCombo('mod+shift+code:Period', { platform: 'windows' })              // 'Ctrl+Shift+.'
formatCombo('mod+shift+code:Period', { platform: 'mac' })                  // 'Shift+Cmd+.'
formatCombo('mod+shift+code:Period', { platform: 'mac', style: 'glyphs' }) // '⇧⌘.'

comboTokens('mod+shift+code:Period', { platform: 'mac' })
// [{ label: '⇧', name: 'Shift',   modifier: 'shift' },
//  { label: '⌘', name: 'Command', modifier: 'meta' },
//  { label: '.', name: 'Period',  key: 'Period' }]

modifierLabel('alt', { platform: 'mac', style: 'both' }) // '⌥ Option'
modifierLabel('mod')                                      // 'Cmd' on macOS, 'Ctrl' elsewhere
```

`platform` is `'mac'`, `'windows'`, `'linux'` or `'chromeos'`, and defaults
to the machine the code runs on (`detectPlatform()`, with ChromeOS told
apart; `'windows'` when it can't tell). It also decides what `mod` means.

## Functions

| Function | Returns |
| --- | --- |
| `formatCombo(hotkey, { platform, style, order, separator })` | One string. `style: 'text'` (default) joins words with `+`; `'glyphs'` uses the macOS symbols (⌃ ⌥ ⇧ ⌘ ↩ ⌫ ⎋ ← …) with no separator. `separator` overrides the joiner, e.g. `' + '`. |
| `comboTokens(hotkey, { platform, style, order })` | One keycap per key, `{ label, name, modifier?, key? }`; `'glyphs'` by default. `name` is what a screen reader should say: put it in visually hidden text or `aria-label` next to a glyph. |
| `modifierLabel(name, { platform, style })` | One modifier: `'text'`, `'glyphs'` or `'both'` (`'⌥ Option'`). Takes `mod` and the aliases (`cmd`, `option`, `win`, `⌘`, …). |
| `modifierName(name, { platform })` | The spoken name: `Command`, `Option`, `Control`, `Alt`, `Windows`, `Super`, `Search`. |
| `keyLabel(key, { platform, style })` | One key, given as a `code:` value (`code:Enter`, `KeyK`) or an `event.key` value (`.`, `k`, `enter`). |
| `listModifiers(names, { platform, conjunction })` | For sentences: `['ctrl', 'alt', 'shift']` → `'Ctrl, Alt or Shift'`. |
| `platformLabel(platform)` / `browserLabel(browser)` | `'mac'` → `'macOS'`, `'edge'` → `'Edge'`. |
| `KEY_LABELS` | Label and spoken name per `KeyboardEvent.code` value, with macOS variants and glyphs (`Enter` → Enter, Return on macOS, ↩). Letters, digits and F-keys are derived, not listed. |

`formatCombo` and `comboTokens` take a hotkey string or a parsed combo (from `parseHotkey`, or the one
an `onBind` hook receives). An empty hotkey formats as `''` (`[]` tokens).

## Words per platform

| Platform | Ctrl | Alt | Shift | Meta |
| --- | --- | --- | --- | --- |
| macOS | Control ⌃ | Option ⌥ | Shift ⇧ | Cmd ⌘ (spoken "Command") |
| Windows | Ctrl | Alt | Shift | Win |
| Linux | Ctrl | Alt | Shift | Super |
| ChromeOS | Ctrl | Alt | Shift | Search |

Windows, Linux and ChromeOS have no modifier symbols, so `'glyphs'` gives the
same words as `'text'` there. Some keys change name on macOS: Enter is
Return, Backspace is Delete, Delete is Forward Delete.

## Modifier order

Modifiers come in the platform's own order whatever order the string is
written in:

- macOS: Apple's ⌃⌥⇧⌘ (Control, Option, Shift, Command), the order every Mac
  menu shows, so `mod+shift+code:Period` is `⇧⌘.`.
- Windows, Linux and ChromeOS: Win/Super/Search, Ctrl, Alt, Shift.

Pass `{ order: 'combo' }` to keep the written order (`⌘⇧.`).
