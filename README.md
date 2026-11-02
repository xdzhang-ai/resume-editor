# Resume Studio · 简历编辑器

一个基于浏览器的**简历编辑器**：左侧分模块编辑，右侧实时分页预览，支持多套排版模板、Markdown 与一键导出 PDF。数据持久化在本地 SQLite（无需额外数据库服务）。

## 功能特性

- **多份简历管理**：首页卡片网格，支持新建 / 进入 / 拷贝 / 重命名 / 删除。
- **分模块编辑**：个人信息、教育经历、工作经历、专业技能、项目经历、自定义模块；模块可拖拽排序、增删条目。
- **实时分页预览**：模拟 A4 / A5 / Letter 纸张，按内容高度自动切页。
- **排版设置**：4 套模板（现代蓝 / 极简灰 / 经典衬线 / 紧凑绿）、主题色、字号、行距、字体、纸张大小。
- **Markdown 支持**：工作/项目/技能等模块支持轻量 Markdown（自带防 XSS 渲染器）。
- **导出 PDF**：通过浏览器打印（`window.print()`）+ 专用打印样式实现。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + Vite 5（`@vitejs/plugin-react`） |
| 状态 | React `useReducer` + Context（无 Redux/Zustand） |
| 后端 | Node 内置 `node:http`（手写极简服务，无 Express/Koa） |
| 数据库 | Node 内置 `node:sqlite`（`DatabaseSync`，零原生依赖） |

项目为纯 JavaScript / JSX，**无 TypeScript**。

## 环境要求

- **Node ≥ 22.5**（后端使用实验性的 `node:sqlite`，低于此版本无法运行）。
- 启动时会打印 `ExperimentalWarning: SQLite is an experimental feature`，属正常现象。

## 快速开始

```bash
cd resume-editor
npm install
npm run dev        # 同时启动后端(3001) + 前端(5173)
```

浏览器打开 **http://localhost:5173** 即可使用。首次启动会自动建库并播种一份示例简历（「张晓冬」）。

## 脚本说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键同时拉起后端(3001) + Vite 前端(5173)，开发用 |
| `npm run dev:web` | 只起前端(5173)，**不带后端**（单独使用会因 `/api` 无响应而报错） |
| `npm run server` | 只起后端(3001)，提供 `/api` 并托管 `dist/` |
| `npm run build` | 前端打包到 `dist/` |
| `npm run start` | = `server`，生产用（需先 `build`） |
| `npm run preview` | 预览 `dist/` 静态站点（不含 API） |

**生产部署：**

```bash
npm run build
npm run start      # 同一服务在 3001 同时托管前端与 API
```

打开 **http://localhost:3001**。

## 项目结构

```
resume-editor/
├── index.html              # Vite 入口
├── vite.config.js          # 端口 5173，/api 代理到 3001
├── scripts/
│   └── dev.js              # 并行启动后端 + 前端
├── server/
│   ├── index.js            # node:http 服务：/api CRUD + 托管 dist/
│   ├── db.js               # node:sqlite 数据访问层
│   └── data/resume.db      # 真实 SQLite 数据库（运行时生成）
├── src/
│   ├── main.jsx            # React 入口
│   ├── App.jsx             # 首页/编辑器切换、保存确认、导出 PDF
│   ├── components/         # HomePage / EditorPanel / PreviewPanel / SettingsModal ...
│   ├── state/              # ResumeContext、moduleTypes、sampleData
│   ├── db/resumeDb.js      # 前端 API 客户端（fetch /api/*）
│   ├── templates/          # 4 套模板定义
│   ├── utils/              # markdown.js（渲染器）、paper.js（纸张换算）
│   └── styles/             # global / home / markdown / print / templates
└── dist/                   # 构建产物（已存在）
```

## 数据持久化

- 数据存于 **`server/data/resume.db`**（SQLite 3）。该目录被 `.gitignore` 忽略，**不进版本库**；首次运行时若库不存在会自动建表。
- 库表 `resumes`：`id`（姓名+时间戳）、`name`、`created_at`、`updated_at`、`auto_named`、`data`（JSON：`{ meta, modules }`）。
- 编辑后需**手动点「保存」**才会持久化；有未保存改动时离开会弹确认框。
- 前端 `src/db/resumeDb.js` 是 HTTP API 客户端，不直接触碰数据库。

### REST API（前缀 `/api`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET / POST | `/api/resumes` | 列出 / 新建简历 |
| GET / PUT / DELETE | `/api/resumes/:id` | 读取 / 更新 / 删除 |
| POST | `/api/resumes/:id/copy` | 拷贝 |
| PUT | `/api/resumes/:id/rename` | 重命名 |

## 配置（环境变量）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端端口 |
| `RESUME_DB` | `server/data/resume.db` | 数据库文件路径 |

## 注意事项

- **`npm run dev:web` 单独用会失败**：它只起前端，没有后端响应 `/api`，首页会提示「无法连接本地后端服务」。开发务必用 `npm run dev`。
- **手动保存**：编辑器不是自动保存，记得点「保存」。
- **不要删除 `src/utils/markdown.js` 中的 NUL（`\0`）字节**：它们是行内代码占位哨兵（用户文本不可能含 NUL，用于安全防护），删除会破坏渲染器。
