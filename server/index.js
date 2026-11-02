// 轻量 Node 后端：提供简历 CRUD 的 HTTP API，并（可选）托管构建后的前端静态文件。
// 数据库使用 Node 内置 node:sqlite（见 ./db.js），无需任何原生依赖。
//
// 开发模式：vite 跑在 5173 并代理 /api -> 本服务(3001)。
// 生产模式：vite build 后，本服务可直接托管 dist 并同时提供 /api。

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './db.js'

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

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
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
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  if (path.startsWith('/api/')) {
    try {
      if (path === '/api/health') {
        return sendJson(res, 200, { ok: true })
      }

      // 列表
      if (path === '/api/resumes' && req.method === 'GET') {
        return sendJson(res, 200, store.listResumes())
      }

      // 新建
      if (path === '/api/resumes' && req.method === 'POST') {
        const body = await readBody(req)
        const name = String(body.name || '').trim()
        if (!name) {
          return sendJson(res, 400, { error: 'invalid-name', message: '简历名称不能为空' })
        }
        if (store.findByName(name)) {
          return sendJson(res, 409, { error: 'duplicate', message: '简历名称已存在' })
        }
        const rec = store.createResume({
          name,
          data: body.data,
          autoNamed: !!body.autoNamed
        })
        return sendJson(res, 201, rec)
      }

      // 拷贝一份已有简历（内容复制，名称可改）
      const cp = path.match(/^\/api\/resumes\/([^/]+)\/copy$/)
      if (cp && req.method === 'POST') {
        const body = await readBody(req)
        const srcId = decodeURIComponent(cp[1])
        const src = store.getResume(srcId)
        if (!src) return sendJson(res, 404, { error: 'not-found', message: '源简历不存在' })
        const name = String(body.name || '').trim() || `${src.name} 副本`
        if (store.findByName(name)) {
          return sendJson(res, 409, { error: 'duplicate', message: '简历名称已存在' })
        }
        const rec = store.copyResume(srcId, name)
        if (!rec) return sendJson(res, 404, { error: 'not-found', message: '源简历不存在' })
        return sendJson(res, 201, rec)
      }

      // 重命名（独立路由，避免与上面的通用 :id 冲突）
      const rn = path.match(/^\/api\/resumes\/([^/]+)\/rename$/)
      if (rn && req.method === 'PUT') {
        const body = await readBody(req)
        const id = decodeURIComponent(rn[1])
        const name = String(body.name || '').trim()
        if (!name) {
          return sendJson(res, 400, { error: 'invalid-name', message: '简历名称不能为空' })
        }
        if (store.findByName(name, id)) {
          return sendJson(res, 409, { error: 'duplicate', message: '简历名称已存在' })
        }
        const rec = store.updateResume(id, { name })
        if (!rec) return sendJson(res, 404, { error: 'not found' })
        return sendJson(res, 200, rec)
      }

      // 通用 :id 路由
      const m = path.match(/^\/api\/resumes\/([^/]+)$/)
      if (m) {
        const id = decodeURIComponent(m[1])
        if (req.method === 'GET') {
          const rec = store.getResume(id)
          if (!rec) return sendJson(res, 404, { error: 'not found' })
          return sendJson(res, 200, rec)
        }
        if (req.method === 'PUT') {
          const body = await readBody(req)
          const rec = store.updateResume(id, body)
          if (!rec) return sendJson(res, 404, { error: 'not found' })
          return sendJson(res, 200, rec)
        }
        if (req.method === 'DELETE') {
          store.deleteResume(id)
          return sendJson(res, 200, { ok: true })
        }
      }

      return sendJson(res, 404, { error: 'unknown api path' })
    } catch (e) {
      console.error('[api error]', e)
      return sendJson(res, 500, { error: String(e && e.message ? e.message : e) })
    }
  }

  // 非 API：托管静态文件（生产模式下有效）
  return serveStatic(res, url.pathname)
})

server.listen(PORT, () => {
  console.log(`[resume-server] SQLite + API 已启动: http://localhost:${PORT}`)
})
