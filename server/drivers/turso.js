// Turso 驱动（@libsql/client，云托管 SQLite 兼容库）。
// 部署到 Vercel 等无持久磁盘的环境时使用：通过环境变量
//   TURSO_DATABASE_URL=libsql://xxxx.turso.io
//   TURSO_AUTH_TOKEN=xxxxx
// 连接远端库；接口与本地驱动完全一致（exec / all / get / run）。

function toPlain(row) {
  if (!row) return row
  if (typeof row.toJSON === 'function') return row.toJSON()
  const out = {}
  for (const k of Object.keys(row)) out[k] = row[k]
  return out
}

export async function createTursoDriver({ url, authToken }) {
  const { createClient } = await import('@libsql/client')

  const client = createClient({
    url,
    authToken: authToken || undefined
  })

  return {
    kind: 'turso',
    location: url,

    async exec(sql) {
      // libsql 的 execute 支持无参数 DDL
      await client.execute(sql)
    },

    async all(sql, args = []) {
      const rs = await client.execute({ sql, args })
      return rs.rows.map(toPlain)
    },

    async get(sql, args = []) {
      const rs = await client.execute({ sql, args })
      return rs.rows.length ? toPlain(rs.rows[0]) : null
    },

    async run(sql, args = []) {
      const rs = await client.execute({ sql, args })
      return { changes: Number(rs.rowsAffected || 0) }
    }
  }
}
