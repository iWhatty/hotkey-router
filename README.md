# hotkey-router

[![npm](https://img.shields.io/npm/v/hotkey-router)](https://www.npmjs.com/package/hotkey-router)
[![downloads](https://img.shields.io/npm/dm/hotkey-router)](https://www.npmjs.com/package/hotkey-router)
[![bundle size](https://img.shields.io/bundlephobia/minzip/hotkey-router)](https://bundlephobia.com/package/hotkey-router)
[![license](https://img.shields.io/npm/l/hotkey-router)](https://github.com/iWhatty/hotkey-router-js/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/hotkey-router-js?style=social)](https://github.com/iWhatty/hotkey-router-js)

A tiny, deterministic keyboard routing engine for modern web apps. Not a key utility, a predictable plugin-first routing layer for keyboard shortcuts.

## Features

- O(1) dispatch
- Plugin-safe lifecycle management
- Deterministic winner selection (priority + recency)
- Input-safe by default
- Testable via `trigger()`
- Optional opt-in browser/OS conflict warnings (tree-shakable)
- ~3 kB minified + gzipped (core); ~7.5 kB with conflict warnings
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
}
```

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

Override per-binding with `allowIn()`.

### `init(options?)`

Manually attach listeners.

```js
hotkeys.init({
  target: window,
  capture: false,
})
```

Auto-initializes on `window` by default (browser environments).

### `destroy()`

Removes all listeners and clears internal state.

### `trigger(hotkey, options?)`

Programmatically trigger a hotkey. Useful for testing.

```js
hotkeys.trigger('ctrl+k')
```

Returns `true` if a handler ran.

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

The feature is opt-in by design: the core router stays ~3 KB gzipped, and the ~5 KB reservation data is tree-shaken out entirely unless you import it.

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

### Supported syntax

**Standard:**

- `ctrl+k`
- `shift+a`
- `ctrl+k up`
- `mod+s` (meta on macOS, ctrl elsewhere)
- `ctrl++` or `ctrl+plus`

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
- `alt`, `option`, `⌥`, `!`
- `meta`, `cmd`, `command`, `win`, `⌘`, `#`
- `mod` (meta on macOS, ctrl elsewhere)

**Navigation / special key aliases:**

- `escape`, `esc`
- `enter`, `return`
- `space`
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
