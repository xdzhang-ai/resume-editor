// Presentational renderer for a single resume module (preview side).
// 个人信息 and 教育经历 keep structured rendering; the other module types
// render a single Markdown blob edited via the Markdown editor.
import React from 'react'
import { renderMarkdown } from '../utils/markdown.js'

function PersonalView({ data }) {
  const contacts = [data.phone, data.email, data.location, data.website, data.wechat].filter(
    (c) => c && String(c).trim()
  )
  const meta = [
    data.gender && `性别：${data.gender}`,
    data.age && `年龄：${data.age}`
  ].filter(Boolean)
  return (
    <div className="personal">
      <div className="personal-name">{data.name || '你的名字'}</div>
      {data.title && <div className="personal-title">{data.title}</div>}
      {contacts.length > 0 && (
        <div className="personal-contact">{contacts.join('  ·  ')}</div>
      )}
      {meta.length > 0 && <div className="personal-meta">{meta.join('　')}</div>}
      {data.summary && <div className="personal-summary">{data.summary}</div>}
    </div>
  )
}

function EducationView({ data }) {
  const items = data.items || []
  return (
    <div className="entries">
      {items.map((it) => (
        <div className="entry" key={it.id}>
          <div className="entry-head">
            <span className="entry-left">
              <span className="entry-title">{it.school || '学校'}</span>
              {it.schoolLocation && <span className="entry-loc"> · {it.schoolLocation}</span>}
            </span>
            <span className="entry-date">
              {[it.start, it.end].filter(Boolean).join(' – ')}
            </span>
          </div>
          {(it.college || it.major || it.degree) && (
            <div className="entry-sub">
              {[it.college, it.major, it.degree].filter(Boolean).join(' · ')}
            </div>
          )}
          {it.detail && <div className="entry-desc">{it.detail}</div>}
        </div>
      ))}
    </div>
  )
}

function WorkView({ data }) {
  const items = data.items || []
  return (
    <div className="entries">
      {items.map((it) => (
        <div className="entry" key={it.id}>
          <div className="entry-head">
            <span className="entry-left">
              <span className="entry-title">{it.company || '公司'}</span>
              {it.position && <span className="entry-role"> · {it.position}</span>}
            </span>
            <span className="entry-date">{it.time}</span>
          </div>
          {it.content && (
            <div
              className="md-render entry-md"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(it.content) }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function ProjectView({ data }) {
  const items = data.items || []
  return (
    <div className="entries">
      {items.map((it) => {
        const time = [it.start, it.end].filter(Boolean).join(' – ')
        return (
          <div className="entry" key={it.id}>
            <div className="entry-head">
              <span className="entry-title">{it.name || '项目名称'}</span>
            {(it.role || time) && (
              <span className="entry-date">
                {it.role && <span className="entry-role">{it.role}</span>}
                {it.role && time ? ' · ' : ''}
                {time}
              </span>
            )}
          </div>
          {it.description && <div className="entry-desc">{it.description}</div>}
            {it.techStack && <div className="entry-tech">{it.techStack}</div>}
            {it.content && (
              <div
                className="md-render entry-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(it.content) }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const MARKDOWN_TYPES = ['skills', 'custom']

export default function ModuleView({ module }) {
  const { type, title, data } = module
  return (
    <div className={`module-inner mod-${type}`}>
      {type === 'personal' ? (
        <PersonalView data={data} />
      ) : (
        <>
          <div className="module-header">
            <span className="module-title">{title}</span>
          </div>
          <div className="module-body">
            {type === 'education' && <EducationView data={data} />}
            {type === 'projects' && <ProjectView data={data} />}
            {type === 'work' && <WorkView data={data} />}
            {MARKDOWN_TYPES.includes(type) && (
              <div
                className="md-render"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(data.markdown) }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
