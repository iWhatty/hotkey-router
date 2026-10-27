// focus-mode.test.js
// Slice C of sprint 0.4.0: the opt-in ignoreInput('text') mode. Text entry
// stays fully blocked; other controls block plain and Shift-only keys but let
// Ctrl/Alt/Meta chords through. The default mode must not change.
import { describe, it, expect, vi, afterEach } from 'vitest'
import hotkeys, { createRouter } from './hotkey-router.js'

const TEXT_TYPES = ['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week']
const CONTROL_TYPES = ['checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'reset', 'image']

const routers = []
function router(ignoreInput) {
  hotkeys.destroy()
  const r = createRouter(ignoreInput === undefined ? {} : { ignoreInput })
  r.init()
  routers.push(r)
  return r
}

function add(html) {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.appendChild(wrap)
  return wrap.firstElementChild
}

const input = (type) => add(`<input type="${type}">`)

function press(el, key, init = {}, type = 'keydown') {
  const e = new KeyboardEvent(type, { key, bubbles: true, composed: true, cancelable: true, ...init })
  if (init.altGraph) Object.defineProperty(e, 'getModifierState', { value: (k) => k === 'AltGraph' })
  el.dispatchEvent(e)
}

// Which of a fixed set of bindings fire for a press on `el`.
function firedOn(r, el, key, init) {
  const fired = []
  const offs = ['k', 'shift+k', 'ctrl+k', 'alt+k', 'meta+k', 'space'].map((combo) =>
    r.bind(combo, () => fired.push(combo)))
  press(el, key, init)
  offs.forEach((off) => off())
  return fired
}

afterEach(() => {
  for (const r of routers.splice(0)) r.destroy()
  document.body.innerHTML = ''
  hotkeys.destroy()
  hotkeys.init({ target: window })
})

describe("ignoreInput('text')", () => {
  describe('text entry stays fully blocked', () => {
    const cases = [
      ...TEXT_TYPES.map((t) => [`input type=${t}`, () => input(t)]),
      ['input with no type', () => add('<input>')],
      ['input with an unknown type', () => input('weird')],
      ['textarea', () => add('<textarea></textarea>')],
      ['select', () => add('<select><option>a</option></select>')],
      ['role=textbox', () => add('<div role="textbox" tabindex="0"></div>')],
    ]
    it.each(cases)('%s: plain keys and chords', (_, make) => {
      const r = router('text')
      const el = make()
      expect(firedOn(r, el, 'k')).toEqual([])
      expect(firedOn(r, el, 'k', { ctrlKey: true })).toEqual([])
      expect(firedOn(r, el, 'k', { altKey: true })).toEqual([])
    })

    it('contenteditable: plain keys and chords', () => {
      const r = router('text')
      const el = add('<div contenteditable="true"></div>')
      // jsdom does not compute isContentEditable; a browser does.
      Object.defineProperty(el, 'isContentEditable', { value: true })
      expect(firedOn(r, el, 'k')).toEqual([])
      expect(firedOn(r, el, 'k', { ctrlKey: true })).toEqual([])
    })
  })

  describe('other controls: chords through, plain and Shift-only keys blocked', () => {
    const cases = [
      ...CONTROL_TYPES.map((t) => [`input type=${t}`, () => input(t)]),
      ['native button', () => add('<button>Save</button>')],
      ['role=button', () => add('<div role="button" tabindex="0">Save</div>')],
      ['an element inside a native button', () => add('<button><span>Save</span></button>').firstElementChild],
      ['an element inside role=button', () => add('<div role="button" tabindex="0"><b>Save</b></div>').firstElementChild],
    ]
    it.each(cases)('%s', (_, make) => {
      const r = router('text')
      const el = make()
      expect(firedOn(r, el, 'k')).toEqual([])
      expect(firedOn(r, el, ' ')).toEqual([])
      expect(firedOn(r, el, 'K', { shiftKey: true })).toEqual([])
      expect(firedOn(r, el, 'k', { ctrlKey: true })).toEqual(['ctrl+k'])
      expect(firedOn(r, el, 'k', { altKey: true })).toEqual(['alt+k'])
      expect(firedOn(r, el, 'k', { metaKey: true })).toEqual(['meta+k'])
    })

    it('a chord binding fires on keyup too', () => {
      const r = router('text')
      const box = input('checkbox')
      const fn = vi.fn()
      r.bind('ctrl+k up', fn)
      press(box, 'k', { ctrlKey: true }, 'keyup')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('bare-modifier bindings stay blocked on controls, keydown and keyup', () => {
      const r = router('text')
      const box = input('checkbox')
      const fn = vi.fn()
      r.bind('alt', fn)
      r.bind('alt up', fn)
      press(box, 'Alt', { altKey: true })
      press(box, 'Alt', {}, 'keyup')
      expect(fn).not.toHaveBeenCalled()
    })

    it('text entry wins: an editable element inside a button is text', () => {
      const r = router('text')
      const el = add('<button><span contenteditable="true">x</span></button>').firstElementChild
      Object.defineProperty(el, 'isContentEditable', { value: true })
      expect(firedOn(r, el, 'k', { ctrlKey: true })).toEqual([])
    })
  })

  describe('shadow DOM', () => {
    it('reads the element inside an open shadow root', () => {
      const r = router('text')
      const host = add('<div></div>')
      const root = host.attachShadow({ mode: 'open' })
      root.innerHTML = '<input type="checkbox"><input type="text"><button><span>go</span></button>'
      const [box, text, button] = root.children
      expect(firedOn(r, box, 'k', { ctrlKey: true })).toEqual(['ctrl+k'])
      expect(firedOn(r, box, 'k')).toEqual([])
      expect(firedOn(r, text, 'k', { ctrlKey: true })).toEqual([])
      expect(firedOn(r, button.firstElementChild, ' ')).toEqual([])
      expect(firedOn(r, button.firstElementChild, 'k', { ctrlKey: true })).toEqual(['ctrl+k'])
    })
  })

  describe('allowIn and the other guards', () => {
    it('allowIn overrides the focus check in both categories', () => {
      const r = router('text')
      const text = input('text')
      const box = input('checkbox')
      const fn = vi.fn()
      r.bind('k', fn, null, { allowIn: () => true })
      press(text, 'k')
      press(box, 'k')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('allowIn does not override the AltGr or IME guards', () => {
      const r = router('text')
      const box = input('checkbox')
      const fn = vi.fn()
      r.bind('ctrl+alt+a', fn, null, { allowIn: () => true })
      r.bind('ctrl+k', fn, null, { allowIn: () => true })
      press(box, 'ą', { ctrlKey: true, altKey: true, altGraph: true })
      press(box, 'k', { ctrlKey: true, isComposing: true })
      expect(fn).not.toHaveBeenCalled()
    })

    it('trigger() with a target classifies it the same way', () => {
      const r = router('text')
      const box = input('checkbox')
      const span = add('<button><span>go</span></button>').firstElementChild
      r.bind('ctrl+k', () => {})
      r.bind('k', () => {})
      expect(r.trigger('ctrl+k', { target: box })).toBe(true)
      expect(r.trigger('k', { target: box })).toBe(false)
      expect(r.trigger('k', { target: span })).toBe(false)
      expect(r.trigger('ctrl+k', { target: span })).toBe(true)
    })
  })
})

describe('setting the mode', () => {
  it('the setter switches modes on an existing router', () => {
    const r = router()
    const box = input('checkbox')
    expect(firedOn(r, box, 'k', { ctrlKey: true })).toEqual([])
    r.ignoreInput('text')
    expect(firedOn(r, box, 'k', { ctrlKey: true })).toEqual(['ctrl+k'])
    r.ignoreInput('all')
    expect(firedOn(r, box, 'k', { ctrlKey: true })).toEqual([])
    r.ignoreInput(false)
    expect(firedOn(r, box, 'k')).toEqual(['k'])
  })

  it('rejects an unknown mode name', () => {
    const r = router()
    expect(() => r.ignoreInput('texts')).toThrow(TypeError)
    expect(() => createRouter({ ignoreInput: 'everything' })).toThrow(TypeError)
  })
})

describe('the default mode is unchanged', () => {
  for (const [label, make] of [['true (default)', () => router()], ["'all'", () => router('all')]]) {
    it(`${label}: every input blocks chords too, and a native button blocks nothing`, () => {
      const r = make()
      for (const t of [...TEXT_TYPES, ...CONTROL_TYPES]) {
        expect(firedOn(r, input(t), 'k', { ctrlKey: true })).toEqual([])
      }
      const button = add('<button>Save</button>')
      expect(firedOn(r, button, ' ')).toEqual(['space'])
      expect(firedOn(r, button, 'k')).toEqual(['k'])
    })
  }

  it('the default router starts in the default mode', () => {
    const fn = vi.fn()
    hotkeys.bind('ctrl+k', fn)
    press(input('checkbox'), 'k', { ctrlKey: true })
    expect(fn).not.toHaveBeenCalled()
  })
})
