/**
 * Serves ./out under the production basePath so the deployed URL shape is
 * verified before pushing (PRD §11). Node's http only — no new dependency.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const ROOT = new URL('../out/', import.meta.url).pathname
const BASE_PATH = '/isolation-anomaly'
const PORT = Number(process.env.PORT ?? 4321)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

async function resolveFile(rawPathname) {
  /*
   * The App Router emits chunks under a literal `[locale]` directory, which a
   * browser requests percent-encoded. Serving `url.pathname` verbatim looks for
   * a directory actually named `%5Blocale%5D`, so every client chunk 404s and
   * the interactive pages silently never hydrate — which is exactly what a
   * preview is supposed to catch rather than cause. A malformed escape is not
   * worth throwing over; fall back to the raw path and let the 404 happen.
   */
  let pathname = rawPathname
  try {
    pathname = decodeURIComponent(rawPathname)
  } catch {
    // Keep the undecoded path.
  }

  const candidates = [pathname, join(pathname, 'index.html'), `${pathname}.html`]
  for (const candidate of candidates) {
    const full = join(ROOT, normalize(candidate))
    if (!full.startsWith(ROOT)) continue
    try {
      const info = await stat(full)
      if (info.isFile()) return full
    } catch {
      // try the next candidate
    }
  }
  return null
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (url.pathname === '/') {
    res.writeHead(302, { location: `${BASE_PATH}/` })
    res.end()
    return
  }

  if (!url.pathname.startsWith(BASE_PATH)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end(`Not found. The site is served under ${BASE_PATH}/`)
    return
  }

  const file = await resolveFile(url.pathname.slice(BASE_PATH.length) || '/')
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('404')
    return
  }

  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(await readFile(file))
})

server.listen(PORT, () => {
  console.log(`preview: http://localhost:${PORT}${BASE_PATH}/`)
})
