# macOS Help menu shortcut missing from the reservation table (fixed in 0.3.1)

## The gap

On macOS, Cmd+Shift+/ (Cmd+?) opens the Help menu search. AppKit adds it to
every app's menu bar, so Chrome, Firefox, Safari, Edge and Brave all take the
key before the page sees it. Up to 0.3.0, `data/browser-hotkeys.json` had no
entry for it, so `lookupReservation`, the bind-time warning
(`installReservationWarnings`) and `validateCombo` all accepted
`mod+shift+code:Slash` on a Mac.

A second, smaller gap: lookup only normalized `code:` values. A combo bound by
key (`mod+shift+/`, `mod+space`) looked up `/` and ` ` instead of the data's
`slash` and `space`, so it missed entries (Spotlight included).

## SpellBolt context

SpellBolt (uses `hotkey-router` ^0.3.0) found it on 2026-10-15 while choosing a
Mac cycle key for its keyboard flow keys. It added a stopgap,
`OS_RESERVED_HOTKEYS` in `src/panel/typoHotkeyPairs.js`
(`mac: ['mod+shift+code:Slash']`), checked by `tests/hotkeyReservations.spec.js`
next to this package's table.

## The fix (0.3.1)

- `platforms.mac.system` gains `meta+shift+slash` (Help menu search, `os`),
  plus three more chords from the same Apple page: `meta+alt+h` (hide other
  apps), `meta+alt+d` (show or hide the Dock), `meta+backquote` (switch
  windows of the front app). The others asked about (Cmd+H, Cmd+M, Cmd+Q,
  Cmd+Tab, Cmd+Space, Cmd+Shift+3/4/5) were already listed.
- Source: Apple, Mac keyboard shortcuts, https://support.apple.com/en-us/102650
  (already in the data file's `version.sources`).
- `reservations.js` maps punctuation and space keys to the data's names (same
  map as `sites.js`).
- Tests: `reservations.test.js` (Help chord in all four browsers, by code and
  by key; not reserved on Windows; Spotlight by key), `validate.test.js`
  (`validateCombo` rejects it on mac only).

`data/browser-hotkeys.json` says `docs/browser-hotkeys.md` is the human source
of truth, but that file is not in this repo (it lives with WebRadar, if
anywhere). Update it there too if it still exists.

## Release steps (owner)

1. `npm test`
2. `git push origin main`
3. `npm publish` (`prepare` builds `dist/` and types; `prepublishOnly` runs the tests)
4. Optional: `git tag v0.3.1 && git push origin v0.3.1`
5. In SpellBolt: `pnpm up hotkey-router@^0.3.1`, then drop the `mac` entry from
   `OS_RESERVED_HOTKEYS` (or the whole list if nothing else is in it) and let
   `tests/hotkeyReservations.spec.js` rely on hotkey-router's table.
