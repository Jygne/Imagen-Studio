# Imagen Studio

AI 驱动的批量商品图生成工作台。

## 功能

- **Local Generate** — 从本地文件夹批量处理生成干净商品图
- **Sheet Generate** — 读取 Google Sheet 行数据驱动批量生成
- **Seg Generate** — 批量分割商品主体并导出 PSD 文件（product + scenebg 双图层）
- **PSD Rename** — 批量规范 PSD 图层命名，支持 text / frame / stickerbg / scenebg 分类
- **Console** — 右上角实时日志面板，查看任务执行详情
- **Runs** — 执行历史记录，支持逐条查看处理结果
- **中/英双语界面** — 右上角一键切换

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 · FastAPI · SQLite · uvicorn |
| 前端 | Next.js 15 · React 19 · TypeScript · Tailwind CSS |
| AI   | OpenAI `gpt-image-1` · OpenRouter (Gemini) |

---

## 快速安装（团队成员）

### 前置要求

| 工具 | 版本 | 安装方式 |
|------|------|----------|
| Python | ≥ 3.11 | https://www.python.org/downloads/ |
| Node.js | ≥ 18 | https://nodejs.org/ |
| Git | 任意 | https://git-scm.com/ |

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

### 4. 配置 API Key（使用 AI 功能时必填）

在应用界面的 **API Keys** 页面填写，或在后端目录创建 `.env` 文件：

```bash
# backend/.env
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
```

### 5. 启动服务

**方式 A — 双击 Imagen Studio.app（仅 macOS，推荐）**

将项目根目录的 `Imagen Studio.app` 拖到桌面，双击即可自动启动后端、前端并打开浏览器。

> 首次运行若提示「无法打开」，前往 **系统设置 → 隐私与安全性 → 仍然允许**。
> 或在终端执行：`xattr -cr ~/Desktop/Imagen Studio.app`

**方式 B — 命令行手动启动**

```bash
# 终端 1：后端
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# 终端 2：前端
cd frontend
npm run dev
```

浏览器访问 → **http://localhost:3000**

---

## 目录结构

```
imagen-studio/
├── Imagen Studio.app/          # macOS 双击启动包
├── backend/
│   ├── app/
│   │   ├── api/routes/  # 各工作流 API 路由
│   │   └── workers/     # 核心处理逻辑
│   ├── .venv/           # 虚拟环境（不进 Git）
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/         # Next.js 页面路由
    │   ├── features/    # 各工作流页面组件
    │   └── shared/      # 公共组件、类型、工具
    └── package.json
```

---

## 常见问题

**Q: 双击 Imagen Studio.app 提示"无法打开"？**
在终端运行：
```bash
xattr -cr ~/Desktop/Imagen Studio.app
```

**Q: 后端报 `No module named 'xxx'`？**
进入 `backend/` 目录，激活虚拟环境后重新运行：
```bash
pip install -r requirements.txt
```

**Q: 前端端口 3000 被占用？**
```bash
lsof -ti:3000 | xargs kill
```

**Q: Google Sheet 功能报错？**
在 **Settings** 页面上传 Google Service Account 的 JSON 凭证文件，并确保该账号有对应 Sheet 的读写权限。
