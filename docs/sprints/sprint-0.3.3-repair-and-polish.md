# Sprint 0.3.3: repair and polish

Date: 2026-10-22. Status: **released as 0.3.3 on 2026-10-23.** A, B, D and
F merged on 2026-10-22 (PR #1); C and E on 2026-10-23 (PR #2) after the owner
decisions below. Found during release prep and fixed in it: `dist/auto.js`
inlined its own copy of the router (see CHANGELOG). In B, `validateCombo`
reports shifted punctuation as an error (`ok: false`), since the combo never
fires on US layouts. Still open: a manual check of Russian and one CJK IME in
Chrome and Firefox (not done before release; `playground/key-check.html` lists
the checks and copies the results as a note), and the SpellBolt upgrade.
Source: a review of
0.3.2 from SpellBolt (core `hotkey-router.js` and `parse.js` read in full; all
169 tests pass), plus simulated key events against the 0.3.2 source.

Goal: fix the cases where the router does the wrong thing silently, without
breaking any existing binding. Every fix lands with a test that fails on 0.3.2.
API additions that change how people use the router wait for 0.4 (end of page).

## What was found

Each row was reproduced with fake `KeyboardEvent`s dispatched through
`init({ target })`, or `trigger(..., { target })` for the target checks
(Windows platform, US layout unless stated). The probe script is at the end.

| # | Case | 0.3.2 result | Should be |
| --- | --- | --- | --- |
| 1 | `k` bound, user types in an `<input>` **inside a shadow root** | **Fires** (the window sees the shadow host, not the input) | Ignored, like any input |
| 2 | `ctrl+shift+,` bound, user presses Ctrl+Shift+, | **Never fires** (`e.key` is `<`); no warning at bind | Warn at bind, or match |
| 3 | `mod+shift+/` bound, user presses Ctrl+Shift+/ | **Never fires** (`e.key` is `?`) | Same as 2 |
| 4 | `ctrl+k` bound, Russian layout (`e.key` is `л`, `code` is `KeyK`) | **Never fires** | Fires, as browser shortcuts do |
| 5 | `once` binding whose handler throws | Runs again on the next press | Removed after the first run |
| 6 | `registerPlugin` where one key string fails to parse | Earlier bindings stay bound; the plugin is not recorded, so `unregisterPlugin` cannot remove them | All or nothing |
| 7 | Any binding with focus on a checkbox, radio, button or range `<input>` | Ignored (treated as a text field) | Decided: keep, and document (slice E) |
| 8 | `package.json` `"sideEffects": false` | The core attaches listeners at import, and `auto` installs warnings at import | List the files that have side effects |

Controls that behave correctly: `ctrl+shift+code:Comma` fires; `ctrl+k` with
Caps Lock (`e.key` `K`) fires; `ctrl+z` on AZERTY (`e.key` `z` on the physical
W key) fires, as it should for a key-based binding.

**A consumer bug the docs could prevent.** SpellBolt wrote
`allowIn: (el) => el === this._followUpInput`, expecting an element. The
router passes the event, so the check never matched; it only worked because of
case 1. Fixed in SpellBolt `b901f773`. The `BindOptions` type says `(e:
KeyboardEvent)`, but the README examples should show it, together with
`e.composedPath()[0]` for shadow DOM.

## Slices

### A. Shadow DOM input check (case 1)

- `isFromInputTarget(e)`: use `e.composedPath?.()[0] ?? e.target`. Open shadow
  roots then work; closed ones still hide their inside (no fix possible;
  document it).
- Also check `isContentEditable` and `role="textbox"` on that element, as now.
- Tests: an input inside an open shadow root is ignored; `allowIn` receives the
  event and can read `composedPath()`; a closed-root host behaves as today.

### B. Shifted punctuation (cases 2, 3)

- At `bind`, when a key-based combo has `shift` and a punctuation key whose
  shifted character differs on US layouts (`, . / ; ' [ ] \ - = \``), emit a
  one-time `console.warn` naming the `code:` form to use
  (`ctrl+shift+code:Comma`). Same message from `validateCombo`.
- Do **not** silently match by `code` in 0.3.3: on other layouts the shifted
  character is somewhere else, and matching would change which key fires.
  Revisit in 0.4 with a layout-aware option.
- Tests: the warning fires once per combo; `code:` bindings and unshifted
  punctuation do not warn.

### C. Non-Latin layouts (case 4), done as decided

The proposal (any character outside `a`-`z`, digits included, any modifier
but Shift) was narrowed in review. As built (`latinKeyFromEvent` in
`hotkey-router.js`):

- Ctrl or Meta held, Shift allowed, **no Alt** (Option and AltGr type
  characters).
- `e.key` is one letter from a **non-Latin script**; `e.code` is
  `KeyA`..`KeyZ`. No digits: that would bring back the shifted-character
  matching that B leaves out.
- Never during IME composition (`isComposing` or keyCode 229) or with
  AltGraph reported, even for bindings that opt into those.
- A **fallback tier**: tried only when the key-based and `code:` lookups give
  no eligible binding in that phase. All guards apply to it.
- No opt-out option; `when: (e) => e.key === 'k'` requires the exact
  character.
- Tests: Russian Ctrl/Cmd+K and Ctrl+Shift+K; Greek, Hebrew, Arabic; keyup;
  plain and Shift-only letters; Alt, Ctrl+Alt, AltGr; composition; accented
  Latin, Arabic-Indic digit, letter on a Digit key, non-letter; AZERTY; an
  exact `ctrl+л` and a `ctrl+code:KeyJ` beat a higher-priority fallback; an
  ineligible exact binding lets the fallback fire; the input guard and
  `when` still apply.

### D. Small correctness fixes (cases 5, 6)

- `fire`: remove a `once` binding in a `finally`, so a throwing handler still
  counts as its one run.
- `registerPlugin`: parse every key string first; bind only if all parse;
  otherwise throw without binding anything.
- Tests for both.

### E. Non-text inputs (case 7), decided: document only

Plain keys (Space, Enter, arrows) on a checkbox, button or slider belong to
that control, so ignoring them is right. Modifier chords (`ctrl+k`) on those
controls are not typing and could fire. The proposal was to let Ctrl, Alt or
Meta chords through on checkbox, radio, button, submit, reset, range, color
and file inputs. **Declined**; behaviour is unchanged:

- With `ignoreInput(true)`, every `<input>` type is ignored, modifiers or
  not, as are `<textarea>`, `<select>`, contenteditable and `role="textbox"`.
  `allowIn(e)` lets one binding through; `ignoreInput(false)` turns the check
  off.
- A native `<button>` is not ignored, so a plain `space` binding fires on a
  focused button. Documented as a known hazard (gate with `when`).
- README documents both, with an `allowIn` example for a checkbox or slider;
  tests pin every input type, `allowIn` on a checkbox, and the `<button>`
  case.

### F. Packaging and docs (case 8)

- `"sideEffects": ["./dist/hotkey-router.js", "./dist/hotkey-router.cjs", "./dist/hotkey-router.min.js", "./dist/auto.js", "./dist/auto.min.js"]`
  (the 0.3.2 `dist/` names), so bundlers keep the auto-init and the `auto`
  entry. `validate`, `sites`, `format` and `reservations` do not import the
  core and stay side-effect free. Confirm with a tree-shaking check in
  `build.js`.
- README: `allowIn` / `when` receive the event; shadow DOM and `composedPath`;
  the shifted-punctuation rule; what auto-init does at import.
- CHANGELOG entry and the usual release steps (types build, `npm pack` check).

## Not in 0.3.3 (proposed for 0.4)

- **`createRouter({ target })`**: separate routers instead of one module-wide
  router, so two libraries on a page do not share or fight over one registry,
  and a router can be scoped to a dialog, iframe or shadow root. Keep today's
  default export as a router created at import.
- **No work at import**: an opt-out (`hotkey-router/core` without auto-init).
- Optional layout-aware matching for shifted punctuation.
- One focus policy for controls: whether modifier chords may fire on
  checkboxes, sliders and the like, and whether a native `<button>` should
  block plain Space and Enter (slice E left both as they are).

## Owner decisions

Decided 2026-10-23, after a two-round review by four models through the Codex
CLI (gpt-6-luna and gpt-5.6-terra at high effort, gpt-6.1-sol and gpt-6-astra
at medium). The owner accepted the result.

1. **Slice E: document only, in 0.3.3.** Unanimous after round 2 (Luna and
   Terra switched). A modifier chord on a control is not necessarily free for
   the app to take, `allowIn` already lets one binding through, and the README
   promised that every `<input>` is ignored. A single policy for controls,
   `<button>` included, goes to 0.4.
2. **Slice C: ship in 0.3.3 as a patch, no opt-out.** All four agreed on the
   rule above. Version split 2-2: Luna and Terra for a patch, Sol and Astra
   for 0.4.0 with a `layoutFallback: false` option. Decided for the patch
   because the fallback tier means any keypress that fired a binding before
   fires the same one now; only keypresses that fired nothing change. `when`
   covers the rare app that wants the exact character. Use cases that decided
   it:
   - Russian SpellBolt user presses Ctrl+K: missed before, fires now.
   - App binds both `ctrl+л` and `ctrl+k`: `ctrl+л` still wins.
   - Mac user types `˚` with Option+K: `alt+k` still does not fire.
   - AZERTY user presses Ctrl+Z: unchanged.
   Synthetic events cannot show how every browser reports layouts and IMEs;
   check Russian and one CJK IME by hand in Chrome and Firefox before release.
3. License: AGPL-3.0 with additional terms keeps outside web apps from adopting
   the library. Fine for WATT3D products; revisit only if wider adoption is a
   goal. Not reviewed by the panel.

## Done when

- Every slice has a test that fails on 0.3.2 and passes after.
- `npm test` green; types build; `npm pack` contents checked.
- SpellBolt upgraded to 0.3.3 with its unit suite green.

## Probe used for the table

Run with Node 24 against the repo root. It fakes `navigator` and
`KeyboardEvent`s; it is a review aid, not a test file.

```js
// node probe.mjs C:/Users/Spectre/GitHub/hotkey-router
const root = process.argv[2]
Object.defineProperty(globalThis, 'navigator', { value: { platform: 'Win32', userAgent: 'Windows' }, configurable: true })
const { default: hk } = await import(`file:///${root}/hotkey-router.js`)
const target = new EventTarget()
hk.setTarget(target); hk.init({ target })
function press(props) {
  const e = new Event('keydown')
  const { target: _t, ...rest } = props
  Object.assign(e, { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false, isComposing: false, getModifierState: () => false, ...rest })
  target.dispatchEvent(e)
}
function check(label, combo, ev) {
  let hit = false
  const off = hk.bind(combo, () => { hit = true })
  press(ev); off()
  console.log(`${hit ? 'FIRES ' : 'MISSES'}  ${label}`)
}
check("'ctrl+shift+,' (key '<')", 'ctrl+shift+,', { key: '<', code: 'Comma', ctrlKey: true, shiftKey: true })
check("'ctrl+shift+code:Comma'", 'ctrl+shift+code:Comma', { key: '<', code: 'Comma', ctrlKey: true, shiftKey: true })
check("'mod+shift+/' (key '?')", 'mod+shift+/', { key: '?', code: 'Slash', ctrlKey: true, shiftKey: true })
check("'ctrl+k' Russian (key 'л')", 'ctrl+k', { key: 'л', code: 'KeyK', ctrlKey: true })
check("'ctrl+k' Caps Lock (key 'K')", 'ctrl+k', { key: 'K', code: 'KeyK', ctrlKey: true })
check("'ctrl+z' AZERTY (key 'z', code KeyW)", 'ctrl+z', { key: 'z', code: 'KeyW', ctrlKey: true })
const host = { tagName: 'MY-EDITOR', isContentEditable: false, getAttribute: () => null }
{ let hit = false; const off = hk.bind('k', () => { hit = true }); hk.trigger('k', { target: host }); off(); console.log(`${hit ? 'FIRES ' : 'MISSES'}  'k' in a shadow-root input (target = host)`) }
const box = { tagName: 'INPUT', type: 'checkbox', isContentEditable: false, getAttribute: () => null }
{ let hit = false; const off = hk.bind('space', () => { hit = true }); hk.trigger('space', { target: box }); off(); console.log(`${hit ? 'FIRES ' : 'MISSES'}  'space' on a checkbox`) }
let calls = 0
hk.bind('ctrl+q', () => { calls++; throw new Error('boom') }, null, { once: true })
for (let i = 0; i < 2; i++) { try { press({ key: 'q', code: 'KeyQ', ctrlKey: true }) } catch {} }
console.log(`once + throwing handler ran ${calls} time(s) over 2 presses`)
```

Result on 0.3.2: MISSES, FIRES, MISSES, MISSES, FIRES, FIRES, FIRES, MISSES,
`ran 2 time(s)` (Node also reports the thrown error).
