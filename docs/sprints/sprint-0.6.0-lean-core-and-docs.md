# Sprint 0.6.0 — lean core, opt-in add-ons, clean docs

Status: **in progress**. Slice C started on 2026-11-21 with parser sharing
across the ESM package entries.

Inputs, all from 2026-10-29: a fleet usage survey (static-web-watt3d and
sibling repos), a measured cost map of the core bundle, and a README audit.
The owner took the recommendation on all three decisions (2026-10-29).

## October 2026 baseline

- 0.5.0 on npm. Core `dist/hotkey-router.min.js`: 11,201 B min, 4,850 B gzip
  (budget 12,288 B).
- **The fleet is three extensions, all built with esbuild, none on 0.4 or
  0.5:**

  | Consumer | Range (installed) | Uses |
  |---|---|---|
  | SpellBolt | `^0.3.3` (0.3.2 in the main checkout) | default router; `code:` binds with `when`, `allowIn`, `capture`, `repeat`; `/sites`, `/reservations`, `/validate`, `/format`; named `comboFromEvent` in its key recorder |
  | WebX (DeleteMe-ChromeExt) | `^0.2.3` | `registerPlugin` with bare `alt`, `alt up`, `alt+code:KeyX` |
  | WebRadar (fps-devtools-js) | `^0.2.3` | `hotkey-router/auto` in its **production** page bundle; `lookupReservation` in its popup picker |

  No gallery app or CDN use. Nobody uses scopes, priority, `trigger`,
  `pause`, `onBind`, `createRouter`/`/core`, the `'text'` mode, or reads
  `data/*.json` directly.
- **Correction:** the 0.5.0 CHANGELOG says SpellBolt reads the JSON
  severities itself. It doesn't: it calls `lookupReservation` and checks
  `severity === 'os'` (`src/panel/typoHotkeyPairs.js:111`), so
  `preventable` changes nothing for it. Fix the note in the next docs
  release.

## What the measurements say

| Feature in core | min / gzip | Fleet use | Decision |
|---|---|---|---|
| `trigger()` and its key/code tables | 1,501 / 588 | none | move to `hotkey-router/testing` |
| Shifted-punctuation hint | 687 / 325 | dev aid only | move to the dev add-on (via `onBind`) |
| `router.comboFromEvent` (property) | 443 / 175 in a consumer build | SpellBolt uses the **named** export | drop the router property, keep the named export |
| Non-Latin Latin-letter fallback | 410 / 117 | indirect (fleet binds `code:`) | **keep in core**: an opt-in hook costs ~184 / 86 itself, and leaving it out silently breaks Ctrl/Cmd+letter for Russian, Greek and other layouts |
| AltGr, IME, input check | 208 + 45 + 1,102 | everyone | keep: removing them is a bug, not a saving |
| Everything else (plugins, `code:`, aliases, AHK, keyup, bare modifiers, priority, `onBind`) | each < 500 | used or core to the API | keep |

Taking the three "move" rows out: **8,681 B min / 3,796 B gzip** (−22% min,
−1 KB gzip), measured.

## Design rules (from the survey)

1. **Opt-in by import, never by environment sniffing.** `NODE_ENV`,
   `import.meta.env.DEV` and the `"development"` export condition each
   behave differently in esbuild, Vite, webpack, CDN and unbundled extension
   builds, and the fleet defines none of them usefully. The app decides,
   e.g. `if (__WEBRADAR_DEV__) installDevWarnings(hotkeys)`.
2. **Static subpath entries, not lazy `import()` inside the library.** Every
   fleet content/page bundle is IIFE without code splitting: an internal
   `import()` would be inlined (no saving) or break. SpellBolt already splits
   at its own build entry and that works; document that pattern instead.
3. **Split "warnings" from "lookup data".** Warnings are a dev aid. The
   lookup is production code: SpellBolt's typo-key picker and WebRadar's
   popup both call `lookupReservation` at runtime.
4. **Correctness guards stay in core**, even when small and rarely hit.

## Slices

### A. README fixes now (docs only, 0.5.1) — in progress
Stale after 0.5.0, small, worth shipping before the restructure:
- API examples `bind('mod+k', …)` and `ctrl+s` with `once` have no
  `preventDefault` (the browser acts too): add it, or use free keys.
- "Who gets a key" step 1 says reserved keys never reach the page; split
  hard from preventable.
- The sample warning text doesn't match `formatReservationWarning`.
- CommonJS: only the main entry has `require`; subpaths are ESM-only.
- Pin the CDN URL; make `docs/` and LICENSE links absolute (they break on
  npmjs.com, and `docs/` isn't in the tarball).
- `parseHotkey` returns `{ combo, type, raw }`; say so.
- validate size is ~69 KB min, not ~62 KB.
- Correct the SpellBolt line in the 0.5.0 CHANGELOG entry.

### B. README restructure (docs only, 0.5.x)
808 lines → about 400. Order: first five minutes, why this library (with
facts about the others verified first), install, syntax, core API in order
of use, how routing works, multiple routers, opt-in add-ons (one example
each), browser support, scope, license. Detail moves to `docs/reservations.md`,
`docs/validate.md`, `docs/format.md`, `docs/sites.md`, `docs/routers.md`,
`docs/testing.md`. Drop "(vX.Y.Z+)" tags from headings and fix the four
internal anchors in the same change. One name per thing: "reservation
warnings", "`code:` binding", "hotkey / combo / binding".

### C. Lean core (0.6.0, test-first)
- The ESM package entries share a private parser, platform detector, and lookup
  helper. WebRadar's popup gets one parser when it imports `/core` and
  `/reservations`. `/sites`, `/format`, and `/validate` use the same modules.
  CDN and CommonJS builds remain standalone.

  In an esbuild ES2020 IIFE using the popup's parser and reservation imports,
  the minified bundle fell from 29,974 B to 26,934 B (6,604 B to 6,475 B gzip).
  The core-only fixture stayed at 11,731 B minified. The build checks that
  `/core` and `/reservations` use the shared runtime modules.
- `trigger(router, hotkey, opts)` now lives in `hotkey-router/testing` and
  calls `router.dispatch(event, type)`. The old `router.trigger` method was
  removed. The minified CDN build fell from 11,893 B to 10,480 B (5,094 B to
  4,533 B gzip). Adding `/testing` to an esbuild ES2020 IIFE that uses
  `/core` adds 1,473 B minified and 585 B gzip.
- `installDevWarnings(router)` in `hotkey-router/dev` installs reservation
  warnings and shifted-punctuation hints through `onBind`. `/auto` installs
  both on the default router. `/validate` shares the hint logic with `/dev`.
  The minified CDN core fell from 10,480 B to 9,740 B (4,533 B to 4,143 B gzip).
- Removed the instance properties `comboFromEvent`, `parseHotkey`, and
  `detectPlatform`. The named exports are available from `hotkey-router` and
  `hotkey-router/core`. With esbuild ES2020 IIFE output, a default-router-only
  bundle fell from 9,624 B to 9,178 B (4,094 B to 3,915 B gzip). The CDN build
  includes the named exports and fell from 9,740 B to 9,691 B minified.
- Tightened the standalone minified core budget in `build.js` from 12,288 B
  to 10,000 B. The 9,691 B build leaves 309 B of headroom.
- The build projects the reservation JSON to its schema, date, shortcut
  actions, severity codes, and table references. The raw JSON export still
  has the research notes and sources. In an esbuild ES2020 IIFE, the lookup
  fell from 25,716 B to 22,243 B minified (5,947 B to 4,375 B gzip). The
  standalone auto CDN bundle fell from 34,308 B to 30,835 B minified
  (9,345 B to 7,813 B gzip).

### D. Fleet bumps (each in its own repo, own PR)
- **SpellBolt → `^0.5.0`** (then 0.6): no code change expected for
  `preventable`. Re-check the recorder and typo-key picker; drop the
  default-parameter import that keeps `installReservationWarnings` in
  production builds.
- **WebRadar → `^0.5.0`**: gate `/auto` behind `__WEBRADAR_DEV__`, import
  the plain router in production.
- **WebX → `^0.5.0`**: the 0.3 bare-modifier and keyup fixes it asked for
  (`docs/upstream-hotkey-router-issues.md`) are in; verify `alt` / `alt up`.

## Owner decisions (decided 2026-10-29: all three as recommended)

1. **`router.trigger`:** remove in 0.6.0 outright (no fleet use), or keep a
   deprecated alias for one minor (keeps its ~1.4 KB in core until 0.7)?
   *Recommendation: remove; 0.x minor, internal fleet, nobody calls it.*
   **Decided: remove in 0.6.0.**
2. **Strip the JSON prose** from the bundled reservation data (changes
   `HOTKEY_DATA`)? *Recommendation: yes; nobody reads it.*
3. **Order:** A → B → C, with D after A (fleet gets 0.5.x now) or after C
   (one bump to 0.6)? *Recommendation: D after A for SpellBolt and WebRadar;
   it's where the real users are, and 0.2.3 → 0.5 is the bigger gap.*
   **Decided: A → B → C; D after A.**

## How to run it with sessions and subagents

- **A** here, by hand: small and needs care with the facts.
- **B** in one session on its own branch (docs only, touches README and new
  `docs/*.md`); review with a fresh subagent that checks every example
  against the source.
- **C** here, test-first as in 0.4.0; a fresh subagent reviews the diff and
  re-measures sizes.
- **D** one session per consumer repo (they end in PRs there), each with a
  brief from the table above. They can run in parallel with B and C.
