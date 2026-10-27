// browser-tests/harness.mjs
//
// Shared setup for the local browser tests (npm run test:browser). Drives the
// Chrome and Edge already installed on this machine through playwright-core
// (`channel: 'chrome'` / `'msedge'`): no browser downloads, never hosted CI.
// Keyboard input goes through the browser's own input pipeline, so events
// are trusted, unlike jsdom's.
//
// A browser that is missing, or blocked by policy, is reported and its tests
// skipped, not failed.

import { chromium } from 'playwright-core'
import { startServer } from '../scripts/key-check-server.mjs'

export const CHANNELS = (process.env.BROWSERS || 'chrome,msedge').split(',').map((s) => s.trim()).filter(Boolean)

let serverPromise = null

/** The repo, served read-only on a free port (one server per test file). */
export function server() {
  serverPromise ??= startServer({ port: 0 })
  return serverPromise
}

/**
 * Launch one installed browser. Resolves to null, with a message, when it
 * can't be launched here.
 *
 * @param {string} channel
 */
export async function launch(channel) {
  try {
    return await chromium.launch({ channel, headless: true })
  } catch (err) {
    console.log(`# ${channel}: not launched, its tests are skipped (${String(err.message).split('\n')[0]})`)
    return null
  }
}

/**
 * A fresh page on the blank fixture, with `window.fired` collecting the
 * combos handlers report. Load modules inside it with `await import('/core.js')`.
 *
 * @param {import('playwright-core').Browser} browser
 */
export async function blankPage(browser) {
  const { origin } = await server()
  const page = await browser.newPage()
  page.on('pageerror', (err) => console.log(`# page error: ${err.message}`))
  await page.goto(`${origin}/browser-tests/fixtures/blank.html`)
  return page
}

/** Read and clear `window.fired`. */
export async function takeFired(page) {
  return page.evaluate(() => window.fired.splice(0))
}

export async function closeServer() {
  if (!serverPromise) return
  const { server: s } = await serverPromise
  await new Promise((resolve) => s.close(resolve))
  serverPromise = null
}
