# Sprint 0.4.0: separate routers, a core entry, and focus on controls

Date: 2026-10-26. Status: **decisions 1-3 settled by the panel review
(2026-10-26, below); not started.** Builds on 0.3.3 (on npm).
Sources: the "Not in 0.3.3" list in `sprint-0.3.3-repair-and-polish.md`, the
slice E decision there, and the post-0.3.3 review of the library.

Goal: make hotkey-router safe to use as a shared building block. Two
libraries on one page, a dialog, an iframe or a shadow root each get their own
router, and importing the package doesn't have to attach anything. Every
existing binding and import keeps working unchanged: 0.4.0 adds API and
changes no default. Run all checks locally; hosted CI stays off.

## Why

| # | Problem today | Who hits it |
| --- | --- | --- |
| 1 | One router per page. All state (`registry`, `plugins`, `paused`, `ignoreInput`, `onBind` hooks, listeners) is module-wide, so two libraries that use hotkey-router share one registry, and one's `pause()` or `destroy()` stops the other's keys. | Any page with two consumers, such as SpellBolt injected into a site that uses hotkey-router too |
| 2 | A router can't be scoped. `setTarget` + `init` move the one router; there's no way to have page-wide keys and dialog-only keys at once. | Dialogs, iframes, web components |
| 3 | Importing `hotkey-router` attaches `keydown`/`keyup` listeners to `window` straight away. | Libraries that want to start the router themselves, server-side rendering, tests |
| 4 | Every `<input>` blocks every binding, modifier chords included, while a native `<button>` blocks none, so a plain `space` binding fires on a focused button (slice E, 0.3.3: kept and documented). | Apps with forms and settings panels |

## Slices

### A. `createRouter()` (problems 1 and 2)

- **Change:** move the router's state into `createRouter({ target, capture, ignoreInput })`. It returns an object with today's full API: `bind`, `unbind`, `registerPlugin`, `unregisterPlugin`, `onBind`, `pause`, `resume`, `ignoreInput`, `init`, `destroy`, `setTarget`, `trigger`, plus the helpers. `target` can be an element, a `ShadowRoot` or an iframe's window.
- **No auto-init (decided):** `createRouter` attaches nothing; the caller runs `init()`.
  - **Default target:** `target` defaults to `window` when one exists, otherwise to none. An explicit `target: null` also means none. `init()` with no target throws, as today.
  - **Defaults, not settings:** the constructor's `target` and `capture` are defaults. `init({ target, capture })` overrides them for that call only, without changing them.
  - **Lifecycle unchanged:** a second `init()` destroys first; `destroy()` clears bindings and plugins and keeps `onBind` hooks.
- **`setTarget` stays, not deprecated (decided, 3-1):** it changes the default target of an existing router, which other modules and an installed warning hook may hold on to, without moving listeners. `createRouter({ target })` makes a new router instead, so it doesn't replace that. Document both clearly.
- **Default router:** the `hotkey-router` default export becomes `createRouter()` plus `init()` on `window` when one exists. Same object shape as today; `/auto` stays the same object. Also export `createRouter` by name.
- **Separate means separate:** each router has its own registry, plugins, pause state, input setting, hooks and listeners. If two routers both have a binding for a key and the event reaches both, both fire, each picking its own winner. Priority only arbitrates within one router.
- **Making one router win (corrected by the panel):** `stopPropagation` does not stop another listener on the same target. Only `stopImmediatePropagation` does, and only for listeners registered later. A capture listener on an ancestor runs before a child's anyway. Document coordination (`when` gates, separate scopes) rather than promising a winner across routers.
- **Stays shared:** the parser, `comboFromEvent`, `detectPlatform`, and the one-time shifted-punctuation warning. The warning is deduplicated by combo and type per loaded copy of the module, not per router. Two separately bundled copies each warn once.
- **Extensions:** `installReservationWarnings(router)` already takes any router with `onBind`; it works per router as is. `hotkey-router/auto` stays the default router with warnings.
- **Types:** a `Router` type, with the default export typed as `Router`.
- **Tests:**
  - Every existing test passes unchanged against the default export.
  - Two routers are isolated: binding, pausing, `ignoreInput` and `destroy` on one leave the other alone.
  - A router scoped to a dialog element only sees keys from inside it.
  - A router on a `ShadowRoot` sees keys from its inputs only when `allowIn` lets them through, like any input.
  - Both routers fire when both bind the same key.
  - Reservation warnings installed on one router don't fire for the other's binds.

### B. `hotkey-router/core` (problem 3)

- **Change:** new entry `core.js`, which exports `createRouter`, `parseHotkey`, `comboFromEvent` and `detectPlatform`. It does nothing at import.
- **One implementation:** `hotkey-router.js` imports from it. `dist/hotkey-router.js` imports `./core.js` instead of inlining it, as `auto` does since 0.3.3, so an app that imports both gets one copy. The CommonJS and CDN files stay single files.
- **Packaging:** `core` is not added to `sideEffects`. `build.js` checks that a bare `import 'hotkey-router/core'` drops out of a bundle, and that `hotkey-router` and `/auto` still keep their listeners.
- **Size budget:** `build.js` fails if the minified core goes over 12 KB. It's 10.3 KB today, so the budget catches drift without blocking this sprint.

### C. Focus on controls, opt-in (problem 4), decided: add it

- **Change:** a second input mode, `ignoreInput('text')` (also `createRouter({ ignoreInput: 'text' })`). `true`/`'all'` stays the default and works exactly as today; `false` turns the check off.
- **In `'text'` mode:**
  - **Text entry** stays fully blocked: text-like `<input>` types (text, search, email, url, tel, password, number), date and time inputs, `<textarea>`, `<select>`, contenteditable, `role="textbox"`.
  - **Other controls** (checkbox, radio, range, color, file, button, submit, reset and image inputs, plus native `<button>` and `role="button"`) block plain keys and Shift-only chords, which belong to the control (Space, Enter, arrows). They let chords with Ctrl, Alt or Meta through.
- **Refinements (panel, unanimous):**
  - A chord needs a non-modifier base key. Bare-modifier bindings (`alt`, `alt up`) stay blocked on controls, keyup included.
  - An element inside a native `<button>` or `role="button"` counts as that button, found along the event's path.
  - Text entry wins where categories overlap.
  - Unknown `<input>` types stay fully blocked.
- **`allowIn`** still overrides, but only the focus check. The AltGr, IME, repeat and `when` checks apply as always.
- **Fixes the `<button>` hazard** for apps that opt in: a plain `space` binding no longer fires on a focused button.
- **Not a default change in 0.4.** The README promises today's behaviour. Whether `'text'` becomes the default is a 1.0 question.
- **Tests:** every listed type in both modes; `<button>`, `role="button"` and an element inside each; bare-modifier bindings on controls; an unknown input type; shadow DOM targets; `allowIn` overrides; AltGr and IME guards unchanged.
- **Unverified:** which modified chords native pickers (color, file, date) take for themselves in each browser. Test representative cases in slice D before documenting any guarantee.

### D. Local browser tests (supports A to C)

- **Change:** `npm run test:browser`, run locally, never in hosted CI. Real Chrome and Edge, with trusted key events, for what jsdom can't show:
  - shadow DOM targets;
  - capture bindings against a page that stops propagation;
  - routers scoped to a dialog, a shadow root and an iframe;
  - `sideEffects`: a bundled app page loads with its listeners.
- **Decided (unanimous):** `playwright-core` as a devDependency, driving the Chrome and Edge already installed (`channel: 'chrome'` / `'msedge'`). No browser downloads, never in hosted CI. A browser that's missing or blocked by policy is reported clearly, not failed silently.
- **Cover first:**
  - real key input through open shadow roots, including `allowIn`;
  - routers scoped to a dialog, a shadow root and a same-origin iframe;
  - capture bindings against a page that stops propagation;
  - two routers on one target (both fire), and `destroy()` on one leaving the other working;
  - the `'text'` mode on a text field, a checkbox, a slider and a native `<button>`;
  - built entries: `hotkey-router` and `/auto` keep their listeners and are one object, and `/core` attaches nothing.
- **Don't cover:** keyboard layouts, AltGr and IME (the AHK key check drives the real OS for those), browser-reserved shortcuts, or automating third-party pages. Keep the full matrix of input types in jsdom; the browser suite checks representative cases.
- **Done when:** the suite runs in under a minute on this machine and covers each item above.

### E. Data freshness

- **Change:** `npm run data:age` prints each table's date (`browser-hotkeys.json` `version.generated`, `site-hotkeys.json` `version.researched`) and warns when one is older than six months. `build.js` prints the same warning without failing.
- **Docs:** a short review checklist in `docs/`: which vendor pages to re-read, and how to update a row and its date. Building real scrapers stays out of scope.

### F. Docs and release

- **README:** "Multiple routers" (scoped routers, iframes, shadow roots, two libraries on one page), `hotkey-router/core`, the `'text'` input mode, and what importing each entry does.
- **Release:** CHANGELOG 0.4.0, type build, `npm pack` check, and a version bump.
- **SpellBolt upgrade note,** like 0.3.3's. SpellBolt runs inside other people's pages, so it's the first consumer that should move to its own router.

## Order

1. A, then B: B is mostly packaging once A exists.
2. D next to A and B, since its first tests are for scoped routers.
3. C.
4. E and F last.

## Not in 0.4

- **Layout-aware matching for shifted punctuation.** `code:` bindings already work on every layout, and nothing has asked for more since 0.3.3 added the warning.
- **Making `'text'` the default input mode:** a 1.0 question.
- **Environment items from the 0.3.3 key check,** which are owner setup, not code:
  - Japanese IME checks: they need Japanese installed in Windows.
  - Russian Ctrl+Shift check: it needs Russian installed, or Windows' Ctrl+Shift layout shortcut unassigned.
- **Hosted CI:** `.github/workflows/ci.yml.disabled` stays disabled.

## Owner decisions

Decided 2026-10-26 by a two-round review of four models through the Codex CLI
(gpt-6-luna and gpt-5.6-terra at high effort, gpt-6.1-sol and gpt-6-astra at
medium), at the owner's request. The slices above are written to match.

1. **C, focus on controls: add the opt-in `'text'` mode.** Unanimous in both
   rounds, with the refinements Sol and Astra proposed, which all four adopted
   in round 2.
   - **Why a mode and not just `allowIn`:** `allowIn` can only let keys
     *through*. It can't protect a native `<button>` from a plain `space`
     binding. And repeating it on every app command is easy to miss.
   - **Use cases that decided it:**
     - A SpellBolt settings router opts in, and Ctrl+K opens the palette from
       a focused checkbox while Space still toggles the checkbox.
     - A plain `space` binding stops firing on a focused Save button.
   - **Risk accepted:** a modified arrow chord on a slider, or Ctrl on a file
     input, may conflict with the control. The mode is opt-in, and `when`
     can exclude a control.
2. **A and B, API shape.**
   - **`core` is factory-only:** `createRouter` plus the stateless helpers, no
     ready router. Unanimous. A second ready-made router would be a second,
     ambiguous source of shared state.
   - **`createRouter` doesn't auto-init,** and its options are defaults for
     `init()`. Unanimous; details in slice A.
   - **`setTarget` stays, not deprecated:** 3-1 (Terra, Sol and Astra; Luna
     for deprecating in docs and types only). The deciding use case: SpellBolt
     replaces a panel's shadow root but keeps the one router its command
     modules and warning hook refer to. It calls `destroy()`, `setTarget()`,
     `init()` and rebinds. `createRouter({ target })` would make a new object
     instead, so it doesn't replace that.
   - **Correction to the first draft:** `stopPropagation` does not make one
     router win over another on the same target. Raised by all four; slice A
     now says how to coordinate instead.
3. **D, local browser tests: add `playwright-core`** with the installed Chrome
   and Edge, run locally only. Unanimous.
   - **Why:** jsdom can't show real shadow DOM event paths, iframe and dialog
     scoping, or whether a bundled app keeps its listeners.
   - **Scope:** what to cover and what to leave to the AHK key check is in
     slice D.
   - **Risk accepted:** installed browser versions change, so the suite will
     need upkeep. It stays small and local.

Compatibility, as the panel checked it: no 0.3.3 default changes. New
behaviour needs an explicit `createRouter`, `hotkey-router/core` or `'text'`.
The risks are all in the refactor, so its tests must guard them:
- capture-phase defaults changing;
- `onBind` hooks lost on `destroy()`;
- the default export and `/auto` splitting into two objects again;
- the new button rule leaking into the default mode.

## Done when

- Every slice has tests, and the scoped-router and focus tests fail on 0.3.3.
- `npm test` passes. `node build.js` passes with the new checks (core drops out of a bundle, size budget). The type build and the `npm pack` contents are checked.
- `npm run test:browser` passes locally, if D is accepted.
- The key check (`scripts/key-check.ahk`) still gives 7 pass in Chrome, Firefox and Edge.
- SpellBolt upgrade note written.
