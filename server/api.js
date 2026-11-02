// 纯业务路由层：不依赖 http 对象，输入 { method, path, body, headers }，输出 { status, body, headers }。
// 这样同一套 API 既能给本地 Node 服务用（server/index.js），也能给 Vercel Function 用（api/index.js）。
//
// 鉴权：HttpOnly Cookie 里的会话令牌（rs_session）。除 /api/health 与 /api/auth/* 外，
// 所有接口都要求登录，并按当前用户隔离数据。

import * as store from './db.js'
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  COOKIE_NAME,
  SESSION_TTL_MS,
  parseCookies,
  serializeSessionCookie,
  clearSessionCookie,
  isSecureRequest,
  headerValue
} from './auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 6
const PASSWORD_MAX = 64

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

// 对外暴露的用户信息（绝不包含 password_hash）
function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    createdAt: Number(u.created_at ?? u.createdAt ?? 0) || 0
  }
}

// 从请求头解析当前会话用户
async function resolveUser(headers) {
  const cookies = parseCookies(headerValue(headers, 'cookie'))
  const token = cookies[COOKIE_NAME]
  if (!token) return { user: null, token: null }
  const session = await store.findSession(token)
  if (!session) return { user: null, token: null }
  const user = await store.getUserById(session.user_id)
  if (!user) return { user: null, token: null }
  return { user, token }
}

async function startSession(userId) {
  const token = newSessionToken()
  await store.insertSession({ token, userId, expiresAt: Date.now() + SESSION_TTL_MS })
  return token
}

function cookieHeaders(value) {
  return { 'set-cookie': value, 'cache-control': 'no-store' }
}

/**
 * @param {{ method?: string, path?: string, body?: any, headers?: any }} req
 * @returns {Promise<{ status: number, body: any, headers?: Record<string,string> }>}
 */
export async function handleApi({ method = 'GET', path = '/', body = null, headers = null } = {}) {
  try {
    if (path === '/api/health') {
      return { status: 200, body: { ok: true } }
    }

    const secure = isSecureRequest(headers)

    /* ---------------- 认证 ---------------- */

    if (path === '/api/auth/register' && method === 'POST') {
      const email = str(body && body.email).toLowerCase()
      const password = String((body && body.password) || '')

      if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
        return { status: 400, body: { error: 'invalid-email', message: '请输入有效的邮箱地址' } }
      }
      if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
        return {
          status: 400,
          body: { error: 'weak-password', message: `密码长度需为 ${PASSWORD_MIN}-${PASSWORD_MAX} 位` }
        }
      }
      if (await store.findUserByEmail(email)) {
        return { status: 409, body: { error: 'email-taken', message: '该邮箱已注册' } }
      }

      const passwordHash = await hashPassword(password)
      const user = await store.createUser({ email, emailKey: email, passwordHash })
      const token = await startSession(user.id)
      return {
        status: 201,
        body: { user: publicUser(user) },
        headers: cookieHeaders(serializeSessionCookie(token, { secure }))
      }
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const email = str(body && body.email).toLowerCase()
      const password = String((body && body.password) || '')
      if (!email || !password) {
        return { status: 400, body: { error: 'invalid-input', message: '请输入邮箱和密码' } }
      }
      const row = await store.findUserByEmail(email)
      const ok = row ? await verifyPassword(password, row.password_hash) : false
      if (!ok) {
        return { status: 401, body: { error: 'invalid-credentials', message: '邮箱或密码不正确' } }
      }
      const user = publicUser(row)
      const token = await startSession(user.id)
      return {
        status: 200,
        body: { user },
        headers: cookieHeaders(serializeSessionCookie(token, { secure }))
      }
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      const { token } = await resolveUser(headers)
      if (token) await store.deleteSession(token)
      return {
        status: 200,
        body: { ok: true },
        headers: cookieHeaders(clearSessionCookie({ secure }))
      }
    }

    // 未登录时返回 { user: null } 而不是 401，避免前端启动时产生无意义的错误噪音
    if (path === '/api/auth/me' && method === 'GET') {
      const { user } = await resolveUser(headers)
      return {
        status: 200,
        body: { user: publicUser(user) },
        headers: { 'cache-control': 'no-store' }
      }
    }

    /* ---------------- 以下全部需要登录 ---------------- */

    const { user } = await resolveUser(headers)
    if (!user) {
      return { status: 401, body: { error: 'unauthorized', message: '请先登录' } }
    }
    const uid = user.id

    // 列表
    if (path === '/api/resumes' && method === 'GET') {
      return { status: 200, body: await store.listResumes(uid) }
    }

    // 新建
    if (path === '/api/resumes' && method === 'POST') {
      const name = str(body && body.name)
      if (!name) {
        return { status: 400, body: { error: 'invalid-name', message: '简历名称不能为空' } }
      }
      if (await store.findByName(uid, name)) {
        return { status: 409, body: { error: 'duplicate', message: '简历名称已存在' } }
      }
      const rec = await store.createResume({
        userId: uid,
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
      const src = await store.getResume(srcId, uid)
      if (!src) return { status: 404, body: { error: 'not-found', message: '源简历不存在' } }
      const name = str(body && body.name) || `${src.name} 副本`
      if (await store.findByName(uid, name)) {
        return { status: 409, body: { error: 'duplicate', message: '简历名称已存在' } }
      }
      const rec = await store.copyResume(srcId, uid, name)
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
      if (await store.findByName(uid, name, id)) {
        return { status: 409, body: { error: 'duplicate', message: '简历名称已存在' } }
      }
      const rec = await store.updateResume(id, uid, { name })
      if (!rec) return { status: 404, body: { error: 'not found' } }
      return { status: 200, body: rec }
    }

    // 通用 :id 路由
    const m = path.match(/^\/api\/resumes\/([^/]+)$/)
    if (m) {
      const id = decodeId(m[1])
      if (method === 'GET') {
        const rec = await store.getResume(id, uid)
        if (!rec) return { status: 404, body: { error: 'not found' } }
        return { status: 200, body: rec }
      }
      if (method === 'PUT') {
        const rec = await store.updateResume(id, uid, body || {})
        if (!rec) return { status: 404, body: { error: 'not found' } }
        return { status: 200, body: rec }
      }
      if (method === 'DELETE') {
        await store.deleteResume(id, uid)
        return { status: 200, body: { ok: true } }
      }
    }

    return { status: 404, body: { error: 'unknown api path' } }
  } catch (e) {
    console.error('[api error]', e)
    return { status: 500, body: { error: String(e && e.message ? e.message : e) } }
  }
}
