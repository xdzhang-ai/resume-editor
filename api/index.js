// Vercel Serverless Function 入口（Web Standard fetch）。
// 路由：vercel.json 把 /api/* 重写到本函数，并把原始子路径放进 __path 查询参数，
// 因为改写后函数看到的 pathname 已经变成 /api/index，原始路径会丢。
// 业务逻辑与本地服务共用 server/api.js，不重复实现。

import { handleApi } from '../server/api.js'

function resolveApiPath(url) {
  const injected = url.searchParams.get('__path')
  if (injected !== null) {
    const clean = injected.replace(/^\/+/, '')
    return clean ? `/api/${clean}` : '/api'
  }
  // 兜底：如果未来 Vercel 行为变化、函数仍能看到原始路径
  if (url.pathname.startsWith('/api') && url.pathname !== '/api/index') {
    return url.pathname
  }
  return '/api'
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const path = resolveApiPath(url)

    let body = null
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      try {
        body = await request.json()
      } catch {
        body = null
      }
    }

    const { status, body: out } = await handleApi({ method: request.method, path, body })

    return Response.json(out, {
      status,
      headers: { 'cache-control': 'no-store' }
    })
  }
}
