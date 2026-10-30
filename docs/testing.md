# Testing

## Testing your bindings with `trigger()`

`router.trigger(hotkey, options?)` fires the binding a real keypress of
`hotkey` would fire, without a DOM event. It returns `true` if a handler
ran.

```js
hotkeys.trigger('mod+shift+space')
hotkeys.trigger('escape', { target: inputElement }) // as if typed in the input: blocked, false
hotkeys.trigger('alt up')                           // the " up" suffix fires keyup bindings
hotkeys.trigger('alt', { type: 'keyup' })           // or force the type
```

What it does:

- The synthetic event has both `key` and `code` (as a US layout types
  them; `key` in the parser's lowercase form, e.g. `escape`), so
  `trigger('ctrl+k')` also fires a `ctrl+code:KeyK` binding, and the reverse.
- The same checks apply as for a real keypress: `when`, the input check
  (`ignoreInput` / `allowIn`, using `target`), priority and recency, `once`,
  and `pause()` (a paused router returns `false`).
- The handler gets the synthetic event. Its `preventDefault()` and
  `stopPropagation()` do nothing, `repeat` and `isComposing` are `false`, and
  `getModifierState()` always returns `false`, so the AltGr and IME guards
  never skip a triggered binding.
- For a bare-modifier keyup (`trigger('alt up')`), the modifier's own flag
  is `false`, as on a real release.
- Capture and bubble phases aren't simulated: every eligible binding
  competes, and one winner fires.

Each router's `trigger()` fires only that router's bindings, and it doesn't
check the router's scope: `target` only feeds the input check, so a router
on a dialog still fires for a `target` outside the dialog, where a real
keypress would never reach it.

## The library's own tests

Everything runs locally; there is no hosted CI.

- `npm test`: unit tests in jsdom (vitest). In a checkout that contains git
  worktrees under `.claude/`, keep vitest out of them:
  `npx vitest run --environment jsdom --exclude ".claude/**" --exclude "**/node_modules/**"`.
- `node build.js`: builds `dist/`, checks that the side-effect-free entries
  tree-shake away, that `hotkey-router` and `hotkey-router/auto` share one
  router, that the minified core stays within its 12 KB budget, and prints
  each file's size.
- `npm run build:types`: the TypeScript declarations in `dist/types/`, from
  the JSDoc.
- `npm run test:browser`: builds, then runs `browser-tests/` in the Chrome
  and Edge installed on this machine through `playwright-core`. That covers
  real key events through shadow roots, routers scoped to a dialog, a shadow
  root and an iframe, capture against a page that stops keys, the `'text'`
  mode on real controls, and the built entries as an app bundles them.
  Nothing is downloaded; a browser that isn't installed is skipped.
  `BROWSERS=chrome` runs one. Needs Node 22 or later.
- `npm run data:age`: how old the browser/OS and website shortcut tables
  are; warns past six months (the build prints the same warning).
  [docs/data-review.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/data-review.md)
  says how to review them.
- `scripts/key-check.ahk` (Windows, AutoHotkey 1.1): real keyboard layouts
  (Russian, Greek, Hebrew, Polish AltGr) in Chrome, Firefox and Edge, with
  results written to `docs/notes/`. See `playground/key-check.html`.
- `scripts/key-check-reserved.ahk` (Windows, AutoHotkey 1.1): whether the
  page or the browser gets each Ctrl+letter, with real key presses; see
  [docs/reservations.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/reservations.md#how-the-table-is-checked).
- `npm run key-check:sandbox` (Windows Sandbox, untested end to end): runs
  either AHK check inside Windows Sandbox so it doesn't take over the PC;
  see [docs/data-review.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/data-review.md#real-key-checks-in-windows-sandbox).
