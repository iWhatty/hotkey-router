// build.js
//
// Production build script for hotkey-router.
//
// Outputs:
//  - dist/core.js                (ESM, readable, sourcemap; does nothing at import)
//  - dist/hotkey-router.js       (ESM, readable, sourcemap; imports ./core.js)
//  - dist/hotkey-router.min.js   (ESM, minified for CDN; one file, core inlined)
//  - dist/hotkey-router.cjs      (CommonJS for require() consumers; one file)
//  - the other entries: reservations, sites, format, validate, auto
//
// Notes:
//  - We bundle (bundle: true) so local modules (parse.js, platform.js) and
//    the data JSON are inlined into the dist files. Library is still
//    zero-dependency.
//  - We target modern environments (ES2020).
//  - dist/ is fully recreated on every build to avoid stale artifacts.

import { build } from 'esbuild'
import { rmSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// --- Read package metadata (robust across Node versions) ---
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

const banner = {
  // Keep banner short so it doesn’t bloat minified output.
  js: `// hotkey-router v${pkg.version} | ${pkg.license}\n`,
}

// --- Clean dist directory ---
// Remove previous build output to prevent stale files.
rmSync('dist', { recursive: true, force: true })
mkdirSync('dist')

const common = {
  bundle: true,
  target: 'es2020',
  loader: { '.json': 'json' },
}

// --- Core (ESM, readable + sourcemap) ---
// `import { createRouter } from 'hotkey-router/core'`. No router, no
// listeners, no reservation data.
await build({
  ...common,
  entryPoints: ['core.js'],
  outfile: 'dist/core.js',
  format: 'esm',
  sourcemap: true,
  banner,
})

// --- Main entry: ESM (readable + sourcemap) ---
// The core plus a default router started on window. Imports dist/core.js
// instead of inlining it, so an app that also imports hotkey-router/core
// bundles one copy (checked below).
await build({
  ...common,
  entryPoints: ['hotkey-router.js'],
  outfile: 'dist/hotkey-router.js',
  format: 'esm',
  sourcemap: true,
  external: ['./core.js'],
  banner,
})

// --- Main entry: ESM (minified, one file for CDN) ---
await build({
  ...common,
  entryPoints: ['hotkey-router.js'],
  outfile: 'dist/hotkey-router.min.js',
  format: 'esm',
  minify: true,
  banner,
})

// --- Main entry: CommonJS (one file) ---
await build({
  ...common,
  entryPoints: ['hotkey-router.js'],
  outfile: 'dist/hotkey-router.cjs',
  format: 'cjs',
  sourcemap: true,
  banner,
})

// --- Reservations module (ESM) ---
// Lets consumers `import { installReservationWarnings, lookupReservation }
// from 'hotkey-router/reservations'`. JSON data inlined.
await build({
  ...common,
  entryPoints: ['reservations.js'],
  outfile: 'dist/reservations.js',
  format: 'esm',
  sourcemap: true,
  banner,
})

// --- Sites module (ESM) ---
// `import { siteAware, lookupSiteConflicts } from 'hotkey-router/sites'`.
// Website shortcut table inlined; self-contained (no core import).
await build({
  ...common,
  entryPoints: ['sites.js'],
  outfile: 'dist/sites.js',
  format: 'esm',
  sourcemap: true,
  banner,
})

// --- Format module (ESM) ---
// `import { formatCombo, comboTokens } from 'hotkey-router/format'`. No data
// tables; inlines the shared parser and detector (parse.js, platform.js),
// which are stateless, so a second copy is harmless.
await build({
  ...common,
  entryPoints: ['format.js'],
  outfile: 'dist/format.js',
  format: 'esm',
  sourcemap: true,
  banner,
})

// --- Validate module (ESM) ---
// `import { validateCombo } from 'hotkey-router/validate'`, for key recorders.
// Imports dist/reservations.js, dist/sites.js and dist/format.js instead of
// inlining them, so an app that also imports those subpaths bundles one copy
// of each table, not two.
await build({
  ...common,
  entryPoints: ['validate.js'],
  outfile: 'dist/validate.js',
  format: 'esm',
  sourcemap: true,
  external: ['./reservations.js', './sites.js', './format.js'],
  banner,
})

// --- Auto entry (ESM) ---
// One-import: same default export as core, with warnings pre-installed.
// Imports dist/hotkey-router.js and dist/reservations.js instead of inlining
// them, so an app that imports both `hotkey-router` and `hotkey-router/auto`
// gets one router (one registry, one set of listeners), and the warnings
// cover bindings made through either import.
await build({
  ...common,
  entryPoints: ['auto.js'],
  outfile: 'dist/auto.js',
  format: 'esm',
  sourcemap: true,
  external: ['./hotkey-router.js', './reservations.js'],
  banner,
})

// --- Auto entry (minified, for CDN) ---
// Standalone: inlines the core and the table for a single <script> tag.
// It is its own router, so don't mix it with other hotkey-router imports.
await build({
  ...common,
  entryPoints: ['auto.js'],
  outfile: 'dist/auto.min.js',
  format: 'esm',
  minify: true,
  banner,
})

// --- Tree-shaking check ---
// Bundle a bare import of each entry through package.json, as an app's
// bundler would. The core and `auto` attach listeners (and `auto` installs
// warnings) at import, so they must survive; the others have no side
// effects and must drop out. Guards the `sideEffects` list.
const bareImport = async (spec) => {
  const out = await build({
    stdin: { contents: `import '${spec}'`, resolveDir: '.' },
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
  })
  return out.outputFiles[0].text.trim().length
}
for (const spec of ['hotkey-router', 'hotkey-router/auto']) {
  if (!(await bareImport(spec))) throw new Error(`build: \`import '${spec}'\` was tree-shaken away; check "sideEffects" in package.json`)
}
for (const spec of ['hotkey-router/core', 'hotkey-router/reservations', 'hotkey-router/sites', 'hotkey-router/format', 'hotkey-router/validate']) {
  if (await bareImport(spec)) throw new Error(`build: \`import '${spec}'\` kept code; it should have no side effects`)
}

// --- One router check ---
// `hotkey-router` and `hotkey-router/auto` must give the same router, or an
// app importing both gets two registries, two sets of window listeners, and
// no reservation warnings for bindings made through the plain import.
const main = await import('./dist/hotkey-router.js')
const auto = (await import('./dist/auto.js')).default
if (main.default !== auto) throw new Error('build: dist/auto.js has its own copy of the router; it must import ./hotkey-router.js')

// --- One implementation check ---
// dist/hotkey-router.js must import dist/core.js, not inline it, so an app
// that imports both `hotkey-router` and `hotkey-router/core` bundles one copy.
const coreEntry = await import('./dist/core.js')
if (main.createRouter !== coreEntry.createRouter) {
  throw new Error('build: dist/hotkey-router.js has its own copy of the core; it must import ./core.js')
}
if ('default' in coreEntry) throw new Error('build: dist/core.js must not have a default export (no ready router)')

// --- Size budget ---
// The minified core (dist/hotkey-router.min.js: the core plus the default
// router) must stay at or under 12 KB. Raise it only on purpose.
const SIZE_BUDGET = 12 * 1024
const coreSize = statSync('dist/hotkey-router.min.js').size
if (coreSize > SIZE_BUDGET) {
  throw new Error(`build: dist/hotkey-router.min.js is ${coreSize} B, over the ${SIZE_BUDGET} B budget`)
}

// --- Bundle size report ---
const report = (file) => {
  const raw = readFileSync(file)
  const gz = gzipSync(raw)
  return `${file}: ${raw.length} B raw, ${gz.length} B gzip`
}

console.log('✓ Built dist/')
console.log('  ' + report('dist/core.js'))
console.log('  ' + report('dist/hotkey-router.js'))
console.log('  ' + report('dist/hotkey-router.min.js'))
console.log('  ' + report('dist/hotkey-router.cjs'))
console.log('  ' + report('dist/reservations.js'))
console.log('  ' + report('dist/sites.js'))
console.log('  ' + report('dist/format.js'))
console.log('  ' + report('dist/validate.js'))
console.log('  ' + report('dist/auto.js'))
console.log('  ' + report('dist/auto.min.js'))
