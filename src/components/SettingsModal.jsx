import React from 'react'
import { useResume } from '../state/ResumeContext.jsx'
import { TEMPLATES } from '../templates/index.js'
import { PAPER_SIZES } from '../utils/paper.js'

const FONTS = [
  { label: '系统默认（苹方 / 微软雅黑）', value: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif' },
  { label: '无衬线 Arial', value: 'Arial, "Helvetica Neue", sans-serif' },
  { label: '衬线 Georgia / 宋体', value: 'Georgia, "Times New Roman", "Songti SC", "SimSun", serif' },
  { label: '等宽 Menlo', value: 'Menlo, Consolas, monospace' }
]

const SWATCHES = ['#2f6df6', '#0f766e', '#1a3c5e', '#7c3aed', '#dc2626', '#d97706', '#0ea5e9', '#111827']

export default function SettingsModal({ open, onClose }) {
  const { state, actions } = useResume()
  const { meta } = state
  if (!open) return null

  const set = (patch) => actions.setMeta(patch)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>排版与模板设置</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <section className="settings-section">
            <h4>模板</h4>
            <div className="tpl-grid">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className={`tpl-card ${meta.templateId === t.id ? 'active' : ''}`}
                  onClick={() => set({ templateId: t.id })}
                >
                  <span className="tpl-swatch" style={{ background: t.defaultColor }} />
                  <span className="tpl-name">{t.name}</span>
                  <span className="tpl-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h4>主题色</h4>
            <div className="swatch-row">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`swatch ${meta.themeColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => set({ themeColor: c })}
                />
              ))}
              <input
                type="color"
                value={meta.themeColor}
                onChange={(e) => set({ themeColor: e.target.value })}
                className="color-input"
              />
            </div>
          </section>

          <section className="settings-section two-col">
            <div>
              <h4>基础字号：{meta.baseFontSize}px</h4>
              <input
                type="range"
                min="10"
                max="18"
                step="0.5"
                value={meta.baseFontSize}
                onChange={(e) => set({ baseFontSize: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <h4>行间距：{meta.lineHeight.toFixed(2)}</h4>
              <input
                type="range"
                min="1.2"
                max="2.2"
                step="0.05"
                value={meta.lineHeight}
                onChange={(e) => set({ lineHeight: parseFloat(e.target.value) })}
              />
            </div>
          </section>

          <section className="settings-section two-col">
            <div>
              <h4>字体</h4>
              <select
                className="select-inp"
                value={meta.fontFamily}
                onChange={(e) => set({ fontFamily: e.target.value })}
              >
                {FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <h4>纸张大小</h4>
              <select
                className="select-inp"
                value={meta.paperSize}
                onChange={(e) => set({ paperSize: e.target.value })}
              >
                {Object.keys(PAPER_SIZES).map((k) => (
                  <option key={k} value={k}>
                    {PAPER_SIZES[k].label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="settings-section">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={!!meta.accentSoft}
                onChange={(e) => set({ accentSoft: e.target.checked })}
              />
              <span>标题使用浅色底色（关闭则为纯色文字）</span>
            </label>
          </section>
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={() => actions.reset()}>
            恢复示例数据
          </button>
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
