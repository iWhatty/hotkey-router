// scripts/sandbox/key-check-sandbox.mjs
//
// Runs a real-key check inside Windows Sandbox, so the keys it presses and
// the windows it brings to the front stay on the sandbox's own desktop and
// the PC stays usable:
//
//   npm run key-check:sandbox                      key-check-reserved.ahk, default keys
//   npm run key-check:sandbox -- reserved all all control
//   npm run key-check:sandbox -- layouts           key-check.ahk
//   npm run key-check:sandbox -- layouts chrome 2 9
//
// Writes key-check.wsb to %TEMP%\hotkey-router-key-check\sandbox (the run
// folder) and opens it. Inside the sandbox:
//   C:\hotkey-router   this repo, read-only
//   C:\notes           docs\notes, writable: the notes land here on the host
//   C:\run             the run folder, writable: job, status, logs, probe.jsonl
//   AutoHotkey, Node, Chrome, Firefox and Edge, mapped read-only from this PC
// scripts\sandbox\logon.ps1 runs at logon, installs whatever this PC didn't
// have, runs the script, writes the reserved-key note, and shuts the sandbox
// down when it worked (it stays open when something went wrong).
//
// This waits for the run and prints where the note went. Windows Sandbox must
// be turned on first (docs/data-review.md says how).

import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\$/, '')
const NOTES = join(ROOT, 'docs', 'notes')
const RUN = join(tmpdir(), 'hotkey-router-key-check', 'sandbox')
const SANDBOX = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsSandbox.exe')
const SCRIPTS = { reserved: 'key-check-reserved.ahk', layouts: 'key-check.ahk' }
const TIMEOUT_MS = 90 * 60 * 1000

const PF = process.env.ProgramFiles || 'C:\\Program Files'
const PF86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
const LOCAL = process.env.LOCALAPPDATA || ''

// What to map from this PC: [name, folders to look in (first with the file
// wins), file that must be there, folder inside the sandbox]. Browsers go to
// the paths the AHK scripts look in. Anything not found is installed by
// logon.ps1 inside the sandbox instead.
const TOOLS = [
  ['AutoHotkey', [join(PF, 'AutoHotkey')], 'AutoHotkey.exe', 'C:\\tools\\AutoHotkey'],
  ['Node', [dirname(process.execPath)], 'node.exe', 'C:\\tools\\nodejs'],
  ['Chrome', [join(PF, 'Google', 'Chrome', 'Application'), join(LOCAL, 'Google', 'Chrome', 'Application')],
    'chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application'],
  ['Firefox', [join(PF, 'Mozilla Firefox'), join(LOCAL, 'Mozilla Firefox')], 'firefox.exe', 'C:\\Program Files\\Mozilla Firefox'],
  ['Edge', [join(PF86, 'Microsoft', 'Edge', 'Application')], 'msedge.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application'],
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (process.platform !== 'win32') fail('Windows Sandbox runs on Windows only.')
if (!existsSync(SANDBOX)) {
  fail(`Windows Sandbox is not turned on (${SANDBOX} is missing).
Turn it on once, from an admin PowerShell, then restart:
  Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All
It needs Windows 10/11 Pro or Enterprise and virtualization on in the BIOS.`)
}
if (tasklist().includes('"windowssandbox')) {
  fail('A Windows Sandbox is already open, and only one can run at a time. Close it and run this again.')
}

const [which = 'reserved', ...args] = process.argv.slice(2)
if (!SCRIPTS[which]) fail(`Unknown check "${which}". Use one of: ${Object.keys(SCRIPTS).join(', ')}.`)

// A fresh run folder, keeping the last event log for comparison.
mkdirSync(join(RUN, 'cache'), { recursive: true })
for (const name of ['done.json', 'status.txt', 'logon.log', 'run.log', 'run-reserved.log']) rmSync(join(RUN, name), { force: true })
if (existsSync(join(RUN, 'probe.jsonl'))) renameSync(join(RUN, 'probe.jsonl'), join(RUN, 'probe-previous.jsonl'))
writeFileSync(join(RUN, 'job.json'), JSON.stringify({ script: SCRIPTS[which], args }, null, 2))

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mapping = (host, sandbox, readOnly) => `    <MappedFolder>
      <HostFolder>${xml(host)}</HostFolder>
      <SandboxFolder>${xml(sandbox)}</SandboxFolder>
      <ReadOnly>${readOnly}</ReadOnly>
    </MappedFolder>`

const maps = [mapping(ROOT, 'C:\\hotkey-router', true), mapping(NOTES, 'C:\\notes', false), mapping(RUN, 'C:\\run', false)]
for (const [name, folders, file, target] of TOOLS) {
  const found = folders.find((folder) => folder && existsSync(join(folder, file)))
  console.log(`${name.padEnd(10)} ${found ? `from ${found}` : 'not on this PC; the sandbox installs it'}`)
  if (found) maps.push(mapping(found, target, true))
}

// No clipboard or printer sharing: the check presses Ctrl+C, Ctrl+X and
// Ctrl+P, and none of that should reach this PC.
const wsb = `<Configuration>
  <MemoryInMB>4096</MemoryInMB>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <PrinterRedirection>Disable</PrinterRedirection>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <MappedFolders>
${maps.join('\n')}
  </MappedFolders>
  <LogonCommand>
    <Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File C:\\hotkey-router\\scripts\\sandbox\\logon.ps1</Command>
  </LogonCommand>
</Configuration>
`
const wsbFile = join(RUN, 'key-check.wsb')
writeFileSync(wsbFile, wsb)

const started = Date.now()
const notesBefore = notesSnapshot()
console.log(`\nOpening ${wsbFile}\nRunning ${SCRIPTS[which]} ${args.join(' ')} in the sandbox. Leave its window open (it can sit behind`)
console.log('others, but not minimized); clicking into it pauses the check. Ctrl+C here stops waiting, not the sandbox.\n')
spawn(SANDBOX, [wsbFile], { detached: true, stdio: 'ignore' }).unref()

let lastStatus = ''
await new Promise((resolve) => {
  const timer = setInterval(() => {
    const status = read(join(RUN, 'status.txt')).trim()
    if (status && status !== lastStatus) console.log(`sandbox: ${(lastStatus = status)}`)
    const done = read(join(RUN, 'done.json'))
    const gone = Date.now() - started > 60_000 && !tasklist().includes('"windowssandbox')
    if (done || gone || Date.now() - started > TIMEOUT_MS) {
      clearInterval(timer)
      resolve()
    }
  }, 3000)
})

const done = JSON.parse(read(join(RUN, 'done.json')) || 'null')
const written = Object.entries(notesSnapshot()).filter(([name, time]) => notesBefore[name] !== time).map(([name]) => `docs/notes/${name}`)
if (!done) {
  fail(`The sandbox ${tasklist().includes('"windowssandbox') ? 'is still running after 90 minutes' : 'closed before the run finished'}.
Logs: ${RUN} (logon.log, status.txt)`)
}
console.log(`\n${done.ok ? 'Done' : 'Failed'}: ${done.message}`)
if (written.length) console.log(`Written:\n  ${written.join('\n  ')}`)
console.log(`Logs: ${RUN}`)
if (!done.ok) {
  console.log('The sandbox stays open so you can look; close its window when done (everything in it is discarded).')
  process.exit(1)
}

function tasklist() {
  try {
    return execFileSync('tasklist', ['/fo', 'csv', '/nh'], { encoding: 'utf8' }).toLowerCase()
  } catch {
    return ''
  }
}

function read(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function notesSnapshot() {
  const out = {}
  for (const name of readdirSync(NOTES)) out[name] = statSync(join(NOTES, name)).mtimeMs
  return out
}
