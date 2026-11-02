// 认证工具：密码哈希（scrypt）、会话令牌、Cookie 读写。
// 只用 Node 内置 crypto，不引入额外依赖（本地与 Vercel Node 运行时都可用）。

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)

const KEY_LEN = 64
const SCHEME = 'scrypt'

// 密码哈希格式：scrypt$<salt hex>$<hash hex>
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(String(password), salt, KEY_LEN)
  return `${SCHEME}$${salt}$${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 3 || parts[0] !== SCHEME) return false
  const [, salt, hex] = parts
  if (!salt || !hex) return false
  const expected = Buffer.from(hex, 'hex')
  const actual = await scrypt(String(password), salt, expected.length || KEY_LEN)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function newSessionToken() {
  return randomBytes(32).toString('base64url')
}

export const COOKIE_NAME = 'rs_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 天

// 解析 Cookie 头为普通对象（同名取第一个）
export function parseCookies(header) {
  const out = {}
  const raw = String(header || '')
  if (!raw) return out
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (!k || k in out) continue
    out[k] = decodeURIComponent(v)
  }
  return out
}

// 生成 Set-Cookie 值。secure 仅在 https 下开启（本地 http 开发也能用）。
export function serializeSessionCookie(token, { secure = false, maxAgeMs = SESSION_TTL_MS } = {}) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`
  ]
  if (secure) attrs.push('Secure')
  return attrs.join('; ')
}

// 清除会话 Cookie
export function clearSessionCookie({ secure = false } = {}) {
  const attrs = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) attrs.push('Secure')
  return attrs.join('; ')
}

// 判断当前请求是否走 https（Vercel 通过 x-forwarded-proto 告知）
export function isSecureRequest(headers) {
  const proto = headerValue(headers, 'x-forwarded-proto')
  return String(proto || '').split(',')[0].trim() === 'https'
}

// 兼容普通对象（node:http req.headers）与 Headers 实例（Web 请求）
export function headerValue(headers, name) {
  if (!headers) return ''
  if (typeof headers.get === 'function') return headers.get(name) || ''
  const v = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(v) ? v.join(', ') : v || ''
}
