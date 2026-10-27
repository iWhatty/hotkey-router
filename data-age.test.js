// data-age.test.js
// Slice E of sprint 0.4.0: how old the shortcut tables are (npm run data:age,
// and a warning in build.js). Dates are fixed in each test.
import { describe, it, expect } from 'vitest'
import { tableAges, staleWarnings, STALE_AFTER_DAYS } from './scripts/data-age.mjs'

const day = (iso) => new Date(`${iso}T12:00:00Z`)

describe('tableAges', () => {
  it('reads each table date from the data files', () => {
    const rows = tableAges({ now: day('2026-10-27') })
    expect(rows.map((r) => [r.file, r.date])).toEqual([
      ['data/browser-hotkeys.json', '2026-10-15'],
      ['data/site-hotkeys.json', '2026-10-03'],
    ])
    expect(rows.map((r) => r.days)).toEqual([12, 24])
    expect(rows.every((r) => !r.stale)).toBe(true)
  })

  it(`calls a table stale after ${STALE_AFTER_DAYS} days`, () => {
    const tables = { browser: { version: { generated: '2026-01-01' } }, sites: { version: { researched: '2026-01-01' } }, runtime: { version: { researched: '2026-01-01' } } }
    const fresh = tableAges({ now: day('2026-07-03'), tables }) // 183 days
    const old = tableAges({ now: day('2026-07-04'), tables }) // 184 days
    expect(fresh.map((r) => r.stale)).toEqual([false, false])
    expect(old.map((r) => r.stale)).toEqual([true, true])
  })

  it('treats a missing or unreadable date as stale', () => {
    const tables = { browser: { version: {} }, sites: { version: { researched: 'soon' } }, runtime: { version: { researched: 'soon' } } }
    const rows = tableAges({ now: day('2026-10-27'), tables })
    expect(rows.map((r) => [r.date, r.days, r.stale])).toEqual([[null, null, true], ['soon', null, true]])
  })
})

describe('staleWarnings', () => {
  it('is empty when every table is fresh and the runtime copy matches', () => {
    expect(staleWarnings({ now: day('2026-10-27') })).toEqual([])
  })

  it('names the stale table, its age and the checklist', () => {
    const tables = { browser: { version: { generated: '2026-01-01' } }, sites: { version: { researched: '2026-10-03' } }, runtime: { version: { researched: '2026-10-03' } } }
    const warnings = staleWarnings({ now: day('2026-10-27'), tables })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('data/browser-hotkeys.json')
    expect(warnings[0]).toContain('299 days')
    expect(warnings[0]).toContain('docs/data-review.md')
  })

  it('flags a runtime site table that was not rebuilt after the source changed', () => {
    const tables = { browser: { version: { generated: '2026-10-15' } }, sites: { version: { researched: '2026-10-20' } }, runtime: { version: { researched: '2026-10-03' } } }
    const warnings = staleWarnings({ now: day('2026-10-27'), tables })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('npm run sites:build')
  })
})
