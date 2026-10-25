# SpellBolt: upgrading to hotkey-router 0.3.3

Date: 2026-10-25. hotkey-router 0.3.3 is on npm. SpellBolt (`SpellBolt-ChromeExt`
and its worktrees `SpellBolt-wt-citations`, `SpellBolt-wt-platform`) depends on
`^0.3.2` with 0.3.2 installed. This note was checked against SpellBolt
`origin/main` at `cf7be7ef`. SpellBolt was not changed as part of this note.

## What to do

1. `npm install hotkey-router@^0.3.3` (bump the range in `package.json` so the
   lockfile can't stay on 0.3.2).
2. Run the unit suite. Nothing below is expected to change a result.
3. Nothing to delete. The 0.3.2 cleanup is already done: the helpers still in
   `src/panel/typoHotkeyPairs.js` (`formatHotkey`, `hotkeyTokens`,
   `KEY_GLYPH_NAMES`, `isOsReservedHotkey`, `isMacPlatform`) are thin wrappers
   over hotkey-router that keep SpellBolt's names, its `{ mac }` option and the
   combo's own key order.

## What 0.3.3 changes, and whether SpellBolt is affected

| 0.3.3 change | SpellBolt |
| --- | --- |
| **Shadow DOM inputs are ignored like any input** (the router reads `composedPath()[0]`) | Not affected. Every binding passes `allowIn`: `() => true` (summon key, typo keys, flow keys) or `fromFollowUp`, which already reads `composedPath()[0]` (`AIResponsePanelMini.js` `mod+enter`). |
| **Key-based Shift + punctuation warns at bind**; `validateCombo` rejects it (`shifted-punctuation`) | Not affected. Every typo pair and flow key is a `code:` combo, and the recorder uses `comboFromEvent` (physical by default), so it records `code:` combos too. |
| **Non-Latin layouts:** Ctrl/Cmd + a letter falls back to the Latin letter (Russian Ctrl+K fires `ctrl+k`) | Not affected. The only key-based binding is `mod+enter`; Enter is not a letter. `code:` bindings already worked on every layout. |
| A `once` binding whose handler throws is still removed; `registerPlugin` is all or nothing | Not used. |
| `sideEffects` lists the core and `auto` files | Not affected. SpellBolt imports the default export, which a bundler always keeps. |
| `hotkey-router/auto` shares the core router | Not affected. SpellBolt doesn't import `/auto`; it installs nothing at import. |
| Core is ~10 KB minified (was ~9 KB) | Slightly larger bundle. |

## Worth knowing, no action needed

- **Non-text inputs:** every `<input>` type is ignored, modifier chords
  included, while a native `<button>` is not. That is unchanged in 0.3.3, now
  documented. SpellBolt's bindings all set `allowIn`, so it isn't affected.
- **Key check page:** `playground/key-check.html` and `scripts/key-check.ahk`
  in hotkey-router test real layouts and IMEs in Chrome, Firefox and Edge. Use
  them if a SpellBolt user reports a key that doesn't work on their layout.
