// Module type definitions: metadata + default data + helpers for list items.

let _idSeq = 0
export function uid(prefix = 'm') {
  _idSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${_idSeq}`
}

// Each module type declares how to create an empty module and a new sub-item.
export const MODULE_TYPES = {
  personal: {
    label: '个人信息',
    icon: '👤',
    defaultTitle: '基本信息',
    createData: () => ({
      name: '',
      title: '',
      phone: '',
      email: '',
      location: '',
      website: '',
      wechat: '',
      gender: '',
      age: '',
      summary: ''
    })
  },
  education: {
    label: '教育经历',
    icon: '🎓',
    defaultTitle: '教育经历',
    createData: () => ({ items: [newEducationItem()] }),
    newItem: newEducationItem
  },
  work: {
    label: '工作经历',
    icon: '💼',
    defaultTitle: '工作经历',
    createData: () => ({ items: [newWorkItem()] }),
    newItem: newWorkItem
  },
  skills: {
    label: '专业技能',
    icon: '🛠️',
    defaultTitle: '专业技能',
    createData: () => ({ markdown: '' }),
    newItem: () => ({ markdown: '' })
  },
  projects: {
    label: '项目经历',
    icon: '🚀',
    defaultTitle: '项目经历',
    createData: () => ({ items: [newProjectItem()] }),
    newItem: newProjectItem
  },
  custom: {
    label: '自定义模块',
    icon: '📝',
    defaultTitle: '自定义模块',
    createData: () => ({ markdown: '' }),
    newItem: () => ({ markdown: '' })
  }
}

export const MODULE_TYPE_LIST = Object.keys(MODULE_TYPES)

function newEducationItem() {
  return {
    id: uid('i'),
    school: '',
    schoolLocation: '', // 学校地点（与学校同行）
    college: '', // 学院（与专业同行，在专业前）
    major: '',
    degree: '',
    start: '',
    end: '',
    detail: ''
  }
}
function newWorkItem() {
  return {
    id: uid('i'),
    company: '', // 公司
    position: '', // 岗位
    time: '', // 时间（与公司、岗位同行）
    content: '' // 工作内容（Markdown）
  }
}
function newSkillItem() {
  return { id: uid('i'), category: '', content: '' }
}
function newProjectItem() {
  return {
    id: uid('i'),
    name: '', // 项目名
    role: '', // 角色（与项目名同行、靠右）
    start: '', // 时间（开始）
    end: '', // 时间（结束）
    description: '', // 项目描述（独占一行，在项目名下面）
    techStack: '', // 技术栈
    content: '' // 工作内容（Markdown）
  }
}
function newCustomItem() {
  return { id: uid('i'), heading: '', content: '' }
}

export function createModule(type) {
  const def = MODULE_TYPES[type]
  if (!def) throw new Error('Unknown module type: ' + type)
  return {
    id: uid('mod'),
    type,
    title: def.defaultTitle,
    data: def.createData()
  }
}

// Default sub-item factory used by the "add item" action.
export function createItem(type) {
  const def = MODULE_TYPES[type]
  if (def && def.newItem) return def.newItem()
  return { id: uid('i') }
}

// 加载简历时把旧数据模型升级为新结构，避免渲染崩溃或字段丢失。
// 项目经历早期是单个 markdown 字符串，这里把它整体迁移为一个项目条目；
// 缺 items 的简历补一个空条目，保证 ADD_ITEM 等通用 reducer 可正常工作。
export function normalizeResume(resume) {
  if (!resume || !Array.isArray(resume.modules)) return resume
  const modules = resume.modules.map((m) => {
    if (m.type === 'projects') {
      const d = m.data || {}
      if (Array.isArray(d.items)) return m
      if (typeof d.markdown === 'string') {
        return {
          ...m,
          data: {
            items: [
              {
                id: uid('i'),
                name: '',
                role: '',
                start: '',
                end: '',
                techStack: '',
                content: d.markdown
              }
            ]
          }
        }
      }
      return { ...m, data: { items: [newProjectItem()] } }
    }
    if (m.type === 'work') {
      const d = m.data || {}
      if (Array.isArray(d.items)) return m
      if (typeof d.markdown === 'string') {
        return {
          ...m,
          data: {
            items: [{ id: uid('i'), company: '', position: '', time: '', content: d.markdown }]
          }
        }
      }
      return { ...m, data: { items: [newWorkItem()] } }
    }
    return m
  })
  return { ...resume, modules }
}
