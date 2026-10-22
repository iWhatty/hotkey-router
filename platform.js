// platform.js
// The one platform/browser detector for hotkey-router. The core router (for
// `mod`), reservations, sites, validate and format all use it, so they never
// disagree about what machine they are on.
//
// Sources, most to least reliable: a ChromeOS user agent (Chromebooks report
// navigator.platform as Linux), navigator.userAgentData.platform (Chromium),
// navigator.platform, then the user agent string.

/** @typedef {'mac' | 'windows' | 'linux' | 'chromeos'} Platform */
/** @typedef {'chrome' | 'firefox' | 'safari' | 'edge'} Browser */

function fromPlatformString(s) {
  if (!s) return null
  if (/Chrome ?OS|CrOS/i.test(s)) return 'chromeos'
  if (/Mac|iPhone|iPad|iPod/i.test(s)) return 'mac'
  if (/Win/i.test(s)) return 'windows'
  if (/Linux|X11/i.test(s)) return 'linux'
  return null
}

/**
 * The platform a navigator reports: 'mac', 'windows' or 'linux' (ChromeOS
 * counts as 'linux' unless `{ chromeos: true }`). Null when it can't tell,
 * or outside a browser.
 *
 * @param {Navigator | null} [nav]
 * @param {{ chromeos?: boolean }} [opts]
 * @returns {Platform | null}
 */
export function detectPlatform(nav = (typeof navigator !== 'undefined' ? navigator : null), { chromeos = false } = {}) {
  if (!nav) return null
  const ua = nav.userAgent || ''
  const found =
    (/\bCrOS\b/.test(ua) ? 'chromeos' : null) ||
    fromPlatformString(nav.userAgentData?.platform) ||
    fromPlatformString(nav.platform) ||
    (/Mac OS X/i.test(ua) ? 'mac' : /Windows/i.test(ua) ? 'windows' : /Linux|X11/i.test(ua) ? 'linux' : null)
  if (found === 'chromeos' && !chromeos) return 'linux'
  return found
}

/**
 * @param {Navigator | null} [nav]
 * @returns {Browser | null}
 */
export function detectBrowser(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  if (!nav) return null
  const ua = nav.userAgent || ''
  // Order matters: Edge UA contains 'Chrome', Chrome UA contains 'Safari'.
  if (/Edg\//.test(ua)) return 'edge'
  if (/Firefox/.test(ua)) return 'firefox'
  if (/Chrome/.test(ua)) return 'chrome'
  if (/Safari/.test(ua)) return 'safari'
  return null
}

const PLATFORM_LABELS = { mac: 'macOS', windows: 'Windows', linux: 'Linux', chromeos: 'ChromeOS' }
const BROWSER_LABELS = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge', safari: 'Safari' }

/** 'mac' -> 'macOS'. Unknown names come back as given. @param {string} platform @returns {string} */
export function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || platform
}

/** 'chrome' -> 'Chrome'. Unknown names come back as given. @param {string} browser @returns {string} */
export function browserLabel(browser) {
  return BROWSER_LABELS[browser] || browser
}
