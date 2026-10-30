# hotkey-router

[![npm](https://badgen.net/npm/v/hotkey-router)](https://www.npmjs.com/package/hotkey-router)
[![types](https://badgen.net/npm/types/hotkey-router)](https://www.npmjs.com/package/hotkey-router)
[![license](https://badgen.net/static/license/AGPL-3.0%20%2B%20terms/blue)](https://github.com/iWhatty/hotkey-router/blob/main/LICENSE)

A small, deterministic keyboard-shortcut router for modern web apps: named groups of bindings, one predictable
winner per key.

## First five minutes

```sh
npm install hotkey-router
```

```js
import hotkeys from 'hotkey-router' // starts listening on window

// `mod` is Cmd on macOS, Ctrl elsewhere
const off = hotkeys.bind('mod+shift+space', openPalette)

// A plugin is a named group of bindings that you remove together
hotkeys.registerPlugin('search', {
  '/': openSearch,
  'escape': [closeSearch, { allowIn: () => true }], // also from inside the search field
})

off()                              // remove one binding
hotkeys.unregisterPlugin('search') // remove the group
```

By default no binding fires while the user types in a field, chords included; `allowIn` opts one in (see
[`ignoreInput`](#ignoreinputvalue)).
During development, import `hotkey-router/auto` instead: it is the same router, and it warns in the console
when you bind a key the browser or OS keeps for itself.

## Why this library

- **`code:` bindings** match the physical key (`alt+code:KeyX`), whatever the layout or macOS Option types.
- **Non-Latin layouts:** `ctrl+k` still fires for Ctrl+K on a Russian, Greek or Hebrew layout, as browser
  shortcuts do.
- **AltGr and IME guards**, on by default: nothing fires while the user types `<` with AltGr or composes CJK
  text.
- **Input handling:** nothing fires from text fields by default; `'text'` mode lets chords through on
  checkboxes, sliders and buttons; `allowIn` overrides per binding.
- **One winner per key:** highest priority, then the most recent binding.
- **Several routers:** one per library on a shared page, or scoped to a dialog, shadow root or iframe.
- **Opt-in data:** which keys the browser and OS take, and which a page can win with `preventDefault` (Windows
  rows checked with real key presses); which keys popular websites use.
- **`validateCombo`** for "press your keys" settings, with reasons ready to show.
- Zero dependencies. Core ~11.2 KB minified, ~4.85 KB gzipped; the data lives in separate entries.

It doesn't do key sequences (`g i`, `ctrl+k ctrl+s`), and it targets current browsers only.

## Install

```sh
npm install hotkey-router   # or: pnpm add hotkey-router / yarn add hotkey-router
```

ESM:

```js
import hotkeys, { createRouter } from 'hotkey-router'
```

CommonJS (the router is the `default` export):

```js
const hotkeys = require('hotkey-router').default
const { createRouter } = require('hotkey-router')
```

Only the main entry has a CommonJS build. The subpaths (`/core`, `/auto`, `/reservations`, `/sites`,
`/validate`, `/format`) are ESM only; load them with `import`, or `await import()` from CommonJS.

CDN (ESM), pinned to a version:

```js
import hotkeys from 'https://cdn.jsdelivr.net/npm/hotkey-router@0.5.1/dist/hotkey-router.min.js'
```

`dist/auto.min.js` at the same path is the router with reservation warnings. It is a standalone build with its
own router, so don't load both.

Importing `hotkey-router` starts the default router on `window`. `hotkey-router/core` does nothing at import:
`createRouter` and the helpers, no router and no listeners until you start one.

```js
import { createRouter } from 'hotkey-router/core'

const keys = createRouter()
keys.init() // when your app is ready
```

## Hotkey syntax

A hotkey is a string: modifiers, then one key, joined by `+`, with an optional ` up` suffix for keyup (keydown
by default). The router parses it into a combo; a binding is a combo plus its handler and options.

| Hotkey | Meaning |
| --- | --- |
| `ctrl+alt+x`, `shift+a` | Modifiers before the key; `k+ctrl` throws. |
| `mod+shift+space` | `mod` is Cmd (meta) on macOS, Ctrl elsewhere, decided when the hotkey is parsed. |
| `ctrl+alt+x up` | Fires on keyup. |
| `^k` `!k` `+k` `#k` `^!k` | AutoHotkey prefixes: Ctrl, Alt, Shift, Meta, Ctrl+Alt. |
| `ctrl++`, `ctrl+plus` | The `+` key. |
| `alt+code:KeyX`, `!code:KeyX` | A `code:` binding: the physical key, by `KeyboardEvent.code`. |
| `alt`, `alt up` | A bare modifier: fires when Alt itself goes down or up. |

- **Modifiers:** `ctrl` `control` `⌃`; `shift` `⇧`; `alt` `option` `opt` `⌥`; `meta` `cmd` `command` `win`
  `⌘`; `mod`.
- **Keys:** `escape`/`esc`, `enter`/`return`, `space`/`spacebar`, `tab`, `backspace`, `delete`/`del`, `home`,
  `end`, `pageup`/`pgup`, `pagedown`/`pgdn`, `up` `down` `left` `right`, `f1`…`f19`; any other key by its
  `KeyboardEvent.key` (`/`, `[`, `a`).
- Names and keys are case-insensitive. The `code:` value is case-sensitive, as in the spec (`KeyA`, `Digit1`,
  `ArrowLeft`, `Period`), and a hotkey has one `code:` token at most. A key-based and a `code:` binding for
  the same keys can coexist; priority and recency pick the winner.
- **Bare modifiers:** one only (`ctrl+alt` throws; add a key). A held modifier fires once. The match is loose:
  `alt` fires whenever Alt goes down or up, whatever else is held; add a `when` check for an exact set.

## Core API

The default export is a router; `createRouter()` makes more with the same methods.

### `bind(hotkey, handler, plugin?, options?)`

Adds a binding and returns `off()`, which removes it (and has `off.id` and `off.hotkey`). `plugin` is a label
that `onBind` hooks receive, or `null`; `unregisterPlugin` only removes bindings made by `registerPlugin`.

```js
// preventDefault: on Windows and Linux the browser also uses Ctrl+K (search)
hotkeys.bind('mod+k', openPalette, null, { preventDefault: true, allowIn: () => true })

// preventDefault, or the browser's Save As dialog opens too
hotkeys.bind('ctrl+s', saveDraft, null, { once: true, preventDefault: true })

hotkeys.bind('delete', deleteItem, null, { when: () => selectionCount() > 0 })
```

| Option | Default | What it does |
| --- | --- | --- |
| `preventDefault` | `false` | Call `event.preventDefault()` when this binding wins: keeps the browser's own action (and typing) out. |
| `stopPropagation` | `false` | Stop the event from reaching listeners further along. |
| `stopImmediatePropagation` | `false` | Also stop other listeners on the same target. |
| `repeat` | `false` (keydown) | Fire on auto-repeat while the key is held. |
| `once` | `false` | Remove the binding after it runs once (even if the handler throws). |
| `when(event)` | — | Gate: the binding is skipped when it returns exactly `false`. |
| `allowIn(event)` | — | Return `true` to fire where the input check would block it. |
| `priority` | `0` | Higher wins; ties go to the most recent binding. |
| `capture` | `false` | Run in the capture phase, before the page's own listeners. |
| `altGraph` | `false` | Also fire on an AltGr keystroke that types a character. |
| `composing` | `false` | Also fire during IME composition. |
| `warnOnReserved` | `true` | `false` silences [reservation warnings](#reservation-warnings) for this binding. |

`when` and `allowIn` get the `KeyboardEvent`. To see where the key was typed, read `event.composedPath()[0]`
(the element inside an open shadow root) or `event.target`:

```js
hotkeys.bind('enter', submitFollowUp, null, {
  allowIn: (e) => e.composedPath()[0] === followUpInput,
})
```

### `unbind(hotkey, handler?)`

Removes the bindings for that hotkey and type (keydown or keyup), or only the ones with `handler`. A key-based
hotkey and its `code:` spelling are different bindings: `unbind('ctrl+k')` leaves `ctrl+code:KeyK`.

### `registerPlugin(name, map)` / `unregisterPlugin(name)`

A plugin is a named group of bindings. `registerPlugin` binds every entry of `map` (a handler, or `[handler,
options]`) under `name` and returns a function that unregisters it. Removing a plugin never touches other
bindings. If a hotkey in the map doesn't parse, it throws and binds nothing; a name that is already registered
throws too.

```js
const unregister = hotkeys.registerPlugin('editor', {
  'mod+shift+space': openPalette,
  'escape': [closeMenu, { priority: 10 }],
})
```

### `pause()` / `resume()`

Stop and restart all routing on this router. Bindings stay registered.

### `ignoreInput(value)`

The input check. `true` or `'all'` (the default), `'text'`, or `false` (no check). By default no binding fires
when the key was typed in an `<input>` (any type), `<textarea>`, `<select>`, a contenteditable element or
`role="textbox"`, including inside an open shadow root (a closed one only shows its host). A native `<button>`
isn't on the list, so a plain `space` or `enter` binding fires while a button has focus; gate it with `when`
if that matters.

`'text'` (also `createRouter({ ignoreInput: 'text' })`) is for apps with forms and settings panels: it blocks
typing, not shortcuts.

| Where the key was typed | Plain and Shift-only keys | Chords with Ctrl, Alt or Meta |
| --- | --- | --- |
| Text entry: text-like and date/time `<input>` types (and any type not listed below), `<textarea>`, `<select>`, contenteditable, `role="textbox"` | blocked | blocked |
| Other controls: checkbox, radio, range, color, file, button, submit, reset and image inputs; `<button>`; `role="button"`; any element inside a button | blocked (Space, Enter and arrows belong to the control) | **fire** |

A chord needs a non-modifier key, so bare-modifier bindings stay blocked on controls. An editable element
inside a button counts as text entry. `allowIn` overrides the input check, but not the AltGr, IME, repeat or
`when` checks.

### `init(options?)` / `destroy()`

`init({ target, capture })` attaches the `keydown` and `keyup` listeners (default: the router's target, `window` for the default router). The
default router calls it at import in browsers; a router from `createRouter()` waits for you. Calling it again
calls `destroy()` first. `capture: true` runs every binding in the capture phase; by default only bindings
with `{ capture: true }` do. `destroy()` removes the listeners and clears all bindings and plugins; `onBind`
hooks survive it.

### `trigger(hotkey, options?)`

Fires the binding a real keypress would, through the same checks (`when`, the input check with `{ target }`,
priority, `once`, `pause()`), and returns `true` if a handler ran: `hotkeys.trigger('mod+shift+space')`. For
tests; see [docs/testing.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/testing.md).

### `parseHotkey(hotkey, options?)`

Named export. Returns `{ combo, type, raw }`: `combo` is `{ ctrl, shift, alt, meta, key, code, bareModifier
}`, `type` is `'keydown'` or `'keyup'`, `raw` the string you passed. Throws on a hotkey the router can't bind.
`{ platform }` resolves `mod` for another platform.

### `comboFromEvent(event, options?)`

Named export. Turns a keyboard event into a hotkey string, for a "press your keys" recorder. Physical by
default (`ctrl+shift+code:Period`); `{ useMod: true }` writes the platform's primary modifier as `mod`; `{
physical: false }` uses `event.key`; `{ platform }` decides what `mod` stands for. Returns `null` while only a
modifier is held.

```js
import { comboFromEvent } from 'hotkey-router'

field.addEventListener('keydown', (e) => {
  const hotkey = comboFromEvent(e, { useMod: true }) // 'mod+shift+code:Period'
  if (hotkey) save(hotkey)
})
```

### `detectPlatform(navigator?, { chromeos? })`

Named export. `'mac'`, `'windows'`, `'linux'` or `null`. ChromeOS counts as `'linux'` unless you pass `{
chromeos: true }`. Reads `navigator.userAgentData.platform`, then `navigator.platform`, then the user agent.
The router and every add-on use it, so they agree on `mod`.

### `onBind(hook)`

Calls `hook({ combo, raw, options, plugin, id })` after every successful `bind()` on this router, and returns
an unsubscribe function. Reservation warnings are built on it; use it for dev panels or telemetry. A hook that
throws is logged with `console.error` and doesn't break the bind.

```js
const stop = hotkeys.onBind(({ raw, plugin }) => console.debug('bound', raw, plugin))
```

## How routing works

A keypress meets these in order, and each can stop it before the next:

1. **The browser and the OS.** Some shortcuts (Ctrl+T, Ctrl+W, Cmd+Q, Spotlight) are taken before the page
   gets a keydown, and no listener can get them back. Others (most Ctrl+letter keys on Windows and Linux, such
   as Ctrl+K, Ctrl+F, Ctrl+S) reach the page first: the winning binding's `preventDefault` keeps the browser
   out, and without it both act. [Reservation warnings](#reservation-warnings) flag both kinds when you bind.
2. **The capture phase, from `window` down to the focused element.** Bindings with `{ capture: true }`, or
   every binding of a router started with `init({ capture: true })`, run here at the router's target: before
   the page's own listeners below it, so they can stop the key with `stopPropagation`.
3. **The focused element, then the bubble phase back up.** The page's own handlers (an editor's keymap, say)
   run first and can stop the key. The other bindings run when it reaches the router's target; for the default
   router that's `window`, last of all.
4. **Inside one router**, each time its listener runs:
   - **Lookup:** bindings for the key (`ctrl+k`) and for the physical key (`ctrl+code:KeyK`) are both
     candidates. The non-Latin fallback is tried only when neither has an eligible binding.
   - **Checks per binding:** AltGr, IME composition, the input check (`ignoreInput` / `allowIn`), auto-repeat,
     then `when`. A paused router skips everything.
   - **One winner:** highest `priority`, then the most recent binding. One binding per router fires in each
     phase.
   - **The winner** can `preventDefault` (no browser action, no typed character) and stop propagation, as in
     steps 2 and 3.
5. **Between routers:** each picks its own winner, and both fire if the event reaches both. See [Multiple
   routers](#multiple-routers).

**AltGr and IME.** Windows reports AltGr as Ctrl+Alt, so a `ctrl+alt+code:Comma` binding would swallow the `<`
a Polish or Czech user types with AltGr. A keystroke with AltGr held that types one character is skipped, as
is every keystroke during IME composition. `altGraph: true` or `composing: true` on a binding turns its guard
off.

**Shifted punctuation.** With Shift held, `event.key` is the shifted character, so a key-based `ctrl+shift+,`
waits for a `,` that a US keyboard reports as `<`, and never fires. Bind the physical key:
`ctrl+shift+code:Comma`. `bind()` warns once in the console for Shift with `` , . / ; ' [ ] \ - = ` ``, and
`validateCombo` reports it as `shifted-punctuation`.

**Non-Latin layouts.** On a Russian layout Ctrl+K reports `event.key === 'л'` with `event.code === 'KeyK'`.
When Ctrl or Cmd is held (Shift allowed, Alt not), the key types a letter from a non-Latin script and `code`
is `KeyA`…`KeyZ`, the router also looks up the Latin letter, so `ctrl+k` fires. It does this only when no
exact binding is eligible, so `ctrl+л` or `ctrl+code:KeyK` always wins. Plain and Shift-only letters, Alt and
AltGr chords, IME composition, digits and Latin layouts such as AZERTY are never affected. To require the
exact character, add `when: (e) => e.key === 'k'`.

## Multiple routers

`createRouter(options?)` makes a router with its own bindings, plugins, `pause()`, `ignoreInput()`, `onBind`
hooks and listeners. It attaches nothing until `init()`. Use one when two libraries in one bundle both use
hotkey-router (so one's `pause()` or `destroy()` can't stop the other's keys), or when keys belong to a scope:
a router on a dialog, a `ShadowRoot` or an iframe's window only sees keys from inside it.

```js
import { createRouter } from 'hotkey-router'

const dialogKeys = createRouter({ target: dialogEl, ignoreInput: 'text' })
dialogKeys.init()
dialogKeys.bind('escape', closeDialog)
dialogKeys.destroy() // later; the page's other routers keep working
```

Options: `target` (default `window`), `capture` (default `false`) and `ignoreInput` (default `true`). Routers
don't arbitrate between each other: if two bind the same key and the event reaches both, both fire. Gate one
with `when`, keep their scopes apart, or stop the event from the inner one. `setTarget`, how `stopPropagation`
and `stopImmediatePropagation` work between routers, and what is shared:
[docs/routers.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/routers.md).

## Opt-in add-ons

Each add-on is a separate entry that the core never imports, so it costs nothing unless you import it. Sizes
are minified (gzipped) in an app bundle.

| Entry | What it does | Size |
| --- | --- | --- |
| `hotkey-router/auto` | The default router with reservation warnings installed | ~34 KB (~9.6 KB), router included |
| `hotkey-router/reservations` | Which keys the browser and OS take; warnings and lookup | ~24 KB (~5.6 KB) |
| `hotkey-router/validate` | Checks a recorded hotkey before you save it | ~69 KB (~16 KB), both tables |
| `hotkey-router/format` | Shows a hotkey to people: `Ctrl+Shift+.`, `⇧⌘.`, keycaps | ~8.6 KB (~3.5 KB) |
| `hotkey-router/sites` | Which keys popular websites use; a `when` gate that yields to them | ~38 KB (~9 KB) |

The data tables are big next to the core. Use `/auto`, `/reservations`, `/validate` and `/sites` in
development builds or in the settings page that records keys, not on every page, unless your app needs them at
runtime.

### Reservation warnings

`hotkey-router/auto` is the same router object as `hotkey-router`, with warnings installed, so bindings made
through either import are checked:

```js
import hotkeys from 'hotkey-router/auto'

hotkeys.bind('meta+shift+f', toggleFullscreen)
// Firefox on macOS:
// [hotkey-router] "meta+shift+f" (meta+shift+f) reserved by firefox on macOS: "Toggle fullscreen" [hard] — will not fire.
```

Or `installReservationWarnings(router, { platform, browser })` from `hotkey-router/reservations`, on any
router. Keys the page never gets log a `warn`; a key the page can win logs a `warn` without `preventDefault:
true` and an `info` with it. `lookupReservation(combo, { platform, browser })` answers the same question at
runtime. Severities, every export, caveats and how the table was checked with real keys:
[docs/reservations.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/reservations.md).

### Validating a recorded hotkey

```js
import { validateCombo } from 'hotkey-router/validate'

const { ok, reasons } = validateCombo('mod+shift+code:Period', {
  requirePrimary: true, // must include Ctrl (Cmd on macOS)
  taken: ['mod+shift+code:Space'],
})
// ok: true; reasons: site-conflict warnings (Google Docs, GitHub, ...)
```

Errors make `ok` false: no key, no modifier, Alt alone on Windows/Linux, a rule you asked for, already taken,
reserved by the browser or OS, shifted punctuation. Warnings keep it true: keys the page wins with
`preventDefault`, Ctrl+Alt as AltGr, sites that use the keys. Every reason code and option:
[docs/validate.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/validate.md).

### Showing a hotkey

```js
import { formatCombo, comboTokens } from 'hotkey-router/format'

formatCombo('mod+shift+code:Period', { platform: 'windows' })              // 'Ctrl+Shift+.'
formatCombo('mod+shift+code:Period', { platform: 'mac', style: 'glyphs' }) // '⇧⌘.'
comboTokens('mod+code:KeyK', { platform: 'mac' })
// [{ label: '⌘', name: 'Command', modifier: 'meta' }, { label: 'K', name: 'K', key: 'KeyK' }]
```

Modifiers come in each platform's own order, and every keycap has a name a screen reader can say. All
functions and options: [docs/format.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/format.md).

### Website shortcuts

For browser extensions and widgets that run on other people's pages:

```js
import hotkeys from 'hotkey-router'
import { siteAware } from 'hotkey-router/sites'

hotkeys.bind('mod+shift+code:Period', nextTypo, null, {
  capture: true,         // see the key before the page's editor
  preventDefault: true,
  stopPropagation: true, // when we take it, the page doesn't run it too
  allowIn: () => true,
  when: siteAware('mod+shift+code:Period', { engaged: () => panelHasFocus() }),
})
```

On sites that use the chord (Google Docs, GitHub, ...) the gate returns `engaged()`, and when that's false the
site's shortcut runs. Options, the other exports and the sourced table:
[docs/sites.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/sites.md).

## Browser support

Current Chrome, Edge, Firefox and Safari. The core relies on `KeyboardEvent.key` and `.code`, `composedPath()`
(it walks up from `event.target` when that is missing), `getModifierState('AltGraph')`, `isComposing`, `Map`
and `Set`, and Unicode property escapes in regular expressions; the build targets ES2020. The browser tests
run in Chrome and Edge; real keyboard layouts and reserved keys were checked in Chrome, Edge and Firefox on
Windows. See [docs/testing.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/testing.md).

## Scope

hotkey-router routes keys: it decides which one binding gets a keypress, and keeps plugins from stepping on
each other. It is not:

- a key-sequence engine (`g i`, VS Code-style chords in sequence);
- a keycode polyfill or a shim for legacy browsers;
- a scope manager: use separate routers, `when` or `pause()` for modes and dialogs;
- a store for user-remapped shortcuts: `comboFromEvent` and `validateCombo` help you record and check them,
  and you save them.

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See
[LICENSE](https://github.com/iWhatty/hotkey-router/blob/main/LICENSE) and
[ADDITIONAL_TERMS.md](https://github.com/iWhatty/hotkey-router/blob/main/ADDITIONAL_TERMS.md). Commercial
AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
