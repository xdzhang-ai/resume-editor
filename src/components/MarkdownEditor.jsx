import React, { useRef, useState } from 'react'
import { renderMarkdown } from '../utils/markdown.js'

// Editor for modules other than 个人信息 / 教育经历:
// one Markdown source for the whole module, with an edit/preview toggle.
export default function MarkdownEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const taRef = useRef(null)

  const insert = (wrapBefore, wrapAfter = '', linePrefix = '') => {
    const ta = taRef.current
    const v = value || ''
    if (!ta) {
      onChange(wrapBefore + v + wrapAfter)
      return
    }
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const sel = v.slice(s, e)
    let next
    let selStart
    let selEnd
    if (linePrefix) {
      const lineStart = v.slice(0, s).lastIndexOf('\n') + 1
      next = v.slice(0, lineStart) + linePrefix + v.slice(lineStart)
      selStart = s + linePrefix.length
      selEnd = e + linePrefix.length
    } else {
      next = v.slice(0, s) + wrapBefore + sel + wrapAfter + v.slice(e)
      selStart = s + wrapBefore.length
      selEnd = selStart + sel.length
    }
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(selStart, selEnd)
    })
  }

  const tools = [
    { label: 'B', title: '加粗', fn: () => insert('**', '**') },
    { label: 'I', title: '斜体', fn: () => insert('*', '*') },
    { label: 'H', title: '标题', fn: () => insert('', '', '### ') },
    { label: '•', title: '无序列表', fn: () => insert('', '', '- ') },
    { label: '1.', title: '有序列表', fn: () => insert('', '', '1. ') },
    { label: '🔗', title: '链接', fn: () => insert('[', '](https://)') },
    { label: '</>', title: '行内代码', fn: () => insert('`', '`') }
  ]

  if (!editing) {
    return (
      <div className="md-editor">
        <div
          className="md-render"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
        <button className="add-item md-edit-btn" onClick={() => setEditing(true)}>
          ✎ 编辑内容
        </button>
      </div>
    )
  }

  return (
    <div className="md-editor editing">
      <div className="md-toolbar">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            className="md-tool"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.fn}
          >
            {t.label}
          </button>
        ))}
        <span className="md-spacer" />
        <button
          type="button"
          className="md-done"
          onClick={() => setEditing(false)}
        >
          完成
        </button>
      </div>
      <textarea
        ref={taRef}
        className="inp md-textarea"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          '用 Markdown 编写本模块全部内容，例如：\n### 公司 · 职位\n*2022.07 – 2025.02*\n- 负责……\n- 主导……'
        }
        rows={14}
      />
    </div>
  )
}
