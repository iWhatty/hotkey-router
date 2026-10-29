# CHANGELOG — `hotkey-router`

Releases are tagged `vX.Y.Z`. Entries before 0.2.3 were reconstructed from
`git log`, so they list commits rather than describe changes.

## 0.4.1 — 2026-10-29

Docs only: no change to the library's behaviour or API, so nothing to do
when upgrading. Published so the README on npm matches.

### Docs

- **The CommonJS example was wrong** (since at least 0.2.3).
  `require('hotkey-router')` returns the named exports, so `hotkeys.bind` was
  `undefined`. The README now says `require('hotkey-router').default`, and
  shows `const { createRouter } = require('hotkey-router')`.
- **Quick start no longer uses browser-reserved keys.** Its examples used
  `ctrl+k`, `ctrl+p` and `ctrl+f`, which this package's own reservation table
  marks as taken by the browser on Windows. They now use `mod+shift+space`,
  `mod+shift+x`, `ctrl+alt+k`, `/` and `escape`, all free in every major
  browser per the table. A short note points to "Who gets a key" and
  `hotkey-router/auto`. Checked by running the Quick start as written: every
  example fires, and the conflict warnings stay silent.
- Install shows `npm install` first (pnpm and yarn too).
- README: **"Who gets a key"**, in order: the browser and OS, the capture
  phase, the page's own handlers and the bubble phase, the checks and winner
  inside one router, and how routers relate. Also noted: `trigger()` doesn't
  check a router's scope (now pinned by a test). The Features list and size
  figures are updated for 0.4.0.

## 0.4.0 — 2026-10-27

Upgrading from 0.3.3 needs no code changes: every 0.3.3 import, binding and
default works as before. The new API is opt-in (`createRouter`,
`hotkey-router/core`, `ignoreInput('text')`). The minified core is 11.2 KB
(4.9 KB gzipped), up from 10.3 KB.

### Added

- **`createRouter(options?)`**: separate routers, each with its own
  bindings, plugins, pause state, input setting, `onBind` hooks and
  listeners. Use one when two libraries in one bundle both use
  hotkey-router, or to scope keys to a dialog, a `ShadowRoot` or an iframe. It attaches nothing until `init()`.
  `target` (default `window` when there is one) and `capture` are defaults
  that `init()` can override for one call; `ignoreInput` sets the input
  check. Exported by name, with a `Router` type. If two routers bind the same
  key, both fire. See "Multiple routers" in the README. Sprint 0.4.0 slice A.
- **`hotkey-router/core`**: `createRouter`, `parseHotkey`, `comboFromEvent`
  and `detectPlatform`, with no default export: nothing is created or
  attached at import, and a bundler drops an unused import of it.
  `hotkey-router` is now built on it (`dist/hotkey-router.js` imports
  `./core.js`), so an app that imports both bundles one copy. The CDN file
  and the CommonJS build stay single files. Sprint 0.4.0 slice B.
- **`ignoreInput('text')`**, an opt-in input mode (also `createRouter({
  ignoreInput: 'text' })`): text entry stays fully blocked, while checkboxes,
  radios, sliders, color and file inputs, button-type inputs, `<button>`,
  `role="button"` and elements inside a button block plain and Shift-only
  keys but let chords with Ctrl, Alt or Meta through. Fixes the native
  `<button>` hazard for apps that opt in: a plain `space` binding no longer
  fires on a focused button. Bare-modifier bindings stay blocked on
  controls; text entry wins where both apply; unknown input types count as
  text. `ignoreInput` now also takes `'all'` (same as `true`) and throws on
  any other string. The default is unchanged. Sprint 0.4.0 slice C.
- `build.js` checks that the main entry imports the core rather than
  copying it, that `/core` has no default export, and that the minified core
  stays within a **12 KB budget** (11.2 KB with the `'text'` mode).

### Changed

- The default export is now `createRouter()` started on `window` at import.
  Same object, same methods, same behaviour; `hotkey-router/auto` is still
  the same object. `setTarget` stays, not deprecated: it reconfigures an
  existing router, which `createRouter` doesn't replace.

### Development

- **`npm run test:browser`**: local browser tests in the installed Chrome and
  Edge through `playwright-core` (a devDependency; no browser downloads, no
  hosted CI). 10 tests per browser cover the following:
  - shadow-root inputs and `allowIn`;
  - routers scoped to a dialog, a shadow root and an iframe;
  - capture bindings against a page that stops keys;
  - two routers on one target;
  - the `'text'` mode on real controls and native pickers;
  - the built entries as an app bundles them.

  A browser that isn't installed is skipped. Sprint 0.4.0 slice D.
- **`npm run data:age`**: prints the date of the browser/OS and website
  shortcut tables, and warns when one is over six months old or when
  `data/site-hotkeys.runtime.json` wasn't rebuilt after its source changed.
  `node build.js` prints the same warnings without failing. How to review the
  tables: `docs/data-review.md`. Sprint 0.4.0 slice E.
- `scripts/key-check-server.mjs` exports `startServer({ port })`, which the
  browser tests use; `npm run key-check` works as before.

## 0.3.3 — 2026-10-23

### Fixed

- **`hotkey-router/auto` is the same router as `hotkey-router`.**
  `dist/auto.js` inlined its own copy of the core, so an app that imported
  both got two routers: two registries, two sets of `window` listeners, and
  no reservation warnings for bindings made through the plain import.
  `dist/auto.js` now imports `./hotkey-router.js` and `./reservations.js`
  (304 B instead of 48 KB), and `build.js` fails if the two entries give
  different objects. The CDN file `dist/auto.min.js` stays standalone.

- **Shortcuts work on non-Latin layouts.** On a Russian layout Ctrl+K
  reports `key: 'л'`, `code: 'KeyK'`, so a `ctrl+k` binding never fired.
  When Ctrl or Cmd is held (Shift allowed, Alt not), the key is a letter
  from a non-Latin script and `code` is `KeyA`..`KeyZ`, the router now also
  looks up the Latin letter, as browsers do for their own shortcuts. It only
  does so when no exact key or `code:` binding is eligible, so any keypress
  that fired a binding before fires the same one now. Typing, Alt/AltGr
  chords, IME composition, digits and Latin layouts (AZERTY, Dvorak) are
  unchanged.
- **Inputs inside a shadow root are ignored like any input.** The router
  checked `e.target`, which a listener on `window` sees as the shadow host,
  so typing in an `<input>` inside a web component fired plain-key bindings.
  It now reads `e.composedPath()[0]`. A closed shadow root still hides its
  inside; only the host is checked there.
- **Shifted punctuation warns at bind.** A key-based `ctrl+shift+,` or
  `mod+shift+/` never fires on US layouts (`e.key` is `<` or `?`). `bind()`
  now logs a one-time `console.warn` naming the `code:` form to use
  (`ctrl+shift+code:Comma`), and `validateCombo` rejects it with the new
  reason `shifted-punctuation` (`details.suggestion` holds the `code:` form).
  Matching is unchanged.
- **A `once` binding whose handler throws is still removed**; it used to run
  again on the next press.
- **`registerPlugin` is all or nothing.** If one key string fails to parse
  it now throws before binding anything. It used to leave the earlier
  bindings in place without recording the plugin, so `unregisterPlugin`
  could not remove them.
- **`sideEffects` in `package.json` lists the files that have them**
  (`dist/hotkey-router.*`, `dist/auto*.js`) instead of `false`, which let a
  bundler drop `import 'hotkey-router'` and the router's listeners with it.
  `build.js` now bundles a bare import of each entry and fails if the core
  or `auto` is dropped, or if another entry keeps code.

### Size

- The core is now ~10 KB minified (~4.5 KB gzipped), up from ~9 KB, for
  the non-Latin fallback and the shifted-punctuation hint.

### Docs

- README: `when`/`allowIn` receive the event (with a `composedPath()`
  example), shadow DOM inputs, the shifted-punctuation rule, non-Latin
  layouts, and what importing the core does.
- README: every `<input>` type is ignored, modifier chords included, and a
  native `<button>` is not (a plain `space` binding fires there). This is
  unchanged; it is now documented and pinned by tests, with an `allowIn`
  example for letting a chord through on a checkbox or slider.

## 0.3.2 — 2026-10-22

### Added

- **`hotkey-router/format`**: show a combo to people.
  `formatCombo('mod+shift+code:Period')` gives `Ctrl+Shift+.` on
  Windows/Linux, `Shift+Cmd+.` or `⇧⌘.` (`style: 'glyphs'`) on macOS;
  `comboTokens()` gives one keycap per key with a spoken `name` for screen
  readers; plus `modifierLabel`, `modifierName`, `keyLabel`, `listModifiers`,
  `platformLabel`, `browserLabel` and the `KEY_LABELS` map for `code:`
  values. Modifiers come in the platform's order (Apple's ⌃⌥⇧⌘ on macOS;
  Win, Ctrl, Alt, Shift elsewhere) unless `order: 'combo'`. No data tables.
- **`detectPlatform()`** exported from the core (and still from
  `/reservations`): the one detector everything uses. Reads
  `navigator.userAgentData.platform` first, and with `{ chromeos: true }`
  reports ChromeOS (otherwise `'linux'`, as before).
- `parseHotkey(str, { platform })` and `comboFromEvent(e, { platform })`
  resolve `mod` for a given platform.
- `opt` is an alias for Alt/Option in the router too (sites and validate
  already accepted it).

### Changed

- **`trigger()` fires what a real keypress would.** It used to look up only
  the key-based binding and skip most guards. The synthetic event now
  carries `key` and `code` (US layout), so `trigger('ctrl+k')` also fires a
  `ctrl+code:KeyK` binding and the reverse, and `ignoreInput`/`allowIn`
  (with a new `target` option), `pause()`, priority and `once` all apply as
  for a real event. A paused router no longer fires from `trigger()`.
- One parser (`parse.js`) for the router, sites, reservations and validate.
  `parseComboString` and `siteLookupKey` now accept everything the router
  does (AHK prefixes like `^+k`, every alias). `ctrl++` is the `+` key in
  all of them; table lookups name it `equal` (it is Shift+= on most
  layouts), which reservations did not do before. Reservations also map
  `code:Numpad1`..`9` to digits, like sites already did.
- One platform detector (`platform.js`) instead of three. The core's `mod`
  now also honours `userAgentData.platform`.
- validate's messages take their key names from the format helpers: "Include
  Cmd." / "Include Ctrl.", and the "use at least one modifier" list is in
  macOS words (Cmd, Option, Control or Shift) when you validate for macOS
  only, PC words when for Windows/Linux only.

### Fixed

- `Severity` in the reservations types listed severities the data never
  used; it now lists the real ones (`hard`, `os`, `menu-activation`,
  `find-bar-only`, `compose`, `system-text`, `devtools-open`).
- `BindOptions` now declares `warnOnReserved`.
- Size claims: the reservation table was described as "~5 KB" in comments
  and the README. Measured (minified): core ~9 KB (~4 KB gzipped);
  reservations ~23 KB (~5.5 KB gzipped); sites ~38 KB (~9 KB gzipped);
  validate with both tables ~62 KB (~15 KB gzipped); format ~9 KB.
- `npm run scrape:diff` printed "bundled data is up to date" although every
  scraper is a stub. It now says no scraper is implemented and exits 1.

## 0.3.1 — 2026-10-15

### Fixed

- **Cmd+Shift+/ on macOS is now reserved** (Help menu search, Cmd+?, which
  AppKit gives every Mac app's menu bar, so Chrome, Firefox, Safari, Edge and
  Brave all take it before the page). `lookupReservation`, the bind-time
  warning and `validateCombo` accepted `mod+shift+code:Slash` on a Mac.
  Found by SpellBolt, which kept its own OS list as a stopgap. Note:
  `docs/notes/2026-10-15-macos-help-menu-shortcut.md`.
- Added three more macOS system chords from Apple's Mac keyboard shortcuts
  page (https://support.apple.com/en-us/102650): Cmd+Option+H (hide other
  apps), Cmd+Option+D (show or hide the Dock), Cmd+` (switch windows of the
  front app).
- Reservation lookup now maps punctuation and space bound by `event.key`
  (`meta+shift+/`, `meta+space`) to the data's names (`slash`, `space`), so
  `mod+space` finds Spotlight and `mod+shift+/` finds Help like their
  `code:` spellings do.
- `package-lock.json` carried version 0.2.3; now matches `package.json`.

## 0.3.0 — 2026-10-04

### Added

- **Website shortcut awareness** (`hotkey-router/sites`): a researched table
  of popular sites' own shortcuts in the Ctrl/Cmd+Shift, Ctrl/Cmd+Alt,
  Shift+Alt and Ctrl/Cmd+Alt+Shift families (21 sites, 432 chords, sourced
  per row in `data/site-hotkeys.json`; reference `docs/site-hotkeys.md`;
  research notes `docs/site-hotkeys/`), with `siteAware()` to build a
  `when()` gate that yields to the site unless the user is engaged with the
  app, plus `lookupSiteConflicts`, `matchSites`, `siteLookupKey`,
  `detectSitePlatform` and `listSites`.
- **Per-binding capture phase**: `bind(..., { capture: true })` runs in a
  second, capture-phase listener so it sees the key before the page's own
  listeners (and can stop them). `init({ capture: true })` keeps its old
  meaning (everything in capture).
- **`comboFromEvent(e, { physical, useMod })`** for key recorders, and
  **`parseHotkey`** as a named export.
- **`hotkey-router/validate`**: `validateCombo(combo, { requirePrimary,
  minModifiers, taken, platforms, browsers, sites })` returns `{ ok, reasons }`
  with plain-language reasons (errors: no key, no modifier, Alt-only, app
  rules, taken, browser/OS-reserved; warnings: soft reservations, AltGr,
  sites using the keys) for recorder UIs.

### Changed

- **AltGr keystrokes that type a character no longer trigger Ctrl+Alt
  bindings** (Windows reports AltGr as Ctrl+Alt; AltGr+, types `<` on
  Polish, Czech and Canadian layouts). Opt back in with `{ altGraph: true }`.
- **Keys during IME composition are skipped** unless `{ composing: true }`.
- Development baseline: repaired the npm lockfile so clean installs include
  TypeScript, restored the tested Node.js 18 floor, moved to patched
  Vitest, Vite and esbuild, and pointed the README shields at the canonical
  repository (`d1d1f63`).

### Fixed

- `dist/validate.js` imports `dist/reservations.js` and `dist/sites.js`
  instead of carrying its own copies (69 KB -> 5 KB), so an app that also
  imports those subpaths bundles each table once.
- The package now ships its TypeScript declarations. Since `dist/types` was
  added, `prepare` (which npm runs after `prepublishOnly`) rebuilt `dist/`
  without them, so 0.2.x went out with `types` exports pointing at missing
  files. `prepare` builds the types too; `prepublishOnly` runs the tests.

## 0.2.3 — 2026-06-15

### Fixed

- **Space-key bindings were impossible.** `normalizeKey()` called `.trim()` before
  its `raw === ' '` guard, so the `space`/`spacebar` aliases (which resolve to
  `' '`) collapsed to `''` and the base key was lost. Any space binding —
  `space`, `ctrl+shift+space`, etc. — threw "missing base key" or "multi-modifier
  bare bindings not supported." Now guards on the original value before trimming,
  so the spacebar survives both at parse time and in `comboKeyFromEvent`. Added
  regression tests.

## 0.2.2 — 2026-05-26

- chore(types): generate .d.ts from JSDoc via tsc  `5c450b3`
- chore(types): polish JSDoc — typed bind/handler surface + Reservation types  `9c861ea`
- chore(pkg): update GitHub repo URL after rename  `86c4624`

## 0.2.1 — 2026-05-19

- chore: normalize README shields row  `7895a8c`
- chore: rebrand author to WATT3D, interim license  `7c79e2c`
- feat: relicense to AGPL-3.0 + WATT3D AI Training Rider  `3af3497`
- chore: deploy WATT3D AI-bot robots.txt policy  `db060d7`
- chore: revise AI Training Rider (v2 — pre-counsel drafting fixes)  `fff34f2`
- chore: rider v3 — remove gameable 0.1% safe harbor  `48706cb`
- chore: rider v4 — Commercial Use restricted to Fully Open Source  `b206123`
- docs(README): apply @whatty README template  `587632a`
- chore(license): finalize AGPL-3.0 + WATT3D Additional Terms metadata  `0ef9569`
- chore: patch version bump to ship license metadata update  `b830bd4`

## 0.2.0 — 2026-05-17

- feat(reservations): warn at bind time on browser/OS-reserved hotkeys (v0.2.0)  `d176f17`

## 0.1.0 — 2026-05-10

- fixed git link for repo in package.json .. added "git+"  `28f481b`
- feat(parser,dispatch): add bare-modifier and code:-based bindings  `6026e71`

## 0.0.2 — 2026-02-27

- Initial commit  `352ff10`
- Initial Commit with basic plan for API urface and goals  `d8169d6`
- First draft of the hotkey router and event listener binding logic  `6e8b905`
- Initial readme to reflect where we are now  `409da06`
- Added platform check for MacOS hotkeys. Added flag to block hotkeys when typing in editable text fields.  `1c6615f`
- Added support to bind hotkeys to the keyUP event listenter.  `3a50f77`
- Updated README to relfect the previous changes, Handling key-down and key-up hotkeys  `207c01d`
- Added gitignore to prepare for bundling and building.  `a6192f7`
- Added a playground testing HTML to live test hotkeys in a browser  `2d971ad`
- Added notes for MAC hotkeys  `648db6a`
- feat(router): introduce priority-based O(1) hotkey routing with plugin lifecycle  `4ab16a0`
- feat: harden routing core and reposition README as deterministic engine  `8bea47e`
- feat(core): add AHK-style modifiers + expand key alias support  `b0c3963`
- test: run vitest in jsdom environment  `b97b919`
- feat(build,playground): add CJS build, banner versioning, and upgrade playground  `3ee7ca2`
- refactor(core): harden alias resolution and optimize combo key generation  `0e2360b`
