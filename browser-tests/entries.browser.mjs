// browser-tests/entries.browser.mjs
//
// Sprint 0.4.0 slice D: the built package as an app bundles it. esbuild
// bundles small apps through package.json (`hotkey-router`, `/auto`,
// `/core`), the way an app's bundler would, and each runs in a real page.
// build.js already checks what survives tree-shaking; this checks that what
// survives works. Needs dist/ (npm run test:browser builds first).

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { CHANNELS, launch, blankPage, takeFired, closeServer } from './harness.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

async function bundle(contents) {
  const out = await build({
    stdin: { contents, resolveDir: ROOT },
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
  })
  return out.outputFiles[0].text
}

const MAIN_APP = `
import hotkeys from 'hotkey-router'
import auto from 'hotkey-router/auto'
window.sameRouter = hotkeys === auto
hotkeys.bind('ctrl+i', () => window.fired.push('main'), null, { preventDefault: true, warnOnReserved: false })
`

const CORE_APP = `
import { createRouter } from 'hotkey-router/core'
window.router = createRouter()
window.router.bind('ctrl+i', () => window.fired.push('core'), null, { preventDefault: true })
`

after(closeServer)

for (const channel of CHANNELS) {
  describe(`${channel}: built entries`, () => {
    let browser
    before(async () => { browser = await launch(channel) })
    after(async () => { await browser?.close() })

    const test = (name, fn) => it(name, async (t) => {
      if (!browser) return t.skip(`${channel} not available`)
      const page = await blankPage(browser)
      try {
        await fn(page)
      } finally {
        await page.close()
      }
    })

    test('hotkey-router and /auto are one router, listening as soon as the app loads', async (page) => {
      await page.addScriptTag({ type: 'module', content: await bundle(MAIN_APP) })
      await page.waitForFunction(() => 'sameRouter' in window)
      assert.equal(await page.evaluate(() => window.sameRouter), true)
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), ['main'])
    })

    test('/core attaches nothing until the app starts its router', async (page) => {
      await page.addScriptTag({ type: 'module', content: await bundle(CORE_APP) })
      await page.waitForFunction(() => 'router' in window)
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), [], 'not started: nothing fires')
      await page.evaluate(() => window.router.init())
      await page.keyboard.press('Control+i')
      assert.deepEqual(await takeFired(page), ['core'])
    })
  })
}
