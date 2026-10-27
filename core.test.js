// core.test.js
// Slice B of sprint 0.4.0: hotkey-router/core does nothing at import, and the
// main entry is built on it. Imports are dynamic and in order on purpose:
// core first, then the main entry, so each one's effect can be seen.
import { describe, it, expect, vi, afterAll } from 'vitest'

const keyListeners = (spy) => spy.mock.calls.filter(([type]) => type === 'keydown' || type === 'keyup')

describe('hotkey-router/core', () => {
  const spy = vi.spyOn(window, 'addEventListener')
  afterAll(() => spy.mockRestore())

  let core
  let main

  it('attaches no listeners at import and has no default export', async () => {
    core = await import('./core.js')
    expect(keyListeners(spy)).toEqual([])
    expect(core.default).toBeUndefined()
    for (const name of ['createRouter', 'parseHotkey', 'comboFromEvent', 'detectPlatform']) {
      expect(typeof core[name]).toBe('function')
    }
  })

  it('makes routers that work once started', () => {
    const fn = vi.fn()
    const router = core.createRouter()
    router.bind('ctrl+k', fn)
    expect(keyListeners(spy)).toEqual([])
    router.init()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    expect(fn).toHaveBeenCalledOnce()
    router.destroy()
  })

  it('is what the main entry is built on: same functions, plus a started default router', async () => {
    spy.mockClear()
    main = await import('./hotkey-router.js')
    expect(main.createRouter).toBe(core.createRouter)
    expect(main.parseHotkey).toBe(core.parseHotkey)
    expect(main.comboFromEvent).toBe(core.comboFromEvent)
    expect(main.detectPlatform).toBe(core.detectPlatform)
    expect(keyListeners(spy).length).toBeGreaterThan(0)

    const fn = vi.fn()
    main.default.bind('ctrl+j', fn)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true }))
    expect(fn).toHaveBeenCalledOnce()
    main.default.destroy()
  })
})
