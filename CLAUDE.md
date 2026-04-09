# Imagen Studio — CLAUDE.md

## 项目概览

Imagen Studio 是一个 AI 驱动的**批量商品图片处理工作台**，面向电商团队与图片处理专业人员。采用前后端分离架构，支持 macOS 桌面应用与 Web 两种部署方式。

**核心工作流：**
- **Local Generate** — 本地文件批量图片生成
- **Sheet Generate** — 基于 Google Sheet 驱动的批量生成
- **Seg Generate** — 商品主体分割 + 图片合成
- **PSD Rename** — PSD 文件图层批量重命名
- **Runs** — 历史任务查看与管理

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+、FastAPI、SQLAlchemy (SQLite)、Pydantic v2 |
| 前端 | Next.js 15、React 19、TypeScript、Tailwind CSS |
| AI | OpenAI API (`gpt-image-1.5`)、OpenRouter (Gemini) |
| 图片处理 | Pillow、psd-tools |
| 外部集成 | Google Sheets API (gspread) |

---

## 常用命令

### 启动项目

```bash
# 一键启动（推荐）
./start.sh

# 分开启动
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

### 初始安装

```bash
./setup.sh
```

### 前端构建

```bash
cd frontend
npm run dev      # 开发模式 (port 3000)
npm run build    # 生产构建
npm start        # 生产服务
```

### 后端验证

```bash
cd backend && source .venv/bin/activate
python validate_providers.py   # 验证 AI provider 配置
python test_live.py            # 集成测试
```

---

## 项目结构

```
imagen-studio/
├── backend/
│   └── app/
│       ├── main.py                 # FastAPI 入口，路由注册，CORS 配置
│       ├── config.py               # Pydantic-settings 配置管理
│       ├── api/routes/             # API 路由处理器（/api/v1 前缀）
│       ├── workers/                # 核心处理逻辑
│       │   ├── executor.py         # 工作流主调度器
│       │   ├── seg_worker.py       # 主体分割 worker
│       │   ├── psd_rename_worker.py
│       │   ├── clean_image_worker.py
│       │   └── psd_builder.py
│       ├── infrastructure/
│       │   ├── db/                 # SQLAlchemy + SQLite
│       │   ├── google_sheet/       # Google Sheets 集成
│       │   └── providers/          # AI provider 适配层
│       ├── domain/                 # 业务模型与实体
│       └── application/            # 应用用例层
├── frontend/
│   └── src/
│       ├── app/                    # Next.js 文件路由（各 feature 页面）
│       ├── features/               # 按功能组织的组件（与 app/ 对应）
│       └── shared/                 # 公共组件、hooks、类型、工具函数
├── start.sh                        # 生产启动脚本
└── setup.sh                        # 初始化安装脚本
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
| `/sheet-generate` | Google Sheet 生成 |
| `/workflows` | 工作流管理 |
| `/settings` | 用户设置 |
| `/runs` | 执行历史 |
| `/logs` | 实时日志（SSE） |
| `/health` | 健康检查 |

### 前端路由（Next.js 文件路由）

`src/app/[feature]/page.tsx` 直接对应各功能页面，组件实现在 `src/features/[feature]/` 下。

---

## 架构约定

- **后端分层**：`infrastructure`（数据/外部服务）→ `domain`（业务模型）→ `application`（用例）→ `api/routes`（HTTP 层），各层职责分离
- **前端分层**：`app/` 只做路由和页面组装，业务组件在 `features/`，可复用逻辑在 `shared/`
- **AI Provider 扩展**：新增 AI 服务在 `backend/app/infrastructure/providers/` 下添加适配器
- **Worker 模式**：耗时任务通过 `workers/executor.py` 调度，避免阻塞 API 请求

---

## 环境变量

敏感配置通过 `.env` 文件管理（已 gitignore）。需要配置的关键变量：

```env
OPENAI_API_KEY=
OPENROUTER_API_KEY=
# Google Sheets 认证通过 OAuth 或服务账号，参考 README
```

---

## 注意事项

- 数据库为 SQLite 文件（`*.db` 已 gitignore），不适合多实例部署
- 分割服务（`PISEG_SERVICE_URL`）为独立外部服务，需单独启动
- `start.sh` 已处理跨设备兼容性（检测已运行的服务、动态端口等）
- macOS 应用包 `Imagen Studio.app` 是双击启动的便捷包装，生产环境同等使用 `start.sh`
