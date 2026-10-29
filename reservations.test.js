// reservations.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectPlatform,
  detectBrowser,
  lookupReservation,
  lookupKeyFromCombo,
  formatReservationWarning,
  severityIsHard,
  severityIsSoft,
  installReservationWarnings,
} from './reservations.js'
import hotkeys from './hotkey-router.js'

// Helpers --------------------------------------------------------------------

// Build a parsed-combo shape matching hotkey-router's internal representation.
function combo({ ctrl = false, meta = false, alt = false, shift = false, key = null, code = null } = {}) {
  return { ctrl, meta, alt, shift, key, code, bareModifier: null }
}

// Programmatic bind helper that captures the warning/info message instead of
// actually printing it. Installs the reservation hook with explicit
// platform/browser overrides, binds the combo, then uninstalls — so each
// captureBind call is self-contained and never leaves a leaked hook behind.
function captureBind(hotkeyStr, { platform, browser, install = true, ...opts } = {}) {
  const calls = { warn: [], info: [] }
  const fakeConsole = {
    warn: (...a) => calls.warn.push(a.join(' ')),
    info: (...a) => calls.info.push(a.join(' ')),
  }
  hotkeys.destroy()
  hotkeys.init({ target: window })
  const uninstall = install
    ? installReservationWarnings(hotkeys, { platform, browser, console: fakeConsole })
    : () => {}
  try {
    hotkeys.bind(hotkeyStr, () => {}, null, opts)
  } finally {
    uninstall()
  }
  return calls
}

// Detection ------------------------------------------------------------------

describe('detectPlatform / detectBrowser', () => {
  it('detects mac from navigator.platform', () => {
    expect(detectPlatform({ platform: 'MacIntel', userAgent: '' })).toBe('mac')
  })

  it('detects windows from navigator.platform', () => {
    expect(detectPlatform({ platform: 'Win32', userAgent: '' })).toBe('windows')
  })

  it('detects linux from navigator.platform', () => {
    expect(detectPlatform({ platform: 'Linux x86_64', userAgent: '' })).toBe('linux')
  })

  it('falls back to userAgent when platform is empty', () => {
    expect(detectPlatform({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe('mac')
  })

  it('orders edge before chrome (UA contains both)', () => {
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 (...) Chrome/120 Safari/537.36 Edg/120' })).toBe('edge')
  })

  it('orders chrome before safari (UA contains both)', () => {
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 (...) Chrome/120 Safari/537.36' })).toBe('chrome')
  })

  it('detects firefox', () => {
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 (...) Firefox/120' })).toBe('firefox')
  })

  it('detects safari when chrome absent', () => {
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 (Macintosh) Version/17 Safari/537.36' })).toBe('safari')
  })
})

// Lookup key normalization ----------------------------------------------------

describe('lookupKeyFromCombo', () => {
  it('builds canonical order (ctrl, meta, alt, shift, key)', () => {
    expect(lookupKeyFromCombo(combo({ meta: true, shift: true, key: 'f' }))).toBe('meta+shift+f')
    expect(lookupKeyFromCombo(combo({ ctrl: true, shift: true, key: 'g' }))).toBe('ctrl+shift+g')
  })

  it('resolves code:KeyX → bare letter', () => {
    expect(lookupKeyFromCombo(combo({ meta: true, shift: true, code: 'KeyF' }))).toBe('meta+shift+f')
  })

  it('resolves code:Digit1 → 1', () => {
    expect(lookupKeyFromCombo(combo({ ctrl: true, code: 'Digit1' }))).toBe('ctrl+1')
  })

  it('returns null for bare-modifier combos', () => {
    expect(lookupKeyFromCombo({ bareModifier: 'alt' })).toBe(null)
  })
})

// Reservation lookup (5 scenarios from WebRadar) ------------------------------

describe('lookupReservation — WebRadar smoke scenarios', () => {
  // The hotkey-router combos under test in WebRadar:
  //   mod+shift+F, mod+shift+G, mod+shift+K
  // After resolving mod (→ meta on mac, ctrl elsewhere) and code:KeyX → letter.

  const macModShift = (key) => combo({ meta: true, shift: true, key })
  const winModShift = (key) => combo({ ctrl: true, shift: true, key })

  it('Firefox Mac flags mod+shift+F (hard) and mod+shift+G (find-bar-only)', () => {
    const f = lookupReservation(macModShift('f'), { platform: 'mac', browser: 'firefox' })
    const g = lookupReservation(macModShift('g'), { platform: 'mac', browser: 'firefox' })
    const k = lookupReservation(macModShift('k'), { platform: 'mac', browser: 'firefox' })
    expect(f?.severity).toBe('hard')
    expect(f?.action).toMatch(/fullscreen/i)
    expect(g?.severity).toBe('find-bar-only')
    expect(k).toBeNull()
  })

  it('Chrome Mac flags only mod+shift+G (find-bar-only)', () => {
    const f = lookupReservation(macModShift('f'), { platform: 'mac', browser: 'chrome' })
    const g = lookupReservation(macModShift('g'), { platform: 'mac', browser: 'chrome' })
    const k = lookupReservation(macModShift('k'), { platform: 'mac', browser: 'chrome' })
    expect(f).toBeNull()
    expect(g?.severity).toBe('find-bar-only')
    expect(k).toBeNull()
  })

  it('Safari Mac flags only mod+shift+G (find-bar-only)', () => {
    const f = lookupReservation(macModShift('f'), { platform: 'mac', browser: 'safari' })
    const g = lookupReservation(macModShift('g'), { platform: 'mac', browser: 'safari' })
    const k = lookupReservation(macModShift('k'), { platform: 'mac', browser: 'safari' })
    expect(f).toBeNull()
    expect(g?.severity).toBe('find-bar-only')
    expect(k).toBeNull()
  })

  it('Firefox Windows flags mod+shift+G (find-bar-only) and mod+shift+K (Web Console, hard)', () => {
    const f = lookupReservation(winModShift('f'), { platform: 'windows', browser: 'firefox' })
    const g = lookupReservation(winModShift('g'), { platform: 'windows', browser: 'firefox' })
    const k = lookupReservation(winModShift('k'), { platform: 'windows', browser: 'firefox' })
    expect(f).toBeNull()
    expect(g?.severity).toBe('find-bar-only')
    expect(k?.severity).toBe('hard')
    expect(k?.action).toMatch(/web console/i)
  })

  it('Edge Windows flags mod+shift+G (find-bar-only) and mod+shift+K (Duplicate tab, hard)', () => {
    const f = lookupReservation(winModShift('f'), { platform: 'windows', browser: 'edge' })
    const g = lookupReservation(winModShift('g'), { platform: 'windows', browser: 'edge' })
    const k = lookupReservation(winModShift('k'), { platform: 'windows', browser: 'edge' })
    expect(f).toBeNull()
    expect(g?.severity).toBe('find-bar-only')
    expect(k?.severity).toBe('hard')
    expect(k?.action).toMatch(/duplicate tab/i)
  })

  // Real keys on Windows (docs/notes/key-check-reserved-2026-10-29.md): the
  // page sees Ctrl+K, F and P first and preventDefault keeps the browser
  // out; Ctrl+T, N and W never reach the page.
  it('Windows Ctrl+K, F, P are preventable (soft); Ctrl+T, N, W stay hard', () => {
    const ctrl = (key) => combo({ ctrl: true, key })
    for (const browser of ['chrome', 'edge', 'firefox']) {
      for (const key of ['f', 'p']) expect(lookupReservation(ctrl(key), { platform: 'windows', browser })?.severity).toBe('preventable')
      for (const key of ['t', 'n', 'w']) expect(lookupReservation(ctrl(key), { platform: 'windows', browser })?.severity).toBe('hard')
    }
    expect(lookupReservation(ctrl('k'), { platform: 'windows', browser: 'chrome' })?.severity).toBe('preventable')
    expect(severityIsSoft('preventable')).toBe(true)
    expect(severityIsHard('preventable')).toBe(false)
    const r = lookupReservation(ctrl('k'), { platform: 'windows', browser: 'edge' })
    expect(formatReservationWarning(r, 'ctrl+k')).toMatch(/browser acts too/)
    expect(formatReservationWarning(r, 'ctrl+k', { preventDefault: true })).toMatch(/preventDefault keeps/)
  })

  it('falls through to platform.system when browser table misses', () => {
    // meta+space is a macOS system reservation (Spotlight), not a browser one.
    // The parsed key is ' '; the data spells it "space".
    const r = lookupReservation(combo({ meta: true, key: ' ' }), { platform: 'mac', browser: 'firefox' })
    expect(r?.source).toBe('system')
    expect(r?.action).toBe('Spotlight')
    const q = lookupReservation(combo({ meta: true, key: 'q' }), { platform: 'mac', browser: 'firefox' })
    expect(q?.source).toBe('system')
    expect(q?.severity).toBe('os')
  })

  it('flags Cmd+Shift+/ (Help menu search) on macOS in every browser, by code or by key', () => {
    // Found by SpellBolt (2026-10-15): AppKit's Help menu takes Cmd+? in every
    // Mac app, so a page never sees mod+shift+code:Slash on a Mac.
    for (const browser of ['chrome', 'firefox', 'safari', 'edge']) {
      const byCode = lookupReservation(combo({ meta: true, shift: true, code: 'Slash' }), { platform: 'mac', browser })
      expect(byCode?.lookupKey).toBe('meta+shift+slash')
      expect(byCode?.action).toMatch(/help menu/i)
      expect(byCode?.severity).toBe('os')
    }
    expect(lookupReservation(combo({ meta: true, shift: true, key: '/' }), { platform: 'mac', browser: 'chrome' })?.action).toMatch(/help menu/i)
    // Windows/Linux Ctrl+Shift+/ is not an OS chord.
    expect(lookupReservation(combo({ ctrl: true, shift: true, code: 'Slash' }), { platform: 'windows', browser: 'chrome' })).toBeNull()
  })

  it('returns null when platform or browser is unknown', () => {
    expect(lookupReservation(macModShift('f'), { platform: null, browser: null })).toBeNull()
    expect(lookupReservation(macModShift('f'), { platform: 'mac', browser: 'opera' })).toBeNull()
  })
})

// Warning formatting ---------------------------------------------------------

describe('formatReservationWarning', () => {
  it('uses "will not fire" for hard severities', () => {
    const r = lookupReservation(combo({ meta: true, shift: true, key: 'f' }), { platform: 'mac', browser: 'firefox' })
    const msg = formatReservationWarning(r, 'mod+shift+f')
    expect(msg).toContain('"mod+shift+f"')
    expect(msg).toContain('firefox on macOS')
    expect(msg).toContain('Toggle fullscreen')
    expect(msg).toContain('[hard]')
    expect(msg).toContain('will not fire')
  })

  it('uses "fires in normal browsing" for soft severities', () => {
    const r = lookupReservation(combo({ meta: true, shift: true, key: 'g' }), { platform: 'mac', browser: 'safari' })
    const msg = formatReservationWarning(r, 'mod+shift+g')
    expect(msg).toContain('fires in normal browsing')
  })

  it('severityIsHard / severityIsSoft', () => {
    expect(severityIsHard('hard')).toBe(true)
    expect(severityIsHard('os')).toBe(true)
    expect(severityIsHard('menu-activation')).toBe(true)
    expect(severityIsHard('find-bar-only')).toBe(false)
    expect(severityIsSoft('find-bar-only')).toBe(true)
    expect(severityIsSoft('compose')).toBe(true)
    expect(severityIsSoft('hard')).toBe(false)
  })
})

// End-to-end: bind() emits the warning ---------------------------------------
//
// Note on `mod`: hotkey-router resolves the `mod` token to `meta`/`ctrl` based
// on the host's `navigator.platform` at module load time. In jsdom that's an
// empty string → `mod` becomes `ctrl`. Tests below use explicit `meta+`/`ctrl+`
// modifiers when they force a different `platform` via init() — the `mod`
// alias is host-bound by design, so it's only meaningful in real browsers.
// The lookup itself (the thing this feature gates on) is exercised explicitly.

describe('bind() conflict warnings', () => {
  afterEach(() => {
    hotkeys.destroy()
  })

  it('warns on hard reservations (Firefox Mac, meta+shift+f)', () => {
    const calls = captureBind('meta+shift+f', { platform: 'mac', browser: 'firefox' })
    expect(calls.warn.length).toBe(1)
    expect(calls.warn[0]).toMatch(/firefox on macOS/)
    expect(calls.warn[0]).toMatch(/Toggle fullscreen/)
    expect(calls.warn[0]).toMatch(/\[hard\]/)
  })

  it('info-logs on soft reservations (Chrome Mac, meta+shift+g)', () => {
    const calls = captureBind('meta+shift+g', { platform: 'mac', browser: 'chrome' })
    expect(calls.info.length).toBe(1)
    expect(calls.warn.length).toBe(0)
    expect(calls.info[0]).toMatch(/find-bar-only/)
  })

  it('warns on a preventable key bound without preventDefault (the browser acts too)', () => {
    const calls = captureBind('ctrl+s', { platform: 'windows', browser: 'chrome' })
    expect(calls.warn.length).toBe(1)
    expect(calls.info.length).toBe(0)
    expect(calls.warn[0]).toMatch(/\[preventable\]/)
    expect(calls.warn[0]).toMatch(/browser acts too/)
  })

  it('info-logs a preventable key bound with preventDefault', () => {
    const calls = captureBind('ctrl+s', { platform: 'windows', browser: 'chrome', preventDefault: true })
    expect(calls.warn.length).toBe(0)
    expect(calls.info.length).toBe(1)
    expect(calls.info[0]).toMatch(/preventDefault keeps/)
  })

  it('Firefox Windows Ctrl+E and Ctrl+K (search bar) are preventable', () => {
    for (const key of ['e', 'k']) {
      const calls = captureBind(`ctrl+${key}`, { platform: 'windows', browser: 'firefox', preventDefault: true })
      expect(calls.info[0]).toMatch(/\[preventable\]/)
    }
  })

  it('does not warn on unreserved combos', () => {
    // meta+shift+y is free on Chrome Mac
    const calls = captureBind('meta+shift+y', { platform: 'mac', browser: 'chrome' })
    expect(calls.warn.length).toBe(0)
    expect(calls.info.length).toBe(0)
  })

  it('warns on Firefox Windows Ctrl+Shift+K (Web Console, hard)', () => {
    const calls = captureBind('ctrl+shift+k', { platform: 'windows', browser: 'firefox' })
    expect(calls.warn.length).toBe(1)
    expect(calls.warn[0]).toMatch(/Web Console/i)
  })

  it('warns on Edge Windows Ctrl+Shift+K (Duplicate tab, hard)', () => {
    const calls = captureBind('ctrl+shift+k', { platform: 'windows', browser: 'edge' })
    expect(calls.warn.length).toBe(1)
    expect(calls.warn[0]).toMatch(/Duplicate tab/i)
  })

  it('Linux Chrome inherits Windows Chrome reservations via $ref', () => {
    // Linux browsers are stored as $ref pointers to the Windows tables.
    const calls = captureBind('ctrl+shift+i', { platform: 'linux', browser: 'chrome' })
    expect(calls.warn.length).toBe(1)
    expect(calls.warn[0]).toMatch(/DevTools/)
  })

  it('respects code:KeyX syntax (meta+shift+code:KeyF)', () => {
    const calls = captureBind('meta+shift+code:KeyF', { platform: 'mac', browser: 'firefox' })
    expect(calls.warn.length).toBe(1)
    expect(calls.warn[0]).toMatch(/Toggle fullscreen/)
  })

  it('not installing the hook means no warnings at all (default behavior)', () => {
    // Without installReservationWarnings, the core router emits zero
    // reservation warnings even on a known conflict. This is the tree-
    // shakable default — devs pay nothing unless they opt in.
    const calls = captureBind('meta+shift+f', {
      platform: 'mac',
      browser: 'firefox',
      install: false,
    })
    expect(calls.warn).toHaveLength(0)
    expect(calls.info).toHaveLength(0)
  })

  it('uninstall() removes the hook cleanly', () => {
    const fakeConsole = { warn: vi.fn(), info: vi.fn() }
    hotkeys.destroy()
    hotkeys.init({ target: window })
    const uninstall = installReservationWarnings(hotkeys, {
      platform: 'mac',
      browser: 'firefox',
      console: fakeConsole,
    })
    hotkeys.bind('meta+shift+f', () => {})
    expect(fakeConsole.warn).toHaveBeenCalledOnce()
    uninstall()
    hotkeys.bind('meta+shift+g', () => {})
    // Second bind would have been a soft find-bar-only info — but uninstalled.
    expect(fakeConsole.warn).toHaveBeenCalledOnce()
    expect(fakeConsole.info).not.toHaveBeenCalled()
  })

  it('per-bind { warnOnReserved: false } disables warning for that bind only', () => {
    const calls = captureBind('meta+shift+f', { platform: 'mac', browser: 'firefox', warnOnReserved: false })
    expect(calls.warn).toHaveLength(0)

    const calls2 = captureBind('meta+shift+f', { platform: 'mac', browser: 'firefox' })
    expect(calls2.warn).toHaveLength(1)
  })

  it('silent when platform/browser cannot be detected', () => {
    const calls = captureBind('meta+shift+f', { platform: null, browser: null })
    expect(calls.warn).toHaveLength(0)
    expect(calls.info).toHaveLength(0)
  })

  it('binding still works after warning fires', () => {
    const handler = vi.fn()
    hotkeys.destroy()
    hotkeys.init({ target: window })
    const uninstall = installReservationWarnings(hotkeys, {
      platform: 'mac',
      browser: 'firefox',
      console: { warn: () => {}, info: () => {} },
    })
    try {
      hotkeys.bind('meta+shift+f', handler)
      hotkeys.trigger('meta+shift+f')
    } finally {
      uninstall()
    }
    expect(handler).toHaveBeenCalledOnce()
  })

  it('throws when called on something without onBind()', () => {
    expect(() => installReservationWarnings({})).toThrow(/onBind/)
  })
})
