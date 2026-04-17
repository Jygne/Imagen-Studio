# Imagen Studio — CLAUDE.md

## 项目概览

Imagen Studio 是一个 AI 驱动的**批量商品图片处理工作台**，面向电商团队与图片处理专业人员。采用前后端分离架构，支持 macOS 桌面应用与 Web 两种部署方式。

**核心工作流：**
- **Local Generate** — 本地文件批量图片生成
- **Sheet Generate** — 基于 Google Sheet 驱动的批量生成
- **Seg Generate** — 商品主体分割 + 图片合成（双图层 PSD）
- **PSD Rename** — PSD 文件图层批量重命名
- **Runs** — 历史任务查看与管理

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+、FastAPI、SQLAlchemy (SQLite)、Pydantic v2 |
| 前端 | Next.js 15、React 19、TypeScript、Tailwind CSS |
| AI | OpenAI `gpt-image-1.5`、OpenRouter (Gemini) |
| 图片处理 | Pillow、psd-tools |
| 外部集成 | Google Sheets API (gspread) |

---

## 常用命令

### 启动项目

```bash
# 后端（终端 1）
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 前端（终端 2）
cd frontend && npm run dev
```

### 初始安装

```bash
# 后端
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 前端
cd frontend && npm install
```

### 前端构建

```bash
cd frontend
npm run dev      # 开发模式 (port 3000)
npm run build    # 生产构建
npm start        # 生产服务
```

---

## 项目结构

```
imagen-studio/
├── backend/
│   └── app/
│       ├── main.py                  # FastAPI 入口，路由注册，CORS 配置
│       ├── config.py                # Pydantic-settings 配置（.env 加载）
│       ├── api/routes/              # HTTP 路由处理器（/api/v1 前缀）
│       │   ├── api_keys.py
│       │   ├── local_generate.py
│       │   ├── seg_generate.py
│       │   ├── psd_rename.py
│       │   ├── runs.py
│       │   ├── workflows.py
│       │   ├── settings.py
│       │   ├── files.py
│       │   └── logs.py
│       ├── workers/                 # 核心处理逻辑（异步任务）
│       │   ├── executor.py          # 工作流主调度器
│       │   ├── seg_worker.py        # 主体分割 worker
│       │   ├── psd_rename_worker.py
│       │   ├── clean_image_worker.py
│       │   ├── selling_point_worker.py
│       │   ├── image_utils.py
│       │   └── psd_builder.py
│       ├── infrastructure/
│       │   ├── db/                  # SQLAlchemy + SQLite
│       │   ├── google_sheet/        # Google Sheets 集成
│       │   └── providers/           # AI provider 适配层
│       │       ├── base.py
│       │       ├── openai_provider.py
│       │       └── openrouter_provider.py
│       ├── domain/                  # 业务模型、枚举、Schemas
│       └── application/             # 应用用例层（Service）
└── frontend/
    └── src/
        ├── app/                     # Next.js 文件路由（页面入口，轻量）
        ├── features/                # 按功能组织的业务组件
        │   ├── local-generate/
        │   ├── seg-generate/
        │   ├── sheet-generate/
        │   ├── psd-rename/
        │   ├── runs/
        │   ├── api-keys/
        │   ├── settings/
        │   └── google-sheet/
        └── shared/                  # 公共组件、contexts、types、lib
```

---

## 关键路径

### 后端 API 端点（前缀 `/api/v1`）

| 路由 | 功能 |
|------|------|
| `/api-keys` | API Key 管理 |
| `/local-generate` | 本地文件批量生成 |
| `/seg-generate` | 主体分割生成 |
| `/psd-rename` | PSD 图层重命名 |
| `/workflows` | 工作流管理 |
| `/settings` | 用户设置 |
| `/runs` | 执行历史 |
| `/files` | 文件管理 |
| `/logs` | 实时日志（SSE） |
| `/health` | 健康检查 |

> **注意**：`sheet-generate` 功能目前仅有前端页面，后端路由尚未注册到 `main.py`。

### 前端路由（Next.js 文件路由）

`src/app/[feature]/page.tsx` 对应各功能页面，组件实现在 `src/features/[feature]/` 下。

---

## 架构约定

- **后端分层**：`infrastructure`（数据/外部服务）→ `domain`（业务模型）→ `application`（用例）→ `api/routes`（HTTP 层），各层职责分离
- **前端分层**：`app/` 只做路由和页面组装，业务组件在 `features/`，可复用逻辑在 `shared/`
- **AI Provider 扩展**：新增 AI 服务在 `backend/app/infrastructure/providers/` 下实现 `base.py` 中的基类接口
- **Worker 模式**：耗时任务通过 `workers/executor.py` 调度，避免阻塞 API 请求

---

## 环境变量

敏感配置通过 `backend/.env` 文件管理（已 gitignore）：

```env
OPENAI_API_KEY=
OPENROUTER_API_KEY=
PISEG_AUTH_TOKEN=       # 分割服务鉴权 token（可选）
# Google Sheets 认证通过 Service Account JSON，在 Settings 页面上传
```

---

## 注意事项

- 数据库为 SQLite 文件（`*.db` 已 gitignore），不适合多实例部署
- 分割服务（`PISEG_SERVICE_URL`，默认指向 Shopee 内部网关）为独立外部服务，需确保可访问
- `sheet-generate` 路由尚未在后端注册，如需启用需在 `main.py` 中添加对应 router
- macOS 应用包 `Imagen Studio.app` 是便捷启动包装，等效于手动启动前后端

---

## 开发注意事项（给 Claude）

- 修改 JSX 文件后，用 `Read` 检查完整文件，确认所有标签缩进层级正确
- 新增 Provider / Wrapper 嵌套时，优先用 `Write` 整体重写，而非多次 `Edit` 拼接
- 执行 merge / 「完成分支」前，必须阅读 `.claude/BUGS.md` 中的 Merge 前检查清单
