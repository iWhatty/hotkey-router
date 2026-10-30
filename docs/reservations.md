# Reservation warnings

`hotkey-router/reservations` knows which keys the browser and the operating
system use for themselves, and `hotkey-router/auto` wires that knowledge into
the default router: when you bind a reserved key, the console says so. The
core router ships none of this data; you opt in by importing one of the two.

About 24 KB minified (~5.6 KB gzipped), mostly the table in
[`data/browser-hotkeys.json`](https://github.com/iWhatty/hotkey-router/blob/main/data/browser-hotkeys.json).
Load it in development builds, a settings page or a key picker, not on every
page in production, unless you need `lookupReservation` at runtime.

## Turning warnings on

One import: `hotkey-router/auto` is the default router (the same object as
`hotkey-router`) with warnings installed, so bindings made through either
import are checked.

```js
import hotkeys from 'hotkey-router/auto'

hotkeys.bind('meta+shift+f', toggleFullscreen)
// Firefox on macOS:
// [hotkey-router] "meta+shift+f" (meta+shift+f) reserved by firefox on macOS: "Toggle fullscreen" [hard] — will not fire.
```

Or install them yourself, on the default router or on any router from
`createRouter()`:

```js
import hotkeys from 'hotkey-router'
import { installReservationWarnings } from 'hotkey-router/reservations'

const uninstall = installReservationWarnings(hotkeys)
```

`installReservationWarnings(router, options?)` subscribes to the router's
`onBind` hook and returns an `uninstall()` function. Warnings are per router:
installing them on one router doesn't cover another. A warning is never
fatal; the binding is registered either way.

The CDN file `dist/auto.min.js` is a standalone build with its own copy of
the router. Don't mix it with other hotkey-router imports on the same page.

To keep warnings out of production, import by build flag rather than by
environment sniffing, for example
`if (__DEV__) installReservationWarnings(hotkeys)` with `__DEV__` defined by
your bundler.

### Options

| Option | Default | What it does |
| --- | --- | --- |
| `platform` | `detectPlatform()` | `'mac'`, `'windows'` or `'linux'` |
| `browser` | `detectBrowser()` | `'chrome'`, `'edge'`, `'firefox'` or `'safari'` |
| `console` | global `console` | any object with `warn` and `info`, e.g. for tests |

If the platform or the browser can't be detected (Node, an unknown browser)
and you didn't pass one, nothing is checked.

```js
// Tests, SSR previews, or checking another machine's keys
installReservationWarnings(hotkeys, { platform: 'mac', browser: 'firefox' })
```

### Per binding

```js
hotkeys.bind('meta+shift+f', toggleFullscreen, null, { warnOnReserved: false })
```

## Severities

Each row in the table has a severity. The first three mean the page never
gets the key; the rest are soft.

| Severity | Logged with | Meaning |
| --- | --- | --- |
| `hard` | `warn` | The browser takes the key before the page sees a keydown. Won't fire. |
| `os` | `warn` | The operating system takes the key, before any app. Won't fire. |
| `menu-activation` | `warn` | Alt+letter opens the browser's menu bar (Windows, Linux). |
| `preventable` | `warn`, or `info` with `preventDefault: true` | The browser's shortcut, but the page sees it first: `preventDefault: true` keeps the browser out; without it, both act. |
| `find-bar-only` | `info` | Reserved only while the browser's find bar has focus. |
| `compose` | `info` | macOS Option+letter types a character in text fields. |
| `system-text` | `info` | macOS Ctrl+letter text-cursor keys inside text fields. |
| `devtools-open` | `info` | Only while DevTools is open. |

The table currently has rows for `hard`, `os`, `preventable`,
`menu-activation` and `find-bar-only`; the other three severities are
defined for data that may be added later.

The warning text says what will happen: `will not fire` (hard tiers),
`fires, and the browser acts too; bind with preventDefault: true` or
`fires first; preventDefault keeps the browser out` (preventable), or
`fires in normal browsing` (other soft tiers).

## Looking keys up yourself

For a cheatsheet that flags conflicts, or a key picker that checks a key at
runtime:

```js
import { parseHotkey } from 'hotkey-router'
import { lookupReservation } from 'hotkey-router/reservations'

const { combo } = parseHotkey('meta+shift+f')
lookupReservation(combo, { platform: 'mac', browser: 'firefox' })
// { source: 'browser', platform: 'mac', browser: 'firefox',
//   lookupKey: 'meta+shift+f', action: 'Toggle fullscreen', severity: 'hard' }
```

`lookupReservation(combo, { platform, browser })` takes a parsed combo (the
`combo` from `parseHotkey`, or the one an `onBind` hook receives) and returns
the browser's row, else the system's row, else `null`. It also returns `null`
without a `platform`. Without a `browser` it checks the system rows only.
`mod` is resolved when the hotkey is parsed, so pass the same platform to
`parseHotkey` when you check another machine's keys.

Everything `hotkey-router/reservations` exports:

| Export | What it is |
| --- | --- |
| `installReservationWarnings(router, options?)` | Wires warnings into a router; returns `uninstall()`. |
| `lookupReservation(combo, { platform, browser })` | The reservation for a combo, or `null`. |
| `lookupKeyFromCombo(combo)` | The table's key for a combo: `ctrl+meta+alt+shift+base`, e.g. `ctrl+shift+period`. |
| `formatReservationWarning(reservation, hotkey, bindOptions?)` | The warning text. |
| `emitReservationWarning(reservation, hotkey, console?, bindOptions?)` | Logs it with `warn` or `info` as in the table above. |
| `severityIsHard(severity)` / `severityIsSoft(severity)` | Which group a severity is in. |
| `detectPlatform(navigator?, { chromeos? })` / `detectBrowser(navigator?)` | The detectors the module uses. |
| `HOTKEY_DATA`, `SCHEMA_VERSION`, `DATA_GENERATED` | The raw table, its schema version and its date. |

The raw table is also importable as `hotkey-router/data/browser-hotkeys.json`.

## Caveats

- The table has default keybindings only. Users who remap shortcuts (Edge's
  settings, Firefox add-ons, the OS) may differ.
- Platforms: `mac` (Chrome, Firefox, Safari), `windows` and `linux` (Chrome,
  Edge, Firefox). Linux shares the Windows browser rows; its system rows are
  GNOME's. KDE and XFCE aren't catalogued. Edge on macOS has no rows of its
  own, so only the macOS system rows apply there.
- Keyboard layouts change which physical key types a given letter. The
  lookup reads both `key` and `code:` bindings (`mod+shift+/` and
  `mod+shift+code:Slash` find the same row), but a shifted character such as
  `?` depends on the layout: bind the physical key.
- macOS menu shortcuts every app gets from the system (Cmd+Shift+/ for Help
  search, Cmd+H, Cmd+Option+H, Cmd+M, Cmd+Q, Cmd+`) are in the mac `system`
  rows.

## How the table is checked

The rows are read from the browser and OS vendors' help pages (listed in
`version.sources` of the JSON) and reviewed by hand twice a year; see
[docs/data-review.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/data-review.md).
`npm run data:age` and `node build.js` warn once the table is older than six
months.

Help pages don't say whether a page can win a key, so the Windows
Ctrl+letter rows were checked with real key presses on 2026-10-29: an
AutoHotkey script (`scripts/key-check-reserved.ahk`) pressed every
Ctrl+letter in Chrome, Edge and Firefox on Windows 10 against a page that
binds them all with `preventDefault: true`, and recorded whether the page
got the keydown and whether the browser acted anyway. Every Ctrl+letter in
the table reached the page first and the binding kept the browser out,
except Ctrl+T, Ctrl+N and Ctrl+W, which the page never sees. Those three
stay `hard`; the rest are `preventable`. Linux uses the same browser rows,
but wasn't checked with real keys. Synthetic keys (Playwright) can't answer
this question, because they skip the browser's own shortcut handling.

- Method and summary:
  [docs/notes/2026-10-29-reserved-keys-windows.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/notes/2026-10-29-reserved-keys-windows.md)
- Raw results per browser and key:
  [docs/notes/key-check-reserved-2026-10-29.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/notes/key-check-reserved-2026-10-29.md)
