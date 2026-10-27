// hotkey-router.js (the main entry, `hotkey-router`)
//
// hotkey-router/core plus a default router, created here and started on
// window at load in browsers. Import `hotkey-router/core` instead for a
// module that does nothing at import (createRouter and the helpers only).
//
// This entry ships ZERO reservation data — opt in via `hotkey-router/auto`
// or by calling `installReservationWarnings(hotkeys)` from the separate
// `hotkey-router/reservations` module. Bundlers tree-shake the data file
// out entirely when neither is imported.

import { createRouter, parseHotkey, comboFromEvent, detectPlatform } from './core.js'

/** @typedef {import('./core.js').Router} Router */
/** @typedef {import('./core.js').HotkeyHandler} HotkeyHandler */
/** @typedef {import('./core.js').BindOptions} BindOptions */
/** @typedef {import('./core.js').BindOff} BindOff */
/** @typedef {import('./core.js').BindEvent} BindEvent */
/** @typedef {import('./core.js').HotkeyMap} HotkeyMap */

// The default router: created at load, listening on window in browsers.
/** @type {Router} */
const hotkeys = createRouter()
if (typeof window !== 'undefined') hotkeys.init()

export default hotkeys

export { createRouter, parseHotkey, comboFromEvent, detectPlatform }
