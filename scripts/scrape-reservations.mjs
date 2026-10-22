#!/usr/bin/env node
// scripts/scrape-reservations.mjs
//
// NOT WORKING YET: every parser in scripts/scrape/ is a TODO stub that
// returns null, so this script fetches nothing and can't diff or apply
// anything. It says so and exits 1. Until the parsers exist, edit
// data/browser-hotkeys.json by hand from the sources named in each parser.
//
// Maintenance tool — NOT shipped to library consumers. Meant to fetch the
// canonical browser/OS shortcut pages, parse them, diff the result against
// the bundled data/browser-hotkeys.json, and print a unified summary
// suitable for human review.
//
// Usage:
//   npm run scrape:diff   # fetch + diff (read-only; default)
//   npm run scrape:apply  # fetch + write merged data file
//
// Each per-source parser lives in scripts/scrape/<browser>.mjs and exports
// a single async function returning a partial of the data file's shape:
//
//   {
//     platform: 'mac' | 'windows' | 'linux',
//     browser:  'firefox' | 'chrome' | 'safari' | 'edge' | null,   // null for system/OS
//     entries:  { [comboKey]: { action, severity } }
//   }
//
// The top-level script merges every partial and diffs it against the bundled
// file. We deliberately don't auto-merge — browser docs change wording in
// ways that need a human eyeball, so even a "clean" diff should be reviewed
// before commit.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import scrapeFirefox from './scrape/firefox.mjs'
import scrapeChrome  from './scrape/chrome.mjs'
import scrapeSafari  from './scrape/safari.mjs'
import scrapeEdge    from './scrape/edge.mjs'
import scrapeGnome   from './scrape/gnome.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = resolve(__dirname, '../data/browser-hotkeys.json')

const SCRAPERS = [
  { name: 'firefox', run: scrapeFirefox },
  { name: 'chrome',  run: scrapeChrome },
  { name: 'safari',  run: scrapeSafari },
  { name: 'edge',    run: scrapeEdge },
  { name: 'gnome',   run: scrapeGnome },
]

function loadBundled() {
  return JSON.parse(readFileSync(DATA_PATH, 'utf8'))
}

// Compare two combo tables and return a structured diff.
function diffTables(current, next) {
  const added = []
  const removed = []
  const changed = []
  const allKeys = new Set([...Object.keys(current || {}), ...Object.keys(next || {})])
  for (const k of allKeys) {
    const a = current?.[k]
    const b = next?.[k]
    if (!a && b) added.push({ key: k, ...b })
    else if (a && !b) removed.push({ key: k, ...a })
    else if (a && b && (a.action !== b.action || a.severity !== b.severity)) {
      changed.push({ key: k, from: a, to: b })
    }
  }
  return { added, removed, changed }
}

function locate(bundled, partial) {
  const platform = bundled.platforms?.[partial.platform]
  if (!platform) return null
  if (partial.browser) {
    let table = platform.browsers?.[partial.browser]
    // Linux entries are $ref strings — resolve before diffing.
    if (typeof table === 'string' && table.startsWith('$ref:')) {
      const path = table.slice('$ref:'.length).split('.')
      let node = bundled
      for (const step of path) node = node?.[step]
      table = node
    }
    return { table, path: ['platforms', partial.platform, 'browsers', partial.browser] }
  }
  return { table: platform.system, path: ['platforms', partial.platform, 'system'] }
}

function setAtPath(obj, path, value) {
  let node = obj
  for (let i = 0; i < path.length - 1; i++) {
    if (node[path[i]] == null) node[path[i]] = {}
    node = node[path[i]]
  }
  node[path[path.length - 1]] = value
}

async function main() {
  const mode = process.argv[2] === '--apply' ? 'apply' : 'diff'
  const bundled = loadBundled()

  let totalChanges = 0
  let ran = 0
  const updates = []

  for (const { name, run } of SCRAPERS) {
    let partials
    try {
      partials = await run()
    } catch (err) {
      console.error(`${name}: scraper failed — ${err.message}`)
      continue
    }
    if (!partials) {
      console.log(`${name}: skipped (no partials returned)`)
      continue
    }
    ran++
    const list = Array.isArray(partials) ? partials : [partials]
    for (const partial of list) {
      const located = locate(bundled, partial)
      if (!located) {
        console.warn(`${name}: no destination in bundled data for ${partial.platform}/${partial.browser ?? 'system'}`)
        continue
      }
      const { added, removed, changed } = diffTables(located.table, partial.entries)
      const total = added.length + removed.length + changed.length
      totalChanges += total
      const label = partial.browser ?? 'system'
      if (total === 0) {
        console.log(`${name} ${partial.platform}/${label}: unchanged`)
      } else {
        console.log(`${name} ${partial.platform}/${label}: +${added.length} -${removed.length} ~${changed.length}`)
        for (const a of added.slice(0, 5)) console.log(`    + ${a.key}: ${a.action} [${a.severity}]`)
        for (const r of removed.slice(0, 5)) console.log(`    - ${r.key}: ${r.action}`)
        for (const c of changed.slice(0, 5)) {
          console.log(`    ~ ${c.key}: "${c.from.action}" [${c.from.severity}] → "${c.to.action}" [${c.to.severity}]`)
        }
        updates.push({ partial, located })
      }
    }
  }

  console.log('')
  if (ran === 0) {
    console.error('No scraper is implemented yet (scripts/scrape/*.mjs are stubs), so nothing was checked.')
    console.error('Edit data/browser-hotkeys.json by hand from the sources listed in each scraper.')
    process.exitCode = 1
    return
  }
  if (totalChanges === 0) {
    console.log('No changes detected — bundled data is up to date.')
    return
  }

  if (mode === 'apply') {
    for (const { partial, located } of updates) {
      // Merge: replace the entire table for that platform/browser. The
      // scrapers are authoritative on the page they read, so a missing entry
      // is a real removal, not an oversight.
      setAtPath(bundled, located.path, partial.entries)
    }
    bundled.version = bundled.version || {}
    bundled.version.generated = new Date().toISOString().slice(0, 10)
    writeFileSync(DATA_PATH, JSON.stringify(bundled, null, 2) + '\n', 'utf8')
    console.log(`Wrote merged ${DATA_PATH} (${totalChanges} change${totalChanges === 1 ? '' : 's'} applied).`)
  } else {
    console.log(`Run \`npm run scrape:apply\` to write the merged data file.`)
    // Non-zero exit so CI can open a PR when changes exist.
    process.exitCode = 2
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
