# Imagen Studio

AI 驱动的批量商品图片处理工作台，面向电商团队与图片处理专业人员。

## 功能模块

| 模块 | 说明 |
|------|------|
| **Local Generate** | 从本地文件夹批量处理，生成干净商品图 |
| **Sheet Generate** | 读取 Google Sheet 行数据驱动批量生成 |
| **Seg Generate** | 批量分割商品主体，导出双图层 PSD（product + scenebg） |
| **PSD Rename** | 批量规范 PSD 图层命名（text / frame / stickerbg / scenebg） |
| **Runs** | 执行历史记录，支持逐条查看处理结果 |
| **Console** | 右上角实时日志面板，查看任务执行详情 |
| **中/英双语界面** | 右上角一键切换 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+ · FastAPI · SQLAlchemy · SQLite · uvicorn |
| 前端 | Next.js 15 · React 19 · TypeScript · Tailwind CSS |
| AI | OpenAI `gpt-image-1.5` · OpenRouter (Gemini) |
| 图片处理 | Pillow · psd-tools |
| 外部集成 | Google Sheets API (gspread) |

---

## 快速安装

### 前置要求

| 工具 | 版本 |
|------|------|
| Python | ≥ 3.11 |
| Node.js | ≥ 18 |
| Git | 任意 |

### 1. 克隆仓库

```bash
git clone https://github.com/Jygne/imagen-studio.git
cd imagen-studio
```

### 2. 后端安装

```bash
cd backend
python3 -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

### 3. 前端安装

```bash
cd ../frontend
npm install
```

### 4. 配置 API Key

在应用界面的 **API Keys** 页面填写，或在 `backend/` 目录下创建 `.env` 文件：

```env
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
PISEG_AUTH_TOKEN=          # 分割服务鉴权（可选）
```

> **Google Sheets 集成**：在 **Settings** 页面上传 Google Service Account 的 JSON 凭证文件，并确保该账号对目标 Sheet 有读写权限。

### 5. 启动服务

```bash
# 终端 1：后端
cd backend
source .venv/bin/activate        # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# 终端 2：前端
cd frontend
npm run dev
```

浏览器访问 → **http://localhost:3000**

> **macOS 桌面应用**：如果项目根目录存在 `Imagen Studio.app`，双击即可自动启动后端与前端。首次运行若提示「无法打开」，执行：
> ```bash
> xattr -cr "~/Desktop/Imagen Studio.app"
> ```

---

## 目录结构

```
imagen-studio/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI 入口，路由注册，CORS 配置
│   │   ├── config.py                # Pydantic-settings 配置管理
│   │   ├── api/routes/              # HTTP 路由层（/api/v1 前缀）
│   │   ├── workers/                 # 核心处理逻辑（异步任务）
│   │   │   ├── executor.py          # 工作流主调度器
│   │   │   ├── seg_worker.py        # 主体分割 worker
│   │   │   ├── psd_rename_worker.py
│   │   │   ├── clean_image_worker.py
│   │   │   ├── selling_point_worker.py
│   │   │   └── psd_builder.py
│   │   ├── infrastructure/
│   │   │   ├── db/                  # SQLAlchemy + SQLite
│   │   │   ├── google_sheet/        # Google Sheets 集成
│   │   │   └── providers/           # AI provider 适配层
│   │   ├── domain/                  # 业务模型与枚举
│   │   └── application/             # 应用用例层（Service）
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/                     # Next.js 文件路由（页面入口）
        ├── features/                # 按功能组织的业务组件
        └── shared/                  # 公共组件、contexts、types、lib
```

---

## 后端 API（前缀 `/api/v1`）

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

---

## 常见问题

**Q: 后端报 `No module named 'xxx'`？**
```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

**Q: 前端端口 3000 被占用？**
```bash
lsof -ti:3000 | xargs kill
```

**Q: Seg Generate 分割服务无响应？**
分割功能依赖外部服务（`PISEG_SERVICE_URL`）。确认服务已启动，并在 `.env` 中配置正确的地址与 `PISEG_AUTH_TOKEN`。

**Q: Google Sheet 功能报错？**
前往 **Settings** 页面上传 Google Service Account JSON 凭证文件，并确认该账号对目标 Sheet 有读写权限。
