// 统一存储层：同一套 SQL，两种驱动。
//   - 配置了 TURSO_DATABASE_URL  -> Turso（@libsql/client，云库，无持久磁盘环境可用）
//   - 未配置                      -> 本地 SQLite 文件（node:sqlite，本地开发 / 自托管）
//
// 数据模型：
//   users    一份账号。email_key 为归一化（小写去空白）邮箱，唯一。
//   sessions 登录会话。token 随机串，存 HttpOnly Cookie；过期即失效。
//   resumes  一份简历 = 一行记录，通过 user_id 归属到某个用户（所有查询都按 user_id 过滤）。
//
// 注意：所有导出函数都是 async（云库只有异步接口），调用方必须 await。

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 建表语句（多条，驱动逐条执行）。user_id 允许 NULL：容纳「加用户体系之前」的历史数据。
const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    email_key     TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resumes (
    id          TEXT PRIMARY KEY,
    user_id     TEXT,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    auto_named  INTEGER NOT NULL DEFAULT 0,
    data        TEXT NOT NULL
  )`
]

// 索引必须等旧库补完 user_id 列之后再建，否则会报 no such column。
const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id, updated_at)`
]

let driverPromise = null

// 单例驱动：首次调用时按环境变量选择本地 / Turso，建表并做列迁移。
export function getDriver() {
  if (!driverPromise) {
    driverPromise = (async () => {
      const url = process.env.TURSO_DATABASE_URL
      let driver
      if (url) {
        const { createTursoDriver } = await import('./drivers/turso.js')
        driver = await createTursoDriver({ url, authToken: process.env.TURSO_AUTH_TOKEN })
      } else {
        const { createLocalDriver } = await import('./drivers/local.js')
        const file = process.env.RESUME_DB || join(__dirname, 'data', 'resume.db')
        driver = await createLocalDriver({ file })
      }
      for (const sql of TABLES) await driver.exec(sql)
      await migrateResumeOwner(driver)
      for (const sql of INDEXES) await driver.exec(sql)
      console.log(
        `[store] 驱动=${driver.kind} 位置=${driver.kind === 'turso' ? 'Turso 云库' : driver.location}`
      )
      return driver
    })().catch((e) => {
      driverPromise = null // 失败后允许下次重试
      throw e
    })
  }
  return driverPromise
}

// 为「加用户体系之前」建的旧库补上 user_id 列；已存在则忽略。
// 历史行 user_id 为 NULL，不会出现在任何用户的列表里（可用 scripts/claim-orphans.mjs 认领）。
async function migrateResumeOwner(driver) {
  try {
    await driver.exec('ALTER TABLE resumes ADD COLUMN user_id TEXT')
    console.log('[store] 已为 resumes 表补充 user_id 列')
  } catch (e) {
    const msg = String(e && e.message ? e.message : e)
    if (!/duplicate column|already exists/i.test(msg)) throw e
  }
}

/* ---------------- 用户 ---------------- */

function normalizeUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    createdAt: Number(row.created_at) || 0
  }
}

export async function findUserByEmail(emailKey) {
  const driver = await getDriver()
  return driver.get('SELECT * FROM users WHERE email_key = ?', [emailKey])
}

export async function getUserById(id) {
  const driver = await getDriver()
  return driver.get('SELECT * FROM users WHERE id = ?', [id])
}

export async function createUser({ email, emailKey, passwordHash }) {
  const driver = await getDriver()
  const id = randomUUID()
  const now = Date.now()
  await driver.run(
    'INSERT INTO users (id, email, email_key, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, email, emailKey, passwordHash, now]
  )
  return normalizeUser({ id, email, created_at: now })
}

export async function countUsers() {
  const driver = await getDriver()
  const r = await driver.get('SELECT COUNT(*) AS c FROM users')
  return Number(r.c) || 0
}

/* ---------------- 会话 ---------------- */

export async function insertSession({ token, userId, expiresAt }) {
  const driver = await getDriver()
  await driver.run(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [token, userId, Date.now(), expiresAt]
  )
}

// 返回 { token, user_id, expires_at } 或 null（过期/不存在都算无效）
export async function findSession(token) {
  if (!token) return null
  const driver = await getDriver()
  const row = await driver.get('SELECT * FROM sessions WHERE token = ?', [token])
  if (!row) return null
  if (Number(row.expires_at) <= Date.now()) {
    await driver.run('DELETE FROM sessions WHERE token = ?', [token])
    return null
  }
  return row
}

export async function deleteSession(token) {
  if (!token) return
  const driver = await getDriver()
  await driver.run('DELETE FROM sessions WHERE token = ?', [token])
}

export async function purgeExpiredSessions() {
  const driver = await getDriver()
  await driver.run('DELETE FROM sessions WHERE expires_at <= ?', [Date.now()])
}

/* ---------------- 简历（全部按 user_id 隔离） ---------------- */

function normalizeRow(row) {
  if (!row) return row
  return { ...row, auto_named: Number(row.auto_named) || 0 }
}

function safeName(name) {
  const s = (name || '').trim().replace(/\s+/g, '_')
  const cleaned = s.replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]/g, '')
  return cleaned || '未命名'
}

function timestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

function isUniqueViolation(e) {
  return /unique constraint/i.test(String(e && e.message ? e.message : e))
}

export async function listResumes(userId) {
  const driver = await getDriver()
  const rows = await driver.all(
    'SELECT id, name, created_at, updated_at, auto_named FROM resumes WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  )
  return rows.map(normalizeRow)
}

export async function getResume(id, userId) {
  const driver = await getDriver()
  const row = await driver.get(
    'SELECT id, user_id, name, created_at, updated_at, auto_named, data FROM resumes WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  if (!row) return null
  let data = {}
  try {
    data = JSON.parse(row.data)
  } catch {
    data = {}
  }
  return { ...normalizeRow(row), data }
}

export async function createResume({ userId, name, data, autoNamed = false }) {
  const driver = await getDriver()
  const now = Date.now()
  const baseName = name || '未命名'
  let attempt = 0

  // 主键冲突（同一姓名同一秒并发创建，或不同用户撞名）时自动加后缀重试。
  while (true) {
    const suffix = attempt === 0 ? '' : '_' + attempt
    const id = `${safeName(baseName)}_${timestamp(new Date(now))}${suffix}`
    try {
      await driver.run(
        'INSERT INTO resumes (id, user_id, name, created_at, updated_at, auto_named, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userId, baseName, now, now, autoNamed ? 1 : 0, JSON.stringify(data || {})]
      )
      return getResume(id, userId)
    } catch (e) {
      if (isUniqueViolation(e)) {
        attempt += 1
        if (attempt > 20) throw e
        continue
      }
      throw e
    }
  }
}

export async function updateResume(id, userId, { data, name, autoNamed } = {}) {
  const driver = await getDriver()
  const row = await driver.get('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [id, userId])
  if (!row) return null
  const setData = data !== undefined ? JSON.stringify(data) : row.data
  const setName = name !== undefined ? name : row.name
  const setAuto = autoNamed !== undefined ? (autoNamed ? 1 : 0) : row.auto_named
  await driver.run(
    'UPDATE resumes SET data = ?, name = ?, auto_named = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [setData, setName, setAuto, Date.now(), id, userId]
  )
  return getResume(id, userId)
}

export async function deleteResume(id, userId) {
  const driver = await getDriver()
  await driver.run('DELETE FROM resumes WHERE id = ? AND user_id = ?', [id, userId])
  return true
}

export async function countResumes(userId) {
  const driver = await getDriver()
  const r = await driver.get('SELECT COUNT(*) AS c FROM resumes WHERE user_id = ?', [userId])
  return Number(r.c) || 0
}

// 名称比较用的归一化：去首尾空白、压缩连续空白、忽略大小写。
function nameKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// 同一用户内按名称查找是否已被占用（excludeId 用于重命名时排除自身）。
// 重名只在单个用户内部约束，不同用户可以同名。
export async function findByName(userId, name, excludeId = null) {
  const key = nameKey(name)
  if (!key) return null
  const driver = await getDriver()
  const rows = await driver.all('SELECT id, name FROM resumes WHERE user_id = ?', [userId])
  return rows.find((r) => r.id !== excludeId && nameKey(r.name) === key) || null
}

// 拷贝一份简历：内容与源完全一致，仅名称 / id / 时间戳为新值。
export async function copyResume(id, userId, name) {
  const src = await getResume(id, userId)
  if (!src) return null
  const nextName = String(name || '').trim() || `${src.name} 副本`
  return createResume({ userId, name: nextName, data: src.data, autoNamed: false })
}
