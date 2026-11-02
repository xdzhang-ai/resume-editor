import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import * as db from '../db/resumeDb.js'

// 登录态：启动时向后端询问当前会话，之后由登录/登出/会话失效事件驱动。
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // { id, email, createdAt } | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const u = await db.me()
      if (!cancelled) {
        setUser(u)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 会话过期 / 被后端判定未登录时，自动退回登录页
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener(db.UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(db.UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(async (email, password) => {
    const u = await db.login(email, password)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (email, password) => {
    const u = await db.register(email, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try {
      await db.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
