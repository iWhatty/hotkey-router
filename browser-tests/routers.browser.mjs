// browser-tests/routers.browser.mjs
//
// Sprint 0.4.0 slice D: what jsdom can't show, in real Chrome and Edge with
// trusted key events. Shadow DOM, scoped routers (dialog, shadow root,
// iframe), capture against a page that stops keys, two routers on one target,
// and the 'text' input mode on real controls.
//
// Chords use Ctrl+I and Ctrl+Shift+X: the reservation table lists them as
// free in every browser, so a miss is the router's, not the browser's.
//
// Run: npm run test:browser (builds first). Local only.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS, launch, blankPage, takeFired, closeServer } from './harness.mjs'

after(closeServer)

for (const channel of CHANNELS) {
  describe(channel, () => {
    let browser
    before(async () => { browser = await launch(channel) })
    after(async () => { await browser?.close() })

    // Each test gets a fresh page; skipped when the browser isn't here.
    const test = (name, fn) => it(name, async (t) => {
      if (!browser) return t.skip(`${channel} not available`)
      const page = await blankPage(browser)
      try {
        await fn(page)
      } finally {
        await page.close()
      }
    })

    test('an input inside an open shadow root is guarded; allowIn can read composedPath()', async (page) => {
      await page.evaluate(async () => {
        const { default: hk } = await import('/hotkey-router.js')
        const host = document.createElement('div')
        document.body.append(host)
        const root = host.attachShadow({ mode: 'open' })
        root.innerHTML = '<input id="field"><div id="panel" tabindex="0">panel</div>'
        const field = root.getElementById('field')
        hk.bind('k', () => window.fired.push('k'))
        hk.bind('ctrl+i', () => window.fired.push('ctrl+i'), null, {
          preventDefault: true,
          allowIn: (e) => e.composedPath()[0] === field,
        })
      })
      await page.locator('#field').focus()
      await page.keyboard.press('k')
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), ['ctrl+i'])
      await page.locator('#panel').focus()
      await page.keyboard.press('k')
      assert.deepEqual(await takeFired(page), ['k'])
    })

    test('a router on a dialog element sees keys from inside it only', async (page) => {
      await page.evaluate(async () => {
        const { createRouter } = await import('/core.js')
        document.body.innerHTML = '<div id="dialog"><button id="in">in</button></div><button id="out">out</button>'
        const r = createRouter({ target: document.getElementById('dialog') })
        r.init()
        r.bind('escape', () => window.fired.push('escape'))
      })
      await page.locator('#out').focus()
      await page.keyboard.press('Escape')
      assert.deepEqual(await takeFired(page), [])
      await page.locator('#in').focus()
      await page.keyboard.press('Escape')
      assert.deepEqual(await takeFired(page), ['escape'])
    })

    test('a router on a shadow root sees keys from inside it only', async (page) => {
      await page.evaluate(async () => {
        const { createRouter } = await import('/core.js')
        document.body.innerHTML = '<div id="host"></div><button id="out">out</button>'
        const root = document.getElementById('host').attachShadow({ mode: 'open' })
        root.innerHTML = '<button id="in">in</button>'
        const r = createRouter({ target: root })
        r.init()
        r.bind('k', () => window.fired.push('k'))
      })
      await page.locator('#out').focus()
      await page.keyboard.press('k')
      assert.deepEqual(await takeFired(page), [])
      await page.locator('#in').focus()
      await page.keyboard.press('k')
      assert.deepEqual(await takeFired(page), ['k'])
    })

    test("a router on a same-origin iframe's window sees keys from inside the frame only", async (page) => {
      await page.evaluate(async () => {
        const { createRouter } = await import('/core.js')
        document.body.innerHTML = '<button id="out">out</button><iframe src="/browser-tests/fixtures/frame.html"></iframe>'
        const frame = document.querySelector('iframe')
        await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
        const r = createRouter({ target: frame.contentWindow })
        r.init()
        r.bind('k', () => window.fired.push('k'))
      })
      await page.locator('#out').focus()
      await page.keyboard.press('k')
      assert.deepEqual(await takeFired(page), [])
      await page.frameLocator('iframe').locator('#inside').focus()
      await page.keyboard.press('k')
      assert.deepEqual(await takeFired(page), ['k'])
    })

    test('a capture binding runs before a page that stops the key; a bubble binding never sees it', async (page) => {
      await page.evaluate(async () => {
        const { default: hk } = await import('/hotkey-router.js')
        document.body.innerHTML = '<div id="editor" tabindex="0">editor</div>'
        document.getElementById('editor').addEventListener('keydown', (e) => e.stopPropagation())
        hk.bind('ctrl+i', () => window.fired.push('capture'), null, { capture: true, preventDefault: true })
        hk.bind('ctrl+shift+x', () => window.fired.push('bubble'), null, { preventDefault: true })
      })
      await page.locator('#editor').focus()
      await page.keyboard.press('Control+i')
      await page.keyboard.press('Control+Shift+X')
      assert.deepEqual(await takeFired(page), ['capture'])
    })

    test('two routers on one target both fire; destroying one leaves the other working', async (page) => {
      await page.evaluate(async () => {
        const { createRouter } = await import('/core.js')
        window.a = createRouter()
        window.b = createRouter()
        for (const [name, r] of [['a', window.a], ['b', window.b]]) {
          r.init()
          r.bind('k', () => window.fired.push(name))
        }
      })
      await page.keyboard.press('k')
      assert.deepEqual(await takeFired(page), ['a', 'b'])
      await page.evaluate(() => window.a.destroy())
      await page.keyboard.press('k')
      assert.deepEqual(await takeFired(page), ['b'])
    })

    test("'text' mode on real controls: typing stays with the control, chords fire", async (page) => {
      await page.evaluate(async () => {
        const { createRouter } = await import('/core.js')
        document.body.innerHTML = `
          <input id="text">
          <input id="box" type="checkbox">
          <input id="slider" type="range" min="0" max="10" value="5">
          <button id="btn">Save</button>`
        window.clicks = 0
        document.getElementById('btn').addEventListener('click', () => window.clicks++)
        const r = createRouter({ ignoreInput: 'text' })
        r.init()
        for (const combo of ['k', 'space', 'arrowright']) r.bind(combo, () => window.fired.push(combo))
        r.bind('ctrl+i', () => window.fired.push('ctrl+i'), null, { preventDefault: true })
      })

      await page.locator('#text').focus()
      await page.keyboard.press('k')
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), [], 'text field: nothing fires')

      await page.locator('#box').focus()
      await page.keyboard.press('Space')
      assert.deepEqual(await takeFired(page), [], 'checkbox: Space is the control\'s')
      assert.equal(await page.locator('#box').isChecked(), true, 'and the checkbox still toggles')
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), ['ctrl+i'], 'checkbox: a chord fires')

      await page.locator('#slider').focus()
      await page.keyboard.press('ArrowRight')
      assert.deepEqual(await takeFired(page), [], 'slider: arrows are the control\'s')
      assert.equal(await page.locator('#slider').inputValue(), '6', 'and the slider still moves')
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), ['ctrl+i'], 'slider: a chord fires')

      await page.locator('#btn').focus()
      await page.keyboard.press('Space')
      assert.deepEqual(await takeFired(page), [], 'button: Space is the button\'s')
      assert.equal(await page.evaluate(() => window.clicks), 1, 'and the button still activates')
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), ['ctrl+i'], 'button: a chord fires')
    })

    test("'text' mode on native pickers: a date input is text, a color input is a control", async (page) => {
      await page.evaluate(async () => {
        const { createRouter } = await import('/core.js')
        document.body.innerHTML = '<input id="date" type="date"><input id="color" type="color">'
        const r = createRouter({ ignoreInput: 'text' })
        r.init()
        r.bind('ctrl+i', () => window.fired.push('ctrl+i'), null, { preventDefault: true })
      })
      await page.locator('#date').focus()
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), [], 'date: blocked')
      await page.locator('#color').focus()
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), ['ctrl+i'], 'color: the chord reaches the page and fires')
    })
  })
}
