// scripts/scrape/firefox.mjs
//
// Canonical sources:
//   https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly
//   https://firefox-source-docs.mozilla.org/devtools-user/keyboard_shortcuts/index.html
//
// Page structure: Mozilla support tables use class="documentation" with
// per-section headings ("Navigation", "Current Page", "Find", ...). DevTools
// docs use Sphinx-generated tables with `.docutils.align-default`.
//
// Until this scraper is wired up, return null so the orchestrator records it
// as "skipped" and the diff stays clean. Fill in using cheerio + fetchText
// from ./_common.mjs and return one partial per platform.

export default async function scrapeFirefox() {
  // TODO: implement parsing of Firefox support + DevTools tables. Should
  // emit three partials: mac/firefox, windows/firefox, linux/firefox.
  return null
}
