// Template catalogue. All templates share the same module content renderer;
// they differ in visual styling (CSS) and a few structural options.
export const TEMPLATES = [
  {
    id: 'modern',
    name: '现代蓝',
    desc: '蓝色强调条 + 浅色标题底，清爽现代，适合技术岗',
    defaultColor: '#2f6df6'
  },
  {
    id: 'minimal',
    name: '极简灰',
    desc: '细线分隔标题，大量留白，中性高级感',
    defaultColor: '#333333'
  },
  {
    id: 'classic',
    name: '经典衬线',
    desc: '衬线字体 + 居中页眉，传统商务风',
    defaultColor: '#1a3c5e'
  },
  {
    id: 'compact',
    name: '紧凑绿',
    desc: '紧凑排版、技能双列，一页装更多内容',
    defaultColor: '#0f766e'
  }
]

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]
}
