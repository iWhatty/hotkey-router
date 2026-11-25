// scripts/key-check-server.mjs
//
// Local server for playground/key-check.html (npm run key-check) and the
// browser tests (npm run test:browser, via startServer). Serves the
// repo read-only on 127.0.0.1 so the page can load the source modules, and
// takes the page's results (POST /results) as a note in docs/notes/:
//   docs/notes/key-check-<date>-<browser>.md
// scripts/key-check.ahk starts it when it isn't already running.
//
// The reserved-key check (playground/key-check-reserved.html and
// scripts/key-check-reserved.ahk) posts events to POST /probe instead: the
// page and the script each send small JSON events, appended with a time to
// %TEMP%/hotkey-router-key-check/probe.jsonl. GET /probe/state tells the
// script whether the page has focus. scripts/key-check-reserved-report.mjs
// turns the log into a note.
//
// No dependencies. Port: KEY_CHECK_PORT, default 8080. KEY_CHECK_NOTES and
// KEY_CHECK_PROBE_LOG move the notes folder and the event log; the Windows
// Sandbox run (scripts/sandbox/) points both at folders mapped from the host.

import { createServer } from 'node:http'
import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const NOTES = process.env.KEY_CHECK_NOTES || join(ROOT, 'docs', 'notes')
const PORT = Number(process.env.KEY_CHECK_PORT) || 8080
const HOST = '127.0.0.1'
const PAGE = '/playground/key-check.html'
const MAX_BODY = 512 * 1024
export const PROBE_LOG = process.env.KEY_CHECK_PROBE_LOG || join(tmpdir(), 'hotkey-router-key-check', 'probe.jsonl')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}

const json = (res, status, value) => send(res, status, JSON.stringify(value), TYPES['.json'])

async function serveFile(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  // Lets scripts/key-check.ahk tell this server from any other on the port.
  if (path === '/key-check-server') return json(res, 200, { server: 'key-check' })
  if (path === '/probe/state') return json(res, 200, pageState)
  if (path === '/') {
    res.writeHead(302, { Location: PAGE })
    return res.end()
  }
  // Resolve inside the repo only; no dotfiles (.git, .env).
  const file = normalize(join(ROOT, path))
  if (!file.startsWith(ROOT) || file.slice(ROOT.length).split(sep).some((part) => part.startsWith('.'))) {
    return send(res, 404, 'Not found')
  }
  try {
    const body = await readFile(file)
    send(res, 200, body, TYPES[extname(file)] || 'application/octet-stream')
  } catch {
    send(res, 404, 'Not found')
  }
}

// The parsed body as { data }, or undefined once an error has been sent.
async function readJson(req, res) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) return void json(res, 413, { error: 'Results too large.' })
    chunks.push(chunk)
  }
  try {
    return { data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  } catch {
    json(res, 400, { error: 'Body is not JSON.' })
  }
}

// Last focus state the reserved-key page reported, for GET /probe/state.
let pageState = { focused: false, visible: 'unknown', type: 'none' }

async function saveProbe(req, res) {
  const body = await readJson(req, res)
  if (!body) return
  const event = { t: Date.now(), ...body.data }
  if (event.source === 'page') pageState = { focused: event.focused, visible: event.visible, type: event.type }
  await mkdir(join(PROBE_LOG, '..'), { recursive: true })
  await appendFile(PROBE_LOG, JSON.stringify(event) + '\n')
  json(res, 200, { ok: true })
}

async function saveResults(req, res) {
  const body = await readJson(req, res)
  if (!body) return
  const { data } = body
  const { date, browser, markdown } = data || {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^[a-z]{2,20}$/.test(browser || '') || typeof markdown !== 'string') {
    return json(res, 400, { error: 'Expected { date: YYYY-MM-DD, browser: lowercase name, markdown: string }.' })
  }
  await mkdir(NOTES, { recursive: true })
  const name = `key-check-${date}-${browser}.md`
  await writeFile(join(NOTES, name), markdown)
  console.log(`saved docs/notes/${name}`)
  json(res, 200, { file: `docs/notes/${name}` })
}

/**
 * Start the server. Port 0 picks a free one (the browser tests do that).
 *
 * @param {{ port?: number }} [opts]
 * @returns {Promise<{ server: import('node:http').Server, origin: string }>}
 */
export function startServer({ port = PORT } = {}) {
  const server = createServer((req, res) => {
    const handle = req.method === 'POST' && req.url === '/results' ? saveResults
      : req.method === 'POST' && req.url === '/probe' ? saveProbe
      : req.method === 'GET' || req.method === 'HEAD' ? serveFile
        : async (_, r) => send(r, 405, 'Method not allowed')
    handle(req, res).catch((err) => {
      console.error(err)
      if (!res.headersSent) send(res, 500, 'Server error')
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, HOST, () => resolve({ server, origin: `http://${HOST}:${server.address().port}` }))
  })
}

// Run as a script (npm run key-check), not when imported.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { origin } = await startServer()
  console.log(`key check: ${origin}${PAGE}`)
  console.log('results go to docs/notes/; Ctrl+C to stop')
}
