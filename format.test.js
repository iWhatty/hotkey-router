// format.test.js
import { describe, it, expect } from 'vitest'
import {
  formatCombo,
  comboTokens,
  modifierLabel,
  modifierName,
  keyLabel,
  listModifiers,
  KEY_LABELS,
} from './format.js'
import { parseHotkey } from './parse.js'

const mac = { platform: 'mac' }
const windows = { platform: 'windows' }
const linux = { platform: 'linux' }

describe('formatCombo', () => {
  it('text style per platform', () => {
    expect(formatCombo('mod+shift+code:Period', windows)).toBe('Ctrl+Shift+.')
    expect(formatCombo('mod+shift+code:Period', linux)).toBe('Ctrl+Shift+.')
    expect(formatCombo('mod+shift+code:Period', mac)).toBe('Shift+Cmd+.')
  })

  it('glyphs on macOS, in Apple order, no separator', () => {
    expect(formatCombo('mod+shift+code:Period', { ...mac, style: 'glyphs' })).toBe('⇧⌘.')
    expect(formatCombo('meta+shift+alt+ctrl+code:KeyK', { ...mac, style: 'glyphs' })).toBe('⌃⌥⇧⌘K')
  })

  it('glyphs fall back to words on Windows and Linux', () => {
    expect(formatCombo('mod+shift+code:Period', { ...windows, style: 'glyphs' })).toBe('Ctrl+Shift+.')
    expect(formatCombo('mod+shift+code:Period', { ...linux, style: 'glyphs' })).toBe('Ctrl+Shift+.')
  })

  it('platform order regardless of how the string is written', () => {
    expect(formatCombo('shift+alt+ctrl+code:KeyK', windows)).toBe('Ctrl+Alt+Shift+K')
    expect(formatCombo('shift+meta+code:KeyS', windows)).toBe('Win+Shift+S')
    expect(formatCombo('shift+meta+code:KeyS', linux)).toBe('Super+Shift+S')
    expect(formatCombo('shift+meta+code:KeyS', { platform: 'chromeos' })).toBe('Search+Shift+S')
  })

  it("order: 'combo' keeps the written order", () => {
    expect(formatCombo('mod+shift+code:Period', { ...mac, style: 'glyphs', order: 'combo' })).toBe('⌘⇧.')
    expect(formatCombo('shift+mod+code:Period', { ...windows, order: 'combo' })).toBe('Shift+Ctrl+.')
    expect(formatCombo('^+k', { ...windows, order: 'combo' })).toBe('Ctrl+Shift+K')
  })

  it('custom separator', () => {
    expect(formatCombo('mod+shift+code:Period', { ...windows, separator: ' + ' })).toBe('Ctrl + Shift + .')
    expect(formatCombo('mod+code:KeyK', { ...mac, style: 'glyphs', separator: ' ' })).toBe('⌘ K')
  })

  it('key-based combos and named keys', () => {
    expect(formatCombo('ctrl+k', windows)).toBe('Ctrl+K')
    expect(formatCombo('ctrl++', windows)).toBe('Ctrl++')
    expect(formatCombo('alt+arrowleft', windows)).toBe('Alt+Left')
    expect(formatCombo('alt+left', { ...mac, style: 'glyphs' })).toBe('⌥←')
    expect(formatCombo('mod+enter', mac)).toBe('Cmd+Return')
    expect(formatCombo('mod+enter', { ...mac, style: 'glyphs' })).toBe('⌘↩')
    expect(formatCombo('ctrl+backspace', windows)).toBe('Ctrl+Backspace')
    expect(formatCombo('meta+backspace', { ...mac, style: 'glyphs' })).toBe('⌘⌫')
    expect(formatCombo('esc', windows)).toBe('Esc')
    expect(formatCombo('ctrl+space', windows)).toBe('Ctrl+Space')
    expect(formatCombo('f5', windows)).toBe('F5')
    expect(formatCombo('ctrl+code:Numpad1', windows)).toBe('Ctrl+Num 1')
    expect(formatCombo('ctrl+code:Digit1', mac)).toBe('Control+1')
  })

  it('bare modifiers, keyup suffix, parsed combos, empty input', () => {
    expect(formatCombo('alt', mac)).toBe('Option')
    expect(formatCombo('ctrl+k up', windows)).toBe('Ctrl+K')
    expect(formatCombo(parseHotkey('mod+shift+code:Period', mac).combo, { ...mac, style: 'glyphs' })).toBe('⇧⌘.')
    expect(formatCombo('', windows)).toBe('')
    expect(formatCombo(null, windows)).toBe('')
  })

  it('defaults to the detected platform', () => {
    expect(typeof formatCombo('mod+k')).toBe('string')
    expect(formatCombo('mod+k')).toMatch(/K$/)
  })
})

describe('comboTokens', () => {
  it('keycaps with accessible names on macOS (glyphs by default)', () => {
    expect(comboTokens('mod+shift+code:Period', mac)).toEqual([
      { label: '⇧', name: 'Shift', modifier: 'shift' },
      { label: '⌘', name: 'Command', modifier: 'meta' },
      { label: '.', name: 'Period', key: 'Period' },
    ])
  })

  it('words on Windows and Linux', () => {
    expect(comboTokens('mod+alt+code:Slash', windows)).toEqual([
      { label: 'Ctrl', name: 'Control', modifier: 'ctrl' },
      { label: 'Alt', name: 'Alt', modifier: 'alt' },
      { label: '/', name: 'Slash', key: 'Slash' },
    ])
    expect(comboTokens('meta+code:KeyL', linux).map((t) => t.label)).toEqual(['Super', 'L'])
  })

  it('text style on macOS uses words', () => {
    expect(comboTokens('ctrl+alt+code:KeyK', { ...mac, style: 'text' }).map((t) => t.label)).toEqual(['Control', 'Option', 'K'])
  })

  it('key-based tokens carry the event.key value', () => {
    const [, key] = comboTokens('ctrl+arrowup', windows)
    expect(key).toEqual({ label: 'Up', name: 'Up Arrow', key: 'arrowup' })
    expect(comboTokens('ctrl+plus', windows)[1]).toEqual({ label: '+', name: 'Plus', key: '+' })
  })

  it('empty input gives no tokens', () => {
    expect(comboTokens('', mac)).toEqual([])
    expect(comboTokens(null, mac)).toEqual([])
  })
})

describe('modifierLabel / modifierName', () => {
  it('per platform', () => {
    expect(modifierLabel('alt', mac)).toBe('Option')
    expect(modifierLabel('alt', windows)).toBe('Alt')
    expect(modifierLabel('alt', { ...mac, style: 'both' })).toBe('⌥ Option')
    expect(modifierLabel('alt', { ...windows, style: 'both' })).toBe('Alt')
    expect(modifierLabel('alt', { ...mac, style: 'glyphs' })).toBe('⌥')
    expect(modifierLabel('ctrl', mac)).toBe('Control')
    expect(modifierLabel('meta', windows)).toBe('Win')
    expect(modifierLabel('meta', linux)).toBe('Super')
  })

  it('mod is Cmd on macOS, Ctrl elsewhere', () => {
    expect(modifierLabel('mod', mac)).toBe('Cmd')
    expect(modifierLabel('mod', { ...mac, style: 'glyphs' })).toBe('⌘')
    expect(modifierLabel('mod', windows)).toBe('Ctrl')
    expect(modifierLabel('mod', linux)).toBe('Ctrl')
  })

  it('accepts aliases', () => {
    expect(modifierLabel('cmd', mac)).toBe('Cmd')
    expect(modifierLabel('option', windows)).toBe('Alt')
    expect(modifierLabel('opt', mac)).toBe('Option')
    expect(modifierLabel('control', windows)).toBe('Ctrl')
    expect(modifierLabel('⌘', mac)).toBe('Cmd')
    expect(modifierLabel('hyper', mac)).toBe('hyper')
  })

  it('accessible names', () => {
    expect(modifierName('mod', mac)).toBe('Command')
    expect(modifierName('mod', windows)).toBe('Control')
    expect(modifierName('meta', windows)).toBe('Windows')
    expect(modifierName('alt', mac)).toBe('Option')
  })

  it('lists modifiers for sentences', () => {
    expect(listModifiers(['ctrl', 'alt', 'shift'], windows)).toBe('Ctrl, Alt or Shift')
    expect(listModifiers(['meta', 'alt'], { ...mac, conjunction: 'and' })).toBe('Cmd and Option')
    expect(listModifiers(['shift'], linux)).toBe('Shift')
  })
})

describe('keyLabel / KEY_LABELS', () => {
  it('labels code: values and event.key values', () => {
    expect(keyLabel('code:Period', windows)).toBe('.')
    expect(keyLabel('KeyJ', windows)).toBe('J')
    expect(keyLabel('Digit7', windows)).toBe('7')
    expect(keyLabel('Enter', mac)).toBe('Return')
    expect(keyLabel('Enter', { ...mac, style: 'glyphs' })).toBe('↩')
    expect(keyLabel('Enter', windows)).toBe('Enter')
    expect(keyLabel('NumpadEnter', windows)).toBe('Enter')
    expect(keyLabel('ArrowLeft', { ...windows, style: 'glyphs' })).toBe('Left')
    expect(keyLabel('esc', windows)).toBe('Esc')
    expect(keyLabel('k', windows)).toBe('K')
    expect(keyLabel('code:IntlRo', windows)).toBe('IntlRo')
  })

  it('every listed code has a label and a name', () => {
    for (const [code, entry] of Object.entries(KEY_LABELS)) {
      expect(entry.label, code).toBeTruthy()
      expect(entry.name, code).toBeTruthy()
    }
  })
})
