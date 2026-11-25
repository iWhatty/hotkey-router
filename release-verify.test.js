// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

const verifier = resolve('scripts/release-verify.mjs')
const lockfile = (version) => JSON.stringify({ version, lockfileVersion: 3, packages: { '': { version } } })

function withTaggedPackage(version, lockedVersion, test) {
  const repo = mkdtempSync(join(tmpdir(), 'hotkey-verifier-test-'))
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' })
  try {
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'hotkey-router', version }))
    writeFileSync(join(repo, 'package-lock.json'), lockfile(lockedVersion))
    git('init')
    git('add', 'package.json', 'package-lock.json')
    git('-c', 'user.name=Verifier Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false',
      'commit', '-m', 'Fixture release')
    const tag = `v${version}`
    git('-c', 'tag.gpgSign=false', 'tag', tag)
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'npm_execpath'))
    const verify = () => spawnSync(process.execPath, [verifier, tag], {
      cwd: repo, encoding: 'utf8', env,
    })
    test({ repo, git, verify })
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

it('rejects a tagged lockfile mismatch even when the working copy is fixed', () => {
  withTaggedPackage('0.6.0', '0.5.2', ({ repo, git, verify }) => {
    writeFileSync(join(repo, 'package-lock.json'), lockfile('0.6.0'))

    const result = verify()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('package-lock.json version does not match package.json (0.6.0)')
    expect(result.stdout).not.toContain('npm publish')
    expect(git('status', '--porcelain').toString()).toContain(' M package-lock.json')
  })
})

it('rejects a prerelease with a matching lockfile before printing a publish command', () => {
  withTaggedPackage('0.7.0-rc.1', '0.7.0-rc.1', ({ verify }) => {
    const result = verify()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Expected a stable hotkey-router version (X.Y.Z); got 0.7.0-rc.1')
    expect(result.stdout).not.toContain('npm publish')
  })
})
