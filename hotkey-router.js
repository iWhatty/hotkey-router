// hotkey-router.js
// Hotkey Router — plugin-first keyboard shortcut router (tiny + predictable)
//
// Goals:
// - O(1) dispatch by combo string lookup
// - Deterministic routing: highest priority wins; ties -> most recently bound wins
// - Safe plugin cleanup (never deletes other plugins’ bindings)
// - Modern browser target (KeyboardEvent.key + addEventListener)
//
// This core ships ZERO reservation data — opt in via `hotkey-router/auto`
// or by calling `installReservationWarnings(hotkeys)` from the separate
// `hotkey-router/reservations` module. Bundlers tree-shake the data file
// out entirely when neither is imported.

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
 *   priority?: number
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

// --- key alias map ---
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)


const modifierTokens = new Set(['ctrl', 'shift', 'alt', 'meta'])

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

const ahkPrefixMap = new Map([
  ['^', 'ctrl'],  // Ctrl
  ['!', 'alt'],   // Alt
  ['+', 'shift'], // Shift
  ['#', 'meta'],  // Win / Command
])


const keyAliases = Object.freeze({
  // common
  esc: 'escape',
  escape: 'escape',
  space: ' ',
  spacebar: ' ',
  enter: 'enter',
  return: 'enter',
  del: 'delete',
  delete: 'delete',
  backspace: 'backspace',
  tab: 'tab',

  // arrows
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',

  // navigation
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
  pgup: 'pageup',
  pgdn: 'pagedown',

  // modifiers (words)
  cmd: 'meta',
  command: 'meta',
  win: 'meta',
  meta: 'meta',
  control: 'ctrl',
  ctrl: 'ctrl',
  option: 'alt',
  alt: 'alt',
  shift: 'shift',

  // modifiers (symbols)
  '⌘': 'meta',
  '⌃': 'ctrl',
  '⌥': 'alt',
  '⇧': 'shift',

  // cross-platform "mod"
  mod: isMac ? 'meta' : 'ctrl',

  // plus key ergonomics
  plus: '+',
})

// --- config ---
let ignoreEditable = true
let defaultTarget = typeof window !== 'undefined' ? window : null

// Bind hooks: subscribers called after each successful bind. Used by the
// optional reservations module to emit conflict warnings without coupling
// the core router to the (~5 KB) reservation table.
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

// --- helpers ---
function normalizeKey(key) {
  const raw = String(key ?? '').trim()
  const k = raw.toLowerCase()
  return keyAliases[k] ?? (raw === ' ' ? ' ' : k)
}

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


function isModifierToken(token) {
  const t = normalizeKey(token)
  return modifierTokens.has(t)
}


// Matches `code:KeyX` (case-sensitive value). Used to extract code tokens BEFORE
// the rest of the parser lowercases everything, since KeyboardEvent.code values
// are camelCase (KeyA, Digit1, ArrowLeft) and must be preserved.
const CODE_TOKEN_RE = /(^|\+)code:([A-Za-z][A-Za-z0-9_]*)/

function parseHotkey(hotkeyStr) {
  const raw = String(hotkeyStr || '').trim()

  // Detect ' up' suffix case-insensitively so 'Alt UP' works the same as 'alt up'.
  const isUp = /\s+up$/i.test(raw)
  const baseRaw = isUp ? raw.replace(/\s+up$/i, '').trim() : raw

  // --- AHK-style prefix modifiers ---
  // Examples:
  //  ^k    => ctrl+k
  //  !k    => alt+k
  //  +k    => shift+k
  //  #k    => meta+k
  //  ^!k   => ctrl+alt+k
  //  !code:KeyX => alt+code:KeyX
  //
  // We strip these BEFORE both the code-token extraction AND the lowercase
  // pass, because the AHK prefix chars (^ ! + #) are case-stable, and the
  // remainder may contain a case-sensitive `code:KeyX` token that must survive.
  const combo = {
    ctrl: false, shift: false, alt: false, meta: false,
    key: null, code: null, bareModifier: null,
  }

  let stripped = baseRaw
  while (stripped.length) {
    const mod = ahkPrefixMap.get(stripped[0]) ?? null
    if (!mod) break
    combo[mod] = true
    stripped = stripped.slice(1).trimStart()
  }

  // Pull out a code:XXX token before lowercasing; preserve the camelCase value.
  // Reject multiple code: tokens to avoid silent loss of intent.
  const codeMatches = stripped.match(/code:[A-Za-z][A-Za-z0-9_]*/g)
  if (codeMatches && codeMatches.length > 1) {
    throw new Error(
      `Invalid hotkey "${hotkeyStr}": multiple code: tokens not supported (got ${codeMatches.length}).`
    )
  }
  let codeValue = null
  const scrubbed = stripped.replace(CODE_TOKEN_RE, (_, sep, val) => {
    codeValue = val
    return sep + '__code__'
  })

  let cleanStr = scrubbed.toLowerCase()

  // Allow plus key:
  //  - "ctrl++" => ctrl + "+"
  //  - "++"     => shift + "+" (AHK '+' prefix sets shift, remaining '+' becomes the base key)
  // `split('+')` produces empties; we keep that signal.
  const rawParts = cleanStr.split('+').map((p) => p.trim())
  const parts = rawParts.filter(Boolean)
  const impliedPlusKey = rawParts.some((p) => p === '') && cleanStr.includes('++')

  // Enforce: modifiers must come before the base key.
  // Example: "ctrl+k" ✅  |  "k+ctrl" ❌
  // We ignore the special "+ key" case (ctrl++) since it has no explicit base token.
  if (!impliedPlusKey) {
    let seenBase = false
    for (const part of parts) {
      if (isModifierToken(part)) {
        if (seenBase) {
          throw new Error(
            `Invalid hotkey "${hotkeyStr}": modifiers must come before the base key (e.g. "ctrl+k", not "k+ctrl")`
          )
        }
      } else {
        if (!seenBase) seenBase = true
      }
    }
  }

  // Continue parsing the remaining tokens (words/symbols/aliases)
  for (const part of parts) {
    if (part === '__code__') {
      combo.code = codeValue
      continue
    }
    const actual = keyAliases[part] ?? part
    if (actual === 'ctrl') combo.ctrl = true
    else if (actual === 'shift') combo.shift = true
    else if (actual === 'alt') combo.alt = true
    else if (actual === 'meta') combo.meta = true
    else combo.key = normalizeKey(actual)
  }

  if (!combo.key && !combo.code && impliedPlusKey) combo.key = '+'

  // If no base key/code is set, this might be a bare-modifier binding ('alt' / 'ctrl').
  // Allow exactly ONE modifier with no other tokens. Multi-modifier bare bindings
  // (e.g. 'ctrl+alt') are intentionally rejected — add a base key for those.
  if (!combo.key && !combo.code) {
    const modCount =
      (combo.ctrl ? 1 : 0) + (combo.shift ? 1 : 0) +
      (combo.alt ? 1 : 0) + (combo.meta ? 1 : 0)

    if (modCount === 1) {
      combo.bareModifier =
        combo.ctrl ? 'ctrl' :
        combo.shift ? 'shift' :
        combo.alt ? 'alt' : 'meta'
    } else if (modCount > 1) {
      throw new Error(
        `Invalid hotkey "${hotkeyStr}": multi-modifier bare bindings not supported. Add a base key (e.g. "ctrl+alt+x").`
      )
    } else {
      throw new Error(`Invalid hotkey "${hotkeyStr}" (missing base key)`)
    }
  }

  return { combo, type: isUp ? 'keyup' : 'keydown', raw: hotkeyStr }
}


function isFromInputTarget(e) {
  const t = e?.target
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
function normalizeOptions(type, options) {
  const o = options ? { ...options } : {}
  if (type === 'keydown' && o.repeat == null) o.repeat = false
  if (o.priority == null) o.priority = 0
  return o
}


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
  const ids = []

  for (const [hotkeyStr, fnOrTuple] of Object.entries(hotkeyMap)) {
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
 * Replace the default target (used by {@link init} when no `target` is
 * provided). Useful for iframes and tests. Does NOT auto-rebind existing
 * listeners — call {@link destroy} + {@link init} to re-attach.
 *
 * @param {EventTarget | null} target
 * @returns {void}
 */
function setTarget(target) {
  defaultTarget = target
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


function handleEvent(type) {
  return (e) => {
    if (paused) return

    const fromInput = ignoreEditable && isFromInputTarget(e)
    const comboStr = comboKeyFromEvent(e)
    const codeStr = codeKeyFromEvent(e)

    // Look up under both lookup keys: key-based (`alt+x`) and code-based
    // (`alt+code:KeyX`). Same physical keypress, two valid binding shapes.
    // Merge candidates and let the existing priority/recency arbiter pick.
    const seen = new Set()
    const candidates = []
    for (const lookupKey of [comboStr, codeStr]) {
      if (!lookupKey || seen.has(lookupKey)) continue
      seen.add(lookupKey)

      const bindings = registry.get(lookupKey)?.get(type)
      if (!bindings?.length) continue

      for (const b of bindings) {
        const o = b.options
        if (fromInput && !o.allowIn?.(e)) continue
        if (type === 'keydown' && o.repeat === false && e.repeat) continue
        if (o.when && o.when(e) === false) continue
        candidates.push(b)
      }
    }
    if (!candidates.length) return

    const winner = pickWinner(candidates)
    const o = winner.options

    if (o.preventDefault) e.preventDefault()
    if (o.stopImmediatePropagation) e.stopImmediatePropagation()
    else if (o.stopPropagation) e.stopPropagation()

    winner.handler(e)

    if (o.once) removeById(winner.id)
  }
}


// --- listeners ---
let stopDown = null
let stopUp = null

/**
 * Initialize the router by attaching `keydown`/`keyup` listeners to a target.
 * Re-initializes cleanly if already running (calls {@link destroy} first).
 * Auto-runs on `window` at module-load time in browser environments.
 *
 * @param {{ target?: EventTarget, capture?: boolean }} [opts]
 * @returns {void}
 */
function init({ target = defaultTarget, capture = false } = {}) {
  if (!target) throw new Error('hotkeys.init() requires a target (e.g. window)')
  if (stopDown || stopUp) destroy()

  stopDown = on(target, 'keydown', handleEvent('keydown'), { capture })
  stopUp = on(target, 'keyup', handleEvent('keyup'), { capture })
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
  stopDown = null
  stopUp = null
  registry.clear()
  plugins.clear()
  bindingIndex.clear()
  // Note: bindHooks deliberately survive destroy(). Consumer extensions
  // (reservations, future telemetry, etc.) install once at startup and
  // shouldn't have to re-attach when the router restarts. Tests that need
  // a clean slate should use the uninstall fn returned by their installer.
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

/**
 * Programmatically fire any bindings for `hotkeyStr`. Used by tests and
 * automation; not a typical app-runtime path. Returns `true` if a binding
 * was found and invoked, `false` otherwise.
 *
 * @param {string} hotkeyStr
 * @param {{ type?: 'keydown' | 'keyup' }} [opts]
 * @returns {boolean}
 */
function trigger(hotkeyStr, { type: forcedType } = {}) {
  const { combo, type } = parseHotkey(hotkeyStr)
  const comboStr = comboKeyFromParts(combo)
  const actualType = forcedType || type

  const bindings = registry.get(comboStr)?.get(actualType)
  if (!bindings?.length) return false

  // Fill `.key` from bareModifier when the binding is bare-modifier-only;
  // otherwise use combo.key. `.code` is set from combo.code for code-based bindings.
  const eventKey = combo.bareModifier
    ? BARE_MOD_TO_KEY[combo.bareModifier]
    : combo.key

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
    code: combo.code || null,
    ctrlKey, shiftKey, altKey, metaKey,
    repeat: false,
    preventDefault() { },
    stopPropagation() { },
    stopImmediatePropagation() { },
    target: null,
  }

  const winner = pickWinner(
    bindings.filter((b) => (b.options.when ? b.options.when(e) !== false : true))
  )
  if (!winner) return false

  winner.handler(e)
  if (winner.options.once) removeById(winner.id)
  return true
}


// Auto-init on window by default (browser only)
if (defaultTarget) init()

export default {
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
}