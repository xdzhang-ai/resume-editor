import React, { useState, useRef } from 'react'
import { useResume } from '../state/ResumeContext.jsx'
import { MODULE_TYPES, MODULE_TYPE_LIST } from '../state/moduleTypes.js'
import ModuleEditor from './ModuleEditor.jsx'

export default function EditorPanel() {
  const { state, actions, anyDirty, persist } = useResume()
  const modules = state.modules
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dropId, setDropId] = useState(null)
  const draggingRef = useRef(false)
  const dragReadyRef = useRef(false)

  // Only allow a drag to start when the press began on the drag handle.
  const onHandleMouseDown = () => {
    dragReadyRef.current = true
  }
  const onCardMouseUp = () => {
    dragReadyRef.current = false
  }
  const onDragStart = (id) => (e) => {
    if (!dragReadyRef.current) {
      e.preventDefault()
      return
    }
    dragReadyRef.current = false
    setDragId(id)
    draggingRef.current = true
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', id)
    } catch (_) {}
  }
  const onDragOver = (id) => (e) => {
    e.preventDefault()
    if (id !== dropId) setDropId(id)
  }
  const onDragLeave = () => {
    // keep last target; cleared on drop/end
  }
  const onDrop = (id) => (e) => {
    e.preventDefault()
    const from = dragId
    if (!from || from === id) {
      setDragId(null)
      setDropId(null)
      return
    }
    const order = modules.map((m) => m.id)
    const fromIdx = order.indexOf(from)
    const toIdx = order.indexOf(id)
    if (fromIdx < 0 || toIdx < 0) return
    order.splice(fromIdx, 1)
    order.splice(toIdx, 0, from)
    actions.reorderModules(order)
    setDragId(null)
    setDropId(null)
    draggingRef.current = false
  }
  const onDragEnd = () => {
    dragReadyRef.current = false
    setDragId(null)
    setDropId(null)
    draggingRef.current = false
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <span className="editor-toolbar-label">模块编辑</span>
        <div className="editor-toolbar-actions">
          <button
            className="btn primary save-all-btn"
            disabled={!anyDirty}
            onClick={() => persist()}
            title="把所有未保存的修改写入数据库"
          >
            保存全部
          </button>
          <div className="add-menu-wrap">
          <button className="add-module-btn" onClick={() => setMenuOpen((o) => !o)}>
            + 添加模块
          </button>
          {menuOpen && (
            <div className="add-menu" onMouseLeave={() => setMenuOpen(false)}>
              {MODULE_TYPE_LIST.map((t) => (
                <button
                  key={t}
                  className="add-menu-item"
                  onClick={() => {
                    actions.addModule(t)
                    setMenuOpen(false)
                  }}
                >
                  <span className="add-menu-icon">{MODULE_TYPES[t].icon}</span>
                  {MODULE_TYPES[t].label}
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="editor-scroll">
        {modules.length === 0 && (
          <div className="empty-hint">
            还没有模块，点击「+ 添加模块」开始创建你的简历。
          </div>
        )}
        {modules.map((m) => (
          <ModuleEditor
            key={m.id}
            module={m}
            dragProps={{
              dragging: dragId === m.id,
              dropTarget: dropId === m.id,
              onHandleMouseDown,
              onCardMouseUp,
              onDragStart: onDragStart(m.id),
              onDragOver: onDragOver(m.id),
              onDragLeave,
              onDrop: onDrop(m.id),
              onDragEnd
            }}
          />
        ))}
        <p className="editor-tip">
          提示：拖动模块卡片左侧的 ⠿ 可调整顺序；点 ↑ / ↓ 也能上下移动。
        </p>
      </div>
    </div>
  )
}
