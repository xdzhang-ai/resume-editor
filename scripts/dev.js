// 开发启动器：同时拉起 Node 后端(3001) 与 Vite 前端(5173)。
// 不引入任何额外依赖，纯 Node child_process。
//   node server/index.js   -> API
//   vite --host            -> 前端，并把 /api 代理到 3001

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const procs = [
  { name: 'server', cmd: 'node', args: ['server/index.js'], color: '\x1b[36m' },
  { name: 'vite', cmd: 'node', args: [viteBin, '--host'], color: '\x1b[35m' }
]

const children = procs.map((p) => {
  const c = spawn(p.cmd, p.args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
  const tag = `${p.color}[${p.name}]\x1b[0m`
  c.stdout.on('data', (d) => process.stdout.write(tag + ' ' + d))
  c.stderr.on('data', (d) => process.stderr.write(tag + ' ' + d))
  c.on('exit', (code) => {
    console.log(`${tag} 进程退出，码=${code}`)
    shutdown()
  })
  return c
})

function shutdown() {
  for (const c of children) {
    try {
      c.kill()
    } catch {
      /* noop */
    }
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
