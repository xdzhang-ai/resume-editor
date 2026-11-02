import React from 'react'
import { useResume } from '../state/ResumeContext.jsx'
import { MODULE_TYPES } from '../state/moduleTypes.js'
import MarkdownEditor from './MarkdownEditor.jsx'

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function Text({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      className="inp"
      type={type}
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      className="inp ta"
      rows={rows}
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function ItemCard({ title, children, canUp, canDown, onUp, onDown, onRemove }) {
  return (
    <div className="item-card">
      <div className="item-card-head">
        <span className="item-card-title">{title}</span>
        <div className="item-card-ops">
          <button className="mini" disabled={!canUp} onClick={onUp} title="上移">
            ↑
          </button>
          <button className="mini" disabled={!canDown} onClick={onDown} title="下移">
            ↓
          </button>
          <button className="mini danger" onClick={onRemove} title="删除">
            ✕
          </button>
        </div>
      </div>
      <div className="item-card-body">{children}</div>
    </div>
  )
}

export default function ModuleEditor({ module, dragProps }) {
  const { actions, persist, isDirty } = useResume()
  const { id, type, title, data } = module
  const set = (patch) => actions.updateData(id, patch)
  const setItem = (itemId, key, value) => actions.updateItem(id, itemId, key, value)
  const moduleDirty = isDirty(id)

  const body = (() => {
    switch (type) {
      case 'personal':
        return (
          <div className="grid-2">
            <Field label="姓名">
              <Text value={data.name} onChange={(v) => set({ name: v })} placeholder="张三" />
            </Field>
            <Field label="求职意向 / 头衔">
              <Text value={data.title} onChange={(v) => set({ title: v })} placeholder="Java 后端开发工程师" />
            </Field>
            <Field label="电话">
              <Text value={data.phone} onChange={(v) => set({ phone: v })} placeholder="138-0000-0000" />
            </Field>
            <Field label="邮箱">
              <Text value={data.email} onChange={(v) => set({ email: v })} placeholder="you@example.com" />
            </Field>
            <Field label="所在地">
              <Text value={data.location} onChange={(v) => set({ location: v })} placeholder="上海" />
            </Field>
            <Field label="个人主页 / GitHub">
              <Text value={data.website} onChange={(v) => set({ website: v })} placeholder="github.com/xxx" />
            </Field>
            <Field label="微信">
              <Text value={data.wechat} onChange={(v) => set({ wechat: v })} placeholder="微信号" />
            </Field>
            <div className="grid-2-inline">
              <Field label="性别">
                <select
                  className="inp"
                  value={data.gender || ''}
                  onChange={(e) => set({ gender: e.target.value })}
                >
                  <option value="">未填</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </Field>
              <Field label="年龄">
                <input
                  className="inp"
                  type="number"
                  min="0"
                  value={data.age || ''}
                  placeholder="28"
                  onChange={(e) => set({ age: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid-full">
              <Field label="个人简介">
                <TextArea value={data.summary} onChange={(v) => set({ summary: v })} placeholder="一句话概括你的经验与优势" />
              </Field>
            </div>
          </div>
        )

      case 'education':
        return (
          <div className="items-wrap">
            {data.items.map((it, i) => (
              <ItemCard
                key={it.id}
                title={it.school || `教育经历 ${i + 1}`}
                canUp={i > 0}
                canDown={i < data.items.length - 1}
                onUp={() => actions.moveItem(id, it.id, -1)}
                onDown={() => actions.moveItem(id, it.id, 1)}
                onRemove={() => actions.removeItem(id, it.id)}
              >
                <div className="grid-2">
                  <Field label="学校">
                    <Text value={it.school} onChange={(v) => setItem(it.id, 'school', v)} />
                  </Field>
                  <Field label="学校地点">
                    <Text
                      value={it.schoolLocation}
                      onChange={(v) => setItem(it.id, 'schoolLocation', v)}
                      placeholder="上海"
                    />
                  </Field>
                  <Field label="学院">
                    <Text
                      value={it.college}
                      onChange={(v) => setItem(it.id, 'college', v)}
                      placeholder="计算机学院"
                    />
                  </Field>
                  <Field label="专业">
                    <Text value={it.major} onChange={(v) => setItem(it.id, 'major', v)} />
                  </Field>
                </div>
                <div className="grid-3">
                  <Field label="学历">
                    <Text
                      value={it.degree}
                      onChange={(v) => setItem(it.id, 'degree', v)}
                      placeholder="本科 / 硕士"
                    />
                  </Field>
                  <Field label="开始">
                    <Text
                      value={it.start}
                      onChange={(v) => setItem(it.id, 'start', v)}
                      placeholder="2019.09"
                    />
                  </Field>
                  <Field label="结束">
                    <Text
                      value={it.end}
                      onChange={(v) => setItem(it.id, 'end', v)}
                      placeholder="2022.06"
                    />
                  </Field>
                </div>
                <div className="grid-full">
                  <Field label="补充说明">
                    <TextArea value={it.detail} onChange={(v) => setItem(it.id, 'detail', v)} rows={2} />
                  </Field>
                </div>
              </ItemCard>
            ))}
            <button className="add-item" onClick={() => actions.addItem(id)}>
              + 添加一段教育经历
            </button>
          </div>
        )

      case 'projects':
        return (
          <div className="items-wrap">
            {(data.items || []).map((it, i) => (
              <ItemCard
                key={it.id}
                title={it.name || `项目 ${i + 1}`}
                canUp={i > 0}
                canDown={i < data.items.length - 1}
                onUp={() => actions.moveItem(id, it.id, -1)}
                onDown={() => actions.moveItem(id, it.id, 1)}
                onRemove={() => actions.removeItem(id, it.id)}
              >
                <div className="grid-2">
                  <Field label="项目名">
                    <Text
                      value={it.name}
                      onChange={(v) => setItem(it.id, 'name', v)}
                      placeholder="短链及服务人群推送平台"
                    />
                  </Field>
                  <Field label="角色">
                    <Text
                      value={it.role}
                      onChange={(v) => setItem(it.id, 'role', v)}
                      placeholder="核心开发 / 技术负责人"
                    />
                  </Field>
                  <div className="grid-2-inline">
                    <Field label="开始时间">
                      <Text
                        value={it.start}
                        onChange={(v) => setItem(it.id, 'start', v)}
                        placeholder="2023.06"
                      />
                    </Field>
                    <Field label="结束时间">
                      <Text
                        value={it.end}
                        onChange={(v) => setItem(it.id, 'end', v)}
                        placeholder="2024.12"
                      />
                    </Field>
                  </div>
                  <div className="grid-full">
                    <Field label="项目描述">
                      <TextArea
                        value={it.description}
                        onChange={(v) => setItem(it.id, 'description', v)}
                        placeholder="一句话概括项目背景与目标"
                        rows={2}
                      />
                    </Field>
                  </div>
                  <div className="grid-full">
                    <Field label="技术栈">
                      <Text
                        value={it.techStack}
                        onChange={(v) => setItem(it.id, 'techStack', v)}
                        placeholder="React / Ant Design / SpringBoot / Redis"
                      />
                    </Field>
                  </div>
                  <div className="grid-full">
                    <Field label="工作内容（Markdown）">
                      <MarkdownEditor
                        value={it.content}
                        onChange={(v) => setItem(it.id, 'content', v)}
                      />
                    </Field>
                  </div>
                </div>
              </ItemCard>
            ))}
            <button className="add-item" onClick={() => actions.addItem(id)}>
              + 添加一个项目
            </button>
          </div>
        )

      case 'work':
        return (
          <div className="items-wrap">
            {(data.items || []).map((it, i) => (
              <ItemCard
                key={it.id}
                title={it.company || `工作 ${i + 1}`}
                canUp={i > 0}
                canDown={i < data.items.length - 1}
                onUp={() => actions.moveItem(id, it.id, -1)}
                onDown={() => actions.moveItem(id, it.id, 1)}
                onRemove={() => actions.removeItem(id, it.id)}
              >
                <div className="grid-3">
                  <Field label="公司">
                    <Text
                      value={it.company}
                      onChange={(v) => setItem(it.id, 'company', v)}
                      placeholder="携程"
                    />
                  </Field>
                  <Field label="岗位">
                    <Text
                      value={it.position}
                      onChange={(v) => setItem(it.id, 'position', v)}
                      placeholder="Java 后端开发工程师"
                    />
                  </Field>
                  <Field label="时间">
                    <Text
                      value={it.time}
                      onChange={(v) => setItem(it.id, 'time', v)}
                      placeholder="2022.07 – 2025.02"
                    />
                  </Field>
                </div>
                <div className="grid-full">
                  <Field label="工作内容（Markdown）">
                    <MarkdownEditor value={it.content} onChange={(v) => setItem(it.id, 'content', v)} />
                  </Field>
                </div>
              </ItemCard>
            ))}
            <button className="add-item" onClick={() => actions.addItem(id)}>
              + 添加一段工作经历
            </button>
          </div>
        )

      case 'skills':
      case 'custom':
        return <MarkdownEditor value={data.markdown} onChange={(v) => set({ markdown: v })} />

      default:
        return null
    }
  })()

  return (
    <div
      className={`module-card ${dragProps?.dragging ? 'dragging' : ''} ${
        dragProps?.dropTarget ? 'drop-target' : ''
      }`}
      draggable
      onDragStart={dragProps?.onDragStart}
      onDragOver={dragProps?.onDragOver}
      onDragLeave={dragProps?.onDragLeave}
      onDrop={dragProps?.onDrop}
      onDragEnd={dragProps?.onDragEnd}
      onMouseUp={dragProps?.onCardMouseUp}
    >
      <div className="module-card-head">
        <span
          className="drag-handle"
          title="按住拖动排序"
          onMouseDown={dragProps?.onHandleMouseDown}
        >
          ⠿
        </span>
        <input
          className="module-title-input"
          value={title}
          onChange={(e) => actions.updateTitle(id, e.target.value)}
        />
        <div className="module-card-ops">
          <button className="mini" onClick={() => actions.moveModule(id, -1)} title="上移模块">
            ↑
          </button>
          <button className="mini" onClick={() => actions.moveModule(id, 1)} title="下移模块">
            ↓
          </button>
          <button className="mini danger" onClick={() => actions.removeModule(id)} title="删除模块">
            ✕
          </button>
        </div>
      </div>
      <div className="module-card-body">{body}</div>
      <div className="module-card-foot">
        <span className={`save-state ${moduleDirty ? 'unsaved' : 'saved'}`}>
          {moduleDirty ? '● 未保存' : '✓ 已保存'}
        </span>
        <button
          className="btn save-btn"
          disabled={!moduleDirty}
          onClick={() => persist()}
          title="把当前编辑内容写入数据库"
        >
          保存
        </button>
      </div>
    </div>
  )
}
