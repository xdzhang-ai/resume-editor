import React, { useEffect, useRef, useState } from 'react'

const MAX_LEN = 50

// 名称比较用的归一化：去首尾空白、压缩连续空白、忽略大小写。
function nameKey(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * 新建 / 拷贝简历时的「简历名称」弹窗。
 * 负责：名称输入、空值 / 超长 / 重名校验、错误提示、回车提交。
 * 真正的创建动作由父组件通过 onSubmit(name) 完成；若抛出错误（如后端判定重名），
 * 弹窗会保留并展示错误信息。
 */
export default function NameDialog({
  mode = 'create', // 'create' | 'copy'
  sourceName = '',
  defaultName = '',
  existingNames = [],
  onCancel,
  onSubmit
}) {
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  // 打开即聚焦并全选默认名，方便直接输入覆盖。
  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  // Esc 关闭（提交中不关闭，避免半途中断）。
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  const trimmed = name.trim()
  const exists = trimmed && existingNames.some((n) => nameKey(n) === nameKey(trimmed))
  const localError = !trimmed
    ? '请输入简历名称'
    : trimmed.length > MAX_LEN
      ? `名称不能超过 ${MAX_LEN} 个字符`
      : exists
        ? '该名称已存在，请换一个'
        : ''
  // 空名称时把「请输入」作为提示而非报错，只在用户输入后展示校验错误。
  const showLocalError = Boolean(localError) && Boolean(trimmed)
  const visibleError = error || (showLocalError ? localError : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (localError || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(trimmed)
      // 成功后由父组件卸载弹窗
    } catch (err) {
      const isDup = err && err.code === 'duplicate'
      setError(isDup ? '该名称已存在，请换一个' : err?.message || '操作失败，请重试')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={() => !submitting && onCancel()}>
      <form
        className="modal name-dialog"
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{mode === 'copy' ? '拷贝简历' : '新建简历'}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {mode === 'copy' && sourceName ? (
            <p className="name-dialog-sub">
              将复制「{sourceName}」的全部内容，生成一份互不影响的新简历。
            </p>
          ) : (
            <p className="name-dialog-sub">新建一份空白简历，先给它取个名字。</p>
          )}

          <label className="field">
            <span className="field-label">简历名称</span>
            <input
              ref={inputRef}
              className={`inp${showLocalError ? ' inp-err' : ''}`}
              value={name}
              maxLength={MAX_LEN + 10}
              placeholder="例如：张晓冬 · Java 后端"
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
            />
          </label>

          {visibleError ? (
            <div className="name-dialog-err">{visibleError}</div>
          ) : (
            <div className="name-dialog-hint">{trimmed.length}/{MAX_LEN}</div>
          )}
        </div>

        <div className="modal-foot name-dialog-foot">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={Boolean(localError) || submitting}
          >
            {submitting ? '处理中…' : mode === 'copy' ? '拷贝' : '创建'}
          </button>
        </div>
      </form>
    </div>
  )
}
