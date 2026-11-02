import React, { useState } from 'react'
import { useResume } from '../state/ResumeContext.jsx'
import '../styles/home.css'

function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`
}

export default function HomePage({ onOpen, onCreate, onCopy }) {
  const { resumes, renameResume, deleteResume, loading, error } = useResume()
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

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
  const onDelete = async (r) => {
    if (window.confirm(`确定删除「${r.name}」？此操作不可恢复。`)) {
      await deleteResume(r.id)
    }
  }

  if (loading) {
    return (
      <div className="home">
        <div className="home-loading">加载中…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home">
        <div className="home-error">
          <p>无法连接数据服务。</p>
          <p className="home-error-detail">{error}</p>
          <p className="home-error-detail">
            请确认后端服务已启动（本地开发可运行 <code>npm run dev</code>）。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-head">
          <div>
            <h1 className="home-title">我的简历</h1>
            <p className="home-sub">共 {resumes.length} 份</p>
          </div>
        </div>

        {resumes.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">📭</div>
            <p>还没有简历，点击右上角“新建简历”开始吧。</p>
            <button className="btn primary" onClick={onCreate}>
              ＋ 新建简历
            </button>
          </div>
        ) : (
          <div className="resume-grid">
            {resumes.map((r) => (
              <div className="resume-card" key={r.id}>
                <div className="resume-card-top">
                  {editingId === r.id ? (
                    <input
                      className="resume-card-name-inp"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <h3 className="resume-card-name" title={r.name}>
                      {r.name}
                    </h3>
                  )}
                </div>
                <div className="resume-card-meta">
                  <span>更新 {fmt(r.updatedAt)}</span>
                  <span>创建 {fmt(r.createdAt)}</span>
                </div>
                <div className="resume-card-ops">
                  <button className="btn primary sm" onClick={() => onOpen(r.id)}>
                    进入编辑
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => onCopy(r.id, r.name)}
                    title="复制这份简历的全部内容，生成一份新简历"
                  >
                    拷贝
                  </button>
                  <button className="btn ghost sm" onClick={() => startRename(r)}>
                    重命名
                  </button>
                  <button className="btn ghost sm danger" onClick={() => onDelete(r)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
