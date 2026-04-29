# ComfyUI Remote

移动优先的 ComfyUI 管理后台。在手机或任何浏览器上管理生图项目、批量审核图片、调整参数，并通过 Agent API / MCP 让 AI 直接操控工作流。

## ✨ 功能亮点

- **项目管理** — 用统一分类系统（PresetCategory × Preset）组合创建批量生图项目
- **宫格审图** — 在手机上滑动式多选，批量保留 / 删除，支持单张放大；操作后一键处理剩余并跳转下一组
- **结果 Gallery** — 独立结果页展示小节所有运行图片，Lightbox 放大查看，支持精选标记（⭐）
- **图片整合导出** — 一键将已保留图片转 JPG 打包 zip，精选图片单独输出到 pixiv/ 目录
- **回收站** — 误删随时恢复，文件级 trash / restore
- **参数编辑** — Project 级和 Section 级覆盖：prompt、LoRA、画幅、batch size、双 KSampler 参数
- **LoRA 文件管理** — 磁盘目录浏览、上传、跨目录移动、备注；级联选择器替代传统下拉
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
| 图片处理 | sharp（缩略图 / JPG 转换）+ archiver（ZIP 打包） |
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

### 环境变量

| 变量 | 必填 | 默认值 | Windows 示例 | 说明 |
|------|------|--------|-------------|------|
| `DB_PROVIDER` | 否 | `postgresql` | `sqlite` | 数据库类型：`postgresql` / `sqlite` |
| `DATABASE_URL` | 是 | — | `file:./data/comfyui.db` | 数据库连接字符串 |
| `COMFY_API_URL` | 否 | `http://127.0.0.1:8188` | `http://127.0.0.1:8188` | ComfyUI API 地址 |
| `IMAGE_BASE_DIR` | 否 | — | `D:\ComfyUI\output` | ComfyUI 的默认输出目录。Worker 会从此目录本地复制生成的图片到 `data/images/`；不填则通过 HTTP 下载 |
| `MODEL_BASE_DIR` | 否 | — | `D:\ComfyUI\models` | ComfyUI 模型根目录，用于推导 `loras` 和 `checkpoints` 子目录 |
| `LOG_LEVEL` | 否 | `info` | `info` | 日志级别：`debug` / `info` / `warn` / `error` |
| `LOG_FORMAT` | 否 | `pretty` | `pretty` | 输出格式：`pretty` / `json` |
| `LOG_ENABLE_FILE` | 否 | `false` | `false` | 是否写入日志文件 |

### 触发 Worker

Worker 不是长驻进程，需要通过 HTTP 调用触发。推荐使用 Worker 自动轮询模式（在设置页开启），或通过 Agent API 触发运行。

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
| 宫格审图 | `/queue/:runId` | 多选 + 批量保留 / 删除 + 处理剩余跳转下一组 |
| Project 列表 | `/projects` | 创建 / 编辑 / 复制 / 运行 |
| 创建 Project | `/projects/new` | 选择各提示词分类的预设模板 |
| Project 详情 | `/projects/:projectId` | Section 列表 + 缩略图条 + 运行 + 图片整合导出 |
| Project 编辑 | `/projects/:projectId/edit` | 参数编辑表单 |
| Section 编辑 | `/projects/:projectId/sections/:sectionId` | 运行参数 + Prompt Block + LoRA 编辑 |
| 结果 Gallery | `/projects/:projectId/sections/:sectionId/results` | 全部运行结果 + Lightbox + 精选标记 |
| 回收站 | `/trash` | 已删除图片 + 恢复按钮 |
| LoRA 管理 | `/assets/loras` | 文件管理器：浏览 / 上传 / 移动 / 备注 |
| 提示词管理 | `/assets/prompts` | 提示词分类与预设管理 |
| 设置首页 | `/settings` | 各管理入口 |
| 模板管理 | `/settings/templates` | 项目模板列表 + 创建 / 编辑 |
| Workflow 管理 | `/settings/workflows` | 模板列表 + 从 ComfyUI JSON 导入 |

## 🤖 AI 集成

### Agent REST API

7 个专为 AI Agent 设计的端点，详见 [`docs/agent-api.md`](docs/agent-api.md)：

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/agent/projects` | 列出 Project（搜索 / 状态筛选） |
| GET | `/api/agent/projects/:id/context` | 获取 Project 完整上下文 |
| POST | `/api/agent/projects/:id/update` | 修改 Project 参数 |
| POST | `/api/agent/projects/:id/run-all` | 触发所有 enabled Section |
| POST | `/api/agent/sections/:id/run` | 触发单个 Section |
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

**11 个 Tools**：`list_projects` · `update_project` · `update_project_section` · `run_all_sections` · `run_section` · `review_images` · `list_section_blocks` · `add_section_block` · `update_section_block` · `remove_section_block` · `reorder_section_blocks`

**6 个 Resources**（`comfyui://` URI scheme）：Project 上下文 · Run 上下文 · Workflow 模板列表 / 详情 · 修订历史列表 / 快照

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
├── data/                       # 运行时数据（git ignored）
│   ├── images/                 #   管理的图片文件
│   ├── export/                 #   图片整合导出输出
│   └── models/                 #   模型文件（由 MODEL_BASE_DIR 指定，包含 loras/ 和 checkpoints/）
├── docs/                       # 文档
│   ├── design-v0.1.md          #   产品与架构设计
│   ├── design-v0.3-*.md        #   v0.3 Workflow 集成设计
│   ├── handoff.md              #   接手文档 / 当前状态
│   ├── agent-api.md            #   Agent API 完整说明
│   ├── development-todo.md     #   开发进度记录
│   ├── development-progress.md #   项目总览 + 版本历史
│   └── local-verification.md   #   本机链路验证指南
├── prisma/                     # 数据库 schema + migration（含 PromptCategory / PromptPreset 模型）
│   ├── schema.prisma           #   PostgreSQL schema
│   ├── schema.sqlite.prisma    #   SQLite schema
│   └── migrate-presets.ts      #   旧数据迁移脚本（Character/Scene/Style → PromptPreset）
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (pages)             #   20+ 个页面
│   │   └── api/                #   50+ 个 API 路由
│   ├── components/             # 通用 UI 组件
│   │   ├── lora-cascade-picker.tsx  # LoRA 级联目录选择器
│   │   ├── lora-list-editor.tsx     # LoRA 列表编辑器
│   │   ├── section-editor.tsx       # 小节编辑器（blocks + LoRA）
│   │   └── ...
│   ├── lib/                    # 共享工具
│   │   ├── actions.ts          #   Server Actions
│   │   ├── server-data.ts      #   数据查询函数
│   │   ├── lora-types.ts       #   LoRA / KSampler 类型定义
│   │   └── types.ts            #   通用类型定义
│   ├── server/
│   │   ├── services/           #   10+ 个 Service（业务逻辑 + 校验）
│   │   ├── repositories/       #   5 个 Repository（数据库访问）
│   │   ├── worker/             #   Worker 执行引擎
│   │   └── mcp/                #   MCP Server
│   └── scripts/                # Seed 脚本
└── docker-compose.yml          # PostgreSQL
```

### 两套数据访问路径

1. **Server Actions**（`actions.ts` + `server-data.ts`）— 前端 RSC 直接调用，简单快速
2. **REST API**（`api/` → `services/` → `repositories/`）— 完整输入校验，供外部 / Agent 调用

### 图片生命周期

```
ComfyUI 输出 → Worker 复制到 data/images/{project}/{section}/run-{N}/raw/
→ 生成缩略图 thumb/ → 创建 ImageResult（pending）
→ 审核：kept / trashed → 精选标记：featured
→ 导出：kept→zip, featured→pixiv/
```

## 📖 文档

| 文档 | 内容 |
|------|------|
| [`docs/design-v0.1.md`](docs/design-v0.1.md) | 产品设计、数据模型、页面规划、API 初稿 |
| [`docs/design-v0.3-workflow-integration.md`](docs/design-v0.3-workflow-integration.md) | v0.3 Workflow 集成设计（LoRA 分区、KSampler、填充器） |
| [`docs/handoff.md`](docs/handoff.md) | 代码组织、架构特点、完成度清单、接手指南 |
| [`docs/agent-api.md`](docs/agent-api.md) | Agent API + MCP Server 完整使用说明 |
| [`docs/local-verification.md`](docs/local-verification.md) | 本机端到端验证：seed → create project → enqueue → worker → output |
| [`docs/development-todo.md`](docs/development-todo.md) | 开发进度与历史 |
| [`docs/development-progress.md`](docs/development-progress.md) | 项目总览 + 页面/API 清单 + 版本历史 |

## License

Private — 仅限个人使用。
