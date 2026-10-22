# SpellBolt: what to delete after upgrading to hotkey-router 0.3.2

Date: 2026-10-22. Applies once 0.3.2 is on npm and SpellBolt depends on
`^0.3.2`. SpellBolt was not changed as part of this release.

## Delete, and import from hotkey-router instead

| SpellBolt | Replace with |
|---|---|
| `src/panel/typoHotkeyPairs.js` `OS_RESERVED_HOTKEYS` (:84-96) and `isOsReservedHotkey` | `lookupReservation` / `validateCombo` (0.3.1 reserves Cmd+Shift+/ on macOS) |
| `typoHotkeyPairs.js` `KEY_NAMES` (:147) and `keyLabel` | `keyLabel` / `KEY_LABELS` from `hotkey-router/format` |
| `typoHotkeyPairs.js` `formatHotkey` (:160) | `formatCombo(combo, { platform })` |
| `typoHotkeyPairs.js` `MAC_MODIFIER_GLYPHS`, `PC_MODIFIER_NAMES`, `hotkeyTokens` (:186-210) | `comboTokens(combo, { platform })` (tokens are `{ label, name }`; `name` replaces `KEY_GLYPH_NAMES`) |
| `typoHotkeyPairs.js` `KEY_GLYPH_NAMES` | the `name` field of each `comboTokens` token, or `modifierName` |
| `typoHotkeyPairs.js` `altKeyLabel` (:259) | `modifierLabel('alt', { style: 'both' })` -> '⌥ Option' / 'Alt' |
| `typoHotkeyPairs.js` `isMacPlatform` (:263) | `detectPlatform() === 'mac'` (from `hotkey-router`) |
| `src/google/googleDocsKeyForwarding.js` `isMacPlatform` (:104) | same |
| `src/genie-ai/AIResponsePanelMini.js` `isMacPlatform` (:802) | same |

## Behaviour differences to decide on

- **Modifier order.** `formatCombo`/`comboTokens` put modifiers in the
  platform's order by default: Apple's ⌃⌥⇧⌘ on macOS, so
  `mod+shift+code:Period` is `⇧⌘.` (SpellBolt shows `⌘⇧.`). Pass
  `{ order: 'combo' }` to keep SpellBolt's current written order; its test
  that `describeTypoHotkey` and the keycaps agree relies on that.
- **Mac text.** `formatCombo(..., { platform: 'mac' })` writes words
  (`Shift+Cmd+.`); SpellBolt's `formatHotkey` writes `⌘+Shift+.`. For glyphs
  use `style: 'glyphs'` (no separator by default; pass `separator: '+'` for
  `⌘+⇧+.`).
- `Control` (not `Ctrl`) on macOS, `Cmd` for meta, `Win` for meta on
  Windows, `Super` on Linux. `NumpadEnter` is `Enter` (macOS glyph `⌤`).
- `options.mac` booleans become `{ platform: 'mac' | 'windows' | 'linux' }`.
