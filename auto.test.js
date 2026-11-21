// auto.test.js
import { describe, it, expect, vi } from 'vitest'
import hotkeys from './auto.js'
import main from './hotkey-router.js'

vi.mock('./platform.js', async (importOriginal) => ({
  ...await importOriginal(),
  detectPlatform: () => 'windows',
  detectBrowser: () => 'chrome',
}))

describe('hotkey-router/auto', () => {
  it('exports the same default as the main entry', () => {
    expect(hotkeys).toBe(main)
  })

  it('installs both warnings on the shared router', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const offReserved = main.bind('ctrl+t', () => {})
      const offShifted = main.bind('shift+2', () => {})
      offReserved()
      offShifted()
      expect(warn.mock.calls.map(([message]) => message)).toEqual([
        expect.stringContaining('reserved by chrome on Windows'),
        expect.stringContaining('shift+code:Digit2'),
      ])
    } finally {
      warn.mockRestore()
    }
  })
})
