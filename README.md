# ComfyUI Remote

移动优先的 ComfyUI 管理后台。在手机或任何浏览器上管理生图任务、批量审核图片、调整参数，并通过 Agent API / MCP 让 AI 直接操控工作流。

## ✨ 功能亮点

- **大任务管理** — 用 Character × Scene × Style × Position 组合创建批量生图任务
- **宫格审图** — 在手机上滑动式多选，批量保留 / 删除，支持单张放大
- **回收站** — 误删随时恢复，文件级 trash / restore
- **参数编辑** — Job 级和 Position 级覆盖：prompt、LoRA、画幅、batch size、seed 策略
- **Workflow 模板** — 内置 SDXL txt2img / HiRes Fix，支持从 ComfyUI 导出 JSON 一键导入自定义模板
- **Worker 引擎** — 自动消费队列、调用 ComfyUI API、下载输出、生成缩略图
- **审计日志 + 修订历史** — 全操作可追溯，区分人工 / AI / 系统，参数修改前自动快照
- **Agent API** — 7 个 REST 端点，AI 可读取上下文、修改参数、触发运行、批量审图
- **MCP Server** — 内置 Model Context Protocol 服务，Claude Desktop / Cursor 等直连使用

## 🏗 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 |
| 后端 | Next.js Route Handlers → Service → Repository 三层架构 |
| 数据库 | **PostgreSQL 16** 或 **SQLite**（可插拔），Prisma 7 ORM |
| Worker | Node claim-based 执行引擎，对接 ComfyUI HTTP API |
| AI 集成 | Agent REST API + MCP Server（`@modelcontextprotocol/sdk`） |
| 存储 | 本地文件系统（图片 / LoRA / Workflow 模板） |

## 🚀 快速开始

### 前置要求

- Node.js 20+
- ComfyUI 实例运行中（默认 `http://127.0.0.1:8188`）
- **方案 A**：Docker（用于 PostgreSQL）
- **方案 B**：无需 Docker，使用 SQLite（零依赖、数据存在本地文件）

### 方案 A — PostgreSQL（推荐用于生产）

```bash
# 1. 克隆仓库
git clone <repo-url> && cd comfyui-remote

# 2. 启动 PostgreSQL
docker compose up -d

# 3. 安装依赖
npm install

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 ComfyUI 地址、文件路径等
# DB_PROVIDER 保持默认 "postgresql" 即可

# 5. 初始化数据库（migration + seed）
npm run db:bootstrap

# 6. 启动开发服务器
npm run dev
```

### 方案 B — SQLite（轻量、免 Docker）

```bash
# 1. 克隆仓库
git clone <repo-url> && cd comfyui-remote

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，设置：
#   DB_PROVIDER="sqlite"
#   DATABASE_URL="file:./data/comfyui.db"

# 4. 初始化数据库（migration + seed）
npm run db:bootstrap:sqlite

# 5. 启动开发服务器
DB_PROVIDER=sqlite DATABASE_URL="file:./data/comfyui.db" npm run dev
```

打开 `http://localhost:3000` 即可使用。

### 触发 Worker

Worker 不是长驻进程，需要通过 HTTP 调用触发：

```bash
# 方式一：localhost 专用端点
curl -X POST "http://localhost:3000/api/local/worker/pass?limit=1"

# 方式二：通用端点（同样有 localhost 安全检查）
curl -X POST "http://localhost:3000/api/worker/process"
```

Worker 会 claim 队列中的 Run → 向 ComfyUI 提交 prompt → 轮询结果 → 下载图片 → 生成缩略图 → 落库。

### 数据库命令

```bash
# PostgreSQL（默认）
npm run prisma:generate   # 生成 Prisma Client
npm run prisma:migrate    # 运行 migration
npm run db:seed           # 写入示例数据
npm run db:bootstrap      # migrate + seed（初始化推荐）
npm run prisma:studio     # 打开 Prisma Studio 数据浏览器

# SQLite（一键初始化）
npm run db:bootstrap:sqlite
```

## 📱 页面一览

| 页面 | 路径 | 功能 |
|------|------|------|
| 审核队列 | `/queue` | 待审核 Run 列表，按时间倒序 |
| 宫格审图 | `/queue/:runId` | 多选 + 批量保留 / 删除 |
| 单张查看 | `/queue/:runId/images/:imageId` | 大图 + 左右切换 + 元数据 |
| Job 列表 | `/jobs` | 创建 / 编辑 / 复制 / 运行 |
| 创建 Job | `/jobs/new` | 选择 Character / Scene / Style，勾选 Position |
| Job 详情 | `/jobs/:jobId` | Position 列表 + 运行状态 + 修订历史 |
| Job 编辑 | `/jobs/:jobId/edit` | 参数编辑表单 |
| Position 编辑 | `/jobs/:jobId/positions/:positionId/edit` | Position 级参数覆盖 |
| 回收站 | `/trash` | 已删除图片 + 恢复按钮 |
| LoRA 资源 | `/assets/loras` | 上传 + 列表 + 路径管理 |
| 设置首页 | `/settings` | 各管理入口 |
| Character 管理 | `/settings/characters` | CRUD |
| Scene 管理 | `/settings/scenes` | CRUD |
| Style 管理 | `/settings/styles` | CRUD |
| Position 模板 | `/settings/positions` | CRUD + Workflow 模板关联 |
| Workflow 管理 | `/settings/workflows` | 模板列表 + 从 ComfyUI JSON 导入 |

## 🤖 AI 集成

### Agent REST API

7 个专为 AI Agent 设计的端点，详见 [`docs/agent-api.md`](docs/agent-api.md)：

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/agent/jobs` | 列出 Job（搜索 / 状态筛选） |
| GET | `/api/agent/jobs/:id/context` | 获取 Job 完整上下文 |
| POST | `/api/agent/jobs/:id/update` | 修改 Job 参数 |
| POST | `/api/agent/jobs/:id/run-all` | 触发所有 enabled Position |
| POST | `/api/agent/positions/:id/run` | 触发单个 Position |
| GET | `/api/agent/runs/:id/context` | 获取 Run 结果上下文 |
| POST | `/api/agent/runs/:id/review` | 批量审核图片 |

### MCP Server

内置 [Model Context Protocol](https://modelcontextprotocol.io) 服务，端点 `POST /api/mcp`（Streamable HTTP transport）。

**配置方法** — 在 Claude Desktop / Cursor 等 MCP 客户端中添加：

```json
{
  "mcpServers": {
    "comfyui-remote": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

**6 个 Tools**：`list_jobs` · `update_job` · `update_job_position` · `run_all_positions` · `run_position` · `review_images`

**6 个 Resources**（`comfyui://` URI scheme）：Job 上下文 · Run 上下文 · Workflow 模板列表 / 详情 · 修订历史列表 / 快照

## 🔧 Workflow 模板系统

模板文件位于 `config/workflows/*.json`，包含元数据 + 变量定义 + ComfyUI 节点图。

- 内置模板：`sdxl-txt2img`（基础 SDXL）、`sdxl-txt2img-hires`（HiRes Fix）
- 支持 `{{variable}}` 占位符，Worker 执行时自动替换
- Prompt 解析优先级：自定义 comfyPrompt > workflowTemplateId > 内置 SDXL fallback
- 导入：在 `/settings/workflows` 页面粘贴或上传 ComfyUI「Save (API Format)」导出的 JSON，系统自动识别可参数化字段

## 📁 项目结构

```
comfyui-remote/
├── config/                     # 配置文件
│   ├── path-maps.json          #   LoRA 分类 → 目录映射
│   └── workflows/*.json        #   Workflow 模板
├── docs/                       # 文档
│   ├── design-v0.1.md          #   产品与架构设计
│   ├── handoff.md              #   接手文档 / 当前状态
│   ├── agent-api.md            #   Agent API 完整说明
│   ├── development-todo.md     #   开发进度记录
│   └── local-verification.md   #   本机链路验证指南
├── prisma/                     # 数据库 schema + migration
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (pages)             #   17 个页面
│   │   └── api/                #   34 个 API 路由
│   ├── components/             # 通用 UI 组件
│   ├── lib/                    # 共享工具
│   │   ├── actions.ts          #   Server Actions
│   │   ├── server-data.ts      #   数据查询函数
│   │   └── types.ts            #   类型定义
│   ├── server/
│   │   ├── services/           #   10 个 Service（业务逻辑 + 校验）
│   │   ├── repositories/       #   5 个 Repository（数据库访问）
│   │   ├── worker/             #   Worker 执行引擎
│   │   └── mcp/                #   MCP Server
│   └── scripts/                # Seed 脚本
└── docker-compose.yml          # PostgreSQL
```

### 两套数据访问路径

1. **Server Actions**（`actions.ts` + `server-data.ts`）— 前端 RSC 直接调用，简单快速
2. **REST API**（`api/` → `services/` → `repositories/`）— 完整输入校验，供外部 / Agent 调用

## 📖 文档

| 文档 | 内容 |
|------|------|
| [`docs/design-v0.1.md`](docs/design-v0.1.md) | 产品设计、数据模型、页面规划、API 初稿 |
| [`docs/handoff.md`](docs/handoff.md) | 代码组织、架构特点、完成度清单、接手指南 |
| [`docs/agent-api.md`](docs/agent-api.md) | Agent API + MCP Server 完整使用说明 |
| [`docs/local-verification.md`](docs/local-verification.md) | 本机端到端验证：seed → create job → enqueue → worker → output |
| [`docs/development-todo.md`](docs/development-todo.md) | 开发进度与历史 |

## License

Private — 仅限个人使用。
