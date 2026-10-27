// core.js (hotkey-router/core)
// Hotkey Router — plugin-first keyboard shortcut router (tiny + predictable)
//
// Goals:
// - O(1) dispatch by combo string lookup
// - Deterministic routing: highest priority wins; ties -> most recently bound wins
// - Safe plugin cleanup (never deletes other plugins’ bindings)
// - Modern browser target (KeyboardEvent.key + addEventListener)
// - Separate routers (createRouter) for scopes and for libraries sharing a page
//
// Does nothing at import: no router, no listeners. `hotkey-router` (the main
// entry, hotkey-router.js) is this plus a default router started on window.
//
// This core ships ZERO reservation data — opt in via `hotkey-router/auto`
// or by calling `installReservationWarnings(hotkeys)` from the separate
// `hotkey-router/reservations` module. Bundlers tree-shake the data file
// out entirely when neither is imported.

import { parseHotkey, normalizeKey, shiftedPunctuationHint } from './parse.js'
import { detectPlatform } from './platform.js'

// -----------------------------------------------------------------------------
// Public type surface (consumed by the tsc-from-JSDoc pipeline)
// -----------------------------------------------------------------------------

/**
 * Handler invoked when a bound hotkey fires. Receives the underlying
 * `KeyboardEvent` (real one from the DOM, or a synthetic one produced by
 * {@link trigger}).
 *
 * @typedef {(e: KeyboardEvent) => void} HotkeyHandler
 */

/**
 * Optional per-binding behavior modifiers. See the inline comment on
 * `normalizeOptions` for the canonical list.
 *
 * @typedef {{
 *   preventDefault?: boolean,
 *   stopPropagation?: boolean,
 *   stopImmediatePropagation?: boolean,
 *   repeat?: boolean,
 *   once?: boolean,
 *   when?: (e: KeyboardEvent) => boolean,
 *   allowIn?: (e: KeyboardEvent) => boolean,
 *   priority?: number,
 *   capture?: boolean,
 *   altGraph?: boolean,
 *   composing?: boolean,
 *   warnOnReserved?: boolean
 * }} BindOptions
 */

/**
 * Return value of {@link bind}: callable to unbind, plus `id` (the unique
 * binding id used internally) and `hotkey` (the original input string).
 *
 * @typedef {(() => boolean) & { id: number, hotkey: string }} BindOff
 */

/**
 * Payload passed to subscribers registered via {@link onBind} after each
 * successful bind.
 *
 * @typedef {{
 *   combo: ReturnType<typeof parseHotkey>['combo'],
 *   raw: string,
 *   options: BindOptions,
 *   plugin: string | null,
 *   id: number
 * }} BindEvent
 */

/**
 * Plugin shape accepted by {@link registerPlugin}: a map from hotkey
 * strings to either a handler or a `[handler, options]` tuple.
 *
 * @typedef {Record<string, HotkeyHandler | [HotkeyHandler, BindOptions]>} HotkeyMap
 */

// --- tiny event helper ---
function on(target, type, fn, options) {
  target.addEventListener(type, fn, options)
  return () => target.removeEventListener(type, fn, options)
}

// --- platform + parser (shared with sites/validate/format) ---
// `mod` resolves for the platform detected at load (meta on macOS).
const PLATFORM = detectPlatform()

// Map from KeyboardEvent.key (which IS the modifier name on bare-modifier events)
// to the canonical token used in combo strings. Used to detect bare-modifier
// keydown/keyup events at dispatch time.
const MODIFIER_KEY_TOKEN = Object.freeze({
  Alt: 'alt',
  AltGraph: 'alt',
  Control: 'ctrl',
  Shift: 'shift',
  Meta: 'meta',
  OS: 'meta',
})

// Combo strings already warned about (shifted punctuation), so each warns
// once per loaded copy of this module, whichever router binds it.
const warnedShifted = new Set()

// --- helpers ---
function comboKeyFromParts({ ctrl, shift, alt, meta, key, code, bareModifier }) {
  // Bare-modifier bindings get a sentinel namespace so they can't collide with
  // regular chord combo strings (`'alt+x'` vs `'__bare__:alt'`).
  if (bareModifier) return `__bare__:${bareModifier}`

  let s = ''
  if (ctrl) s += 'ctrl+'
  if (shift) s += 'shift+'
  if (alt) s += 'alt+'
  if (meta) s += 'meta+'

  // Code-based combos use a `code:KeyX` suffix instead of the key character.
  if (code) return s + 'code:' + code
  return s ? s + key : key
}

function comboKeyFromEvent(e) {
  // If the event's `key` is itself a modifier name, this is a bare-modifier
  // press/release. Match it via the bare-modifier sentinel regardless of which
  // other modifier flags are set (loose match — Alt fires `alt` even when held
  // alongside Ctrl).
  const bareMod = MODIFIER_KEY_TOKEN[e.key]
  if (bareMod) return `__bare__:${bareMod}`

  return comboKeyFromParts({
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.metaKey,
    key: normalizeKey(e.key),
  })
}

// Code-based lookup string for an event. Independent of `comboKeyFromEvent`
// because consumers can register either key-based OR code-based bindings (or
// both) for the same physical key combo, and we look up under whichever they
// chose.
function codeKeyFromEvent(e) {
  if (!e.code) return null

  let s = ''
  if (e.ctrlKey) s += 'ctrl+'
  if (e.shiftKey) s += 'shift+'
  if (e.altKey) s += 'alt+'
  if (e.metaKey) s += 'meta+'
  return s + 'code:' + e.code
}


// The element the key was typed in. A listener on window sees a shadow root's
// host as `e.target`; `composedPath()[0]` is the input inside an open root.
// A closed root keeps its inside hidden, so the host is all we get there.
function isFromInputTarget(e) {
  const t = e?.composedPath?.()[0] ?? e?.target
  if (!t) return false
  const tag = String(t.tagName || '').toUpperCase()
  return (
    t.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    t.getAttribute?.('role') === 'textbox'
  )
}


// --- binding model ---
// options:
//  preventDefault, stopPropagation, stopImmediatePropagation
//  repeat (default false on keydown), once
//  when(e) -> boolean (gate)
//  allowIn(e) -> boolean (override ignoreInput)
//  priority (higher wins)
//  capture (true: handled in the capture phase, before the page's own
//    listeners; see init)
//  altGraph (true: also fire on an AltGr keystroke that types a character;
//    by default those are skipped, since Windows reports AltGr as Ctrl+Alt
//    and binding ctrl+alt+X would swallow the character the user typed)
//  composing (true: also fire during IME composition; skipped by default)
//  warnOnReserved (false: no reservation warning for this bind; read by
//    installReservationWarnings from hotkey-router/reservations)
function normalizeOptions(type, options) {
  const o = options ? { ...options } : {}
  if (type === 'keydown' && o.repeat == null) o.repeat = false
  if (o.priority == null) o.priority = 0
  return o
}

// --- dispatch (O(1) lookup) ---
function pickWinner(bindings) {
  // Highest priority wins; ties -> newest wins (largest id).
  let best = null
  for (const b of bindings) {
    if (!best) best = b
    else if (b.options.priority > best.options.priority) best = b
    else if (b.options.priority === best.options.priority && b.id > best.id) best = b
  }
  return best
}


// An AltGr keystroke that produces a character: Chrome on Windows reports it
// as ctrlKey + altKey with getModifierState('AltGraph'), and a one-character
// `key` (AltGr+, types '<' on Polish, Czech and Canadian layouts).
function isAltGraphCharacter(e) {
  return Boolean(
    e.ctrlKey && e.altKey &&
    typeof e.getModifierState === 'function' && e.getModifierState('AltGraph') &&
    typeof e.key === 'string' && e.key.length === 1
  )
}

function isComposingEvent(e) {
  return Boolean(e.isComposing || e.keyCode === 229)
}

// Latin lookup key for a non-Latin layout: Russian Ctrl+K reports key 'л'
// with code 'KeyK', so a `ctrl+k` binding would never fire. Browsers fall
// back to the Latin letter for their own shortcuts; so do we, but only for
// a letter from a non-Latin script on a KeyA..KeyZ key, with Ctrl or Meta and
// no Alt (Option and AltGr type characters), outside IME composition.
// Latin layouts (AZERTY, Dvorak) never get here: their letters are Latin.
const NON_LATIN_LETTER = /^(?!\p{Script=Latin})\p{L}$/u

function latinKeyFromEvent(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  if (isComposingEvent(e)) return null
  if (typeof e.getModifierState === 'function' && e.getModifierState('AltGraph')) return null
  const letter = /^Key([A-Z])$/.exec(e.code || '')
  if (!letter || typeof e.key !== 'string' || !NON_LATIN_LETTER.test(e.key)) return null
  return comboKeyFromParts({
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: false,
    meta: e.metaKey,
    key: letter[1].toLowerCase(),
  })
}

// --- programmatic trigger (tests / automation) ---
//
// Reverse map: 'alt' -> 'Alt' (the KeyboardEvent.key value for that bare modifier).
// Used to populate the synthetic event's `.key` field so consumer handlers that
// inspect `e.key` see the same value they'd get from a real event.
const BARE_MOD_TO_KEY = {
  ctrl: 'Control',
  shift: 'Shift',
  alt: 'Alt',
  meta: 'Meta',
}

// `code` <-> `key` for the synthetic event, so trigger('ctrl+k') also fires
// a `ctrl+code:KeyK` binding and the reverse. US layout, like any
// automation that has to guess what a physical key types.
const CODE_TO_KEY = {
  Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Slash: '/', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
  Space: ' ', Enter: 'Enter', NumpadEnter: 'Enter', Tab: 'Tab', Escape: 'Escape',
  Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
}
const KEY_TO_CODE = {}
for (const [code, key] of Object.entries(CODE_TO_KEY)) {
  KEY_TO_CODE[normalizeKey(key)] ??= code
}

function keyForCode(code) {
  if (!code) return null
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1].toLowerCase()
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)
  if (digit) return digit[1]
  if (/^F\d{1,2}$/.test(code)) return code
  return CODE_TO_KEY[code] ?? null
}

function codeForKey(key) {
  if (!key) return null
  if (/^[a-z]$/.test(key)) return 'Key' + key.toUpperCase()
  if (/^\d$/.test(key)) return 'Digit' + key
  if (/^f\d{1,2}$/.test(key)) return key.toUpperCase()
  return KEY_TO_CODE[key] ?? null
}


/**
 * The hotkey string for a keyboard event, for a "press your keys" recorder.
 * Physical by default (`ctrl+shift+code:Period`), so the binding survives
 * keyboard layouts. With `useMod`, the platform's primary modifier (Cmd on
 * macOS, Ctrl elsewhere) is written as `mod`. Returns null for a bare
 * modifier press (the user hasn't pressed the base key yet).
 *
 * `platform` (default: this machine) decides which modifier `mod` stands for.
 *
 * @param {KeyboardEvent} e
 * @param {{ physical?: boolean, useMod?: boolean, platform?: 'mac' | 'windows' | 'linux' | 'chromeos' | null }} [opts]
 * @returns {string | null}
 */
function comboFromEvent(e, { physical = true, useMod = false, platform = PLATFORM } = {}) {
  if (!e || MODIFIER_KEY_TOKEN[e.key]) return null
  const parts = []
  const primaryIsMeta = platform === 'mac'
  if (useMod && (primaryIsMeta ? e.metaKey : e.ctrlKey)) parts.push('mod')
  if (e.ctrlKey && !(useMod && !primaryIsMeta)) parts.push('ctrl')
  if (e.metaKey && !(useMod && primaryIsMeta)) parts.push('meta')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (physical && e.code) parts.push(`code:${e.code}`)
  else {
    const key = normalizeKey(e.key)
    if (!key) return null
    parts.push(key === ' ' ? 'space' : key)
  }
  return parts.join('+')
}

// --- the router ---

/**
 * Create a router with its own bindings, plugins, pause state, input setting,
 * `onBind` hooks and listeners. Attaches nothing: call `init()` to start it.
 * The package's default export is one of these, started on `window`.
 *
 * `target` (default: `window` when there is one, else none) and `capture`
 * are defaults for `init()`; `init({ target, capture })` overrides them for
 * that call only. An element, a `ShadowRoot` or an iframe's window scopes
 * the router to keys from inside it. Two routers that both bind a key both
 * fire when the event reaches both; priority only arbitrates within one.
 *
 * @param {{ target?: EventTarget | null, capture?: boolean, ignoreInput?: boolean }} [options]
 */
export function createRouter({
  target = typeof window !== 'undefined' ? window : null,
  capture = false,
  ignoreInput: ignoreInputOption = true,
} = {}) {
  // --- config ---
  let ignoreEditable = !!ignoreInputOption
  let defaultTarget = target
  const defaultCapture = capture

  // Bind hooks: subscribers called after each successful bind. Used by the
  // optional reservations module to emit conflict warnings without coupling
  // the core router to the reservation table (~23 KB minified, ~5.5 KB gzipped).
  let bindHooks = []

  // --- state ---
  // comboStr -> Map<type, Array<Binding>>
  const registry = new Map()
  // pluginName -> Array<bindingId>
  const plugins = new Map()
  // bindingId -> { comboStr, type }
  const bindingIndex = new Map()

  let paused = false
  let nextId = 1


  function ensureSlot(comboStr, type) {
    let typeMap = registry.get(comboStr)
    if (!typeMap) {
      typeMap = new Map()
      registry.set(comboStr, typeMap)
    }
    let arr = typeMap.get(type)
    if (!arr) {
      arr = []
      typeMap.set(type, arr)
    }
    return arr
  }


  function removeById(id) {
    const idx = bindingIndex.get(id)
    if (!idx) return false

    const { comboStr, type } = idx
    const typeMap = registry.get(comboStr)
    const arr = typeMap?.get(type)
    if (!arr?.length) {
      bindingIndex.delete(id)
      return false
    }

    const next = arr.filter((b) => b.id !== id)
    if (next.length) typeMap.set(type, next)
    else typeMap.delete(type)

    if (!typeMap.size) registry.delete(comboStr)
    bindingIndex.delete(id)
    return true
  }


  // --- public API: bind / unbind ---
  // bind returns an off() function; off.id is exposed for plugin bookkeeping.

  /**
   * Bind a hotkey combo string to a handler.
   *
   * @param {string} hotkeyStr      e.g. `'ctrl+shift+k'`, `'meta+slash'`, `'alt+code:KeyX'`
   * @param {HotkeyHandler} handler
   * @param {string | null} [plugin]  optional plugin/namespace tag for bulk cleanup
   * @param {BindOptions} [options]
   * @returns {BindOff} unbind function with `id` + `hotkey` props
   */
  function bind(hotkeyStr, handler, plugin = null, options = {}) {
    const { combo, type, raw } = parseHotkey(hotkeyStr)
    const comboStr = comboKeyFromParts(combo)
    const opts = normalizeOptions(type, options)

    const binding = {
      id: nextId++,
      comboStr,
      type,
      combo,
      handler,
      plugin,
      raw,
      options: opts,
    }

    ensureSlot(comboStr, type).push(binding)
    bindingIndex.set(binding.id, { comboStr, type })

    const warnKey = `${comboStr} ${type}`
    if (!warnedShifted.has(warnKey)) {
      const hint = shiftedPunctuationHint(hotkeyStr)
      if (hint) {
        warnedShifted.add(warnKey)
        // eslint-disable-next-line no-console
        console.warn(`[hotkey-router] ${hint.message}`)
      }
    }

    // Notify bind subscribers. Hook errors must never break the bind itself.
    if (bindHooks.length) {
      for (const hook of bindHooks) {
        try {
          hook({ combo, raw, options: opts, plugin, id: binding.id })
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[hotkey-router] onBind hook threw:', err)
        }
      }
    }

    const off = () => removeById(binding.id)
    off.id = binding.id
    off.hotkey = raw
    return off
  }

  // Subscribe to bind events. The hook receives
  //   { combo, raw, options, plugin, id }
  // after the binding is registered. Returns an unsubscribe function. Used by
  // extensions like `installReservationWarnings` from `hotkey-router/reservations`.

  /**
   * Subscribe to {@link bind} events. The hook is called after each successful
   * bind with a {@link BindEvent} payload.
   *
   * @param {(info: BindEvent) => void} hook
   * @returns {() => void} unsubscribe
   */
  function onBind(hook) {
    if (typeof hook !== 'function') {
      throw new TypeError('hotkeys.onBind(hook) expects a function')
    }
    bindHooks.push(hook)
    return () => {
      bindHooks = bindHooks.filter((h) => h !== hook)
    }
  }


  /**
   * Remove bindings for a combo string. Omit `handler` to remove all bindings
   * for the combo/type; pass a specific handler to remove just that one.
   *
   * @param {string} hotkeyStr
   * @param {HotkeyHandler} [handler]
   * @returns {void}
   */
  function unbind(hotkeyStr, handler) {
    const { combo, type } = parseHotkey(hotkeyStr)
    const comboStr = comboKeyFromParts(combo)
    const typeMap = registry.get(comboStr)
    if (!typeMap) return

    const arr = typeMap.get(type)
    if (!arr?.length) return

    if (!handler) {
      for (const b of arr) bindingIndex.delete(b.id)
      typeMap.delete(type)
    } else {
      const keep = []
      for (const b of arr) {
        if (b.handler === handler) bindingIndex.delete(b.id)
        else keep.push(b)
      }
      if (keep.length) typeMap.set(type, keep)
      else typeMap.delete(type)
    }

    if (!typeMap.size) registry.delete(comboStr)
  }


  // --- plugin system ---
  // registerPlugin returns unregister function.

  /**
   * Register a named plugin that bulk-binds a {@link HotkeyMap}. All bindings
   * are tagged with the plugin name so {@link unregisterPlugin} can clean them
   * up together without touching other plugins' bindings.
   *
   * @param {string} name        plugin name (must be unique)
   * @param {HotkeyMap} hotkeyMap
   * @returns {() => void} unregister fn for this plugin
   */
  function registerPlugin(name, hotkeyMap) {
    if (plugins.has(name)) throw new Error(`Plugin "${name}" already registered`)

    // Parse every key string before binding any, so a bad one leaves nothing
    // bound that unregisterPlugin could not reach.
    const entries = Object.entries(hotkeyMap)
    for (const [hotkeyStr] of entries) parseHotkey(hotkeyStr)

    const ids = []
    for (const [hotkeyStr, fnOrTuple] of entries) {
      const [fn, options] = Array.isArray(fnOrTuple) ? fnOrTuple : [fnOrTuple, {}]
      const off = bind(hotkeyStr, fn, name, options)
      ids.push(off.id)
    }

    plugins.set(name, ids)
    return () => unregisterPlugin(name)
  }

  /**
   * Remove all bindings owned by the named plugin. Silent no-op if no such
   * plugin is registered.
   *
   * @param {string} name
   * @returns {void}
   */
  function unregisterPlugin(name) {
    const ids = plugins.get(name)
    if (!ids) return
    for (const id of ids) removeById(id)
    plugins.delete(name)
  }

  // --- control ---

  /** Pause dispatch — bindings stay registered but no handlers fire. @returns {void} */
  function pause() {
    paused = true
  }

  /** Resume dispatch after a {@link pause}. @returns {void} */
  function resume() {
    paused = false
  }

  /**
   * Toggle whether handlers fire when the event target is an editable element
   * (input/textarea/contenteditable). Default `true`. Override per-binding via
   * `options.allowIn`.
   *
   * @param {boolean} [value]
   * @returns {void}
   */
  function ignoreInput(value = true) {
    ignoreEditable = !!value
  }

  // allow changing the default target (iframes/tests).
  // we intentionally do not auto-rebind to keep the core tiny.

  /**
   * Replace this router's default target (used by {@link init} when no
   * `target` is provided), keeping the router object that other code and
   * `onBind` hooks hold on to. Does NOT auto-rebind existing listeners —
   * call {@link destroy} + {@link init} to re-attach. For a second, separate
   * router, use `createRouter({ target })` instead.
   *
   * @param {EventTarget | null} target
   * @returns {void}
   */
  function setTarget(target) {
    defaultTarget = target
  }


  // The bindings an event may fire, after every guard. Looks up under both
  // lookup keys: key-based (`alt+x`) and code-based (`alt+code:KeyX`). Same
  // physical keypress, two valid binding shapes; the priority/recency arbiter
  // picks among them. Only when neither yields an eligible binding does the
  // Latin fallback (`latinKeyFromEvent`) get a turn, so an exact `ctrl+л` or
  // `ctrl+code:KeyK` always beats a fallback `ctrl+k`.
  //
  // phase: 'all' (one listener handles every binding), 'capture' (only
  // bindings with options.capture) or 'bubble' (only bindings without it).
  function eligibleBindings(e, type, phase) {
    const guards = {
      altGraphChar: isAltGraphCharacter(e),
      composing: isComposingEvent(e),
      fromInput: ignoreEditable && isFromInputTarget(e),
    }

    const candidates = []
    const seen = new Set()
    for (const lookupKey of [comboKeyFromEvent(e), codeKeyFromEvent(e)]) {
      if (!lookupKey || seen.has(lookupKey)) continue
      seen.add(lookupKey)
      collectEligible(candidates, lookupKey, e, type, phase, guards)
    }

    if (!candidates.length) {
      const latinKey = latinKeyFromEvent(e)
      if (latinKey && !seen.has(latinKey)) collectEligible(candidates, latinKey, e, type, phase, guards)
    }
    return candidates
  }

  function collectEligible(candidates, lookupKey, e, type, phase, { altGraphChar, composing, fromInput }) {
    const bindings = registry.get(lookupKey)?.get(type)
    if (!bindings?.length) return

    for (const b of bindings) {
      const o = b.options
      if (phase === 'capture' && !o.capture) continue
      if (phase === 'bubble' && o.capture) continue
      if (altGraphChar && !o.altGraph) continue
      if (composing && !o.composing) continue
      if (fromInput && !o.allowIn?.(e)) continue
      if (type === 'keydown' && o.repeat === false && e.repeat) continue
      if (o.when && o.when(e) === false) continue
      candidates.push(b)
    }
  }

  function fire(winner, e) {
    const o = winner.options

    if (o.preventDefault) e.preventDefault()
    if (o.stopImmediatePropagation) e.stopImmediatePropagation()
    else if (o.stopPropagation) e.stopPropagation()

    // A handler that throws has still had its one run.
    try {
      winner.handler(e)
    } finally {
      if (o.once) removeById(winner.id)
    }
  }

  function handleEvent(type, phase = 'all') {
    return (e) => {
      if (paused) return
      const candidates = eligibleBindings(e, type, phase)
      if (candidates.length) fire(pickWinner(candidates), e)
    }
  }


  // --- listeners ---
  let stopDown = null
  let stopUp = null

  let stopCaptureDown = null
  let stopCaptureUp = null

  /**
   * Initialize the router by attaching `keydown`/`keyup` listeners to a target.
   * Re-initializes cleanly if already running (calls {@link destroy} first).
   * The default router runs this on `window` at load in browsers; a router
   * from `createRouter()` waits for you to call it. `target` and `capture`
   * default to the ones given to `createRouter()`; passing them here
   * overrides them for this call only.
   *
   * `capture: true` handles every binding in the capture phase. With
   * `false`, bindings run in the bubble phase except those bound
   * with `{ capture: true }`, which a second, capture-phase listener handles:
   * they see the key before the page's own listeners and can stop it.
   *
   * @param {{ target?: EventTarget, capture?: boolean }} [opts]
   * @returns {void}
   */
  function init({ target = defaultTarget, capture = defaultCapture } = {}) {
    if (!target) throw new Error('hotkeys.init() requires a target (e.g. window)')
    if (stopDown || stopUp) destroy()

    if (capture) {
      stopDown = on(target, 'keydown', handleEvent('keydown'), { capture: true })
      stopUp = on(target, 'keyup', handleEvent('keyup'), { capture: true })
      return
    }
    stopDown = on(target, 'keydown', handleEvent('keydown', 'bubble'), { capture: false })
    stopUp = on(target, 'keyup', handleEvent('keyup', 'bubble'), { capture: false })
    stopCaptureDown = on(target, 'keydown', handleEvent('keydown', 'capture'), { capture: true })
    stopCaptureUp = on(target, 'keyup', handleEvent('keyup', 'capture'), { capture: true })
  }


  /**
   * Tear down listeners and clear all bindings + plugins. Bind-hook
   * subscribers ({@link onBind}) deliberately survive — consumer
   * extensions should install once and live across `init`/`destroy` cycles.
   *
   * @returns {void}
   */
  function destroy() {
    stopDown?.()
    stopUp?.()
    stopCaptureDown?.()
    stopCaptureUp?.()
    stopDown = null
    stopUp = null
    stopCaptureDown = null
    stopCaptureUp = null
    registry.clear()
    plugins.clear()
    bindingIndex.clear()
    // Note: bindHooks deliberately survive destroy(). Consumer extensions
    // (reservations, future telemetry, etc.) install once at startup and
    // shouldn't have to re-attach when the router restarts. Tests that need
    // a clean slate should use the uninstall fn returned by their installer.
  }


  /**
   * Programmatically fire the binding a real keypress of `hotkeyStr` would
   * fire. Used by tests and automation; not a typical app-runtime path. The
   * synthetic event carries both `key` and `code` (US layout), so key-based
   * and `code:` bindings both match, and the same guards apply as for a real
   * event: `when`, `ignoreInput`/`allowIn` (pass `target` to fire "from" an
   * element), priority, `once`, and `pause()`. Returns `true` if a handler ran.
   *
   * @param {string} hotkeyStr
   * @param {{ type?: 'keydown' | 'keyup', target?: EventTarget | null }} [opts]
   * @returns {boolean}
   */
  function trigger(hotkeyStr, { type: forcedType, target = null } = {}) {
    const { combo, type } = parseHotkey(hotkeyStr)
    const actualType = forcedType || type
    if (paused) return false

    // Fill `.key` from bareModifier when the binding is bare-modifier-only;
    // otherwise from combo.key, or the key a `code:` value types.
    const eventKey = combo.bareModifier
      ? BARE_MOD_TO_KEY[combo.bareModifier]
      : combo.key ?? keyForCode(combo.code)
    const eventCode = combo.bareModifier
      ? null
      : combo.code ?? codeForKey(combo.key)

    // For bare-modifier keyup, real KeyboardEvents have the corresponding
    // modifier flag FALSE (the modifier just released). Mirror that so
    // automation handlers that inspect e.altKey / e.ctrlKey / etc. see the
    // same value they'd see from a real event.
    let altKey = !!combo.alt
    let ctrlKey = !!combo.ctrl
    let shiftKey = !!combo.shift
    let metaKey = !!combo.meta
    if (combo.bareModifier && actualType === 'keyup') {
      if (combo.bareModifier === 'alt') altKey = false
      else if (combo.bareModifier === 'ctrl') ctrlKey = false
      else if (combo.bareModifier === 'shift') shiftKey = false
      else if (combo.bareModifier === 'meta') metaKey = false
    }

    const e = {
      type: actualType,
      key: eventKey,
      code: eventCode,
      ctrlKey, shiftKey, altKey, metaKey,
      repeat: false,
      isComposing: false,
      getModifierState() { return false },
      preventDefault() { },
      stopPropagation() { },
      stopImmediatePropagation() { },
      target,
    }

    const candidates = eligibleBindings(e, actualType, 'all')
    if (!candidates.length) return false
    fire(pickWinner(candidates), e)
    return true
  }

  return {
    // lifecycle
    init,
    destroy,
    setTarget,

    // bindings
    bind,
    unbind,
    registerPlugin,
    unregisterPlugin,

    // extension hooks
    onBind,

    // control
    pause,
    resume,
    ignoreInput,

    // testing / automation
    trigger,

    // helpers
    parseHotkey,
    comboFromEvent,
    detectPlatform,
  }
}

/** @typedef {ReturnType<typeof createRouter>} Router */

export { parseHotkey, comboFromEvent, detectPlatform }
