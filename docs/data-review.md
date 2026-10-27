# Reviewing the shortcut tables

hotkey-router ships two tables that are read off vendor help pages by hand:

| Table | File | Date field | Used by |
| --- | --- | --- | --- |
| Browser and OS shortcuts (keys the page never sees) | `data/browser-hotkeys.json` | `version.generated` | `hotkey-router/reservations`, `/auto`, `/validate` |
| Website shortcuts (keys popular sites use) | `data/site-hotkeys.json`, compiled to `data/site-hotkeys.runtime.json` | `version.researched` | `hotkey-router/sites`, `/validate` |

Nothing updates them on its own; the scrapers in `scripts/scrape/` are stubs
(`npm run scrape:diff` says so and exits 1). So they age silently.
`npm run data:age` prints each table's date and warns once one is older than
six months. `node build.js` prints the same warning without failing.

Review both tables twice a year, or when that warning appears.

## Browser and OS table

1. Open each page in `version.sources` of `data/browser-hotkeys.json` (Chrome,
   Firefox, Safari and Edge help and DevTools pages, Apple's Mac keyboard
   shortcuts, Windows and GNOME shortcuts).
2. Compare with `platforms.<mac|windows|linux>.browsers.<browser>` and
   `platforms.<platform>.system`. Keys are in the canonical form described in
   `$keyFormat` (`ctrl+shift+period`); each row has an `action` and a
   `severity` (see `severityLevels`).
3. Add, change or remove rows. For a new kind of reservation, check that its
   `severity` is one of `severityLevels`.
4. Set `version.generated` to today (`YYYY-MM-DD`).
5. Run `npm test` (the reservation tests use real rows) and `node build.js`.
6. If a change affects a key SpellBolt or another consumer uses, say so in the
   CHANGELOG under Fixed, as 0.3.1 did for Cmd+Shift+/.

## Website table

1. For each site in `data/site-hotkeys.json` `sites`, open its `sources` and
   each row's `source`. The research notes per group are in
   `docs/site-hotkeys/` (google, microsoft, collaboration, publishing).
2. Each row has `windows`, `mac` and `chromeos` keys, an `action`, a
   `family` and `verified`. Set `verified: true` only when the vendor page (or
   its keymap source) shows that key.
3. Sites with `researched: false` list what's missing in `gaps`; research
   them, or leave them as they are.
4. Set `version.researched` to today.
5. Run `npm run sites:build`. It regenerates `data/site-hotkeys.runtime.json`
   (what the library loads) and `docs/site-hotkeys.md`. `npm run data:age`
   warns if the runtime copy's date doesn't match the source's, which means
   this step was skipped.
6. Run `npm test` (the sites tests use real rows) and `node build.js`.

## After either

- `npm run data:age` shows `ok` for both tables.
- Commit the data files with the generated ones, as
  `data: review <table> (YYYY-MM-DD)`, and add a CHANGELOG line.
