# Hotkey-router 0.6.0 post-release review

Reviewed on **2026-11-25** (America/Toronto). Review attribution **Codex / Sol 6.2**.

This is the planning baseline for the next sprint. The proposed work below still needs scope and sequencing decisions.

## Verified release state

| Source | Revision reviewed |
| --- | --- |
| hotkey-router `main` and `v0.6.0` | [`7f3c7f171ea4e227180bc27292fda7652897e3f9`](https://github.com/iWhatty/hotkey-router/commit/7f3c7f171ea4e227180bc27292fda7652897e3f9) |
| static-web-watt3d `main` and consumer report | [`3329f1cd4d3b573d16ce1c66161111285132b504`](https://github.com/iWhatty/static-web-watt3d/blob/3329f1cd4d3b573d16ce1c66161111285132b504/docs/npm-consumers.md) |
| Host consumer pin update | [`61058863db3ce4f56e03e81e6db39f52cfbb9021`](https://github.com/iWhatty/static-web-watt3d/commit/61058863db3ce4f56e03e81e6db39f52cfbb9021) |
| SpellBolt upgrade merge | [`cbcbfb740c81a5e83eb9d5e1fa28abf914c201a7`](https://github.com/iWhatty/SpellBolt-ChromeExt/commit/cbcbfb740c81a5e83eb9d5e1fa28abf914c201a7) |
| WebX upgrade merge and host pin | [`1f7f2becdf360b895ec9c15ad1801844cc9ee90f`](https://github.com/iWhatty/DeleteMe-ChromeExt/commit/1f7f2becdf360b895ec9c15ad1801844cc9ee90f) |
| WebRadar upgrade merge and host pin | [`d09f5b5e739e18230ef77ca29eec3755c72702d0`](https://github.com/iWhatty/fps-devtools-js/commit/d09f5b5e739e18230ef77ca29eec3755c72702d0) |

npm `latest` was `0.6.0`, and all three extensions were locked to `0.6.0` and marked current. The standalone core measured 9,691 B minified and 4,130 B gzipped, with 309 B of headroom under the 10,000 B build limit. Release verification covered 314 unit tests, 24 Chrome and Edge integration tests, TypeScript declarations, and a clean install from the tarball whose integrity matched npm. [npm release](https://www.npmjs.com/package/hotkey-router/v/0.6.0) · [Sprint measurements](../sprints/sprint-0.6.0-lean-core-and-docs.md)

## PM review

1. **Finish the release closeout.** Update the sprint status and create a GitHub Release from the existing `v0.6.0` tag. GitHub Releases still showed `v0.5.2` as latest at review time. Use the changelog’s migration notes for `/testing`, `/dev`, the named helper imports, and the compact `HOTKEY_DATA` export. [Changelog](../../CHANGELOG.md) · [GitHub Releases](https://github.com/iWhatty/hotkey-router/releases)
2. **Prioritize the two known WebRadar shortcut collisions.** Edge on Windows and Linux takes Console Radar’s `mod+shift+L`, and Firefox on macOS takes FPS’s `mod+shift+F`. Decide whether to change the defaults or expose an existing fallback more clearly. Verify that users can still reach both tools on the affected browser and OS pairs. Treat arbitrary user-defined combos as a separate scope decision. [WebRadar integration notes](https://github.com/iWhatty/fps-devtools-js/blob/d09f5b5e739e18230ef77ca29eec3755c72702d0/docs/hotkey-router-integration.md) · [WebRadar backlog](https://github.com/iWhatty/fps-devtools-js/blob/d09f5b5e739e18230ef77ca29eec3755c72702d0/docs/backlog.md#hotkeys) · [Reservation data at release](https://github.com/iWhatty/hotkey-router/blob/v0.6.0/data/browser-hotkeys.json)
3. **Schedule `on-events` 0.0.11 separately.** Seven consumers were pinned to `0.0.10`. The patch rolls back listeners already registered when setup fails partway through `On.batch()` or `On.hover()`. The rollout is complete when the upgrades and applicable host pins have landed and the regenerated report shows all seven current. [Consumer report](https://github.com/iWhatty/static-web-watt3d/blob/3329f1cd4d3b573d16ce1c66161111285132b504/docs/npm-consumers.md#on-events) · [`on-events` changelog](https://github.com/iWhatty/on-events/blob/902e80aac2e647693c36d54ec59d2be2cf7c1f18/CHANGELOG.md)

## CTO review

1. **Add a local `release:verify` command.** Take a named release commit and a frozen install, build once, run the unit and guarded Chrome/Edge checks, and test the packed package on the advertised Node 18 floor and the current runtime. Print the artifact path, integrity hash, and a publish command that can be run from the repo root. Keep the approval step in the operator’s terminal. For 0.6.0, automated browser approval expired and publishing the verified tarball from the operator’s terminal succeeded. [Testing guide](../testing.md)
2. **Use the existing consumer workflow for the next fleet rollout.** The scanner now reads committed gitlinks and the runbook distinguishes lock-only updates from range bumps. During the `on-events` rollout, record which steps still need manual work before proposing more automation. [Pinned-source scanner fix](https://github.com/iWhatty/static-web-watt3d/commit/29c5f58744384bdb5cc426a895f80cd307ee7444) · [Consumer runbook](https://github.com/iWhatty/static-web-watt3d/blob/3329f1cd4d3b573d16ce1c66161111285132b504/docs/npm-packages.md#updating-consumers)
3. **Keep the Windows Sandbox PR in draft until there is a real run.** The acceptance evidence is an end-to-end run inside Windows Sandbox that writes `docs/notes/key-check-reserved-<date>.md`. This can proceed independently of the shipped release. [Draft PR #16](https://github.com/iWhatty/hotkey-router/pull/16)

## Next sprint decisions

- Choose whether the next sprint’s primary outcome is reliable WebRadar shortcuts on the affected platforms or repeatable hotkey-router releases.
- Decide whether the shortcut work can ship with safer defaults or needs a wider picker change.
- Track the `on-events` fleet rollout separately and keep the Sandbox draft gated on the report from a real run.
