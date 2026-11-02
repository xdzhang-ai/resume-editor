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
| 后端 | Node 内置 `node:http`（手写极简服务，无 Express/Koa）；Vercel 上走 Serverless Function |
| 数据库 | 双驱动：本地 `node:sqlite`（零原生依赖）/ 云端 `@libsql/client`（Turso） |

存储层通过同一套 SQL 抽象出两种驱动，环境变量 `TURSO_DATABASE_URL` 有值即走 Turso，否则用本地 SQLite 文件。

项目为纯 JavaScript / JSX，**无 TypeScript**。

## 环境要求

- 本地开发：**Node ≥ 22.5**（本地驱动使用实验性的 `node:sqlite`）。
- 启动时会打印 `ExperimentalWarning: SQLite is an experimental feature`，属正常现象。
- 部署到 Vercel：需要一个 Turso 数据库（Vercel 无持久磁盘，本地 SQLite 无法持久化）。

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

## 部署到 Vercel

Vercel 的函数文件系统只读（仅 `/tmp` 可写且不跨实例），因此**必须用 Turso 存数据**，不能用本地 SQLite 文件。

### 1. 建 Turso 库并取凭据

```bash
# 安装 CLI：brew install tursodatabase/tap/turso  或 curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup                     # 或 turso auth login
turso db create resume-studio
turso db show resume-studio --url     # -> libsql://xxxx.turso.io  （TURSO_DATABASE_URL）
turso db tokens create resume-studio  # -> 一串 token          （TURSO_AUTH_TOKEN）
```

> 免费额度：5 GB 存储 / 10M 行写每月，个人用量远够。

### 2. 导入项目

Vercel 新建项目 → 选本仓库 → **Root Directory 保持仓库根目录**。构建配置已写在 `vercel.json` 里，不用手填：

| 项 | 值 |
|----|----|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### 3. 配环境变量

Project → Settings → Environment Variables 添加（Production + Preview + Development 都勾上）：

```
TURSO_DATABASE_URL=libsql://xxxx.turso.io
TURSO_AUTH_TOKEN=xxxxx
```

### 4. 部署

点 Deploy，或命令行：

```bash
npx vercel --prod
```

### 5. 验证

```bash
curl https://你的域名.vercel.app/api/health        # {"ok":true}
curl https://你的域名.vercel.app/api/resumes       # 简历列表
```

打开首页，新建一份简历 → 刷新页面 → 还在，即说明写进了 Turso。

### 路由说明（重要）

`vercel.json` 里把 `/api/*` 重写到 `api/index.js`，并把原始子路径透传成 `?__path=...`：

```json
{ "source": "/api/:path*", "destination": "/api/index?__path=:path*" }
```

因为改写后函数看到的 pathname 会变成 `/api/index`，原始路径会丢；`api/index.js` 里的 `resolveApiPath()` 正是从 `__path` 还原 `/api/resumes/:id` 这类路径。**改动路由相关配置时不要删掉这个参数**。

### 成本

个人使用 **$0/月**：Vercel Hobby（每月 100 万次函数调用）+ Turso Free。注意 Hobby 仅限非商业个人用途。

## 项目结构

```
resume-editor/
├── index.html              # Vite 入口
├── vite.config.js          # 端口 5173，/api 代理到 3001
├── scripts/
│   └── dev.js              # 并行启动后端 + 前端
├── api/
│   └── index.js            # Vercel Serverless Function 入口（fetch handler）
├── vercel.json             # Vercel 构建 / 重写 / 函数配置
├── server/
│   ├── index.js            # 本地/自托管入口：node:http + 托管 dist/
│   ├── api.js              # 纯业务路由（不依赖 http，本地与 Vercel 共用）
│   ├── db.js               # 存储层：按环境变量选择驱动 + 统一 CRUD（async）
│   ├── drivers/
│   │   ├── local.js        # node:sqlite 驱动
│   │   └── turso.js        # Turso / libSQL 驱动
│   └── data/resume.db      # 本地 SQLite 数据库（运行时生成）
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

存储层有两套驱动，接口完全一致（`server/db.js` 统一导出异步 CRUD）：

| 驱动 | 触发条件 | 数据位置 |
|------|----------|----------|
| 本地 SQLite | 未设置 `TURSO_DATABASE_URL` | `server/data/resume.db`（`RESUME_DB` 可改路径） |
| Turso（libSQL） | 设置了 `TURSO_DATABASE_URL` | 云端库，需同时提供 `TURSO_AUTH_TOKEN` |

- 本地库文件被 `.gitignore` 忽略，**不进版本库**；首次运行时若库不存在会自动建表。
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
| `PORT` | `3001` | 后端端口（Vercel 上由平台注入） |
| `RESUME_DB` | `server/data/resume.db` | 本地 SQLite 文件路径 |
| `TURSO_DATABASE_URL` | 空 | 设置后改走 Turso 云库（部署 Vercel 必填） |
| `TURSO_AUTH_TOKEN` | 空 | Turso 访问令牌 |

## 注意事项

- **`npm run dev:web` 单独用会失败**：它只起前端，没有后端响应 `/api`，首页会提示「无法连接本地后端服务」。开发务必用 `npm run dev`。
- **手动保存**：编辑器不是自动保存，记得点「保存」。
- **不要删除 `src/utils/markdown.js` 中的 NUL（`\0`）字节**：它们是行内代码占位哨兵（用户文本不可能含 NUL，用于安全防护），删除会破坏渲染器。
