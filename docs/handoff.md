# Handoff

## 这是什么
ComfyUI Remote 是一个移动优先的 ComfyUI 管理后台。核心目标是把：
- 大任务管理
- Position Run 运行
- 宫格审图
- 回收站
- LoRA 上传
- 参数编辑
- Worker / ComfyUI 对接
- Agent 接口
放进一个统一系统里。

## 当前代码组织
- 单体 Next.js 项目（App Router），统一在 `main` 分支
- `prisma/` — 数据库 schema + migration（14 模型 + 4 枚举）
- `config/` — 配置文件（`path-maps.json` + `workflows/*.json`）
- `src/app/` — 18 个页面 + 30+ 个 API 路由
- `src/lib/` — 共享工具（prisma client、server-data 查询、server actions、类型）
- `src/server/services/` — Service 层（业务逻辑 + 输入校验 + workflow 模板 + 审计日志 + 修订历史）
- `src/server/mcp/` — MCP Server（Tools + Resources 注册）
- `src/server/repositories/` — Repository 层（数据库访问）
- `src/server/worker/` — Worker 执行引擎（ComfyUI 对接）
- `src/components/` — 通用 UI 组件（AppShell、ConfigManager、LoraUploadPanel 等）
- `src/scripts/` — seed 脚本
- `docs/` — 设计文档、开发进度、Agent API 说明、验证指南

## 架构特点

### 两套数据访问路径
1. **Server Actions**（`src/lib/actions.ts` + `src/lib/server-data.ts`）— 前端 RSC 直接调用，简单快速
2. **REST API**（`src/app/api/` → `src/server/services/` → `src/server/repositories/`）— 完整输入校验，供外部/Agent 调用

### Worker 执行引擎（统一体系 `src/server/worker/`）
- claim-based 并发安全
- 配置快照机制：每次 Run 快照完整配置，保证历史可追溯
- 支持本地文件复制和 HTTP 下载两种图片获取方式
- sharp 缩略图自动生成
- **Fallback workflow**：当 `extraParams` 没有自定义 `comfyPrompt` 时，自动使用内置 SDXL txt2img 节点图（`fallback-prompt-builder.ts`）
- 旧版 `src/lib/worker.ts` / `prompt-builder.ts` / `comfyui-client.ts` 已清理

### Agent API
- `GET /api/agent/jobs` — Job 列表（搜索/状态筛选）
- `GET /api/agent/jobs/:id/context` — Job 完整上下文
- `PATCH /api/agent/jobs/:id/update` — AI 修改 Job 参数
- `POST /api/agent/jobs/:id/run-all` — AI 触发所有 enabled Position 运行
- `POST /api/agent/positions/:id/run` — AI 触发运行
- `GET /api/agent/runs/:id/context` — Run 结果上下文
- `POST /api/agent/runs/:id/review` — AI 批量审图

## 当前完成度

### 数据库
- PostgreSQL via docker-compose
- Prisma schema 覆盖：PromptCategory、PromptPreset、CompleteJob（含 presetBindings JSON 字段）、CompleteJobPosition、PositionRun、ImageResult、TrashRecord、LoraAsset、JobRevision、AuditLog、PromptBlock（含 categoryId 字段）
- 旧模型（Character、ScenePreset、StylePreset、PositionTemplate）仍保留在 schema 中用于数据兼容，但应用层已不再直接查询
- 有 seed 脚本填充测试数据
- 数据迁移脚本 `prisma/migrate-presets.ts`：将旧 Character/Scene/Style/PositionTemplate 数据迁移到 PromptCategory + PromptPreset

### 页面 + 交互
| 路径 | 数据源 | 交互状态 |
|------|--------|----------|
| `/queue` | Prisma 真实查询 | 只读列表 |
| `/queue/[runId]` | Prisma | ✅ 多选 + 批量保留/删除 |
| `/queue/[runId]/images/[imageId]` | Prisma | ✅ 单图保留/删除 |
| `/jobs` | Prisma | ✅ 创建/编辑/复制/运行 |
| `/jobs/new` | Prisma | ✅ 创建表单 |
| `/jobs/[jobId]` | Prisma | ✅ 运行整组/复制/运行单节/编辑 |
| `/jobs/[jobId]/edit` | Prisma | ✅ 参数编辑表单 |
| `/jobs/[jobId]/positions/[positionId]/edit` | Prisma | ✅ Position 编辑 |
| `/trash` | Prisma | ✅ 恢复按钮 |
| `/assets/loras` | Prisma | ✅ 上传表单 |
| `/assets/prompts` | Prisma | ✅ 提示词分类与预设管理（CRUD + 拖拽排序） |
| `/settings` | — | ✅ 设置首页 |
| `/settings/workflows` | 文件系统 | ✅ 模板列表 + 导入表单 |

### Server Actions（`src/lib/actions.ts`）
- `keepImages` / `trashImages` — 批量 keep/trash（DB 更新 + 文件移动）
- `restoreImage` — 回收站恢复（DB 更新 + 文件移回原位）
- `runJob` / `runPosition` — 调用 repository 层入队
- `createJob` / `updateJob` / `copyJob` — 调用 repository 层
- `uploadLora` — LoRA 上传（文件写入 + DB 登记）
- Character / ScenePreset / StylePreset / PositionTemplate CRUD（已废弃，由 PromptCategory / PromptPreset CRUD 替代）
- PromptCategory / PromptPreset CRUD

### REST API Service 层（`src/server/services/`）
- `job-service.ts` — Job 完整 CRUD + 入队 + 复制 + 严格输入校验
- `review-service.ts` — 图片审核 + 恢复
- `comfyui-service.ts` — ComfyUI HTTP API（submit + poll）
- `image-result-service.ts` — 图片持久化 + 缩略图
- `image-file-service.ts` — 文件移动（trash/restore）
- `lora-upload-service.ts` — LoRA 上传
- `audit-service.ts` — Fire-and-forget 审计日志（AuditLog 表），区分 user/system/agent actor
- `revision-service.ts` — Job 更新前自动快照（JobRevision 表），支持修订历史查看
- `workflow-import-service.ts` — ComfyUI API JSON 导入为 workflow 模板（启发式变量识别）

### Workflow 模板系统（`config/workflows/` + `src/server/services/workflow-template-service.ts`）
- 模板文件放在 `config/workflows/*.json`，包含元数据 + 变量定义 + ComfyUI 节点图
- 内置 `sdxl-txt2img`（基础 SDXL）和 `sdxl-txt2img-hires`（HiRes Fix）两个示例
- 支持 `{{variable}}` 占位符，Worker 执行时自动从 `ComfyPromptDraft` 解析变量
- Prompt 解析优先级：自定义 comfyPrompt > workflowTemplateId > 内置 SDXL fallback
- API 端点：`GET /api/workflows`（列表）、`GET /api/workflows/:id`（详情）
- 前端 Position 模板设置页可选择关联 workflow 模板

### Workflow 导入（`src/server/services/workflow-import-service.ts`）
- 支持从 ComfyUI「Save (API Format)」导出的 JSON 自动生成 workflow 模板
- 按已知节点类型启发式识别可参数化字段（prompts/dimensions/seed/steps/cfg/sampler/LoRA 等）
- API 端点：`POST /api/workflows/import`
- 前端：`/settings/workflows` 页面（模板列表 + 粘贴/上传 JSON 导入表单）

### AuditLog + JobRevision
- `AuditLog` 表覆盖：Job CRUD、enqueue、review keep/trash/restore、Worker claim/done/failed
- Agent API 路由传入 `ActorType.agent`，可区分 AI 和人工操作
- `JobRevision` 表在 Job/Position 更新前自动快照，支持回溯"这一轮参数怎么改过"
- API 端点：`GET /api/jobs/:id/revisions`、`GET /api/jobs/:id/revisions/:revisionNumber`、`GET /api/audit-logs`

### Worker 端点
- `/api/local/worker/pass` + `/api/worker/process` 均有 localhost 安全检查
- `/api/worker/status` 返回 ComfyUI 连通性 + 队列状态 + 最近完成/失败的 Run

### MCP Server（`src/server/mcp/server.ts` + `src/app/api/mcp/route.ts`）
- 内置 MCP Server（Model Context Protocol），端点 `POST /api/mcp`
- 使用 `@modelcontextprotocol/sdk` + `WebStandardStreamableHTTPServerTransport`（stateless 模式）
- 6 个 Tools：list_jobs / update_job / update_job_position / run_all_positions / run_position / review_images
- 6 个 Resources：job context / run context / workflow templates / workflow detail / job revisions / revision snapshot
- 任何支持 MCP 的客户端（Claude Desktop、Cursor 等）可直接连接使用

### 已知限制
- 修订历史只展示快照，不做字段级 diff 对比
- MCP Server 无鉴权（适合本地使用）
- 旧模型（Character / ScenePreset / StylePreset / PositionTemplate）仍保留在 Prisma schema 中，仅用于数据兼容和迁移参考，应用层已不再直接查询

## 推荐接手顺序
1. 看 `docs/design-v0.1.md` 了解整体设计
2. 看 `prisma/schema.prisma` 了解数据模型
3. 看 `src/lib/server-data.ts` + `src/lib/actions.ts` 了解前端数据层
4. 看 `src/server/` 了解 REST API 三层架构（services → repositories）
5. 看 `docs/agent-api.md` 了解 Agent API 和 MCP 接口
6. 看 `docs/development-todo.md` 了解下一步计划

## 本地运行
```bash
docker compose up -d          # 启动 PostgreSQL
npm install                   # 安装依赖
npm run prisma:generate       # 生成 Prisma client
npm run db:bootstrap          # 运行 migration + seed
npm run dev                   # 启动开发服务器
```

### 本地手动触发 worker pass
```bash
curl -X POST "http://localhost:3000/api/local/worker/pass?limit=1"
```

## 文档索引
- `design-v0.1.md`：整体设计文档（核心对象模型、页面设计、关键流程）
- `design-v0.3-workflow-integration.md`：v0.3 Workflow 集成设计（待实现）
- `development-progress.md`：当前项目状态总览
- `development-todo.md`：完成记录和下一步计划
- `agent-api.md`：Agent API + MCP Server 完整使用说明
- `local-verification.md`：本机完整链路验证指南
- `workflow.api.json`：标准 ComfyUI workflow 参考文件（v0.3 填充目标）
