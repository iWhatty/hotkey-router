// scripts/key-check-server.mjs
//
// Local server for playground/key-check.html (npm run key-check). Serves the
// repo read-only on 127.0.0.1 so the page can load the source modules, and
// takes the page's results (POST /results) as a note in docs/notes/:
//   docs/notes/key-check-<date>-<browser>.md
// scripts/key-check.ahk starts it when it isn't already running.
//
// No dependencies. Port: KEY_CHECK_PORT, default 8080.

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const NOTES = join(ROOT, 'docs', 'notes')
const PORT = Number(process.env.KEY_CHECK_PORT) || 8080
const HOST = '127.0.0.1'
const PAGE = '/playground/key-check.html'
const MAX_BODY = 512 * 1024

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

async function saveResults(req, res) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) return json(res, 413, { error: 'Results too large.' })
    chunks.push(chunk)
  }
  let data
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return json(res, 400, { error: 'Body is not JSON.' })
  }
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

const server = createServer((req, res) => {
  const handle = req.method === 'POST' && req.url === '/results' ? saveResults
    : req.method === 'GET' || req.method === 'HEAD' ? serveFile
      : async (_, r) => send(r, 405, 'Method not allowed')
  handle(req, res).catch((err) => {
    console.error(err)
    if (!res.headersSent) send(res, 500, 'Server error')
  })
})

server.listen(PORT, HOST, () => {
  console.log(`key check: http://${HOST}:${PORT}${PAGE}`)
  console.log('results go to docs/notes/; Ctrl+C to stop')
})
