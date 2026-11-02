// 本地 SQLite 存储层（Node 内置 node:sqlite，零原生依赖）。
// 数据模型：一份简历 = 一行记录。
//   id          TEXT  主键，形如「姓名_YYYYMMDD_HHMMSS」（姓名 + 时间戳）
//   name        TEXT  显示名
//   created_at  INT   创建时间(ms)
//   updated_at  INT   更新时间(ms)
//   auto_named  INT   是否自动跟随个人信息里的“姓名”（1/0）
//   data        TEXT  JSON：{ meta, modules }

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = process.env.RESUME_DB || join(DATA_DIR, 'resume.db')

const db = new DatabaseSync(DB_PATH)
db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    auto_named  INTEGER NOT NULL DEFAULT 0,
    data        TEXT NOT NULL
  );
`)

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

export function listResumes() {
  return db
    .prepare(
      'SELECT id, name, created_at, updated_at, auto_named FROM resumes ORDER BY updated_at DESC'
    )
    .all()
}

export function getResume(id) {
  const row = db
    .prepare('SELECT id, name, created_at, updated_at, auto_named, data FROM resumes WHERE id = ?')
    .get(id)
  if (!row) return null
  let data = {}
  try {
    data = JSON.parse(row.data)
  } catch {
    data = {}
  }
  return { ...row, data }
}

export function createResume({ name, data, autoNamed = false }) {
  const now = Date.now()
  const baseName = name || '未命名'
  let attempt = 0
  // 主键冲突（同一姓名同一秒并发创建）时自动加后缀重试，保证写入成功。
  while (true) {
    const suffix = attempt === 0 ? '' : '_' + attempt
    const id = `${safeName(baseName)}_${timestamp(new Date(now))}${suffix}`
    try {
      db.prepare(
        'INSERT INTO resumes (id, name, created_at, updated_at, auto_named, data) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, baseName, now, now, autoNamed ? 1 : 0, JSON.stringify(data || {}))
      return getResume(id)
    } catch (e) {
      if (String(e && e.message ? e.message : '').includes('UNIQUE constraint failed')) {
        attempt += 1
        if (attempt > 20) throw e
        continue
      }
      throw e
    }
  }
}

export function updateResume(id, { data, name, autoNamed } = {}) {
  const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id)
  if (!row) return null
  const setData = data !== undefined ? JSON.stringify(data) : row.data
  const setName = name !== undefined ? name : row.name
  const setAuto = autoNamed !== undefined ? (autoNamed ? 1 : 0) : row.auto_named
  db.prepare(
    'UPDATE resumes SET data = ?, name = ?, auto_named = ?, updated_at = ? WHERE id = ?'
  ).run(setData, setName, setAuto, Date.now(), id)
  return getResume(id)
}

export function deleteResume(id) {
  db.prepare('DELETE FROM resumes WHERE id = ?').run(id)
  return true
}

export function countResumes() {
  const r = db.prepare('SELECT COUNT(*) AS c FROM resumes').get()
  return r.c
}

// 名称比较用的归一化：去首尾空白、压缩连续空白、忽略大小写。
function nameKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// 按名称查找是否已被占用（可用 excludeId 排除自身，供重命名时使用）。
export function findByName(name, excludeId = null) {
  const key = nameKey(name)
  if (!key) return null
  const rows = db.prepare('SELECT id, name FROM resumes').all()
  return rows.find((r) => r.id !== excludeId && nameKey(r.name) === key) || null
}

// 拷贝一份简历：内容与源完全一致，仅名称 / id / 时间戳为新值。
export function copyResume(id, name) {
  const src = getResume(id)
  if (!src) return null
  const nextName = String(name || '').trim() || `${src.name} 副本`
  return createResume({ name: nextName, data: src.data, autoNamed: false })
}
