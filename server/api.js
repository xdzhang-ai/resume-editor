// 纯业务路由层：不依赖 http 对象，输入 { method, path, body }，输出 { status, body }。
// 这样同一套 API 既能给本地 Node 服务用（server/index.js），
// 也能给 Vercel Serverless Function 用（api/index.js），不必复制路由逻辑。

import * as store from './db.js'

function decodeId(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function str(v) {
  return String(v == null ? '' : v).trim()
}

/**
 * @param {{ method?: string, path?: string, body?: any }} req
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function handleApi({ method = 'GET', path = '/', body = null } = {}) {
  try {
    if (path === '/api/health') {
      return { status: 200, body: { ok: true } }
    }

    // 列表
    if (path === '/api/resumes' && method === 'GET') {
      return { status: 200, body: await store.listResumes() }
    }

    // 新建
    if (path === '/api/resumes' && method === 'POST') {
      const name = str(body && body.name)
      if (!name) {
        return { status: 400, body: { error: 'invalid-name', message: '简历名称不能为空' } }
      }
      if (await store.findByName(name)) {
        return { status: 409, body: { error: 'duplicate', message: '简历名称已存在' } }
      }
      const rec = await store.createResume({
        name,
        data: body.data,
        autoNamed: !!body.autoNamed
      })
      return { status: 201, body: rec }
    }

    // 拷贝一份已有简历（内容复制，名称可改）
    const cp = path.match(/^\/api\/resumes\/([^/]+)\/copy$/)
    if (cp && method === 'POST') {
      const srcId = decodeId(cp[1])
      const src = await store.getResume(srcId)
      if (!src) return { status: 404, body: { error: 'not-found', message: '源简历不存在' } }
      const name = str(body && body.name) || `${src.name} 副本`
      if (await store.findByName(name)) {
        return { status: 409, body: { error: 'duplicate', message: '简历名称已存在' } }
      }
      const rec = await store.copyResume(srcId, name)
      if (!rec) return { status: 404, body: { error: 'not-found', message: '源简历不存在' } }
      return { status: 201, body: rec }
    }

    // 重命名（独立路由，避免与下面的通用 :id 冲突）
    const rn = path.match(/^\/api\/resumes\/([^/]+)\/rename$/)
    if (rn && method === 'PUT') {
      const id = decodeId(rn[1])
      const name = str(body && body.name)
      if (!name) {
        return { status: 400, body: { error: 'invalid-name', message: '简历名称不能为空' } }
      }
      if (await store.findByName(name, id)) {
        return { status: 409, body: { error: 'duplicate', message: '简历名称已存在' } }
      }
      const rec = await store.updateResume(id, { name })
      if (!rec) return { status: 404, body: { error: 'not found' } }
      return { status: 200, body: rec }
    }

    // 通用 :id 路由
    const m = path.match(/^\/api\/resumes\/([^/]+)$/)
    if (m) {
      const id = decodeId(m[1])
      if (method === 'GET') {
        const rec = await store.getResume(id)
        if (!rec) return { status: 404, body: { error: 'not found' } }
        return { status: 200, body: rec }
      }
      if (method === 'PUT') {
        const rec = await store.updateResume(id, body || {})
        if (!rec) return { status: 404, body: { error: 'not found' } }
        return { status: 200, body: rec }
      }
      if (method === 'DELETE') {
        await store.deleteResume(id)
        return { status: 200, body: { ok: true } }
      }
    }

    return { status: 404, body: { error: 'unknown api path' } }
  } catch (e) {
    console.error('[api error]', e)
    return { status: 500, body: { error: String(e && e.message ? e.message : e) } }
  }
}
