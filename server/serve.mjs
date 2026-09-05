import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleZhihuApi } from './zhihu-bridge.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dist = path.join(root, 'dist')
const host = process.env.HOST || '127.0.0.1'
const port = Number.parseInt(process.env.PORT || '4174', 10)
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
])

const server = createServer(async (request, response) => {
  if (await handleZhihuApi(request, response)) return
  const url = new URL(request.url || '/', `http://${host}:${port}`)
  const requested = url.pathname === '/' ? '/index.html' : url.pathname
  const filePath = path.normalize(path.join(dist, requested))
  const fallback = path.join(dist, 'index.html')
  const target = filePath.startsWith(dist) && existsSync(filePath)
    ? filePath
    : existsSync(fallback) ? fallback : null
  if (!target) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ ok: false, error: 'NOT_FOUND' }))
    return
  }
  response.writeHead(200, { 'Content-Type': types.get(path.extname(target)) || 'application/octet-stream' })
  response.end(await readFile(target))
})

server.listen(port, host, () => {
  process.stdout.write(`life-backtest: http://${host}:${port}/\n`)
})
