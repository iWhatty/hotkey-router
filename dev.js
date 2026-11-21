import { lookupReservation, severityIsHard } from './reservations.js'
import { detectPlatform, detectBrowser, platformLabel } from './platform.js'
import { lookupKey } from './parse.js'
import { shiftedPunctuationHint } from './shifted-punctuation.js'

/** @typedef {import('./reservations.js').Reservation} Reservation */
/** @typedef {Pick<import('./core.js').Router, 'onBind'>} BindSource */
/** @typedef {Pick<Console, 'warn' | 'info'>} WarningConsole */
/**
 * @typedef {{
 *   platform?: import('./reservations.js').Platform | null,
 *   browser?: import('./reservations.js').Browser | null,
 *   console?: WarningConsole
 * }} WarningOptions
 */

// A shifted combo and event type warn once, even across routers.
const warnedShifted = new Set()

/**
 * Render a console-friendly warning string for a reservation.
 *
 * @param {Reservation} reservation
 * @param {string} rawHotkey
 * @param {{ preventDefault?: boolean }} [bindOptions]  the binding's options
 * @returns {string}
 */
export function formatReservationWarning(reservation, rawHotkey, bindOptions) {
  const where = platformLabel(reservation.platform)
  const sourceLabel = reservation.source === 'browser'
    ? `${reservation.browser} on ${where}`
    : where
  const tag = severityIsHard(reservation.severity)
    ? 'will not fire'
    : reservation.severity === 'preventable'
      ? (bindOptions?.preventDefault
          ? 'fires first; preventDefault keeps the browser out'
          : 'fires, and the browser acts too; bind with preventDefault: true')
      : 'fires in normal browsing'
  return `[hotkey-router] "${rawHotkey}" (${reservation.lookupKey}) reserved by ${sourceLabel}: "${reservation.action}" [${reservation.severity}] — ${tag}.`
}

/**
 * Emit a reservation warning via the given console (or the global `console`
 * by default). Hard reservations log via `warn`; soft ones via `info`, except
 * a preventable key bound without `preventDefault`, where the browser's
 * action runs too: that logs via `warn`.
 *
 * @param {Reservation} reservation
 * @param {string} rawHotkey
 * @param {WarningConsole} [console_]
 * @param {{ preventDefault?: boolean }} [bindOptions]  the binding's options
 * @returns {void}
 */
export function emitReservationWarning(reservation, rawHotkey, console_ = console, bindOptions) {
  const msg = formatReservationWarning(reservation, rawHotkey, bindOptions)
  const loud = severityIsHard(reservation.severity) ||
    (reservation.severity === 'preventable' && !bindOptions?.preventDefault)
  const fn = loud ? console_.warn : console_.info
  fn.call(console_, msg)
}

/** @param {BindSource} router @param {WarningOptions} opts @param {boolean} includeShifted */
function installWarnings(router, opts, includeShifted) {
  if (!router || typeof router.onBind !== 'function') {
    throw new TypeError('Development warnings require a hotkey-router instance with onBind()')
  }
  const { platform = detectPlatform(), browser = detectBrowser() } = opts
  const console_ = opts.console || console

  return router.onBind(({ combo, type, raw, options }) => {
    if (includeShifted) {
      const hint = shiftedPunctuationHint(raw, { combo, type })
      if (hint) {
        const key = `${lookupKey(combo)} ${type}`
        if (!warnedShifted.has(key)) {
          warnedShifted.add(key)
          console_.warn(`[hotkey-router] ${hint.message}`)
        }
      }
    }

    if (options?.warnOnReserved === false || !platform || !browser) return
    const reservation = lookupReservation(combo, { platform, browser })
    if (reservation) emitReservationWarning(reservation, raw, console_, options)
  })
}

/**
 * Subscribe to reservation warnings and shifted-punctuation hints for future binds.
 * @param {BindSource} router
 * @param {WarningOptions} [opts]
 * @returns {() => void} uninstall function
 */
export function installDevWarnings(router, opts = {}) {
  return installWarnings(router, opts, true)
}

/**
 * Subscribe to reservation warnings for future binds.
 * @param {BindSource} router
 * @param {WarningOptions} [opts]
 * @returns {() => void} uninstall function
 */
export function installReservationWarnings(router, opts = {}) {
  return installWarnings(router, opts, false)
}
