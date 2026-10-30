# Multiple routers

The default export of `hotkey-router` is one router, started on `window` at
import. `createRouter()` makes another, with its own bindings, plugins,
`pause()`, `ignoreInput()`, `onBind` hooks and listeners, and the same
methods. `hotkey-router/core` exports `createRouter` without the default
router, for code that wants nothing to happen at import.

```js
import { createRouter } from 'hotkey-router'

const dialogKeys = createRouter({ target: dialogEl })
dialogKeys.init()
dialogKeys.bind('escape', closeDialog)

// Later
dialogKeys.destroy() // the page's other routers keep working
```

## When to use one

- **Two libraries in one bundle both use hotkey-router.** They would share
  the default router (one copy of the module, one registry), so one's
  `pause()` or `destroy()` would stop the other's keys. With a router each,
  they're independent. A browser extension's content scripts don't share a
  router with the page anyway: they run in an isolated JavaScript world with
  their own copy of the module. Key events still reach both.
- **Keys belong to a scope.** A router on a dialog element, a `ShadowRoot` or
  an iframe's window only sees keys from inside it, while page-wide keys stay
  on the default router.

## Options

`createRouter({ target, capture, ignoreInput })`:

| Option | Default | What it does |
| --- | --- | --- |
| `target` | `window` when there is one, else none | Where `init()` listens. An element, a `ShadowRoot` or an iframe's `contentWindow` scopes the router to keys from inside it. |
| `capture` | `false` | `true` runs every binding in the capture phase (as `init({ capture: true })`). |
| `ignoreInput` | `true` | The input check, as `router.ignoreInput()`: `true`/`'all'`, `'text'` or `false`. |

`target` and `capture` are defaults: `init({ target, capture })` overrides
them for that call only. `init()` throws if there's no target.

`router.setTarget(target)` changes the default target of an existing router,
which helps when other code (or an `onBind` hook) holds on to the router
object. It doesn't move listeners: call `init()` again to re-attach (it
calls `destroy()` first, which also clears the bindings).

## Between routers

Routers don't arbitrate between each other. Priority and recency pick one
winner within a router; if two routers bind the same key and the event
reaches both, both fire. To let one take the key:

- gate the other with `when`, or keep their scopes apart (a dialog router
  only sees keys from inside the dialog);
- or stop the event from the first one. How far that reaches depends on
  where the routers listen:
  - **Different targets** (a dialog router, then the default router on
    `window`): `stopPropagation: true` on the inner router's binding stops
    the event before it bubbles up to `window`, so the outer router's
    bubble-phase bindings never see it. (Its `{ capture: true }` bindings
    ran on the way down, before the inner router.)
  - **The same target**: `stopPropagation` doesn't stop other listeners on
    that target. `stopImmediatePropagation: true` does, but only for
    listeners added later, i.e. routers whose `init()` ran after this one's.

A router runs two listeners per event type when `capture` is `false`: one in
the capture phase for bindings with `{ capture: true }`, one in the bubble
phase for the rest. One binding per router fires in each phase.

## Shared and per-router state

Shared by every router (module-level, one per loaded copy of the module):
the parser, `comboFromEvent`, `detectPlatform`, the platform `mod` resolves
to, and the one-time console warning for shifted punctuation (once per
hotkey, whichever router binds it).

Per router: bindings, plugins (plugin names only need to be unique within a
router), pause state, the input setting, `onBind` hooks and therefore
reservation warnings. `installReservationWarnings(router)` covers that
router's binds only; `hotkey-router/auto` covers the default router.

## `trigger()` and scopes

Each router's `trigger()` fires only that router's bindings, and it doesn't
check the router's scope: `trigger`'s `target` option only feeds the input
check. So a router on a dialog still fires for a `target` outside the
dialog, where a real keypress would never reach it. See
[docs/testing.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/testing.md).
