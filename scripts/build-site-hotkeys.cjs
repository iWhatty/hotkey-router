// scripts/build-site-hotkeys.cjs
//
// Regenerates the derived site-shortcut files from the sourced table:
//   data/site-hotkeys.json          (source of truth: edit this)
//   -> data/site-hotkeys.runtime.json (compact, imported by sites.js)
//   -> docs/site-hotkeys.md           (human reference)
//
// Run: npm run sites:build
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..');
const out = JSON.parse(fs.readFileSync(`${REPO}/data/site-hotkeys.json`, 'utf8'));
const sites = out.sites;
const systemNotes = out.systemNotes || [];

// Runtime projection for sites.js: only what matching and messages need.
// shortcuts: [windows, mac, chromeos, action, verified (1 or 0)]
const runtime = {
  $comment: 'Generated from data/site-hotkeys.json (the full, sourced table). Runtime projection used by sites.js; do not edit by hand.',
  version: out.version,
  sites: sites.map((st) => ({
    id: st.id,
    name: st.name,
    hosts: st.hosts,
    pathPrefixes: st.pathPrefixes,
    shortcuts: st.shortcuts.map((k) => [k.windows, k.mac, k.chromeos, k.action, k.verified ? 1 : 0]),
  })),
};
fs.writeFileSync(`${REPO}/data/site-hotkeys.runtime.json`, JSON.stringify(runtime) + '\n');

// --- docs/site-hotkeys.md ---
const fam = ['ctrl+shift', 'ctrl+alt', 'alt+shift', 'ctrl+alt+shift'];
const famLabel = {
  'ctrl+shift': 'Ctrl/Cmd+Shift',
  'ctrl+alt': 'Ctrl/Cmd+Alt',
  'alt+shift': 'Shift+Alt',
  'ctrl+alt+shift': 'Ctrl/Cmd+Alt+Shift',
};
const cell = (v) => String(v ?? '').replace(/\|/g, '/');
const lines = [];
lines.push('# Website Shortcuts Reference', '');
lines.push(`Generated from \`data/site-hotkeys.json\` (researched ${out.version.researched}) by the merge script; edit the data, not this file. Research notes per group: [docs/site-hotkeys/](site-hotkeys/).`, '');
lines.push("Why this exists: an extension or embedded widget that binds a hotkey runs on other people's pages. Browser and OS keys are in `data/browser-hotkeys.json` (they never reach the page). The keys here DO reach the page, and the site uses them. `hotkey-router/sites` looks them up so an app can yield on those sites unless the user is focused on the app.", '');
lines.push(out.version.method, '');
lines.push('## Coverage', '');
lines.push(`| Site | Hosts | ${fam.map((f) => famLabel[f]).join(' | ')} | Verified |`);
lines.push(`| --- | --- | ${fam.map(() => '---').join(' | ')} | --- |`);
for (const s of sites) {
  const hosts = `${s.hosts.join(', ')}${s.pathPrefixes.length ? ` (${s.pathPrefixes.join(', ')})` : ''}${s.hostsConfirmed ? '' : ' (unconfirmed)'}`;
  if (!s.researched) {
    lines.push(`| ${s.name} | ${hosts} | not researched | | | | |`);
    continue;
  }
  const c = fam.map((f) => s.shortcuts.filter((k) => k.family === f).length);
  const v = s.shortcuts.filter((k) => k.verified).length;
  lines.push(`| ${s.name} | ${hosts} | ${c.join(' | ')} | ${v}/${s.shortcuts.length} |`);
}
lines.push('', '## Punctuation chords at a glance', '');
lines.push('Who uses each family with `,` `.` `;` `\'` `/` (keys apps like to pick for "next / previous"). Windows notation; the Mac column is matched with Cmd in place of Ctrl.', '');
lines.push('| Chord (Windows) | Used by |', '| --- | --- |');
for (const f of fam) {
  for (const p of ['comma', 'period', 'semicolon', 'quote', 'slash']) {
    const chord = `${f}+${p}`;
    const macChord = chord.replace(/^ctrl\+/, 'meta+');
    const users = new Set();
    for (const s of sites) {
      for (const k of s.shortcuts) {
        if (k.windows === chord || k.chromeos === chord || k.mac === macChord) {
          users.add(`${s.name}: ${cell(k.action)}${k.verified ? '' : ' (unverified)'}`);
        }
      }
    }
    lines.push(`| ${chord} | ${users.size ? [...users].join('; ') : 'none found'} |`);
  }
}
lines.push('', '## System notes', '');
lines.push('Operating-system behavior that affects these families on every site (not part of site matching).');
for (const n of systemNotes) {
  lines.push('', `### ${n.name}`, '');
  for (const r of n.notes) lines.push(`- Windows \`${cell(r.windows) || '-'}\`: ${cell(r.action)}${r.verified ? '' : ' (unverified)'}. ${cell(r.notes)}`);
  if (n.gaps) lines.push('', `Gaps: ${cell(n.gaps)}`);
}
for (const s of sites) {
  lines.push('', `## ${s.name}`, '');
  lines.push(`Hosts: ${s.hosts.join(', ')}${s.pathPrefixes.length ? `; paths: ${s.pathPrefixes.join(', ')}` : ''}${s.hostsConfirmed ? '' : ' (unconfirmed)'}.`);
  if (!s.researched) {
    lines.push('', `Not researched: ${cell(s.gaps)}`);
    continue;
  }
  lines.push('', '| Family | Windows | Mac | ChromeOS | Action | Verified |', '| --- | --- | --- | --- | --- | --- |');
  const rows = [...s.shortcuts].sort((a, b) => fam.indexOf(a.family) - fam.indexOf(b.family));
  for (const k of rows) {
    lines.push(`| ${famLabel[k.family] ?? k.family} | ${cell(k.windows)} | ${cell(k.mac)} | ${cell(k.chromeos)} | ${cell(k.action)} | ${k.verified ? 'yes' : 'no'} |`);
  }
  for (const n of s.modifierNotes || []) {
    lines.push('', `Modifier pattern: ${cell(n.action)} (Windows ${cell(n.windows) || '-'}, Mac ${cell(n.mac) || '-'}). ${cell(n.notes)}`);
  }
  if (s.gaps) lines.push('', `Gaps: ${cell(s.gaps)}`);
}
fs.writeFileSync(`${REPO}/docs/site-hotkeys.md`, lines.join('\n') + '\n');
console.log('sites', sites.length, 'rows', sites.reduce((a, s) => a + s.shortcuts.length, 0));
