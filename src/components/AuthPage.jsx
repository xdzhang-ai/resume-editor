import React, { useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import '../styles/auth.css'

// 登录 / 注册页：未登录时占据整个工作区。
export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const switchMode = (next) => {
    if (next === mode) return
    setMode(next)
    setErr(null)
    setConfirm('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setErr(null)

    const em = email.trim()
    if (!em) return setErr('请输入邮箱')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr('邮箱格式不正确')
    if (password.length < 6) return setErr('密码至少 6 位')
    if (mode === 'register' && password !== confirm) return setErr('两次输入的密码不一致')

    setBusy(true)
    try {
      if (mode === 'login') await login(em, password)
      else await register(em, password)
    } catch (e2) {
      setErr((e2 && e2.message) || '操作失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="auth-logo">📄</span>
          <div>
            <h1 className="auth-title">简历编辑器</h1>
            <p className="auth-sub">Resume Studio</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            注册
          </button>
        </div>

        <label className="auth-field">
          <span>邮箱</span>
          <input
            className="auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </label>

        <label className="auth-field">
          <span>密码</span>
          <input
            className="auth-input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
          />
        </label>

        {mode === 'register' && (
          <label className="auth-field">
            <span>确认密码</span>
            <input
              className="auth-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再输入一次"
            />
          </label>
        )}

        {err && <div className="auth-err">{err}</div>}

        <button className="btn primary auth-submit" type="submit" disabled={busy}>
          {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>

        <p className="auth-tip">简历按账号隔离，其他账号看不到你的内容。</p>
      </form>
    </div>
  )
}
