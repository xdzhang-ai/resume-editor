// 本地 / 自托管入口：常驻 Node HTTP 服务，提供 /api 接口并托管构建后的前端静态文件。
//   - 开发：vite 跑在 5173，代理 /api -> 本服务(3001)
//   - 自托管/生产：先 npm run build，本服务同时提供 dist 与 /api
//   - 部署到 Vercel 时不走这个文件，入口是 api/index.js
//
// 数据存储由 ./db.js 按环境变量决定：配置了 TURSO_DATABASE_URL 用 Turso，否则用本地 SQLite。

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi } from './api.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const DIST = join(__dirname, '..', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
}

function sendJson(res, code, obj, extraHeaders = null) {
  const body = JSON.stringify(obj)
  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...(extraHeaders || {}) }
  res.writeHead(code, headers)
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = ''
    req.on('data', (c) => {
      buf += c
      if (buf.length > 10 * 1024 * 1024) req.destroy()
    })
    req.on('end', () => {
      if (!buf) return resolve({})
      try {
        resolve(JSON.parse(buf))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

async function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath)
  if (rel === '/' || rel === '') rel = '/index.html'
  const filePath = normalize(join(DIST, rel))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  try {
    const s = await stat(filePath)
    if (s.isDirectory()) throw new Error('dir')
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    // SPA 兜底：没有对应静态文件时回退到 index.html
    try {
      const html = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname.startsWith('/api/')) {
    const body = await readBody(req)
    const { status, body: out, headers } = await handleApi({
      method: req.method,
      path: url.pathname,
      body,
      headers: req.headers
    })
    return sendJson(res, status, out, headers)
  }

  // 非 API：托管静态文件（生产模式下有效）
  return serveStatic(res, url.pathname)
})

server.listen(PORT, () => {
  console.log(`[resume-server] API 已启动: http://localhost:${PORT}`)
})
