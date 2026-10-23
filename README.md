# hotkey-router

[![npm](https://img.shields.io/npm/v/hotkey-router)](https://www.npmjs.com/package/hotkey-router)
[![downloads](https://img.shields.io/npm/dm/hotkey-router)](https://www.npmjs.com/package/hotkey-router)
[![bundle size](https://img.shields.io/bundlephobia/minzip/hotkey-router)](https://bundlephobia.com/package/hotkey-router)
[![license](https://img.shields.io/npm/l/hotkey-router)](https://github.com/iWhatty/hotkey-router/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/hotkey-router?style=social)](https://github.com/iWhatty/hotkey-router)
[![types](https://img.shields.io/npm/types/hotkey-router)](https://www.npmjs.com/package/hotkey-router)

A tiny, deterministic keyboard routing engine for modern web apps. Not a key utility, a predictable plugin-first routing layer for keyboard shortcuts.

## Features

- O(1) dispatch
- Plugin-safe lifecycle management
- Deterministic winner selection (priority + recency)
- Input-safe by default
- Testable via `trigger()`
- Optional opt-in browser/OS conflict warnings (tree-shakable)
- Display helpers: `Ctrl+Shift+.` / `⇧⌘.` and accessible keycaps (`hotkey-router/format`)
- ~4 kB minified + gzipped (core); ~8.5 kB with conflict warnings
- Zero dependencies

---

## Install

```sh
pnpm add hotkey-router
```

ESM:

```js
import hotkeys from 'hotkey-router'
```

CommonJS:

```js
const hotkeys = require('hotkey-router')
```

CDN (ESM):

```js
import hotkeys from 'https://cdn.jsdelivr.net/npm/hotkey-router/dist/hotkey-router.min.js'
```

---

## Quick start

```js
import hotkeys from 'hotkey-router'

// Simple keydown
hotkeys.bind('ctrl+k', () => {
  openCommandPalette()
})

// Multi-modifier combos, including the spacebar
hotkeys.bind('mod+shift+space', summonCommandPalette)

// Keyup using " up" suffix
hotkeys.bind('ctrl+p up', () => {
  console.log('Released CTRL+P')
})

// AHK-style modifiers also supported
hotkeys.bind('^k', () => {
  openCommandPalette() // ctrl+k
})

// Bare-modifier bindings (Alt-as-mode UX)
hotkeys.bind('alt', enterSelectMode)        // fires on Alt keydown
hotkeys.bind('alt up', exitSelectMode)      // fires on Alt keyup

// Layout-stable matching via KeyboardEvent.code (cross-platform Alt+letter,
// works on macOS where Option remaps Alt+X to ≈)
hotkeys.bind('alt+code:KeyX', deleteHovered, null, { preventDefault: true })

// Plugin grouping
hotkeys.registerPlugin('docs', {
  'ctrl+f': openSearch,
  'escape': closeSearch,
})
```

---

## API

### `bind(hotkey, handler, plugin?, options?)`

Register a hotkey. Returns an `off()` function.

```js
const off = hotkeys.bind('mod+k', openPalette)

// Later
off()
```

**Options**

```ts
{
  preventDefault?: boolean
  stopPropagation?: boolean
  stopImmediatePropagation?: boolean
  repeat?: boolean         // default false on keydown
  once?: boolean
  when?: (event) => boolean
  allowIn?: (event) => boolean
  priority?: number        // default 0
  warnOnReserved?: boolean // only read when conflict warnings are installed
  capture?: boolean        // v0.3.0+: run in the capture phase, before the page's listeners
  altGraph?: boolean       // v0.3.0+: also fire on an AltGr keystroke that types a character
  composing?: boolean      // v0.3.0+: also fire during IME composition
}
```

By default (v0.3.0+), a binding is skipped when the keystroke is AltGr typing
a character (Windows reports AltGr as Ctrl+Alt, so `ctrl+alt+code:Comma`
would otherwise swallow the `<` a Polish or Czech user typed) and while an
IME is composing.

`when` and `allowIn` receive the `KeyboardEvent`, not an element. To check
where the key was typed, read `event.composedPath()[0]` (the element inside an
open shadow root) or `event.target`.

**Shifted punctuation.** With Shift held, `event.key` is the shifted
character, so a key-based `ctrl+shift+,` waits for a `,` that a US keyboard
reports as `<`, and never fires. Bind the physical key instead:
`ctrl+shift+code:Comma`. Since v0.3.3, `bind()` warns once in the console for
Shift with `` , . / ; ' [ ] \ - = ` ``, and `validateCombo` rejects it with the
reason `shifted-punctuation`.

**Non-Latin layouts (v0.3.3+).** On a Russian layout Ctrl+K reports
`event.key === 'л'` with `event.code === 'KeyK'`. Like the browser's own
shortcuts, a key-based `ctrl+k` binding still fires there: when Ctrl or Cmd is
held (Shift allowed, Alt not), the key types a letter from a non-Latin script
(Cyrillic, Greek, Hebrew, Arabic, ...), and `code` is `KeyA`..`KeyZ`, the
router also looks up the Latin letter for that key. It does this only when no
exact binding is eligible, so a `ctrl+л` or `ctrl+code:KeyK` binding always
wins over it. Plain and Shift-only letters (typing), Alt and AltGr chords, IME
composition, digits and Latin layouts such as AZERTY are never affected. To
require the exact character, gate the binding: `when: (e) => e.key === 'k'`.

**Examples**

Ignore repeat keydown (default behavior):

```js
hotkeys.bind('j', nextItem)
```

Allow inside inputs:

```js
hotkeys.bind('mod+k', openPalette, null, {
  allowIn: () => true,
  preventDefault: true,
})

// Only in one field (the event, not the element, is passed in)
hotkeys.bind('enter', submitFollowUp, null, {
  allowIn: (e) => e.composedPath()[0] === followUpInput,
})
```

Conditional binding:

```js
hotkeys.bind('delete', deleteItem, null, {
  when: () => selectionCount() > 0,
})
```

Run once:

```js
hotkeys.bind('ctrl+s', saveDraft, null, { once: true })
```

### `unbind(hotkey, handler?)`

Remove bindings.

```js
hotkeys.unbind('ctrl+k')
hotkeys.unbind('ctrl+k', openPalette)
```

### `registerPlugin(name, map)`

Batch register hotkeys under a plugin namespace.

```js
const unregister = hotkeys.registerPlugin('files', {
  'mod+o': openFile,
  'delete': deleteFile,
})

// Later
unregister()
```

Plugin cleanup is isolated. Removing one plugin never affects other bindings.
If any key string fails to parse, `registerPlugin` throws and binds nothing
(v0.3.3+).

### `unregisterPlugin(name)`

Remove all hotkeys associated with a plugin.

### `onBind(hook)`

Subscribe to bind events. The hook receives `{ combo, raw, options, plugin, id }` after every successful `bind()`. Returns an unsubscribe function. Used internally by `installReservationWarnings`; exposed for telemetry, dev panels, and custom validation.

```js
const off = hotkeys.onBind(({ raw }) => {
  console.debug('bound:', raw)
})
// off() unsubscribes.
```

Hook errors are caught and logged via `console.error`. A buggy hook can't break the bind.

### `pause()` / `resume()`

Temporarily disable or re-enable all routing.

### `ignoreInput(boolean = true)`

By default, hotkeys do **not** fire inside:

- `<input>`
- `<textarea>`
- `<select>`
- `[contenteditable]`
- `role="textbox"`

This includes those elements inside an open shadow root (v0.3.3+; the router
reads `event.composedPath()[0]`). A closed shadow root hides its inside from
the page, so only its host element is checked there.

Every `<input>` counts, whatever its `type` and whatever modifiers are held:
a checkbox, radio, range slider, color or file input blocks `ctrl+k` as well
as Space. A native `<button>` is **not** on the list, so a plain `space` or
`enter` binding fires while a button has focus; gate such bindings with
`when` if that matters.

Override per-binding with `allowIn()`:

```js
// Let the palette open from a focused checkbox or slider, but not from text fields
hotkeys.bind('mod+k', openPalette, null, {
  allowIn: (e) => ['checkbox', 'radio', 'range'].includes(e.composedPath()[0].type),
})
```

### `init(options?)`

Manually attach listeners.

```js
hotkeys.init({
  target: window,
  capture: false,
})
```

Auto-initializes on `window` by default (browser environments): importing
`hotkey-router` attaches `keydown` and `keyup` listeners to `window` straight
away, and `hotkey-router/auto` also installs the reservation warnings. The
package's `sideEffects` list names those files so bundlers keep that work;
`/reservations`, `/sites`, `/validate` and `/format` do nothing at import and
tree-shake away when unused.

With `capture: false` (the default), bindings run in the bubble phase except
those bound with `{ capture: true }`, which a second, capture-phase listener
handles (v0.3.0+). `capture: true` here runs every binding in the capture
phase.

### `parseHotkey(hotkey, options?)` / `comboFromEvent(event, options?)` (v0.3.0+)

Named exports (also on the default object). `comboFromEvent` turns a
keyboard event into a hotkey string for a "press your keys" recorder:
physical by default, `{ useMod: true }` writes the platform's primary
modifier as `mod`, and it returns `null` while only a modifier is held.
Both take `{ platform }` (v0.3.2+) to resolve `mod` for a platform other
than the one detected.

```js
import { comboFromEvent } from 'hotkey-router'

input.addEventListener('keydown', (e) => {
  const combo = comboFromEvent(e, { useMod: true }) // 'mod+shift+code:Period'
  if (combo) save(combo)
})
```

### `detectPlatform(navigator?, { chromeos? })` (v0.3.2+)

The one platform detector the router, reservations, sites, validate and
format all use: `'mac'`, `'windows'`, `'linux'` or `null`. ChromeOS counts as
`'linux'` unless you pass `{ chromeos: true }`. Reads
`navigator.userAgentData.platform`, then `navigator.platform`, then the user
agent. Also exported from `hotkey-router/reservations`.

### `destroy()`

Removes all listeners and clears internal state.

### `trigger(hotkey, options?)`

Programmatically trigger a hotkey. Useful for testing.

```js
hotkeys.trigger('ctrl+k')
hotkeys.trigger('ctrl+k', { target: inputElement }) // as if typed in the input
```

Returns `true` if a handler ran. Since v0.3.2 it fires what a real keypress
would: the synthetic event has both `key` and `code` (US layout), so
`trigger('ctrl+k')` also fires a `ctrl+code:KeyK` binding and the reverse,
and the same guards apply (`when`, `ignoreInput`/`allowIn` with `target`,
priority, `once`, `pause()`).

---

## Notes

### Routing model

When multiple handlers match the same hotkey:

1. Highest `priority` wins.
2. If equal priority, newest binding wins.

This makes modal overrides simple:

```js
hotkeys.bind('escape', closeModal, null, {
  priority: 100,
  preventDefault: true,
})
```

### Bare-modifier bindings (v0.1.0+)

Some UX patterns are driven by a bare modifier rather than a chord. For example, "hold Alt to enter select mode, release Alt to exit."

```js
hotkeys.bind('alt', onAltDown)       // fires on Alt keydown
hotkeys.bind('alt up', onAltUp)      // fires on Alt keyup
hotkeys.bind('ctrl', onCtrlDown)     // any single modifier supported
```

- Only **single** bare modifiers are supported. Multi-modifier bare bindings (`'ctrl+alt'`) throw, add a base key for those.
- Default `repeat: false` applies, so a held modifier fires only once on keydown.
- Loose match: a bare-Alt binding fires whenever the Alt key is the one being pressed/released, regardless of which other modifier flags are also set. Add a `when` filter for exact-set semantics.

### Code-based matching (v0.1.0+)

`KeyboardEvent.key` is layout- and modifier-dependent. Alt+X gives `≈` on macOS, `x` on Linux/Windows. For shortcuts that should be stable across platforms, bind to `KeyboardEvent.code` instead:

```js
hotkeys.bind('alt+code:KeyX', deleteHovered)   // matches the physical X key
hotkeys.bind('ctrl+code:Digit1', goToTab1)     // matches digit row, not numpad
hotkeys.bind('!code:KeyX', deleteHovered)      // AHK shorthand also works
```

The `code:` value is **case-sensitive** (matches the camelCase `KeyboardEvent.code` spec values: `KeyA`, `Digit1`, `ArrowLeft`, etc.). Only one `code:` token per binding is allowed; multiple `code:` tokens throw a parse error. Both key-based and code-based bindings can coexist; the standard priority + recency rules pick the winner.

### Conflict warnings (v0.2.0+)

Some combos are reserved by the browser chrome (find bar, devtools, bookmarks) or the OS (Spotlight, window management). They never reach page-world JavaScript, no matter how early you listen or whether you call `preventDefault`. hotkey-router ships an **opt-in** reservation table that emits a soft warning at bind time, so the silent failure becomes a noisy one.

The feature is opt-in by design: the core router is ~9 KB minified (~4 KB gzipped), and the reservation module (~23 KB minified, ~5.5 KB gzipped, mostly data) is tree-shaken out entirely unless you import it.

**Two ways to opt in.** One-line ergonomic, use the `auto` entry. Same default export as `hotkey-router`, with warnings pre-installed:

```js
import hotkeys from 'hotkey-router/auto'

hotkeys.bind('meta+shift+f', toggleFullscreen)
// Firefox on macOS:
// [hotkey-router] "meta+shift+f" reserved by firefox on macOS:
//   "Toggle fullscreen" [hard], will not fire.
```

Explicit install, keep using the tiny core, install warnings yourself:

```js
import hotkeys from 'hotkey-router'
import { installReservationWarnings } from 'hotkey-router/reservations'

installReservationWarnings(hotkeys)
hotkeys.bind('meta+shift+f', toggleFullscreen)
```

`installReservationWarnings()` returns an `uninstall` function if you ever need to detach. The warning is **never fatal**, the binding is still registered, in case you're running in a browser/platform where the conflict doesn't apply.

**Severity to log level:**

| Severity          | Log level | Meaning                                                 |
| ----------------- | --------- | ------------------------------------------------------- |
| `hard`            | `warn`    | Browser intercepts before page world; combo won't fire. |
| `os`              | `warn`    | OS intercepts globally.                                 |
| `menu-activation` | `warn`    | Alt+letter activates the browser menu bar (Win/Linux).  |
| `find-bar-only`   | `info`    | Reserved only when the find bar is focused.             |
| `compose`         | `info`    | macOS Option+letter types a special char in inputs.     |
| `system-text`     | `info`    | Mac Ctrl+letter cursor controls inside text inputs.     |
| `devtools-open`   | `info`    | Only relevant when DevTools is already open.            |

**Per-bind opt-out:**

```js
hotkeys.bind('meta+shift+f', toggleFullscreen, null, { warnOnReserved: false })
```

To turn warnings off globally, just don't install them (use the bare `hotkey-router` entry instead of `hotkey-router/auto`).

**Force a platform/browser (tests, SSR previews):**

```js
installReservationWarnings(hotkeys, { platform: 'mac', browser: 'firefox' })
```

Accepted platforms: `'mac' | 'windows' | 'linux'`. Browsers: `'firefox' | 'chrome' | 'safari' | 'edge'`.

**Caveats:**

- Reservations reflect **default** keybindings. Users with custom shortcuts (Edge 95+ rebinds, Firefox add-ons, OS-level customization) may not match.
- KDE/XFCE desktop reservations beyond GNOME are not yet catalogued. Linux coverage is conservative.
- Layout-specific differences (Dvorak, AZERTY) change which physical key produces `event.key === 'f'`. For layout-stable bindings against the physical key, use `code:KeyX` syntax. The reservation lookup normalizes both.
- macOS menu-bar shortcuts that every app gets from the system (Cmd+Shift+/ for Help menu search, Cmd+H, Cmd+Option+H, Cmd+M, Cmd+Q, Cmd+`) are listed under the mac `system` table. Punctuation matches whether you bind it by code (`mod+shift+code:Slash`) or by key (`mod+shift+/`); a shifted character such as `?` depends on the layout, so bind the physical key.

**Programmatic lookup.** If you want to query the table yourself (e.g. building a cheatsheet that flags conflicts):

```js
import { lookupReservation } from 'hotkey-router/reservations'

const r = lookupReservation(
  { meta: true, shift: true, key: 'f' },
  { platform: 'mac', browser: 'firefox' }
)
// → { source: 'browser', action: 'Toggle fullscreen', severity: 'hard', ... }
```

**Extension hook (`onBind`).** Reservation warnings are built on a public `onBind` hook, useful for telemetry, dev panels, or any cross-cutting concern that needs to observe every binding:

```js
const off = hotkeys.onBind(({ combo, raw, options, plugin, id }) => {
  // combo: parsed combo { ctrl, meta, alt, shift, key, code, bareModifier }
  // raw:   original hotkey string
})
// off() unsubscribes.
```

### Website shortcuts (v0.3.0+)

Apps that run on other people's pages (browser extensions, embedded widgets)
collide with the page's own shortcuts: Google Docs uses Ctrl+Shift+. for font
size, GitHub for "quote". Unlike browser keys, those reach the page, so the
app can choose. `hotkey-router/sites` knows which popular sites use which
chords in the Ctrl/Cmd+Shift, Ctrl/Cmd+Alt, Shift+Alt and Ctrl/Cmd+Alt+Shift
families ([docs/site-hotkeys.md](docs/site-hotkeys.md), sourced data in
`data/site-hotkeys.json`) and builds a `when()` gate that yields to the site
unless the user is focused on the app:

```js
import hotkeys from 'hotkey-router'
import { siteAware } from 'hotkey-router/sites'

hotkeys.bind('mod+shift+code:Period', nextTypo, null, {
  capture: true,          // see the key before the page's editor
  preventDefault: true,
  stopPropagation: true,  // when we take it, the page doesn't run it too
  allowIn: () => true,
  when: siteAware('mod+shift+code:Period', {
    engaged: () => popupIsOpen() || panelHasFocus(),
  }),
})
```

On sites that don't use the chord the gate is always true. On sites that do
(Docs, Slides, Confluence, GitHub, WordPress ...), it returns `engaged()`;
when that is false, the router leaves the event untouched and the site's
shortcut runs.

Also exported: `lookupSiteConflicts(combo, { url, platform, verifiedOnly })`,
`matchSites(url)`, `siteLookupKey(combo, platform)`, `detectSitePlatform()`
and `listSites()`. Platforms: `windows` (also used for Linux), `mac`,
`chromeos`. The module is ~38 KB minified (~9 KB gzipped, mostly the table)
and imports nothing from the core, so it never creates a second router.

### Validating a recorded combo (v0.3.0+)

For a "press your keys" setting: record with `comboFromEvent`, then check
with `hotkey-router/validate` before saving. Reasons come in plain language,
ready to show.

```js
import { comboFromEvent } from 'hotkey-router'
import { validateCombo } from 'hotkey-router/validate'

field.addEventListener('keydown', (e) => {
  e.preventDefault()
  const combo = comboFromEvent(e, { useMod: true })
  if (!combo) return // still holding modifiers
  const { ok, reasons } = validateCombo(combo, {
    requirePrimary: true,          // must include Ctrl (Cmd on macOS)
    minModifiers: 2,
    taken: ['mod+shift+code:Space'],
  })
  show(reasons.map((r) => r.message))
  if (ok) save(combo)
})
```

Errors (`ok: false`): no key, no modifier, Alt as the only modifier on
Windows/Linux, a rule you asked for (`requirePrimary`, `minModifiers`),
already in `taken`, or reserved by a browser/OS (never reaches the page).
Warnings (`ok: true`): reserved only in some situations, Ctrl+Alt acting as
AltGr on some Windows layouts, and sites that use the same keys.

It loads both data tables: with them, about 62 KB minified (~15 KB
gzipped). Import it in the settings page that records keys, not in code
that runs on every page.

### Showing a combo to people (v0.3.2+)

`hotkey-router/format` turns a hotkey string (or a parsed combo) into what
people read. It loads no data tables (~9 KB minified, ~3.5 KB gzipped).

```js
import { formatCombo, comboTokens, modifierLabel } from 'hotkey-router/format'

formatCombo('mod+shift+code:Period')                                       // 'Ctrl+Shift+.' (Windows/Linux)
formatCombo('mod+shift+code:Period', { platform: 'mac' })                  // 'Shift+Cmd+.'
formatCombo('mod+shift+code:Period', { platform: 'mac', style: 'glyphs' }) // '⇧⌘.'

comboTokens('mod+shift+code:Period', { platform: 'mac' })
// [{ label: '⇧', name: 'Shift',   modifier: 'shift' },
//  { label: '⌘', name: 'Command', modifier: 'meta' },
//  { label: '.', name: 'Period',  key: 'Period' }]

modifierLabel('alt', { platform: 'mac', style: 'both' })                   // '⌥ Option'
modifierLabel('mod')                                                       // 'Cmd' or 'Ctrl'
```

- `formatCombo(combo, { platform, style, order, separator })`: one string.
  `style: 'text'` (default) joins words with `+`; `'glyphs'` uses the macOS
  symbols (⌃ ⌥ ⇧ ⌘ ↩ ⌫ ⎋ ← …) with no separator.
- `comboTokens(combo, { platform, style, order })`: one keycap per key,
  `'glyphs'` by default. `name` is what a screen reader should say; put it in
  visually hidden text or `aria-label` next to a glyph.
- `modifierLabel(name, { platform, style })` (`'text'`, `'glyphs'` or
  `'both'`), `modifierName(name, { platform })` (spoken), `keyLabel(key,
  { platform, style })`, `listModifiers(names, { platform, conjunction })`
  (`'Ctrl, Alt or Shift'`), `platformLabel('mac')` (`'macOS'`),
  `browserLabel('edge')`.
- `KEY_LABELS`: label and spoken name for `KeyboardEvent.code` values
  (`Period` → `.` / "Period", `Enter` → Enter, Return on macOS, ↩).

Words per platform: macOS Cmd, Option, Control, Shift; Windows Ctrl, Alt,
Shift, Win; Linux the same with Super; ChromeOS with Search. `platform`
defaults to `detectPlatform()`. On Windows, Linux and ChromeOS `'glyphs'`
gives the same words as `'text'` (they have no modifier symbols).

**Modifier order.** Modifiers come in the platform's own order whatever order
the string is written in: on macOS Apple's ⌃⌥⇧⌘ (Control, Option, Shift,
Command), the order every Mac menu shows, so `mod+shift+.` is `⇧⌘.`; on
Windows, Linux and ChromeOS Win/Super/Search, Ctrl, Alt, Shift. Pass
`{ order: 'combo' }` to keep the written order (`⌘⇧.`).

### Supported syntax

**Standard:**

- `ctrl+k`
- `shift+a`
- `ctrl+k up`
- `mod+s` (meta on macOS, ctrl elsewhere)
- `ctrl++` or `ctrl+plus` (the `+` key; reservation and site lookups treat
  it as `=`, since `+` is Shift+= on most layouts)

**AHK-style prefix modifiers:**

- `^k` → `ctrl+k`
- `!k` → `alt+k`
- `+k` → `shift+k`
- `#k` → `meta+k`
- `^!k` → `ctrl+alt+k`

Modifiers must appear before the base key.

**Modifier aliases:**

- `ctrl`, `control`, `⌃`
- `shift`, `⇧`, `+`
- `alt`, `option`, `opt`, `⌥`, `!`
- `meta`, `cmd`, `command`, `win`, `⌘`, `#`
- `mod` (meta on macOS, ctrl elsewhere)

**Navigation / special key aliases:**

- `escape`, `esc`
- `enter`, `return`
- `space`, `spacebar`
- `tab`
- `backspace`
- `delete`, `del`
- `home`, `end`
- `pageup`, `pgup`
- `pagedown`, `pgdn`
- `up`, `down`, `left`, `right`
- `f1`–`f19`

Keys are case-insensitive.

### Philosophy

hotkey-router follows three core rules:

1. **Predictable routing.** Highest priority wins. Ties go to the most recently bound handler.
2. **Safe composition.** Plugins can register and unregister without affecting others.
3. **Modern only.** Built for modern browsers using `KeyboardEvent.key`.

No keycodes. No legacy IE hacks. No hidden global scope state.

### What this is not

- Not a keycode polyfill
- Not a legacy browser shim
- Not a global scope manager
- Not a VSCode-style sequence engine

This is a small, deterministic routing layer for modern applications.

### Browser support

Modern browsers supporting:

- `KeyboardEvent.key`
- `Map`
- `addEventListener`

Chrome, Firefox, Safari, Edge.

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
