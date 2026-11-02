import React, { useState, useRef, useEffect } from 'react'
import { useResume } from '../state/ResumeContext.jsx'

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function ResumeBar({ onSwitch, onCreate, onCopy }) {
  const { resumes, activeId, renameResume, deleteResume } = useResume()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const startRename = (r) => {
    setEditingId(r.id)
    setEditName(r.name)
  }
  const commitRename = async () => {
    const id = editingId
    const name = editName.trim()
    setEditingId(null)
    if (!id || !name) return
    try {
      await renameResume(id, name)
    } catch (e) {
      window.alert(
        e && e.code === 'duplicate'
          ? '该名称已存在，请换一个。'
          : '重命名失败：' + (e && e.message ? e.message : '未知错误')
      )
    }
  }
  const onDelete = (r) => {
    const tip =
      r.id === activeId
        ? `确定删除「${r.name}」？删除后会自动切换到其他简历。`
        : `确定删除「${r.name}」？此操作不可恢复。`
    if (window.confirm(tip)) deleteResume(r.id)
  }

  return (
    <div className="resume-bar">
      <span className="resume-bar-label">简历</span>
      <select
        className="resume-select"
        value={activeId || ''}
        onChange={(e) => onSwitch(e.target.value)}
      >
        {resumes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      <button className="btn ghost sm" onClick={onCreate} title="新建一份空白简历">
        ＋ 新建
      </button>

      <div className="resume-manage-wrap" ref={wrapRef}>
        <button
          className={`btn ghost sm ${open ? 'active' : ''}`}
          onClick={() => setOpen((v) => !v)}
        >
          管理 ▾
        </button>
        {open && (
          <div className="resume-menu">
            <div className="resume-menu-head">
              <span>我的简历（{resumes.length}）</span>
              <button className="mini-add" onClick={() => { onCreate(); setOpen(false) }}>
                ＋ 新建
              </button>
            </div>
            <div className="resume-menu-list">
              {resumes.map((r) => (
                <div
                  key={r.id}
                  className={`resume-row ${r.id === activeId ? 'active' : ''}`}
                  onClick={() => {
                    onSwitch(r.id)
                    setOpen(false)
                  }}
                >
                  <div className="resume-row-main">
                    {editingId === r.id ? (
                      <input
                        className="resume-rename-inp"
                        value={editName}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="resume-row-name">{r.name}</span>
                    )}
                    <span className="resume-row-time">{formatTime(r.updatedAt)}</span>
                  </div>
                  <div className="resume-row-ops" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="mini"
                      title="拷贝这份简历"
                      onClick={() => {
                        onCopy(r.id, r.name)
                        setOpen(false)
                      }}
                    >
                      ⧉
                    </button>
                    <button
                      className="mini"
                      title="重命名"
                      onClick={() => startRename(r)}
                    >
                      ✎
                    </button>
                    <button
                      className="mini danger"
                      title="删除"
                      onClick={() => onDelete(r)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="resume-menu-foot">改动后请点「保存」再离开</div>
          </div>
        )}
      </div>
    </div>
  )
}
