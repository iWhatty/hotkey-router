// create-router.test.js
// Slice A of sprint 0.4.0: separate routers from createRouter(). The default
// export's behaviour is covered by the other test files, unchanged.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import hotkeys, { createRouter } from './hotkey-router.js'
import { installReservationWarnings } from './reservations.js'

const key = (type, k, init = {}) =>
  new KeyboardEvent(type, { key: k, bubbles: true, composed: true, cancelable: true, ...init })
const press = (el, k, init) => el.dispatchEvent(key('keydown', k, init))

describe('createRouter', () => {
  const routers = []
  const make = (opts) => {
    const r = createRouter(opts)
    routers.push(r)
    return r
  }

  beforeEach(() => {
    // Keep the page's default router out of the way.
    hotkeys.destroy()
  })

  afterEach(() => {
    for (const r of routers.splice(0)) r.destroy()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    hotkeys.destroy()
    hotkeys.init({ target: window })
  })

  describe('creation and init', () => {
    it('attaches nothing until init()', () => {
      const fn = vi.fn()
      const r = make()
      r.bind('k', fn)
      press(document.body, 'k')
      expect(fn).not.toHaveBeenCalled()
      r.init()
      press(document.body, 'k')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('has the default router API, and is a different object from it', () => {
      const r = make()
      for (const name of Object.keys(hotkeys)) expect(typeof r[name]).toBe(typeof hotkeys[name])
      expect(r).not.toBe(hotkeys)
    })

    it('targets window by default; target: null means none, so init() throws', () => {
      expect(() => make().init()).not.toThrow()
      expect(() => make({ target: null }).init()).toThrow(/requires a target/)
    })

    it('constructor target and capture are defaults that one init() call can override', () => {
      const a = document.createElement('div')
      const b = document.createElement('div')
      document.body.append(a, b)
      const fn = vi.fn()
      const r = make({ target: a })
      r.bind('k', fn)
      r.init({ target: b })
      press(a, 'k')
      expect(fn).not.toHaveBeenCalled()
      press(b, 'k')
      expect(fn).toHaveBeenCalledOnce()

      // The override was for that call only: a plain init() goes back to `a`.
      r.init()
      r.bind('k', fn)
      press(b, 'k')
      expect(fn).toHaveBeenCalledOnce()
      press(a, 'k')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('capture: true runs every binding before the page can stop the key', () => {
      const page = document.createElement('div')
      document.body.appendChild(page)
      page.addEventListener('keydown', (e) => e.stopPropagation())
      const fn = vi.fn()
      const r = make({ capture: true })
      r.bind('k', fn)
      r.init()
      press(page, 'k')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('setTarget changes the default for the next init(), without moving listeners', () => {
      const a = document.createElement('div')
      const b = document.createElement('div')
      document.body.append(a, b)
      const fn = vi.fn()
      const r = make({ target: a })
      r.init()
      r.setTarget(b)
      r.bind('k', fn)
      press(a, 'k')
      expect(fn).toHaveBeenCalledOnce() // still listening on `a`
      r.init()
      r.bind('k', fn)
      press(b, 'k')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('separate routers', () => {
    it('both fire when both bind the same key', () => {
      const a = vi.fn()
      const b = vi.fn()
      const r1 = make()
      const r2 = make()
      r1.init()
      r2.init()
      r1.bind('ctrl+k', a)
      r2.bind('ctrl+k', b)
      press(document.body, 'k', { ctrlKey: true })
      expect(a).toHaveBeenCalledOnce()
      expect(b).toHaveBeenCalledOnce()
    })

    it('pause, ignoreInput and destroy on one leave the other alone', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      const a = vi.fn()
      const b = vi.fn()
      const r1 = make()
      const r2 = make()
      r1.init()
      r2.init()
      r1.bind('k', a)
      r2.bind('k', b)

      r1.pause()
      press(document.body, 'k')
      expect(a).not.toHaveBeenCalled()
      expect(b).toHaveBeenCalledOnce()
      r1.resume()

      r1.ignoreInput(false)
      press(input, 'k')
      expect(a).toHaveBeenCalledOnce()
      expect(b).toHaveBeenCalledOnce() // r2 still ignores inputs

      r1.destroy()
      press(document.body, 'k')
      expect(a).toHaveBeenCalledOnce()
      expect(b).toHaveBeenCalledTimes(2)
    })

    it('plugin names, bindings and trigger() belong to one router', () => {
      const a = vi.fn()
      const b = vi.fn()
      const r1 = make()
      const r2 = make()
      r1.registerPlugin('palette', { 'ctrl+k': a })
      expect(() => r2.registerPlugin('palette', { 'ctrl+k': b })).not.toThrow()
      expect(r1.trigger('ctrl+k')).toBe(true)
      expect(a).toHaveBeenCalledOnce()
      expect(b).not.toHaveBeenCalled()
      r1.unregisterPlugin('palette')
      expect(r2.trigger('ctrl+k')).toBe(true)
      expect(b).toHaveBeenCalledOnce()
    })

    it("don't share the default router's state", () => {
      const fn = vi.fn()
      hotkeys.init({ target: window })
      const r = make()
      r.init()
      r.bind('k', fn)
      hotkeys.pause()
      press(document.body, 'k')
      hotkeys.resume()
      hotkeys.destroy()
      press(document.body, 'k')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('one can win only with stopImmediatePropagation, from the router registered first', () => {
      const a = vi.fn()
      const b = vi.fn()
      const r1 = make()
      const r2 = make()
      r1.init()
      r2.init()
      r1.bind('ctrl+k', a, null, { stopImmediatePropagation: true })
      r2.bind('ctrl+k', b)
      press(document.body, 'k', { ctrlKey: true })
      expect(a).toHaveBeenCalledOnce()
      expect(b).not.toHaveBeenCalled()
    })

    it('stopPropagation does not stop another router on the same target', () => {
      const a = vi.fn()
      const b = vi.fn()
      const r1 = make()
      const r2 = make()
      r1.init()
      r2.init()
      r1.bind('ctrl+k', a, null, { stopPropagation: true })
      r2.bind('ctrl+k', b)
      press(document.body, 'k', { ctrlKey: true })
      expect(b).toHaveBeenCalledOnce()
    })
  })

  describe('scoped routers', () => {
    it('a router on a dialog sees keys from inside it only', () => {
      const dialog = document.createElement('div')
      const inside = document.createElement('button')
      const outside = document.createElement('button')
      dialog.appendChild(inside)
      document.body.append(dialog, outside)
      const fn = vi.fn()
      const r = make({ target: dialog })
      r.init()
      r.bind('escape', fn)
      press(outside, 'Escape')
      expect(fn).not.toHaveBeenCalled()
      press(inside, 'Escape')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('a router on a shadow root sees keys from inside it, and its inputs stay guarded', () => {
      const host = document.createElement('div')
      document.body.appendChild(host)
      const root = host.attachShadow({ mode: 'open' })
      const panel = document.createElement('div')
      const input = document.createElement('input')
      root.append(panel, input)
      const fn = vi.fn()
      const r = make({ target: root })
      r.init()
      r.bind('k', fn)
      press(document.body, 'k')
      expect(fn).not.toHaveBeenCalled()
      press(panel, 'k')
      expect(fn).toHaveBeenCalledOnce()
      press(input, 'k')
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('shared and per-router extensions', () => {
    it('reservation warnings installed on one router do not fire for another', () => {
      const warnings = { warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
      const r1 = make()
      const r2 = make()
      const off = installReservationWarnings(r1, { platform: 'windows', browser: 'chrome', console: warnings })
      r2.bind('ctrl+t', () => {})
      expect(warnings.warn).not.toHaveBeenCalled()
      r1.bind('ctrl+t', () => {})
      expect(warnings.warn).toHaveBeenCalled()
      off()
    })

    it('onBind hooks survive destroy(), per router', () => {
      const hook = vi.fn()
      const r = make()
      r.onBind(hook)
      r.destroy()
      r.bind('k', () => {})
      expect(hook).toHaveBeenCalledOnce()
    })

    it('the shifted-punctuation warning is once per combo across routers', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      make().bind('ctrl+shift+;', () => {})
      make().bind('ctrl+shift+;', () => {})
      expect(warn).toHaveBeenCalledOnce()
    })
  })
})
