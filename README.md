# ComfyUI Remote

移动优先的 ComfyUI 管理后台。在手机或任何浏览器上管理生图项目、批量审核图片、调整参数，并通过 Agent API / MCP 让 AI 直接操控工作流。

文档入口：先读 [`docs/index.md`](docs/index.md)，再按 [`docs/documentation-map.md`](docs/documentation-map.md) 进入维护中的架构、运行手册、API、UI、测试和历史文档。生成的仓库清单在 [`docs/repo-inventory.md`](docs/repo-inventory.md)。

## ✨ 功能亮点

- **Generation 项目管理** — 用 Project、Section、Project Folder、Template、Preset Library 组织批量生图工作流
- **Review 宫格审图** — 在手机上滑动式多选，批量保留 / 删除，支持单张放大、撤销和下一组跳转
- **结果 Gallery / Export** — 小节和项目结果页展示运行图片，支持 p站、预览、封面标记，并导出 kept / pixiv / preview 文件
- **Training 工作流** — LoRA Training 项目、数据集修订、生成任务、训练运行、训练预设和模板由独立 route / feature / service 管理
- **模型文件管理** — `/assets/models` 管理 checkpoints 和 LoRA 文件；`/assets/loras` 是兼容跳转入口
- **参数编辑** — Project / Section / Template 层覆盖 prompt blocks、LoRA、画幅、batch size、双 KSampler 参数
- **Preset Library** — 分类、文件夹、预设、变体、预设组、排序规则、批量替换和 variant sync 流程
- **Comfy runtime / Worker 引擎** — 队列、暂停/恢复、ComfyUI 进程监控、远端 target、输出清理、缩略图和打码任务
- **审计日志 + 修订历史** — 全操作可追溯，区分人工 / AI / 系统，参数修改前自动快照
- **Agent API** — `/api/agent/**` 高层 agent routes 加上完整 `/api/**` 自动化面；精确清单以 [`docs/agent-api.md`](docs/agent-api.md) 为准
- **MCP Server** — `GET/POST/DELETE /api/mcp` Streamable HTTP transport；tool/resource 注册以 [`src/server/mcp/server.ts`](src/server/mcp/server.ts) 为准

## 🏗 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 |
| 后端 | Next.js Route Handlers → Service → Repository 三层架构 |
| 数据库 | **PostgreSQL 16** 或 **SQLite**（可插拔），Prisma 7 ORM |
| Worker | Node claim-based 执行引擎，对接 ComfyUI HTTP API |
| AI 集成 | Agent REST API + MCP Server（`@modelcontextprotocol/sdk`） |
| 图片处理 | sharp（缩略图 / JPG 转换）+ archiver（ZIP 打包） |
| 存储 | 本地 managed images / export 目录 + 外部 `MODEL_BASE_DIR` 模型根目录 |

## 🚀 快速开始

### 前置要求

- Node.js 20+
- ComfyUI 实例运行中（默认 `http://127.0.0.1:8188`）
- 自动打码需要额外 Python 环境，安装 `ultralytics`、`opencv-python` 和 `pillow`，并通过 `AUTO_CENSOR_MODEL_PATH` 指向 YOLO `.pt` 模型
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
| `AUTH_TOKEN` | 生产建议 | — | — | 页面登录和 API header/cookie 认证 token；不要提交真实值 |
| `COMFY_API_URL` | 否 | `http://127.0.0.1:8188` | `http://127.0.0.1:8188` | ComfyUI API 地址 |
| `COMFY_TARGET_CONFIG_PATH` / `COMFY_ACTIVE_TARGET` | 否 | — | `config/comfy-targets.local.json` | 多 ComfyUI target / SSH tunnel 配置；示例见 `config/comfy-targets.example.json` |
| `MODEL_BASE_DIR` | 否 | — | `D:\ComfyUI\models` | ComfyUI 模型根目录，用于推导 `loras` 和 `checkpoints` 子目录 |
| `OUTPUT_BASE_PATH` | 否 | `data/images` | `D:\ComfyUI\output` | 前端/设计壳读取已生成图片时使用的 serving 根目录 |
| `AUTO_CENSOR_MODEL_PATH` | 打码时必填 | — | `D:\Models\auto-censor.pt` | auto-censor YOLO `.pt` 模型绝对路径 |
| `AUTO_CENSOR_PYTHON_CMD` | 否 | `python3` | `D:\venvs\auto-censor\Scripts\python.exe` | 运行 auto-censor runner 的 Python/venv 命令 |
| `LOG_LEVEL` | 否 | `info` | `info` | 日志级别：`debug` / `info` / `warn` / `error` |
| `LOG_FORMAT` | 否 | `pretty` | `pretty` | 输出格式：`pretty` / `json` |
| `LOG_ENABLE_FILE` | 否 | `false` | `false` | 是否写入日志文件 |
| `TRAINING_MANAGER_URL` / `TRAINING_MANAGER_TOKEN` | Training worker 时 | `http://127.0.0.1:3000` | — | 独立 Training worker 调用 Manager API 的地址和 token |

`.env.example` 是环境变量清单；[`docs/local-verification.md`](docs/local-verification.md) 和 [`docs/runbooks/config-runtime-assets.md`](docs/runbooks/config-runtime-assets.md) 是本机验证和运行时路径的维护来源。

### 触发 Worker

Generation Worker 通过 HTTP route / 队列控制触发，设置页的 ComfyUI 监控负责运行态观察和进程控制。Training worker 是独立 Node 进程，使用 `npm run training:workers` 或 `npm run training:workers:mock` 启动。

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

| 入口 | 当前路径 | 功能 |
|------|------|------|
| 首页 | `/` → `/queue` | 根路由直接进入审核队列 |
| 审核队列 | `/queue`, `/queue/:runId` | 待审核 Run 列表、宫格审图、批量保留/废弃、lightbox |
| Generation Projects | `/projects`, `/projects/new`, `/projects/new/from-existing`, `/projects/:projectId/**` | 项目列表、创建、复制、详情、编辑、批量创建、小节编辑和结果页 |
| 模型文件 | `/assets/models` | checkpoints / LoRA 文件浏览、上传、移动、hash、备注；`/assets/loras` 兼容跳转到这里 |
| Preset Library | `/assets/presets/**`, `/assets/preset-groups/:groupId` | 分类、文件夹、预设、变体、预设组、排序规则 |
| Project Templates | `/assets/templates/**` | 模板列表、创建、编辑、模板小节编辑 |
| Settings | `/settings`, `/settings/logs`, `/settings/monitor` | SFW toggle、日志查看、ComfyUI 监控和启停控制 |
| Training | `/training/**` | Training runs、projects、dataset、generation tasks、training presets、training templates |
| Design demos | `/design-demos/**` | 路由化设计壳和组件实验室；不是生产路由真相 |
| Auth | `/login` | token 登录页 |

## 🤖 AI 集成

### Agent REST API

Agent 使用两层 HTTP 面：

- `/api/agent/**`：项目/运行上下文、批量更新、run-all、section run、review、preset variant switch/sync 等高层工作流。
- `/api/**`：projects、project folders、sections、queue、images、preset library、models、templates、training、worker、logs、MCP 等完整 route surface。

精确端点、请求体和响应约定详见 [`docs/agent-api.md`](docs/agent-api.md)。不要把 README 当作 API contract。

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

当前 MCP tools/resources 由 [`src/server/mcp/server.ts`](src/server/mcp/server.ts) 注册，并在 [`docs/agent-api.md`](docs/agent-api.md) 的 MCP section 维护。它们覆盖 project listing/update/run、run review、prompt blocks 和 `comfyui://` context resources。

## 🔧 Workflow 模板系统

当前标准 ComfyUI API workflow 由 [`docs/workflow.api.json`](docs/workflow.api.json) 和 `src/server/services/workflow-prompt-builder.ts` 维护。

- `docs/workflow.api.json` 是默认 SDXL/HiRes graph contract。
- `src/server/services/workflow-prompt-builder.ts` 根据 project/section 参数填充 prompt、negative prompt、LoRA、尺寸、batch 和双 KSampler。
- `GET /api/runs/:runId/workflow` 可下载提交给 ComfyUI 的 workflow，debug variant 由 `workflow-debug-download` 生成。
- Workflow 行为的当前说明在 [`docs/worker-boundaries.md`](docs/worker-boundaries.md)、[`docs/workflow.api.json`](docs/workflow.api.json) 和 [`docs/agent-api.md`](docs/agent-api.md)。

## 📁 项目结构

```
comfyui-remote/
├── config/                     # 配置文件
│   ├── comfy-targets.example.json # ComfyUI target / SSH tunnel 示例
│   └── path-maps.json             # 路径映射
├── data/                       # 运行时数据（git ignored）
│   ├── images/                 #   管理的图片文件
│   ├── export/                 #   图片整合导出输出
│   └── loras/                  #   本地示例/临时 LoRA 运行数据；生产模型根目录由 MODEL_BASE_DIR 指定
├── docs/                       # 文档
│   ├── index.md                #   read-first 文档入口
│   ├── documentation-map.md    #   维护层级和历史/当前文档映射
│   ├── repo-inventory.md       #   生成的全仓库治理清单
│   ├── architecture/           #   当前模块边界、数据流、队列/Worker 语义
│   ├── runbooks/               #   本地开发、部署、认证、ComfyUI、事故排查
│   ├── api/                    #   Agent API、MCP、路由契约、workflow schema
│   ├── ui/                     #   设计系统、页面模式、shell/navigation 规则
│   ├── testing/                #   测试分组、fixture、DB bootstrap、验证矩阵
│   └── archive/                #   已归档计划、旧 PRD、superseded handoff、旧静态 demo
├── prisma/                     # 数据库 schema + migration（PostgreSQL / SQLite）
│   ├── schema.prisma           #   PostgreSQL schema
│   ├── schema.sqlite.prisma    #   SQLite schema
│   └── migrate-presets.ts      #   旧数据迁移脚本（Character/Scene/Style → PromptPreset）
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── assets/ projects/ queue/ settings/ training/ design-demos/
│   │   └── api/                #   route handlers for app, agent, training, MCP, worker, assets
│   ├── components/             # 通用 UI 组件
│   │   ├── lora-cascade-picker.tsx  # LoRA 级联目录选择器
│   │   ├── lora-list-editor.tsx     # LoRA 列表编辑器
│   │   ├── section-editor.tsx       # 小节编辑器（blocks + LoRA）
│   │   └── ...
│   ├── lib/                    # 共享工具
│   │   ├── actions.ts          #   compatibility barrel
│   │   ├── actions/            #   Server Actions by domain
│   │   ├── server-data.ts      #   RSC / route data loaders
│   │   ├── lora-types.ts       #   LoRA / KSampler 类型定义
│   │   └── types.ts            #   通用类型定义
│   ├── server/
│   │   ├── services/           #   业务服务、Comfy/worker/training orchestration、校验
│   │   ├── repositories/       #   数据库访问和资源边界
│   │   ├── worker/             #   Worker 执行引擎
│   │   └── mcp/                #   MCP Server
│   └── scripts/                # Seed / helper scripts
├── scripts/                    # Repo maintenance, quality, DB, training worker scripts
└── docker-compose.yml          # PostgreSQL
```

### 两套数据访问路径

1. **Server Actions / RSC loaders**（`src/lib/actions/**`, `src/lib/server-data.ts`, route-local loaders）— production UI 内部调用。
2. **REST API**（`src/app/api/**` → `src/server/services/**` → `src/server/repositories/**` → `prisma`）— 外部、Agent、worker、Training 和 UI client mutation 的 HTTP surface。
3. **MCP**（`/api/mcp` → `src/server/mcp/server.ts`）— MCP clients 通过 tools/resources 复用 agent-facing services。

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
| [`docs/index.md`](docs/index.md) | Agent read-first 入口，按需求指向当前文档 |
| [`docs/documentation-map.md`](docs/documentation-map.md) | 当前/历史/生成文档分类和目标目录层级 |
| [`docs/repo-inventory.md`](docs/repo-inventory.md) | 由脚本生成的全仓库文件治理清单 |
| [`docs/agent-api.md`](docs/agent-api.md) | Agent API + MCP Server 完整使用说明 |
| [`docs/local-verification.md`](docs/local-verification.md) | 本机端到端验证：seed → create project → enqueue → worker → output |
| [`DESIGN.md`](DESIGN.md) | 当前 UI 方向和设计系统约束 |

## License

Private — 仅限个人使用。
