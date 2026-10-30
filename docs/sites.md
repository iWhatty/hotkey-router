# Website shortcuts

Apps that run on other people's pages, such as browser extensions and
embedded widgets, collide with the page's own shortcuts: Google Docs uses
Ctrl+Shift+. to grow the font, GitHub uses it too. Unlike the browser's keys
(see [docs/reservations.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/reservations.md)),
these reach the page, so the app can choose whether to take the key or leave
it to the site.

`hotkey-router/sites` knows which popular sites use which chords in the
Ctrl/Cmd+Shift, Ctrl/Cmd+Alt, Shift+Alt and Ctrl/Cmd+Alt+Shift families, and
builds a `when` gate that yields to the site unless the user is working in
the app. It imports nothing from the router, so it never creates a second
one. About 38 KB minified (~9 KB gzipped), mostly the table.

## `siteAware(hotkey, options)`

```js
import hotkeys from 'hotkey-router'
import { siteAware } from 'hotkey-router/sites'

hotkeys.bind('mod+shift+code:Period', nextTypo, null, {
  capture: true,          // see the key before the page's editor does
  preventDefault: true,
  stopPropagation: true,  // when we take it, the page doesn't run it too
  allowIn: () => true,    // the page's editor is a text field
  when: siteAware('mod+shift+code:Period', {
    engaged: () => popupIsOpen() || panelHasFocus(),
  }),
})
```

On sites that don't use the chord the gate is always true. On sites that do
(Google Docs, Google Slides, Confluence, Linear, GitHub, ...) it returns
`engaged(event)`; when that is false, the router leaves the event alone and
the site's shortcut runs.

| Option | What it does |
| --- | --- |
| `engaged(event)` | Required. True when the user is working in your app, so it should get the key. |
| `url()` | The page URL to check; default `location.href`. Conflicts are looked up once per URL. |
| `platform` | `'mac'`, `'windows'`, `'linux'` or `'chromeos'`; default `detectSitePlatform()`, else `'windows'`. |
| `verifiedOnly` | Only count rows read on the vendor's own page (default `false`). |
| `onYield(conflicts, event)` | Called each time the gate yields to the site. |

## Other exports

| Export | What it does |
| --- | --- |
| `lookupSiteConflicts(hotkey, { url, platform, verifiedOnly })` | The site shortcuts on a page (default: this one) that use the same chord: `[{ siteId, siteName, action, verified, lookupKey }]`. |
| `matchSites(url?)` | The sites in the table whose hosts and path prefixes match a URL. |
| `siteLookupKey(hotkey, platform?)` | The canonical key the table uses: `mod+shift+code:Period` on `'mac'` → `meta+shift+period`. |
| `detectSitePlatform(navigator?)` | `detectPlatform` with ChromeOS told apart (the table has a ChromeOS column). |
| `listSites()` | Every site: `{ id, name, hosts, pathPrefixes, shortcuts }`, each shortcut `[windows, mac, chromeos, action, verified]`. |
| `parseComboString(hotkey, platform)` | Lenient parse into `{ ctrl, meta, alt, shift, base }`. |
| `SITE_DATA_RESEARCHED`, `SITE_SCHEMA_VERSION` | The table's research date and schema version. |

`hotkey` is a hotkey string or a parsed combo. Linux uses the Windows
column.

## The table

The sourced table is
[`data/site-hotkeys.json`](https://github.com/iWhatty/hotkey-router/blob/main/data/site-hotkeys.json)
(each row with its sources), compiled to `data/site-hotkeys.runtime.json`
for the module. Both are importable as `hotkey-router/data/...`. Which sites
are covered, what each one uses, and how the rows were researched:
[docs/site-hotkeys.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/site-hotkeys.md).
How to review and update it:
[docs/data-review.md](https://github.com/iWhatty/hotkey-router/blob/main/docs/data-review.md).

`hotkey-router/validate` warns about the same conflicts with the reason
`site-conflict`.
