# CHANGELOG — `hotkey-router`

> Initial cut seeded from `git log` by the host repo's `tools/seed-changelogs.mjs` script. Version groupings infer release boundaries from tags and commit subjects; rough cuts are expected — review and tighten as part of normal maintenance.

## 0.2.3 — 2026-06-15

### Fixed

- **Space-key bindings were impossible.** `normalizeKey()` called `.trim()` before
  its `raw === ' '` guard, so the `space`/`spacebar` aliases (which resolve to
  `' '`) collapsed to `''` and the base key was lost. Any space binding —
  `space`, `ctrl+shift+space`, etc. — threw "missing base key" or "multi-modifier
  bare bindings not supported." Now guards on the original value before trimming,
  so the spacebar survives both at parse time and in `comboKeyFromEvent`. Added
  regression tests.

## Unreleased — 2026-05-18

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
- chore(pkg): update GitHub repo URL after rename  `86c4624`

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
