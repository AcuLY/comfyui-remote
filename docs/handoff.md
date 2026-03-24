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
- `prisma/` — 数据库 schema + migration（12 模型 + 4 枚举）
- `src/app/` — 16 个页面 + 25 个 API 路由
- `src/lib/` — 共享工具（prisma client、server-data 查询、server actions、prompt builder、类型）
- `src/server/services/` — Service 层（业务逻辑 + 输入校验）
- `src/server/repositories/` — Repository 层（数据库访问）
- `src/server/worker/` — Worker 执行引擎（ComfyUI 对接）
- `src/components/` — 通用 UI 组件（AppShell、ConfigManager、LoraUploadPanel 等）
- `src/scripts/` — seed 脚本
- `config/` — path-maps 等配置

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
- `GET /api/agent/jobs/:id/context` — Job 完整上下文
- `PATCH /api/agent/jobs/:id/update` — AI 修改 Job 参数
- `POST /api/agent/positions/:id/run` — AI 触发运行
- `GET /api/agent/runs/:id/context` — Run 结果上下文
- `POST /api/agent/runs/:id/review` — AI 批量审图

## 当前完成度

### 数据库
- PostgreSQL via docker-compose
- Prisma schema 覆盖：Character、ScenePreset、StylePreset、PositionTemplate、CompleteJob、CompleteJobPosition、PositionRun、ImageResult、TrashRecord、LoraAsset、JobRevision、AuditLog
- 有 seed 脚本填充测试数据

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
| `/settings` | — | ✅ 设置首页 |
| `/settings/characters` | Prisma | ✅ CRUD |
| `/settings/scenes` | Prisma | ✅ CRUD |
| `/settings/styles` | Prisma | ✅ CRUD |
| `/settings/positions` | Prisma | ✅ CRUD |

### Server Actions（`src/lib/actions.ts`）
- `keepImages` / `trashImages` — 批量 keep/trash（DB 更新 + 文件移动）
- `restoreImage` — 回收站恢复（DB 更新 + 文件移回原位）
- `runJob` / `runPosition` — 调用 repository 层入队
- `createJob` / `updateJob` / `copyJob` — 调用 repository 层
- `uploadLora` — LoRA 上传（文件写入 + DB 登记）
- Character / ScenePreset / StylePreset / PositionTemplate CRUD

### REST API Service 层（`src/server/services/`）
- `job-service.ts` — Job 完整 CRUD + 入队 + 复制 + 严格输入校验
- `review-service.ts` — 图片审核 + 恢复
- `comfyui-service.ts` — ComfyUI HTTP API（submit + poll）
- `image-result-service.ts` — 图片持久化 + 缩略图
- `image-file-service.ts` — 文件移动（trash/restore）
- `lora-upload-service.ts` — LoRA 上传

### 尚未实现
- 自定义 workflow 模板系统（从 `config/workflows/*.json` 加载）
- Agent API 使用说明文档

## 推荐接手顺序
1. 看 `docs/design-v0.1.md` 了解整体设计
2. 看 `prisma/schema.prisma` 了解数据模型
3. 看 `src/lib/server-data.ts` 了解查询层
4. 看 `src/lib/actions.ts` 了解 Server Actions
5. 看 `src/server/` 了解 REST API 三层架构
6. 看 `docs/development-todo.md` 了解下一步优先级

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

## 当前文档状态
- `development-progress.md`：保留当前态，不再记录过细流水
- `development-todo.md`：只放尚未完成或仍值得跟进的项
