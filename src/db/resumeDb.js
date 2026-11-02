// 数据库访问层（API 客户端）。
// 通过 HTTP 调用后端（server/api.js），后端按 Cookie 里的会话隔离数据。
//
// 对外接口与旧版保持一致，但全部为异步（返回 Promise）：
//   defaultMeta / blankResumeData / bootstrap / getList / getResumeData
//   / saveActive / create / rename / remove / copy
//   以及认证：me / register / login / logout
// 未来若要换数据库/后端，只要替换本文件内部实现即可，UI 层无需改动。

import { createModule } from '../state/moduleTypes.js'

const BASE = '/api'

// 会话失效时的广播事件：AuthContext 监听后把用户态清空，界面自动回到登录页。
export const UNAUTHORIZED_EVENT = 'rs:unauthorized'

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    const err = new Error(
      (payload && (payload.message || payload.error)) ||
        `API ${method} ${path} 失败: ${res.status} ${text}`
    )
    // 供 UI 区分「重名」「未登录」等业务错误：err.code
    err.status = res.status
    err.code = payload && payload.error
    // 会话过期 / 被登出：通知全局退回登录页（登录接口自身的 401 不算）
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

// 服务端字段是 snake_case，这里统一转成前端习惯的 camelCase。
function normalize(r) {
  if (!r) return r
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    autoNamed: !!r.auto_named,
    data: r.data
  }
}
function normalizeList(arr) {
  return (arr || []).map(normalize)
}

export function defaultMeta() {
  return {
    templateId: 'modern',
    themeColor: '#2f6df6',
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    baseFontSize: 13,
    lineHeight: 1.6,
    paperSize: 'A4',
    accentSoft: true
  }
}

// 一份空白简历：仅含一个空的“基本信息”模块。
export function blankResumeData() {
  return {
    meta: defaultMeta(),
    modules: [createModule('personal')]
  }
}

/* ---------------- 认证 ---------------- */

// 当前登录用户；未登录返回 null（后端约定此处不返回 401）
export async function me() {
  try {
    const r = await req('/auth/me')
    return (r && r.user) || null
  } catch {
    return null
  }
}

export async function register(email, password) {
  const r = await req('/auth/register', { method: 'POST', body: { email, password } })
  return r.user
}

export async function login(email, password) {
  const r = await req('/auth/login', { method: 'POST', body: { email, password } })
  return r.user
}

export async function logout() {
  await req('/auth/logout', { method: 'POST' })
}

/* ---------------- 简历 ---------------- */

// 初始化：只拉取列表，不做任何示例数据播种。
// 库为空时首页展示空状态，由用户自行「新建简历」。
// 返回 { resumes, activeId, data }，首页不需要预载某份内容，故 activeId / data 恒为 null。
export async function bootstrap() {
  const resumes = normalizeList(await req('/resumes'))
  return { resumes, activeId: null, data: null }
}

export async function getList() {
  return normalizeList(await req('/resumes'))
}

export async function getResumeData(id) {
  const r = await req('/resumes/' + encodeURIComponent(id))
  return r?.data || null
}

// 保存当前简历内容。displayName 仅在自动命名(autoNamed)且非空时用于同步显示名。
export async function saveActive(activeId, data, displayName) {
  const body = { data }
  if (displayName && displayName.trim()) body.name = displayName.trim()
  await req('/resumes/' + encodeURIComponent(activeId), { method: 'PUT', body })
  return normalizeList(await getList())
}

// 新建一份简历，返回 { rec, list, activeId }。
export async function create(name, data, autoNamed = false) {
  const r = await req('/resumes', {
    method: 'POST',
    body: { name, data, autoNamed }
  })
  const rec = normalize(r)
  const list = normalizeList(await getList())
  return { rec, list, activeId: rec.id }
}

export async function rename(id, name) {
  await req('/resumes/' + encodeURIComponent(id) + '/rename', {
    method: 'PUT',
    body: { name }
  })
  return normalizeList(await getList())
}

// 拷贝一份已有简历（内容与源一致，名称用传入值），返回 { rec, list, activeId }。
export async function copy(id, name) {
  const r = await req('/resumes/' + encodeURIComponent(id) + '/copy', {
    method: 'POST',
    body: { name }
  })
  const rec = normalize(r)
  const list = normalizeList(await getList())
  return { rec, list, activeId: rec.id }
}

// 删除一份简历，返回最新列表。
export async function remove(id) {
  await req('/resumes/' + encodeURIComponent(id), { method: 'DELETE' })
  return normalizeList(await getList())
}
