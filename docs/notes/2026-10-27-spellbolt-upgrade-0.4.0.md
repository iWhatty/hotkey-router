# SpellBolt: upgrading to hotkey-router 0.4.0

Date: 2026-10-27. Applies once 0.4.0 is on npm. Checked against SpellBolt
`origin/main` at `01de92d8`, which depends on `^0.3.3`. SpellBolt was not
changed as part of this note.

## What to do

1. `npm install hotkey-router@^0.4.0` (a new minor, so the `^0.3.3` range
   won't pick it up on its own).
2. Run the unit suite. Nothing below is expected to change a result.

That's all. 0.4.0 only adds API; every 0.3.3 import, binding and default
works as before.

## Does SpellBolt need its own router? No

The 0.4.0 plan said SpellBolt should be the first to move to `createRouter()`,
to keep the host page from sharing its router. That was wrong. SpellBolt's
content scripts run in Chrome's isolated world: its manifest doesn't ask for
the page's `MAIN` world. They get their own copy of every module, so a page
that uses hotkey-router itself never shared SpellBolt's registry, `pause()` or
`destroy()`. Key events still reach both, as they always did.

Inside SpellBolt, sharing the default router is what it wants:
- `PanelPresident` installs the reservation warnings on it before the other
  subsystems bind.
- `OpenSpellBoltManager`, `TypoNavigator` and `AIResponsePanelMini` bind on it.

Moving any of them to a separate router would mean installing the warnings
on that router too.

## Optional, if it helps later

| 0.4.0 feature | Where it could fit in SpellBolt | Worth it? |
| --- | --- | --- |
| `createRouter({ target: shadowRoot })` | `AIResponsePanelMini`'s `mod+enter`, which now uses `allowIn` and `when` to accept only keys from its follow-up box | No real gain: the binding still needs `allowIn` for the input. |
| `ignoreInput('text')` | A settings surface where Ctrl/Cmd chords should work from checkboxes and sliders | Not today: every SpellBolt binding already sets `allowIn: () => true` or its own check. |
| `hotkey-router/core` | Code that wants `createRouter` without the default router started at import | Not needed: SpellBolt wants the default router started. |

## What 0.4.0 changes, and whether SpellBolt is affected

| 0.4.0 change | SpellBolt |
| --- | --- |
| The default export is built on `createRouter()` | Not affected: same object shape and behaviour. `installReservationWarnings(hotkeys)` works as before. |
| `ignoreInput` also takes `'all'` / `'text'`, and throws on other strings | Not affected: SpellBolt doesn't call `ignoreInput`. |
| Core is 11.2 KB minified (was 10.3 KB) | Slightly larger bundle. |
| New `hotkey-router/core` export | Not used. |
