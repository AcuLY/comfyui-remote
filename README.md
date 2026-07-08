# ComfyUI Remote

分类：当前文档
更新触发：产品入口、启动路径、维护来源映射或文档归属发生变化。

ComfyUI Remote 是面向移动端优先使用的 ComfyUI 管理后台，用来组织生图项目、审核队列、素材库、训练流程、Comfy 运行态控制，以及给智能体使用的自动化接口。

这个文件只作为人的入口页。智能体应先读 [`docs/index.md`](docs/index.md)，再通过 [`docs/documentation-map.md`](docs/documentation-map.md) 和生成的 [`docs/repo-inventory.md`](docs/repo-inventory.md) 找到当前事实来源。不要把这里当作路由、接口、环境变量或仓库结构清单。

## 当前边界

- 生图工作区：项目、小节、提示词块、LoRA 与采样参数、模板，以及基于预设的批量运行。
- 审核与导出：队列审核、图片保留或废弃、放大查看、结果图库和导出流程。
- 素材库：模型文件、LoRA 文件、预设分类、预设文件夹、预设变体、预设组和项目模板。
- 训练工作区：LoRA 训练项目、数据集修订、生成任务、训练运行、工作队列、训练预设和训练模板。
- Comfy 运行态：ComfyUI 目标配置、队列与执行器、进程监控、生成图片管理、缩略图，以及可选的自动打码后处理。
- 智能体接口与 MCP：高层 `/api/agent/**` 工作流、完整 `/api/**` 自动化路由，以及 `/api/mcp` 的可流式 HTTP MCP 服务。

## 本地启动

前置要求：

- Node.js 20+
- 可访问的 ComfyUI 实例，通常是 `http://127.0.0.1:8188`
- 使用 Docker 提供 PostgreSQL，或使用 SQLite 做轻量本地环境

PostgreSQL 路径：

```bash
cp .env.example .env
npm install
docker compose up -d
npm run db:bootstrap
npm run dev
```

SQLite 路径：

```bash
cp .env.example .env
npm install
DB_PROVIDER=sqlite DATABASE_URL="file:./data/comfyui.db" npm run db:bootstrap:sqlite
DB_PROVIDER=sqlite DATABASE_URL="file:./data/comfyui.db" npm run dev
```

开发服务启动后打开 `http://localhost:3000`。认证、受保护页面、ComfyUI 连通性、开发服务与生产服务边界、验证命令，请看 [`docs/local-verification.md`](docs/local-verification.md)。

## 维护来源

| 需要确认的内容 | 当前来源 |
| --- | --- |
| 文档入口、分类和归属 | [`docs/index.md`](docs/index.md)、[`docs/documentation-map.md`](docs/documentation-map.md)、[`docs/repo-inventory.md`](docs/repo-inventory.md) |
| 本地配置和运行时路径 | [`.env.example`](.env.example)、[`docs/local-verification.md`](docs/local-verification.md)、[`docs/runbooks/config-runtime-assets.md`](docs/runbooks/config-runtime-assets.md) |
| 智能体接口、路由契约、MCP 和工作流 JSON | [`docs/agent-api.md`](docs/agent-api.md)、[`docs/api/README.md`](docs/api/README.md)、[`docs/workflow.api.json`](docs/workflow.api.json)、[`src/server/mcp/server.ts`](src/server/mcp/server.ts) |
| 界面与产品设计方向 | [`DESIGN.md`](DESIGN.md)、[`docs/frontend-design-guide.md`](docs/frontend-design-guide.md)、[`docs/ui/README.md`](docs/ui/README.md) |
| 数据库和 Prisma Provider 行为 | [`docs/prisma-provider-matrix.md`](docs/prisma-provider-matrix.md)、[`docs/prisma-schema-compatibility.md`](docs/prisma-schema-compatibility.md)、[`prisma/schema.prisma`](prisma/schema.prisma)、[`prisma/schema.sqlite.prisma`](prisma/schema.sqlite.prisma) |
| 训练当前实现 | [`src/app/training/[[...route]]/page.tsx`](src/app/training/[[...route]]/page.tsx)、[`src/features/training`](src/features/training)、[`src/server/services/training`](src/server/services/training)、[`docs/prototypes/README.md`](docs/prototypes/README.md) |
| 队列、执行器和部署流程 | [`docs/worker-boundaries.md`](docs/worker-boundaries.md)、[`AGENTS.md`](AGENTS.md)、[`agent-rules`](agent-rules) |

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地开发服务。 |
| `npm run build` | 构建生产应用。 |
| `npm run start` | 启动已构建的生产应用。 |
| `npm run test` | 运行仓库测试。 |
| `npm run lint` | 运行 ESLint。 |
| `npm run db:bootstrap` | 初始化 PostgreSQL 开发数据库。 |
| `npm run db:bootstrap:sqlite` | 初始化 SQLite 开发数据库。 |
| `npm run training:workers` | 启动真实训练工作进程。 |
| `npm run training:workers:mock` | 启动用于本地流程检查的模拟训练工作进程。 |

## 许可

私有项目。
