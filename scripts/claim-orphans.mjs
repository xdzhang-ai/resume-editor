// 一次性脚本：把「加用户体系之前」留下的无主简历（user_id 为 NULL）认领给某个账号。
//
// 用法：
//   node scripts/claim-orphans.mjs                     # 只列出无主简历，不做修改
//   node scripts/claim-orphans.mjs <邮箱>               # 把这些简历归属到该邮箱对应的账号
//
// 注意：脚本与服务端共用 server/db.js，因此跟随同样的环境变量
// （不设 TURSO_DATABASE_URL 时操作本地 server/data/resume.db）。

import * as store from '../server/db.js'

const email = (process.argv[2] || '').trim().toLowerCase()

const driver = await store.getDriver()
const orphans = await driver.all(
  'SELECT id, name, created_at FROM resumes WHERE user_id IS NULL ORDER BY created_at'
)

if (!orphans.length) {
  console.log('没有无主简历（user_id 为 NULL 的记录为 0 条）。')
  process.exit(0)
}

console.log(`发现 ${orphans.length} 条无主简历：`)
for (const r of orphans) {
  console.log(`  - ${r.id}  |  ${r.name}  |  ${new Date(Number(r.created_at)).toLocaleString()}`)
}

if (!email) {
  console.log('\n未指定邮箱，仅预览。用法：node scripts/claim-orphans.mjs <邮箱>')
  process.exit(0)
}

const user = await store.findUserByEmail(email)
if (!user) {
  console.error(`\n找不到邮箱为 ${email} 的账号，请先在网页上注册该邮箱。`)
  process.exit(1)
}

for (const r of orphans) {
  await driver.run('UPDATE resumes SET user_id = ? WHERE id = ? AND user_id IS NULL', [
    user.id,
    r.id
  ])
}
console.log(`\n已把 ${orphans.length} 条简历归属到 ${email}（user_id=${user.id}）。`)
