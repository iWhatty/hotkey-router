// scripts/data-age.mjs (npm run data:age)
//
// How old the shortcut tables are. The browser/OS table and the site table
// are read off vendor help pages by hand; nothing updates them, so they age
// silently. This prints each table's date and warns when one is older than
// six months, or when the runtime site table wasn't rebuilt after its source
// changed. build.js prints the same warnings without failing.
//
// What to do about a warning: docs/data-review.md.

import { pathToFileURL } from 'node:url'
import BROWSER from '../data/browser-hotkeys.json' with { type: 'json' }
import SITES from '../data/site-hotkeys.json' with { type: 'json' }
import RUNTIME from '../data/site-hotkeys.runtime.json' with { type: 'json' }

export const STALE_AFTER_DAYS = 183
const DAY = 24 * 60 * 60 * 1000

const readTables = () => ({ browser: BROWSER, sites: SITES, runtime: RUNTIME })

function daysSince(iso, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null
  const then = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(then) ? null : Math.floor((now - then) / DAY)
}

/**
 * One row per table: its file, the date field it's read from, the date, its
 * age in days and whether that's stale. A missing or unreadable date is
 * stale.
 *
 * @param {{ now?: Date, tables?: { browser: any, sites: any, runtime: any } }} [opts]
 */
export function tableAges({ now = new Date(), tables = readTables() } = {}) {
  return [
    { table: 'browser and OS shortcuts', file: 'data/browser-hotkeys.json', field: 'version.generated', date: tables.browser?.version?.generated ?? null },
    { table: 'website shortcuts', file: 'data/site-hotkeys.json', field: 'version.researched', date: tables.sites?.version?.researched ?? null },
  ].map((row) => {
    const days = daysSince(row.date, now)
    return { ...row, days, stale: days === null || days > STALE_AFTER_DAYS }
  })
}

/**
 * Plain-language warnings, empty when all is well.
 *
 * @param {{ now?: Date, tables?: { browser: any, sites: any, runtime: any } }} [opts]
 * @returns {string[]}
 */
export function staleWarnings({ now = new Date(), tables = readTables() } = {}) {
  const warnings = []
  for (const row of tableAges({ now, tables })) {
    if (!row.stale) continue
    warnings.push(row.days === null
      ? `${row.file}: no readable date in ${row.field} (got ${JSON.stringify(row.date)}). See docs/data-review.md.`
      : `${row.file}: the ${row.table} were last checked ${row.date}, ${row.days} days ago (over ${STALE_AFTER_DAYS}). Review them: docs/data-review.md.`)
  }
  const source = tables.sites?.version?.researched
  const runtime = tables.runtime?.version?.researched
  if (source !== runtime) {
    warnings.push(`data/site-hotkeys.runtime.json says ${runtime} but data/site-hotkeys.json says ${source}: run npm run sites:build.`)
  }
  return warnings
}

// Run as a script (npm run data:age), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const now = new Date()
  for (const row of tableAges({ now })) {
    const age = row.days === null ? 'no readable date' : `${row.days} days old`
    console.log(`${row.stale ? 'STALE' : 'ok   '}  ${row.file}  ${row.field} = ${row.date}  (${age})`)
  }
  const warnings = staleWarnings({ now })
  for (const w of warnings) console.log(`warning: ${w}`)
  if (!warnings.length) console.log(`All tables checked within ${STALE_AFTER_DAYS} days.`)
}
