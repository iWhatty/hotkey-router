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
4. On Windows, check the rows with real keys: run
   `scripts/key-check-reserved.ahk` (AutoHotkey 1.1; about a minute, and it
   waits while you use the PC), then `node scripts/key-check-reserved-report.mjs`.
   A key where the page wins is `preventable`; one the page never sees is
   `hard`. Pass `all all control` to check every Ctrl+letter. To keep the
   PC usable while it runs, run it in Windows Sandbox instead (below).

5. Set `version.generated` to today (`YYYY-MM-DD`).
6. Run `npm test` (the reservation tests use real rows) and `node build.js`.
7. If a change affects a key SpellBolt or another consumer uses, say so in the
   CHANGELOG under Fixed, as 0.3.1 did for Cmd+Shift+/.

## Real-key checks in Windows Sandbox

The AHK checks press real keys and bring browser windows to the front, so on
your own desktop they take over the keyboard. In Windows Sandbox they do that
on the sandbox's desktop, and the notes come back to `docs/notes/`:

    npm run key-check:sandbox                       # key-check-reserved.ahk, default keys
    npm run key-check:sandbox -- reserved all all control
    npm run key-check:sandbox -- layouts            # key-check.ahk (keyboard layouts)

It opens a sandbox window, runs the check there, writes the note
(`docs/notes/key-check-reserved-<date>.md`, or `key-check-<date>-<browser>.md`
for `layouts`), and closes the sandbox when it worked. The command waits and
prints what was written. A first run takes a few minutes longer while the
sandbox starts.

- **Turn Windows Sandbox on once** (Windows 10/11 Pro or Enterprise, with
  virtualization on in the BIOS): from an admin PowerShell,
  `Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All`,
  then restart. The command says so if it's off.
- **Leave the sandbox window open.** It can sit behind other windows or on
  another virtual desktop, but don't minimize it: a minimized sandbox stops
  drawing, and the window checks can't see what the browser did. Clicking or
  typing in it pauses the reserved-key check (it waits for 10 idle seconds),
  as on your own desktop. Closing it ends the run.
- **What it uses:** AutoHotkey 1.1, Node, Chrome, Firefox and Edge from this
  PC, mapped in read-only; whichever this PC doesn't have, the sandbox
  downloads and installs (cached in the run folder). The repo is mapped
  read-only; only `docs/notes/` and the run folder are writable. Clipboard
  and printer sharing are off, so the check's Ctrl+C and Ctrl+P stay inside.
- **Run folder:** `%TEMP%\hotkey-router-key-check\sandbox` holds
  `key-check.wsb` (double-click it to rerun the last check), `job.json` (the
  script and arguments), `status.txt`, `logon.log`, the AHK run log, and
  `probe.jsonl`, the reserved-key event log (the server's
  `KEY_CHECK_PROBE_LOG`; the previous run's is kept as `probe-previous.jsonl`).
  To rewrite a note from it:
  `node scripts/key-check-reserved-report.mjs %TEMP%\hotkey-router-key-check\sandbox\probe.jsonl`.
- **When it fails** the sandbox stays open so you can look; the command
  prints why. Close the window when done; nothing in it is kept.

How it fits together: `scripts/sandbox/key-check-sandbox.mjs` writes the
`.wsb` and waits for `done.json` in the run folder;
`scripts/sandbox/logon.ps1` runs at the sandbox's logon, sets
`KEY_CHECK_NOTES` and `KEY_CHECK_PROBE_LOG` for `key-check-server.mjs` and
the report, and runs the AHK script.

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
