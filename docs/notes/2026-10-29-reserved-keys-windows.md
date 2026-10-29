# Which "hard" Ctrl+letter keys a page can take — Windows, 2026-10-29

Question: `data/browser-hotkeys.json` marked almost every Windows Ctrl+letter
`hard` (the browser takes the key, and `preventDefault` can't win it back).
GitHub and Slack use Ctrl+K; Google Docs takes Ctrl+F and Ctrl+P. So was the
table too strict?

Answer: yes. With real key presses in Chrome 156, Edge 156 and Firefox 159
on Windows 10 (US layout), **every Ctrl+letter in the table reaches the page
first, and a binding with `preventDefault: true` keeps the browser out**,
except **Ctrl+T, Ctrl+N and Ctrl+W**. The page never sees those three, and
the browser opens the tab or window, or closes the tab, regardless.

Raw results per browser and key: [key-check-reserved-2026-10-29.md](key-check-reserved-2026-10-29.md).

## How it was checked

`scripts/key-check-reserved.ahk` opens `playground/key-check-reserved.html`
in each browser (throwaway profile under `%TEMP%`), with every Ctrl+letter
bound through hotkey-router with `preventDefault: true`, and presses each key
for real with `SendInput`. Playwright can't answer this question, because its
keys go straight to the page and skip the browser's shortcut layer.

For each key it records:

- from the page: the keydown, whether the binding fired, whether the default
  was cancelled, and any sign of the browser acting (window blur when the
  find bar, address bar or print preview takes focus, `beforeprint`, tab
  hidden, `pagehide`, resize, copy/cut/paste, selection);
- from outside: which window is in front, and which new windows or dialogs
  appeared for the browser's process.

Then it undoes what the browser did: closes new windows and dialogs, closes a
tab that took over, presses Esc twice and clicks the page.

**Control pass** (`?bound=0`, nothing bound): Ctrl+E, F, G, K, L, P. In all
three browsers each one reached the page, and the browser then acted (focus
left the page; Ctrl+P also fired `beforeprint`; Edge's find bar showed up as
a new window). So the check does see the browser's action when nothing stops
it. The same keys with a binding showed none of it.

## Results (bound pass)

| Keys | Chrome | Edge | Firefox |
| --- | --- | --- | --- |
| Ctrl+A C V X Z Y, B D E F G H J K L M O P S U R | page wins | page wins | page wins |
| Ctrl+T, Ctrl+N, Ctrl+W | browser only | browser only | browser only |

"Page wins" means the keydown reached the page, the binding fired with
`defaultPrevented: true`, and nothing showed the browser acting.

Caveats:

- Ctrl+A C V X Z Y and Edge's Ctrl+M (mute) have no visible default on a page
  without a text field, so "nothing seen" there rests on the keydown arriving
  with `defaultPrevented`. The editing keys are well known to follow it
  (cancelling keydown cancels the clipboard command); mute was not observed.
- The first Chrome run had Ctrl+X, Y, H, J and K interrupted: another app's
  window came to the front. They were rerun at 01:00 with nothing else
  running, and all five came back "page wins". The script now stops before
  typing if another window is in front, and the report flags such rows.
- Not checked: Ctrl+Shift rows, Alt rows, F-keys, macOS (Cmd rows) and Linux.
  The table's Linux browser rows are `$ref`s to the Windows ones, so this
  change applies to Linux too. Chromium and Firefox use the same reserved-key
  lists on both, but no real-key check was run on Linux.

## Change made to the table

- New severity level **`preventable`** (soft): the browser's own
  shortcut, but keydown reaches the page first, and `preventDefault()` keeps
  the browser out. None of the existing levels fit: `find-bar-only` and the
  others describe keys that the browser takes only in some situations.
- Windows Chrome, Edge and Firefox: every Ctrl+letter row except Ctrl+T, N, W
  goes from `hard` to `preventable` (55 rows). Ctrl+T, N, W stay `hard`.
- Firefox: new `preventable` rows for Ctrl+E and Ctrl+K. The unbound pass
  shows the search bar taking focus, and the bound pass shows the page
  winning; the table had no row for them.
- `version.generated` is now 2026-10-29.

Effect for users: `installReservationWarnings` no longer says these keys
will not fire. Bound without `preventDefault: true` they still log `warn`,
saying the browser acts too; with it, `info`. `validateCombo` reports `reserved-soft`
(warning) instead of `reserved` (error), so pickers stop refusing Ctrl+K.

## Rerunning

Each run is short and takes turns with you. It waits until the keyboard and
mouse have been idle for 10 seconds before each key, and stops if another
window comes to the front. Defaults to 8 keys per browser (F K P S L, plus
T N W as the hard controls), about a minute when nobody is at the PC:

    "C:\Program Files\AutoHotkey\AutoHotkey.exe" scripts\key-check-reserved.ahk
    node scripts\key-check-reserved-report.mjs

`... key-check-reserved.ahk all all control` runs every key and the control
pass. Rerun it when reviewing the table (docs/data-review.md), or after a
browser release that changes shortcuts.
