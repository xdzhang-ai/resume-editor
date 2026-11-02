// 统一存储层：同一套 SQL，两种驱动。
//   - 配置了 TURSO_DATABASE_URL  -> Turso（@libsql/client，云库，无持久磁盘环境可用）
//   - 未配置                      -> 本地 SQLite 文件（node:sqlite，本地开发 / 自托管）
//
// 数据模型：一份简历 = 一行记录。
//   id          TEXT  主键，形如「姓名_YYYYMMDD_HHMMSS」（姓名 + 时间戳）
//   name        TEXT  显示名
//   created_at  INT   创建时间(ms)
//   updated_at  INT   更新时间(ms)
//   auto_named  INT   是否自动跟随个人信息里的“姓名”（1/0）
//   data        TEXT  JSON：{ meta, modules }
//
// 注意：所有导出函数都是 async（云库只有异步接口），调用方必须 await。

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS resumes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    auto_named  INTEGER NOT NULL DEFAULT 0,
    data        TEXT NOT NULL
  );
`

let driverPromise = null

// 单例驱动：首次调用时按环境变量选择本地 / Turso，并建表。
export function getDriver() {
  if (!driverPromise) {
    driverPromise = (async () => {
      const url = process.env.TURSO_DATABASE_URL
      if (url) {
        const { createTursoDriver } = await import('./drivers/turso.js')
        return createTursoDriver({ url, authToken: process.env.TURSO_AUTH_TOKEN })
      }
      const { createLocalDriver } = await import('./drivers/local.js')
      const file = process.env.RESUME_DB || join(__dirname, 'data', 'resume.db')
      return createLocalDriver({ file })
    })()
      .then(async (driver) => {
        await driver.exec(SCHEMA)
        console.log(
          `[store] 驱动=${driver.kind} 位置=${driver.kind === 'turso' ? 'Turso 云库' : driver.location}`
        )
        return driver
      })
      .catch((e) => {
        driverPromise = null // 失败后允许下次重试
        throw e
      })
  }
  return driverPromise
}

// 返回给前端的行：auto_named 统一成 0/1 数字
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

export async function listResumes() {
  const driver = await getDriver()
  const rows = await driver.all(
    'SELECT id, name, created_at, updated_at, auto_named FROM resumes ORDER BY updated_at DESC'
  )
  return rows.map(normalizeRow)
}

export async function getResume(id) {
  const driver = await getDriver()
  const row = await driver.get(
    'SELECT id, name, created_at, updated_at, auto_named, data FROM resumes WHERE id = ?',
    [id]
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

export async function createResume({ name, data, autoNamed = false }) {
  const driver = await getDriver()
  const now = Date.now()
  const baseName = name || '未命名'
  let attempt = 0

  // 主键冲突（同一姓名同一秒并发创建）时自动加后缀重试，保证写入成功。
  while (true) {
    const suffix = attempt === 0 ? '' : '_' + attempt
    const id = `${safeName(baseName)}_${timestamp(new Date(now))}${suffix}`
    try {
      await driver.run(
        'INSERT INTO resumes (id, name, created_at, updated_at, auto_named, data) VALUES (?, ?, ?, ?, ?, ?)',
        [id, baseName, now, now, autoNamed ? 1 : 0, JSON.stringify(data || {})]
      )
      return getResume(id)
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

export async function updateResume(id, { data, name, autoNamed } = {}) {
  const driver = await getDriver()
  const row = await driver.get('SELECT * FROM resumes WHERE id = ?', [id])
  if (!row) return null
  const setData = data !== undefined ? JSON.stringify(data) : row.data
  const setName = name !== undefined ? name : row.name
  const setAuto = autoNamed !== undefined ? (autoNamed ? 1 : 0) : row.auto_named
  await driver.run(
    'UPDATE resumes SET data = ?, name = ?, auto_named = ?, updated_at = ? WHERE id = ?',
    [setData, setName, setAuto, Date.now(), id]
  )
  return getResume(id)
}

export async function deleteResume(id) {
  const driver = await getDriver()
  await driver.run('DELETE FROM resumes WHERE id = ?', [id])
  return true
}

export async function countResumes() {
  const driver = await getDriver()
  const r = await driver.get('SELECT COUNT(*) AS c FROM resumes')
  return Number(r.c) || 0
}

// 名称比较用的归一化：去首尾空白、压缩连续空白、忽略大小写。
function nameKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// 按名称查找是否已被占用（可用 excludeId 排除自身，供重命名时使用）。
export async function findByName(name, excludeId = null) {
  const key = nameKey(name)
  if (!key) return null
  const driver = await getDriver()
  const rows = await driver.all('SELECT id, name FROM resumes')
  return rows.find((r) => r.id !== excludeId && nameKey(r.name) === key) || null
}

// 拷贝一份简历：内容与源完全一致，仅名称 / id / 时间戳为新值。
export async function copyResume(id, name) {
  const src = await getResume(id)
  if (!src) return null
  const nextName = String(name || '').trim() || `${src.name} 副本`
  return createResume({ name: nextName, data: src.data, autoNamed: false })
}
