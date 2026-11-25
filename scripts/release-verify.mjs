import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enterHeavyWork } from './quiet-window.mjs'

const node = process.execPath
const node18Version = '18.20.8'

function run(bin, args, cwd, { capture = false, env = process.env } = {}) {
  const result = spawnSync(bin, args, {
    cwd, env, encoding: 'utf8', stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout)
    throw new Error(`${bin} ${args.join(' ')} failed (${result.signal ?? result.status})`)
  }
  return result.stdout
}

function npm(args, cwd, options) {
  return run(node, [process.env.npm_execpath, ...args], cwd, options)
}

function readRelease(source) {
  const { name, version } = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  if (name !== 'hotkey-router') {
    throw new Error('Expected the hotkey-router package in the requested commit')
  }
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Expected a stable hotkey-router version (X.Y.Z); got ${version}`)
  }
  const lock = JSON.parse(readFileSync(join(source, 'package-lock.json'), 'utf8'))
  if (lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error(`package-lock.json version does not match package.json (${version})`)
  }
  return { name, version }
}

function verifyBrowsers(source) {
  for (const [channel, name] of [['chrome', 'Chrome'], ['msedge', 'Edge']]) {
    console.log(`\nVerifying ${name} against the built package`)
    const output = run(node, ['--test', '--test-concurrency=1', '--test-reporter=tap', 'browser-tests/*.browser.mjs'], source, {
      capture: true, env: { ...process.env, BROWSERS: channel },
    })
    process.stdout.write(output)
    const total = output.match(/^# tests ([1-9]\d*)\r?$/m)?.[1]
    const passed = output.match(/^# pass (\d+)\r?$/m)?.[1]
    if (!total || total !== passed) {
      throw new Error(`${name} verification is incomplete; all browser tests must pass`)
    }
  }
}

function verifyTarball(source, scratch, { name, version }) {
  const [pack] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], source, { capture: true }))
  const filename = `${name}-${version}.tgz`
  if (pack?.name !== name || pack.version !== version || pack.filename !== filename) {
    throw new Error('npm pack produced an unexpected package')
  }
  const tarball = join(scratch, filename)
  const bytes = readFileSync(tarball)
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  if (pack.integrity !== integrity) throw new Error('Tarball integrity differs from the npm pack result')

  const consumer = join(scratch, 'consumer')
  mkdirSync(consumer)
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumer)
  copyFileSync(new URL('./release-smoke.mjs', import.meta.url), join(consumer, 'release-smoke.mjs'))
  copyFileSync(new URL('./release-smoke.mts', import.meta.url), join(consumer, 'release-smoke.mts'))
  run(node, ['release-smoke.mjs', version, process.version], consumer)
  npm(['exec', '--yes', `--package=node@${node18Version}`, '--', 'node', 'release-smoke.mjs', version, `v${node18Version}`], consumer)
  run(node, [join(source, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit',
    '--target', 'es2020', '--module', 'nodenext', 'release-smoke.mts'], consumer)
  console.log('Packed TypeScript declarations passed')
  return { bytes, integrity, filename }
}

function saveTarball(repo, commit, { bytes, filename, integrity }) {
  const dir = 'release-artifacts'
  const digest = Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex')
  const relativePath = `${dir}/${commit.slice(0, 12)}-${digest.slice(0, 16)}-${filename}`
  mkdirSync(join(repo, dir), { recursive: true })
  const temporary = join(repo, dir, `.${randomUUID()}.tmp`)
  try {
    // Publish the local file only after the verified bytes have been copied.
    writeFileSync(temporary, bytes, { flag: 'wx' })
    renameSync(temporary, join(repo, relativePath))
  } finally {
    rmSync(temporary, { force: true })
  }
  return relativePath
}

async function verify(revision, repo, commit, scratch) {
  const archive = join(scratch, 'source.tar')
  const source = join(scratch, 'source')
  mkdirSync(source)
  run('git', ['archive', '--format=tar', `--output=${archive}`, commit], repo)
  run('tar', ['-xf', archive, '-C', source], repo)
  const release = readRelease(source)
  if (!process.env.npm_execpath) throw new Error('Run via npm run release:verify -- <commit-or-tag>')
  console.log(`Verifying ${release.name} ${release.version} from ${revision} (${commit})`)

  const releaseHeavyWork = await enterHeavyWork({ label: 'hotkey-router release verification' })
  try {
    npm(['ci', '--ignore-scripts', '--include=dev', '--no-audit', '--no-fund'], source)
    npm(['test'], source)
    npm(['run', 'build'], source)
    npm(['run', 'build:types'], source)
    verifyBrowsers(source)
    const tarball = verifyTarball(source, scratch, release)
    return {
      ...release, ...tarball,
      coreSize: statSync(join(source, 'dist/hotkey-router.min.js')).size,
    }
  } finally {
    await releaseHeavyWork()
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || args[0].startsWith('-')) {
    throw new Error('Usage: npm run release:verify -- <commit-or-tag>')
  }
  const [revision] = args
  const repo = run('git', ['rev-parse', '--show-toplevel'], process.cwd(), { capture: true }).trim()
  const commit = run('git', ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], repo, { capture: true }).trim()
  const scratch = mkdtempSync(join(tmpdir(), 'hotkey-release-'))
  let result
  try {
    result = await verify(revision, repo, commit, scratch)
  } finally {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 3 })
  }
  const path = saveTarball(repo, commit, result)
  console.log(`\nVerified ${result.name} ${result.version}`)
  console.log(`Commit: ${commit}`)
  console.log(`Tarball: ${path}`)
  console.log(`Integrity: ${result.integrity}`)
  console.log(`Standalone core: ${result.coreSize} bytes`)
  console.log(`Publish from the repository root: npm publish "./${path}" --access public --tag latest --registry https://registry.npmjs.org`)
}

main().catch((error) => {
  console.error(`release:verify: ${error.message}`)
  process.exitCode = error.exitCode ?? 1
})
