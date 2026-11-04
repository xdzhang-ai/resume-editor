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

浏览器打开 **http://localhost:5173** 即可使用。首次启动会自动建库（表结构自动创建），打开后会先看到**登录/注册页**——注册一个账号即可开始。

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

## 🚀 快速部署

### Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxdzhang-ai%2Fresume-editor%2Ftree%2Fvercel&project-name=resume-editor&repository-name=resume-editor&env=TURSO_DATABASE_URL%2CTURSO_AUTH_TOKEN&envDescription=%E5%9C%A8%20Turso%20%E5%88%9B%E5%BB%BA%E6%95%B0%E6%8D%AE%E5%BA%93%E5%90%8E%EF%BC%8C%E7%B2%98%E8%B4%B4%E6%95%B0%E6%8D%AE%E5%BA%93%E5%9C%B0%E5%9D%80%EF%BC%88libsql%3A%2F%2F%20%E5%BC%80%E5%A4%B4%EF%BC%89%E4%B8%8E%E8%AE%BF%E9%97%AE%E4%BB%A4%E7%89%8C&envLink=https%3A%2F%2Fvercel.com%2Fmarketplace%2Ftursocloud%2Fdatabase)

点按钮之后会发生四件事：Fork 本仓库到你自己的 GitHub 账号 → 新建一个 Vercel 项目 → 表单里填两个环境变量 → 自动构建并上线。

> **注意分支**：按钮指向 `vercel` 分支（内容与 `feat/vercel-turso` 同步）。`main` 分支是纯本地 SQLite 版本，没有 `api/` 和 `vercel.json`，**不能直接部署到 Vercel**（会得到一个接口全 404 的站点）。
>
> 为什么不直接写 `feat/vercel-turso`？Vercel 的 Deploy Button 会把 `tree/` 之后的第一段当成分支名、其余当成子目录。分支名里带 `/` 就会被切成「分支 `feat` + 目录 `vercel-turso`」，那个分支并不存在，于是报 `The repository used by this template is private or does not exist`。所以单开了一个不带斜杠的 `vercel` 分支，专门给按钮用。
>
> 同步命令（把 `vercel` 快进到 `feat/vercel-turso` 的最新提交）：
>
> ```bash
> git push origin feat/vercel-turso:vercel
> ```

部署前需要准备一个 Turso 数据库（[Vercel Marketplace 一键开通](https://vercel.com/marketplace/tursocloud/database)，或用 `turso db create` 建库），把 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` 填进表单。**不填也能构建成功，但所有接口会返回 500**——因为 Serverless 的文件系统只读，本地 SQLite 驱动写不进去。

手把手的建库、导入、验证步骤见下方 [部署到 Vercel](#部署到-vercel)。

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
│   ├── auth.js             # 密码哈希(scrypt) / 会话令牌 / Cookie 工具
│   ├── db.js               # 存储层：按环境变量选择驱动 + 统一 CRUD（async）
│   ├── drivers/
│   │   ├── local.js        # node:sqlite 驱动
│   │   └── turso.js        # Turso / libSQL 驱动
│   └── data/resume.db      # 本地 SQLite 数据库（运行时生成）
├── src/
│   ├── main.jsx            # React 入口
│   ├── App.jsx             # 首页/编辑器切换、保存确认、导出 PDF
│   ├── components/         # AuthPage / HomePage / EditorPanel / PreviewPanel / SettingsModal ...
│   ├── state/              # AuthContext、ResumeContext、moduleTypes
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
- 库表：
  - `users`：`id`、`email`、`email_key`（小写去空白，唯一）、`password_hash`（scrypt）、`created_at`
  - `sessions`：`token`（随机串，存 HttpOnly Cookie）、`user_id`、`expires_at`（30 天）
  - `resumes`：`id`（姓名+时间戳）、`user_id`、`name`、`created_at`、`updated_at`、`auto_named`、`data`（JSON：`{ meta, modules }`）
- 编辑后需**手动点「保存」**才会持久化；有未保存改动时离开会弹确认框。
- 前端 `src/db/resumeDb.js` 是 HTTP API 客户端，不直接触碰数据库。

## 账号与数据隔离

- 注册用**邮箱 + 密码**，密码用 `scrypt` 加盐哈希存储，永不回传前端。
- 登录态是 **HttpOnly Cookie**（`rs_session`，`SameSite=Lax`，HTTPS 下自动加 `Secure`），30 天有效；登出会删除服务端会话记录。
- **所有简历接口都要求登录**，并按 `user_id` 过滤：看不到、也改不了别人的简历（跨用户访问返回 404）。
- **简历重名只在同一账号内校验**，不同账号可以同名。
- 页面未登录时直接呈现登录/注册页；会话过期会自动退回登录页。

### 旧数据认领（加用户体系之前建的简历）

历史记录的 `user_id` 为 `NULL`，不会出现在任何账号下。先注册账号，再执行：

```bash
node scripts/claim-orphans.mjs                      # 只列出无主简历
node scripts/claim-orphans.mjs you@example.com      # 归属到该账号
```

脚本与服务端共用 `server/db.js`，因此同样跟随 `TURSO_DATABASE_URL` / `RESUME_DB`。

### REST API（前缀 `/api`）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 否 | 健康检查 |
| POST | `/api/auth/register` | 否 | 注册并自动登录（`{email,password}`） |
| POST | `/api/auth/login` | 否 | 登录（`{email,password}`） |
| POST | `/api/auth/logout` | 否 | 登出，清除 Cookie |
| GET | `/api/auth/me` | 否 | 当前用户，未登录返回 `{user:null}` |
| GET / POST | `/api/resumes` | 是 | 列出 / 新建简历 |
| GET / PUT / DELETE | `/api/resumes/:id` | 是 | 读取 / 更新 / 删除 |
| POST | `/api/resumes/:id/copy` | 是 | 拷贝 |
| PUT | `/api/resumes/:id/rename` | 是 | 重命名 |

未登录访问简历接口返回 `401 {error:"unauthorized"}`。

## 配置（环境变量）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端端口（Vercel 上由平台注入） |
| `RESUME_DB` | `server/data/resume.db` | 本地 SQLite 文件路径 |
| `TURSO_DATABASE_URL` | 空 | 设置后改走 Turso 云库（部署 Vercel 必填） |
| `TURSO_AUTH_TOKEN` | 空 | Turso 访问令牌 |

## 注意事项

- **`npm run dev:web` 单独用会失败**：它只起前端，没有后端响应 `/api`，首页会提示「无法连接数据服务」。开发务必用 `npm run dev`。
- **手动保存**：编辑器不是自动保存，记得点「保存」。
- **不要删除 `src/utils/markdown.js` 中的 NUL（`\0`）字节**：它们是行内代码占位哨兵（用户文本不可能含 NUL，用于安全防护），删除会破坏渲染器。
