# Checking a hotkey before saving it

`hotkey-router/validate` checks a hotkey someone recorded in a "press your
keys" setting, before the app saves it. It answers in plain sentences that
are ready to show next to the field.

It loads both data tables (the browser/OS reservations and the website
shortcuts): about 69 KB minified, ~16 KB gzipped, in an app bundle. Import
it in the settings page that records keys, not in code that runs on every
page.

## Example

```js
import { comboFromEvent } from 'hotkey-router'
import { validateCombo } from 'hotkey-router/validate'

field.addEventListener('keydown', (e) => {
  e.preventDefault()
  const hotkey = comboFromEvent(e, { useMod: true }) // e.g. 'mod+shift+code:Period'
  if (!hotkey) return // only modifiers held so far
  const { ok, reasons } = validateCombo(hotkey, {
    requirePrimary: true,          // must include Ctrl (Cmd on macOS)
    minModifiers: 2,
    taken: ['mod+shift+code:Space'],
  })
  show(reasons.map((r) => r.message))
  if (ok) save(hotkey)
})
```

`comboFromEvent` records the physical key (`code:Period`), so the saved
hotkey works on any keyboard layout. See
[the README](https://github.com/iWhatty/hotkey-router/blob/main/README.md#combofromeventevent-options).

## `validateCombo(hotkey, options?)`

Returns `{ ok, reasons, lookupKeys }`.

- `ok` is `false` when any reason is an error, `true` otherwise (warnings
  only, or nothing to say).
- `reasons` is a list of `{ code, severity, message, platforms?, details? }`.
  `severity` is `'error'` or `'warning'`. `platforms` lists the platforms the
  reason applies to; the same message on several platforms is one reason.
- `lookupKeys` maps each checked platform to the canonical key the tables
  use, with `mod` resolved: `{ mac: 'meta+shift+period', windows:
  'ctrl+shift+period', linux: 'ctrl+shift+period' }`.

The parsing is lenient: it reads what it can and doesn't repeat the
router's syntax checks, so a string that `bind` would refuse (`k+ctrl`,
two `code:` tokens) isn't always flagged. Strings from `comboFromEvent`
are always well formed; for hand-typed ones, call `parseHotkey` first and
show its error.

### Options

| Option | Default | What it does |
| --- | --- | --- |
| `platforms` | `['mac', 'windows', 'linux']` | Platforms to check. `mod` is resolved for each one. |
| `browsers` | `['chrome', 'firefox', 'edge', 'safari']` | Browsers to check against the reservation table. Safari is checked on macOS only. |
| `sites` | `true` | Warn about popular sites that use the same keys. |
| `requirePrimary` | `false` | Require Ctrl (Cmd on macOS). |
| `minModifiers` | `1` | Fewest modifiers a hotkey may have (when it has any; none is `no-modifier`). |
| `taken` | `[]` | Hotkeys the app already uses. Compared per platform after parsing, so `mod+shift+code:Space` and `ctrl+shift+space` are the same on Windows. |

### Reason codes

Errors (`ok: false`):

| Code | When |
| --- | --- |
| `invalid` | Nothing was recorded: not a string, or an empty one. |
| `no-key` | Only modifiers, no key. |
| `no-modifier` | No modifier at all, so the key would fire while typing. |
| `alt-only` | Alt is the only modifier, on Windows or Linux (releasing Alt focuses the browser's menu). |
| `needs-primary` | `requirePrimary` is set and there's no Ctrl (Cmd on macOS). |
| `too-few-modifiers` | Fewer modifiers than `minModifiers`. |
| `taken` | Same keys as an entry in `taken`; `details.combo` is that entry. |
| `reserved` | The browser or OS takes the keys before the page (severity `hard`, `os` or `menu-activation`). `details` has `browser` and `action`. |
| `shifted-punctuation` | A key-based Shift chord with `` , . / ; ' [ ] \ - = ` ``, which never matches on US layouts. `details.suggestion` is the `code:` spelling, e.g. `ctrl+shift+code:Comma`. |

Warnings (`ok` stays `true`):

| Code | When |
| --- | --- |
| `reserved-soft` | The browser uses the keys only in some situations, or it's a `preventable` key (most Ctrl+letter keys on Windows and Linux): the page gets it first and wins with `preventDefault: true`. `details` has `browser`, `action` and `severity`. |
| `altgr` | Ctrl+Alt on Windows: on some layouts that is AltGr typing a character, and the router skips those keystrokes. |
| `site-conflict` | Sites in the website table use the same keys; `details.sites` lists their names. Linux uses the Windows column. |

The reservation rows and severities are described in
[docs/reservations.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/reservations.md),
the website table in
[docs/sites.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/sites.md).

## Messages

Messages name modifiers the way the checked platforms do: `Cmd` when only
macOS is checked, `Ctrl` when macOS isn't, and both when it's mixed. Some
examples, from the default options:

- `Use at least one modifier (Ctrl, Alt, Shift or Cmd), or the key would fire while typing.`
- `Alt on its own moves focus to the browser menu when released. Add Ctrl or Shift.`
- `Chrome on macOS uses these keys (New tab), so a page never sees them.`
- `"ctrl+shift+," never fires on US layouts: Shift turns "," into "<". Bind "ctrl+shift+code:Comma" instead.`
- `Also used by Slack.`

Use `code`, not `message`, to decide anything in code: the wording may
change.
