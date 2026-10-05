// build.js
//
// Production build script for hotkey-router.
//
// Outputs:
//  - dist/hotkey-router.js       (ESM, readable, sourcemap)
//  - dist/hotkey-router.min.js   (ESM, minified for CDN)
//  - dist/hotkey-router.cjs      (CommonJS for require() consumers)
//
// Notes:
//  - We bundle (bundle: true) so the reservations data JSON is inlined into
//    the dist files. Library is still zero-dependency — the only thing being
//    pulled in is local `./reservations.js` + `./data/browser-hotkeys.json`.
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

// --- Core router: ESM (readable + sourcemap) ---
// Tiny mode. No reservation data. esbuild tree-shakes the data file out
// because hotkey-router.js never imports it.
await build({
  ...common,
  entryPoints: ['hotkey-router.js'],
  outfile: 'dist/hotkey-router.js',
  format: 'esm',
  sourcemap: true,
  banner,
})

// --- Core router: ESM (minified) ---
await build({
  ...common,
  entryPoints: ['hotkey-router.js'],
  outfile: 'dist/hotkey-router.min.js',
  format: 'esm',
  minify: true,
  banner,
})

// --- Core router: CommonJS ---
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

// --- Validate module (ESM) ---
// `import { validateCombo } from 'hotkey-router/validate'`, for key recorders.
// Imports dist/reservations.js and dist/sites.js instead of inlining them, so
// an app that also imports those subpaths bundles one copy of each table,
// not two.
await build({
  ...common,
  entryPoints: ['validate.js'],
  outfile: 'dist/validate.js',
  format: 'esm',
  sourcemap: true,
  external: ['./reservations.js', './sites.js'],
  banner,
})

// --- Auto entry (ESM) ---
// One-import: same default export as core, with warnings pre-installed.
await build({
  ...common,
  entryPoints: ['auto.js'],
  outfile: 'dist/auto.js',
  format: 'esm',
  sourcemap: true,
  banner,
})

// --- Auto entry (minified, for CDN) ---
await build({
  ...common,
  entryPoints: ['auto.js'],
  outfile: 'dist/auto.min.js',
  format: 'esm',
  minify: true,
  banner,
})

// --- Bundle size report ---
const report = (file) => {
  const raw = readFileSync(file)
  const gz = gzipSync(raw)
  return `${file}: ${raw.length} B raw, ${gz.length} B gzip`
}

console.log('✓ Built dist/')
console.log('  ' + report('dist/hotkey-router.js'))
console.log('  ' + report('dist/hotkey-router.min.js'))
console.log('  ' + report('dist/hotkey-router.cjs'))
console.log('  ' + report('dist/reservations.js'))
console.log('  ' + report('dist/sites.js'))
console.log('  ' + report('dist/validate.js'))
console.log('  ' + report('dist/auto.js'))
console.log('  ' + report('dist/auto.min.js'))
