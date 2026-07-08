# ComfyUI Remote

分类：当前文档
更新触发：产品入口、功能概览、启动路径、页面/API 概览、项目结构或文档入口变化。

移动优先的 ComfyUI 管理后台。在手机或任何浏览器上管理生图项目、批量审核图片、调整参数，并通过 Agent API / MCP 让智能体直接操控工作流。

文档入口：先读 [`docs/index.md`](docs/index.md)，再按 [`docs/documentation-map.md`](docs/documentation-map.md) 进入维护中的架构、运行手册、API、UI、测试和历史文档。生成的仓库清单在 [`docs/repo-inventory.md`](docs/repo-inventory.md)。

## 功能亮点

- **生图项目管理**：用 Project（项目）、Section（小节）、Project Folder（项目文件夹）、Template（模板）、Preset Library（预设库）组织批量生图工作流。
- **宫格审图**：在手机上滑动式多选，批量保留或废弃，支持单张放大、撤销和下一组跳转。
- **结果图库 / 导出**：项目和小节结果页展示运行图片，支持 p站、预览、封面标记，并导出 kept、pixiv、preview 文件。
- **训练工作流**：LoRA 训练项目、数据集修订、生成任务、训练运行、训练预设和模板由独立路由、功能模块、服务管理。
- **模型文件管理**：`/assets/models` 管理 checkpoints 和 LoRA 文件；`/assets/loras` 是兼容跳转入口。
- **参数编辑**：Project、Section、Template 层覆盖提示词块、LoRA、画幅、批量大小、双 KSampler 参数。
- **Preset Library**：分类、文件夹、预设、变体、预设组、排序规则、批量替换和变体同步流程。
- **Comfy 运行态 / Worker 引擎**：队列、暂停/恢复、ComfyUI 进程监控、远端 target、输出清理、缩略图和打码任务。
- **审计日志 + 修订历史**：全操作可追溯，区分人工、智能体、系统，参数修改前自动快照。
- **Agent API**：`/api/agent/**` 高层智能体路由加上完整 `/api/**` 自动化接口面；精确契约见 [`docs/agent-api.md`](docs/agent-api.md)。
- **MCP 服务**：`GET/POST/DELETE /api/mcp` Streamable HTTP 传输；工具和资源注册以 [`src/server/mcp/server.ts`](src/server/mcp/server.ts) 为准。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16 App Router、React 19、Tailwind CSS 4 |
| 后端 | Next.js Route Handlers、Service、Repository 三层架构 |
| 数据库 | PostgreSQL 16 或 SQLite，Prisma 7 ORM |
| Worker | Node claim-based 执行引擎，对接 ComfyUI HTTP API |
| 智能体集成 | Agent REST API、MCP Server（`@modelcontextprotocol/sdk`） |
| 图片处理 | `sharp` 生成缩略图和 JPG，`archiver` 打包 ZIP |
| 存储 | 本地托管图片、导出目录，以及外部 `MODEL_BASE_DIR` 模型根目录 |

## 快速开始

### 前置要求

- Node.js 20+
- ComfyUI 实例运行中，默认地址是 `http://127.0.0.1:8188`
- 使用 Docker 提供 PostgreSQL，或使用 SQLite 做轻量本地环境
- 自动打码需要额外 Python 环境，安装 `ultralytics`、`opencv-python` 和 `pillow`，并通过 `AUTO_CENSOR_MODEL_PATH` 指向 YOLO `.pt` 模型

### 方案 A：PostgreSQL

```bash
git clone <repo-url> && cd comfyui-remote
cp .env.example .env
npm install
docker compose up -d
npm run db:bootstrap
npm run dev
```

### 方案 B：SQLite

```bash
git clone <repo-url> && cd comfyui-remote
cp .env.example .env
npm install
DB_PROVIDER=sqlite DATABASE_URL="file:./data/comfyui.db" npm run db:bootstrap:sqlite
DB_PROVIDER=sqlite DATABASE_URL="file:./data/comfyui.db" npm run dev
```

开发服务启动后打开 `http://localhost:3000`。认证、受保护页面、ComfyUI 连通性、开发服务与生产服务边界、验证命令，请看 [`docs/local-verification.md`](docs/local-verification.md)。

### 关键环境变量

完整清单以 [`.env.example`](.env.example) 为准；运行时读取逻辑在 [`src/lib/env.ts`](src/lib/env.ts)。

| 变量 | 必填 | 默认值 | Windows 示例 | 说明 |
| --- | --- | --- | --- | --- |
| `DB_PROVIDER` | 否 | `postgresql` | `sqlite` | 数据库类型：`postgresql` 或 `sqlite`。 |
| `DATABASE_URL` | 是 | 无 | `file:./data/comfyui.db` | 数据库连接字符串。 |
| `AUTH_TOKEN` | 生产建议 | 无 | 无 | 页面登录和 API header/cookie 认证 token；不要提交真实值。 |
| `COMFY_API_URL` | 否 | `http://127.0.0.1:8188` | `http://127.0.0.1:8188` | ComfyUI API 地址；配置 target 时作为本地回退地址。 |
| `COMFY_TARGET_CONFIG_PATH` / `COMFY_ACTIVE_TARGET` | 否 | 空 | `config/comfy-targets.local.json` | 多 ComfyUI target / SSH tunnel 配置；示例见 [`config/comfy-targets.example.json`](config/comfy-targets.example.json)。 |
| `COMFY_SSH_TUNNEL_AUTO_START` | 否 | `true` | `true` | SSH target 是否自动启动本地 tunnel。 |
| `MODEL_BASE_DIR` | 上传/浏览模型时需要 | 空 | `D:\ComfyUI\models` | ComfyUI 模型根目录，用于推导 `loras` 和 `checkpoints` 子目录。 |
| `OUTPUT_BASE_PATH` | 否 | `data/images` | `D:\ComfyUI\output` | 前端或设计壳读取已生成图片时使用的访问根目录。 |
| `AUTO_CENSOR_MODEL_PATH` | 打码时必填 | 空 | `D:\Models\auto-censor.pt` | auto-censor YOLO `.pt` 模型绝对路径。 |
| `AUTO_CENSOR_PYTHON_CMD` | 打码时建议显式配置 | 空 | `D:\venvs\auto-censor\Scripts\python.exe` | 运行 auto-censor runner 的 Python/venv 命令；当前源码默认空字符串。 |
| `AUTO_CENSOR_BATCH_SIZE` | 否 | `64` | `64` | 自动打码每批交给 Python/YOLO 的图片数量。 |
| `NEXT_PUBLIC_APP_URL` | 否 | `http://localhost:3000` | 无 | Server Action 内部调用使用的应用地址。 |
| `COMFY_LAUNCH_CMD` / `COMFY_LAUNCH_CWD` | 进程管理时需要 | 空 | `conda run -n comfyui python main.py --listen` | 设置页 ComfyUI 进程管理使用的启动命令和工作目录。 |
| `TRAINING_MANAGER_URL` / `TRAINING_MANAGER_API_NAMESPACE` | 训练 worker 时需要 | `http://127.0.0.1:3000` / `training` | 无 | 独立训练 worker 调用 Manager API 的地址和命名空间。 |
| `TRAINING_IMAGE_WORKER_CONFIG_PATH` / `TRAINING_WORKER_QUEUE_CONFIG_PATH` | Codex 图像 worker 时需要 | 本地配置路径 | 无 | 训练图像生成和 worker 队列配置文件路径；本地文件不要提交。 |
| `CODEX_IMAGE_AUTH_FILE` / `CODEX_BASE_URL` / `CODEX_HOST_MODEL` | Codex 图像 worker 时需要 | 见 `.env.example` | `C:/Users/your-name/.codex/auth.json` | Codex 图像生成桥接配置，使用 auth-file 指针，不在 `.env` 写明文 token。 |
| `TRAINING_RUNNER_COMMAND` | 真实训练时需要 | 空 | `path/to/run_manager_training.cmd` | 外部 LoRA 训练 runner 命令或脚本路径。 |

### 常用命令

```bash
npm run dev                     # 启动本地开发服务
npm run build                   # 构建生产应用
npm run start                   # 启动已构建的生产应用
npm run test                    # 运行仓库测试
npm run lint                    # 运行 ESLint
npm run db:bootstrap            # PostgreSQL 初始化：migration + seed
npm run db:bootstrap:sqlite     # SQLite 初始化：generate + migration + seed
npm run prisma:studio           # 打开 Prisma Studio
npm run training:workers        # 启动真实训练 worker
npm run training:workers:mock   # 启动本地模拟训练 worker
```

## 页面一览

当前源码里有 28 个 `page.tsx` 页面入口。

| 区域 | 路径 | 功能 |
| --- | --- | --- |
| 首页 | `/` | 根路由入口，目前进入队列工作流。 |
| 认证 | `/login` | token 登录页。 |
| 审核队列 | `/queue`, `/queue/:runId` | 待审核 Run 列表、宫格审图、批量保留/废弃、放大查看。 |
| 生图项目 | `/projects`, `/projects/new`, `/projects/new/from-existing`, `/projects/:projectId`, `/projects/:projectId/edit`, `/projects/:projectId/batch-create` | 项目列表、创建、复制、详情、编辑、批量创建。 |
| 生图结果 | `/projects/:projectId/results`, `/projects/:projectId/sections/:sectionId`, `/projects/:projectId/sections/:sectionId/results` | 项目结果、小节编辑、小节结果页。 |
| 模型文件 | `/assets/models`, `/assets/loras` | checkpoints / LoRA 文件浏览、上传、移动、hash、备注；`/assets/loras` 是兼容入口。 |
| Preset Library | `/assets/presets`, `/assets/presets/:presetId`, `/assets/presets/sort-rules`, `/assets/preset-groups/:groupId` | 分类、文件夹、预设、变体、预设组、排序规则。 |
| Project Templates | `/assets/templates`, `/assets/templates/new`, `/assets/templates/:templateId/edit`, `/assets/templates/:templateId/sections/:sectionIndex` | 模板列表、创建、编辑、模板小节编辑。 |
| 设置 | `/settings`, `/settings/logs`, `/settings/monitor` | SFW 开关、日志查看、ComfyUI 监控和启停控制。 |
| 训练 | `/training/:route*` | 训练运行、训练项目、数据集、生成任务、训练预设、训练模板。 |
| 设计演示 | `/design-demos/:route*` | 路由化设计壳和组件实验室；不是生产路由事实来源。 |

## API 与智能体集成

### 当前 HTTP 接口面

当前源码里有 194 个 `src/app/api/**/route.ts` 路由文件，导出 261 个 HTTP 方法入口。按主要区域粗分如下：

| 区域 | HTTP 方法入口数 | 说明 |
| --- | ---: | --- |
| `/api/agent/**` | 10 | 面向智能体的高层项目、运行、审图和预设变体工作流。 |
| `/api/training/**` | 116 | 训练项目、数据集、生成任务、训练运行、模板、worker 和调度器。 |
| `/api/preset-library/**` | 38 | Preset 分类、文件夹、预设、变体、预设组和排序。 |
| `/api/projects/**` / `/api/project-*` | 38 | 生图项目、文件夹、小节、运行、导出、模板化和归档。 |
| `/api/queue/**` / `/api/queue-data` | 6 | 队列列表、清理、暂停、恢复。 |
| `/api/images/**` / `/api/image-review` | 7 | 图片读取、审核、恢复、封面、p站、预览和手动打码。 |
| `/api/models/**` / `/api/loras/**` / `/api/path-maps` / `/api/presets` | 15 | 模型、LoRA、路径映射和 preset 查询。 |
| `/api/comfy/**` / `/api/worker/status` | 6 | ComfyUI 进程和 worker 状态。 |
| 其他 | 25 | 认证、健康检查、日志、审计日志、模板、运行记录、MCP 等。 |

精确端点、请求体、响应格式和认证约定见 [`docs/agent-api.md`](docs/agent-api.md)。README 保留概览，具体契约由 API 文档和路由处理器维护。

### Agent REST API

`/api/agent/**` 当前有 10 个 HTTP 方法入口：

| 方法 | 端点 | 功能 |
| --- | --- | --- |
| `GET` | `/api/agent/projects` | 列出 Project，支持搜索、状态和待审核过滤。 |
| `GET` | `/api/agent/projects/:projectId/context` | 获取 Project 完整上下文。 |
| `POST` | `/api/agent/projects/:projectId/update` | 修改 Project 参数。 |
| `POST` | `/api/agent/projects/:projectId/run-all` | 触发所有启用的小节。 |
| `POST` | `/api/agent/projects/:projectId/switch-variants` | 批量切换小节绑定变体。 |
| `POST` | `/api/agent/projects/:projectId/sync-preset-variants` | 从参考项目同步预设变体。 |
| `POST` | `/api/agent/projects/sync-preset-variant-flow` | 按标题查找项目并执行安全的预设变体同步流程。 |
| `POST` | `/api/agent/sections/:sectionId/run` | 触发单个 Section。 |
| `GET` | `/api/agent/runs/:runId/context` | 获取 Run 结果上下文。 |
| `POST` | `/api/agent/runs/:runId/review` | 批量审核图片。 |

### MCP 服务

内置 [Model Context Protocol](https://modelcontextprotocol.io) 服务，端点是 `GET/POST/DELETE /api/mcp`，传输方式是 Streamable HTTP。

客户端配置示例：

```json
{
  "mcpServers": {
    "comfyui-remote": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

当前 MCP 注册 11 个 tools：

`list_projects`、`update_project`、`update_project_section`、`run_all_sections`、`run_section`、`review_images`、`list_prompt_blocks`、`add_prompt_block`、`update_prompt_block`、`remove_prompt_block`、`reorder_prompt_blocks`

当前 MCP 注册 3 个 resources：

`comfyui://projects/{projectId}/context`、`comfyui://runs/{runId}/context`、`comfyui://sections/{sectionId}/blocks`

## 工作流模板系统

当前标准 ComfyUI API 工作流由 [`docs/workflow.api.json`](docs/workflow.api.json) 和 [`src/server/services/workflow-prompt-builder.ts`](src/server/services/workflow-prompt-builder.ts) 维护。

- [`docs/workflow.api.json`](docs/workflow.api.json) 是默认 SDXL / HiRes graph contract。
- [`src/server/services/workflow-prompt-builder.ts`](src/server/services/workflow-prompt-builder.ts) 根据 project/section 参数填充 prompt、negative prompt、LoRA、尺寸、batch 和双 KSampler。
- `GET /api/runs/:runId/workflow` 可下载提交给 ComfyUI 的 workflow。
- `workflow-debug-download` 负责调试版本下载。
- 工作流行为的当前说明见 [`docs/worker-boundaries.md`](docs/worker-boundaries.md)、[`docs/workflow.api.json`](docs/workflow.api.json) 和 [`docs/agent-api.md`](docs/agent-api.md)。

## 项目结构

```
comfyui-remote/
├── agent-rules/                # Agent git、dev-service、deploy、queue、Prisma、verification 规则
├── config/                     # ComfyUI target 示例、路径映射和本地配置模板
├── data/                       # 运行时数据，git ignored
│   ├── images/                 #   管理的图片文件
│   ├── export/                 #   图片整合导出输出
│   └── loras/                  #   本地示例/临时 LoRA 运行数据
├── docs/                       # 文档
│   ├── index.md                #   read-first 文档入口
│   ├── documentation-map.md    #   当前/历史/生成文档分类
│   ├── repo-inventory.md       #   生成的全仓库治理清单
│   ├── architecture/           #   当前模块边界、数据流、队列/Worker 语义
│   ├── runbooks/               #   本地开发、部署、认证、ComfyUI、事故排查
│   ├── api/                    #   Agent API、MCP、路由契约、workflow schema
│   ├── ui/                     #   设计系统、页面模式、shell/navigation 规则
│   └── archive/                #   已归档计划、旧 PRD、旧 handoff、旧静态 demo
├── prisma/                     # PostgreSQL / SQLite schema、migration、seed
├── scripts/                    # 仓库维护、质量检查、DB、training worker 脚本
├── src/
│   ├── app/                    # Next.js App Router 页面和 API route handlers
│   ├── components/             # 通用 UI 组件
│   ├── features/               # 领域前端功能，Training 等
│   ├── generated/              # Prisma 生成代码，禁止手改
│   ├── lib/                    # 共享工具、server actions、env、DB helpers
│   └── server/                 # services、repositories、worker、MCP server
├── docker-compose.yml          # PostgreSQL 16 本地服务
└── package.json                # npm scripts 和依赖声明
```

### 数据访问路径

1. **Server Actions / RSC loaders**：`src/lib/actions/**`、`src/lib/server-data.ts` 和 route-local loaders，供生产 UI 内部调用。
2. **REST API**：`src/app/api/**` → `src/server/services/**` → `src/server/repositories/**` → Prisma，供外部、智能体、worker、Training 和 UI client mutation 使用。
3. **MCP**：`/api/mcp` → [`src/server/mcp/server.ts`](src/server/mcp/server.ts)，MCP clients 通过 tools/resources 复用面向智能体的服务。

### 图片生命周期

```
ComfyUI 输出
→ Worker 复制到 data/images/{project}/{section}/run-{N}/raw/
→ 生成缩略图 thumb/
→ 创建 ImageResult（pending）
→ 审核：kept / trashed
→ 精选标记：p站 / 预览 / project cover
→ 导出：kept → zip，p站 → pixiv/，预览 → preview/
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [`docs/index.md`](docs/index.md) | 智能体优先阅读入口，按需求指向当前文档。 |
| [`docs/documentation-map.md`](docs/documentation-map.md) | 当前、历史、生成文档分类和目标目录层级。 |
| [`docs/repo-inventory.md`](docs/repo-inventory.md) | 由脚本生成的全仓库文件治理清单。 |
| [`docs/api/README.md`](docs/api/README.md) | API 文档层入口和路由契约位置。 |
| [`docs/agent-api.md`](docs/agent-api.md) | Agent API 与 MCP 服务使用说明。 |
| [`docs/local-verification.md`](docs/local-verification.md) | 本机验证：认证、开发服务、ComfyUI、受保护页面、worker。 |
| [`docs/runbooks/config-runtime-assets.md`](docs/runbooks/config-runtime-assets.md) | 运行时配置、资源路径和本地文件边界。 |
| [`docs/worker-boundaries.md`](docs/worker-boundaries.md) | 队列、worker、工作流和运行边界。 |
| [`docs/prisma-provider-matrix.md`](docs/prisma-provider-matrix.md) | PostgreSQL / SQLite provider 行为矩阵。 |
| [`docs/prisma-schema-compatibility.md`](docs/prisma-schema-compatibility.md) | PostgreSQL / SQLite schema 兼容规则。 |
| [`docs/ui/README.md`](docs/ui/README.md) | UI 文档层入口。 |
| [`DESIGN.md`](DESIGN.md) | 当前 UI 方向和设计系统约束。 |
| [`AGENTS.md`](AGENTS.md) | 本仓库 agent 入口规则，指向 `agent-rules/**`。 |

## 许可

私有项目。
