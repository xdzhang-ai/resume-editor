import React, { useState, useCallback, useEffect, useRef } from 'react'
import EditorPanel from './components/EditorPanel.jsx'
import PreviewPanel from './components/PreviewPanel.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import ResumeBar from './components/ResumeBar.jsx'
import HomePage from './components/HomePage.jsx'
import NameDialog from './components/NameDialog.jsx'
import AuthPage from './components/AuthPage.jsx'
import { useResume } from './state/ResumeContext.jsx'
import { useAuth } from './state/AuthContext.jsx'

// 生成一个不与现有简历重名的默认名称（如「未命名」已被占用 → 「未命名 2」）。
function suggestName(base, names) {
  const used = new Set(
    (names || []).map((n) => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase())
  )
  let candidate = base
  let i = 2
  while (used.has(candidate.trim().toLowerCase())) {
    candidate = `${base} ${i++}`
  }
  return candidate
}

export default function App() {
  const {
    switchResume,
    newResume,
    copyResume,
    anyDirty,
    persist,
    discardCurrent,
    resumes,
    activeId
  } = useResume()
  const { user, loading: authLoading, logout } = useAuth()
  const [view, setView] = useState('home') // 'home' | 'editor'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaveModal, setLeaveModal] = useState(false) // 未保存离开确认
  const [nameDialog, setNameDialog] = useState(null) // 新建/拷贝简历的名称弹窗
  const pendingActionRef = useRef(null) // 确认框关闭后要执行的离开动作

  // 统一的「离开当前简历」守卫：有未保存改动先弹确认框，否则直接执行动作。
  // 动作可以是回首页 / 切换简历 / 新建简历，三者复用同一套确认框。
  const requestLeave = useCallback(
    (action) => {
      if (anyDirty) {
        pendingActionRef.current = action
        setLeaveModal(true)
      } else {
        action()
      }
    },
    [anyDirty]
  )

  // 进入 / 切换简历：先过确认框，确认后再切换并进入编辑器。
  const openResume = useCallback(
    (id) => {
      requestLeave(async () => {
        await switchResume(id)
        setView('editor')
      })
    },
    [requestLeave, switchResume]
  )

  // 新建简历：先过确认框，再弹出「填写名称」弹窗（提交后才真正创建）。
  const openCreateDialog = useCallback(() => {
    requestLeave(() => {
      setNameDialog({
        mode: 'create',
        defaultName: suggestName('未命名', resumes.map((r) => r.name))
      })
    })
  }, [requestLeave, resumes])

  // 拷贝简历：同样先过确认框，再弹出名称弹窗（默认名 = 原名 + 副本）。
  const openCopyDialog = useCallback(
    (id, name) => {
      requestLeave(() => {
        setNameDialog({
          mode: 'copy',
          sourceId: id,
          sourceName: name,
          defaultName: suggestName(`${name} 副本`, resumes.map((r) => r.name))
        })
      })
    },
    [requestLeave, resumes]
  )

  // 名称弹窗提交：创建 / 拷贝成功后关闭弹窗并进入编辑器；失败则抛给弹窗展示错误。
  const submitNameDialog = useCallback(
    async (name) => {
      const dlg = nameDialog
      if (!dlg) return
      if (dlg.mode === 'create') await newResume(name)
      else await copyResume(dlg.sourceId, name)
      setNameDialog(null)
      setView('editor')
    },
    [nameDialog, newResume, copyResume]
  )

  // 返回首页：有未保存改动先弹确认框，否则直接离开（无未保存时零请求、立即回首页）。
  const goHome = useCallback(() => {
    requestLeave(() => setView('home'))
  }, [requestLeave])

  // 确认框：保存并离开（先落盘，再执行挂起的离开动作）
  const leaveSave = useCallback(async () => {
    setLeaveModal(false)
    await persist()
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) await action()
  }, [persist])

  // 确认框：放弃未保存的修改——先丢弃当前编辑（从后端重载并清空脏标记），再执行挂起的离开动作
  // （切换/新建会加载新数据，重载当前这一步冗余但无害；回首页则彻底丢弃编辑）
  const leaveDiscard = useCallback(async () => {
    setLeaveModal(false)
    await discardCurrent()
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) await action()
  }, [discardCurrent])

  // 刷新 / 关闭页面时，若有未保存改动，触发浏览器原生离开确认。
  useEffect(() => {
    const handler = (e) => {
      if (anyDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [anyDirty])

  // 导出 PDF：打印样式会把简历页面单独隔离，导出干净的 PDF。
  // 浏览器「另存为 PDF」的默认文件名取自 document.title，故打印前临时改成简历名称。
  const exportPdf = useCallback(() => {
    const current = resumes.find((r) => r.id === activeId)
    const filename =
      String(current?.name || '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ') // 去掉文件名非法字符
        .replace(/\s+/g, ' ')
        .trim() || '简历'

    const prevTitle = document.title
    document.title = filename

    let restored = false
    const restoreTitle = () => {
      if (restored) return
      restored = true
      document.title = prevTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle)

    try {
      window.print() // Chrome / Safari 此处阻塞到打印对话框关闭
    } finally {
      // 兜底：个别浏览器不触发 afterprint
      setTimeout(restoreTitle, 0)
    }
  }, [resumes, activeId])

  // 退出登录：有未保存改动先确认（登出后本地编辑会丢弃）。
  const handleLogout = useCallback(async () => {
    if (
      anyDirty &&
      !window.confirm('当前简历有未保存的修改，退出登录后这些改动会丢失。确定退出？')
    ) {
      return
    }
    await logout()
    setView('home')
  }, [anyDirty, logout])

  // 鉴权门：会话加载中显示占位，未登录先呈现登录/注册页
  if (authLoading) {
    return (
      <div className="auth-splash">
        <span>加载中…</span>
      </div>
    )
  }
  if (!user) {
    return (
      <div className="app">
        <AuthPage />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div
          className="brand"
          style={{ cursor: view === 'editor' ? 'pointer' : 'default' }}
          onClick={view === 'editor' ? goHome : undefined}
          title={view === 'editor' ? '返回首页' : undefined}
        >
          <span className="brand-logo">📄</span>
          <span className="brand-name">简历编辑器</span>
          <span className="brand-sub">Resume Studio</span>
        </div>
        <div className="topbar-actions">
          {view === 'home' ? (
            <button className="btn primary" onClick={openCreateDialog}>
              ＋ 新建简历
            </button>
          ) : (
            <>
              <ResumeBar
                onSwitch={openResume}
                onCreate={openCreateDialog}
                onCopy={openCopyDialog}
              />
              <button className="btn ghost" onClick={() => setSettingsOpen(true)}>
                ⚙ 排版设置
              </button>
              <button className="btn primary" onClick={exportPdf}>
                ⬇ 导出 PDF
              </button>
              <button className="btn ghost" onClick={goHome}>
                ← 首页
              </button>
            </>
          )}
          <div className="user-chip">
            <span className="user-email" title={user.email}>
              {user.email}
            </span>
            <button className="btn ghost" onClick={handleLogout}>
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="workspace">
        {view === 'home' ? (
          <HomePage onOpen={openResume} onCreate={openCreateDialog} onCopy={openCopyDialog} />
        ) : (
          <>
            <EditorPanel />
            <PreviewPanel />
          </>
        )}
      </main>

      {nameDialog && (
        <NameDialog
          mode={nameDialog.mode}
          sourceName={nameDialog.sourceName}
          defaultName={nameDialog.defaultName}
          existingNames={resumes.map((r) => r.name)}
          onCancel={() => setNameDialog(null)}
          onSubmit={submitNameDialog}
        />
      )}

      {view === 'editor' && (
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}

      {leaveModal && (
        <div className="modal-overlay" onClick={() => setLeaveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>未保存的修改</h3>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0 }}>当前简历有未保存的修改，离开前是否保存？</p>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={leaveDiscard}>
                放弃修改
              </button>
              <button className="btn ghost" onClick={() => setLeaveModal(false)}>
                取消
              </button>
              <button className="btn primary" onClick={leaveSave}>
                保存并离开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
