// 本地 SQLite 驱动（Node 内置 node:sqlite，零原生依赖）。
// 只在「没有配置 Turso」时使用：本地开发 / 自托管常驻服务。
// 对外暴露与其他驱动一致的四个异步方法：exec / all / get / run。

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export async function createLocalDriver({ file }) {
  const { DatabaseSync } = await import('node:sqlite')
  mkdirSync(dirname(file), { recursive: true })

  const db = new DatabaseSync(file)

  return {
    kind: 'local',
    location: file,

    async exec(sql) {
      db.exec(sql)
    },

    async all(sql, args = []) {
      return db.prepare(sql).all(...args)
    },

    async get(sql, args = []) {
      return db.prepare(sql).get(...args) ?? null
    },

    async run(sql, args = []) {
      const r = db.prepare(sql).run(...args)
      return { changes: Number(r.changes || 0) }
    }
  }
}
