# Development Progress

## Final Goal
完成 ComfyUI Remote 的本机可运行版本，覆盖：
- 大任务管理
- Position Run 队列与宫格审图
- 回收站恢复
- LoRA 上传到受控路径
- 前后端真实数据闭环
- Worker / ComfyUI 最小可运行链路
- Agent API 供外部 AI 调用

## Current State (2026-03-24)

单体 Next.js 项目（App Router），前后端统一在 `main` 分支。
`frontend` 和 `backend` 分支已合并到 `main`。

### 已完成 — Phase 1: 数据库基础设施 + 页面真实数据
- PostgreSQL docker-compose.yml
- Prisma schema（12 个模型 + 4 个枚举）+ migration + seed 脚本
- `src/lib/prisma.ts` Prisma client 单例
- `src/lib/server-data.ts` 服务端查询层
- 所有页面从 mock-data 迁移到真实 Prisma 查询

### 已完成 — Phase 2: 交互接线 + 新页面
- `src/lib/actions.ts` Server Actions：
  - reviewImages（批量 keep/trash）
  - restoreImage（从回收站恢复）
  - runJob（运行整组）/ runPosition（运行单节）
  - copyJob（复制大任务，含 Prisma JSON 类型桥接）
- `/trash` 回收站页面 + RestoreButton 客户端组件
- `/assets/loras` LoRA 资源列表页面
- ReviewGrid / ImageActions / JobActions / JobDetailActions / PositionRunButton 客户端组件

### 已完成 — Phase 3: Job 创建/编辑 + LoRA 上传
- `/jobs/new` Job 创建页：Character / Scene / Style 选择 + Position 多选
- `/jobs/[jobId]/edit` 参数编辑页：Job 级别字段 + Position 级别覆盖参数
- `/jobs/[jobId]/positions/[positionId]/edit` Position 编辑页
- `createJob` / `updateJob` Server Actions
- LoRA 上传表单 + `uploadLora` Server Action（文件写入磁盘 + DB 登记）

### 已完成 — Phase 4: Worker / ComfyUI 对接
- `src/server/worker/` — Worker 执行引擎
  - `repository.ts`：claim-based 并发安全的 queued run 处理
  - `payload-builder.ts`：配置快照规范化 + ComfyUI prompt draft 构建
  - `index.ts`：Worker pass 主流程
- `src/server/services/comfyui-service.ts`：ComfyUI HTTP API 交互
- `src/server/services/image-result-service.ts`：图片持久化 + sharp 缩略图
- `src/lib/prompt-builder.ts`：基础 SDXL txt2img workflow 构建

### 已完成 — Phase 5: 配置管理 + LoRA 文件写入
- `/settings` 设置首页：四个配置入口 + Worker 状态链接
- `/settings/characters` 角色 CRUD 管理
- `/settings/scenes` 场景 CRUD 管理
- `/settings/styles` 风格 CRUD 管理
- `/settings/positions` Position 模板 CRUD 管理
- 通用 `ConfigManager` 客户端组件
- LoRA 上传真实文件写入磁盘

### 已完成 — Phase 6: REST API 层 + Agent API（从 backend 分支合并）
- `src/server/services/` — Service 层（业务逻辑 + 输入校验）
  - `job-service.ts`：Job CRUD + 入队 + 复制 + 严格输入校验
  - `review-service.ts`：图片审核 + 恢复 + 输入校验
  - `image-file-service.ts`：文件系统操作（移动到回收站/恢复）
  - `lora-upload-service.ts`：LoRA 上传服务
- `src/server/repositories/` — Repository 层（数据库访问）
  - `job-repository.ts`：Job 完整 CRUD + 列表查询 + 入队逻辑
  - `review-repository.ts`：审核相关 DB 操作 + 文件移动事务
  - `queue-repository.ts` / `trash-repository.ts` / `lora-repository.ts`

### 页面清单（16 个页面）
| 路径 | 状态 |
|------|------|
| `/` → 重定向到 `/queue` | ✅ |
| `/queue` | ✅ 真实数据 |
| `/queue/[runId]` | ✅ 真实数据 + 多选审核 |
| `/queue/[runId]/images/[imageId]` | ✅ 真实数据 + 单图审核 |
| `/jobs` | ✅ 真实数据 + 创建/编辑/复制/运行 |
| `/jobs/new` | ✅ 创建表单 |
| `/jobs/[jobId]` | ✅ 详情 + 运行整组/单节/复制/编辑 |
| `/jobs/[jobId]/edit` | ✅ 参数编辑表单 |
| `/jobs/[jobId]/positions/[positionId]/edit` | ✅ Position 编辑 |
| `/trash` | ✅ 真实数据 + 恢复按钮 |
| `/assets/loras` | ✅ 真实数据 + 上传表单 |
| `/settings` | ✅ 设置首页 |
| `/settings/characters` | ✅ 角色 CRUD |
| `/settings/scenes` | ✅ 场景 CRUD |
| `/settings/styles` | ✅ 风格 CRUD |
| `/settings/positions` | ✅ Position 模板 CRUD |

### API 路由清单（25 个路由）

**核心业务 API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/jobs` | GET/POST | 任务列表（支持过滤） / 创建 |
| `/api/jobs/[jobId]` | GET/PATCH | 任务详情 / 更新 |
| `/api/jobs/[jobId]/copy` | POST | 复制任务 |
| `/api/jobs/[jobId]/run` | POST | 运行整个任务 |
| `/api/jobs/[jobId]/positions/[jobPositionId]` | PATCH | 更新 Position 配置 |
| `/api/jobs/[jobId]/positions/[jobPositionId]/run` | POST | 运行单个 Position |
| `/api/queue` | GET | 审核队列 |
| `/api/runs/[runId]` | GET | Run 详情 |
| `/api/runs/[runId]/review/keep` | POST | 批量保留图片 |
| `/api/runs/[runId]/review/trash` | POST | 批量删除图片 |
| `/api/images/[imageId]/restore` | POST | 恢复图片 |
| `/api/images/[...path]` | GET | 图片文件代理服务 |
| `/api/trash` | GET | 回收站列表 |
| `/api/loras` | GET | LoRA 列表 |
| `/api/job-create-options` | GET | 创建任务下拉选项 |
| `/api/path-maps` | GET | 路径映射 |
| `/api/health` | GET | 健康检查 |

**Worker API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/worker/process` | POST | Worker 处理 |
| `/api/worker/status` | GET | Worker 状态 |
| `/api/local/worker/pass` | POST | 本地手动触发（仅 localhost） |

**Agent API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/agent/jobs/[jobId]/context` | GET | 获取 Job 上下文 |
| `/api/agent/jobs/[jobId]/update` | PATCH | AI 代理更新 Job |
| `/api/agent/positions/[jobPositionId]/run` | POST | AI 代理触发 Position 运行 |
| `/api/agent/runs/[runId]/context` | GET | 获取 Run 上下文 |
| `/api/agent/runs/[runId]/review` | POST | AI 代理执行图片审核 |

## Verified Baseline
- `npm run build` 通过（所有 40+ 路由正确注册）
- 所有页面 HTTP 200 可访问
- 关键操作按钮（批量保留/删除、恢复、运行、复制、创建、编辑、上传）已渲染
- `GET /api/worker/status` 返回正确的队列统计和 ComfyUI 连通性

## Active Gaps
- Server Actions 中的 trash/restore 尚未接入 `image-file-service` 的文件移动逻辑（REST API 层已实现）
- Prompt builder 当前只支持基础 SDXL txt2img workflow，需要支持自定义 workflow 模板
- Server Actions（`src/lib/actions.ts`）与 REST API（`src/server/`）存在功能重叠，后续应统一
- 本机完整链路文档尚未补

## Next Recommended Steps
1. Server Actions 中的 trash/restore 接入 image-file-service 文件移动
2. 补一条清晰的本机验证文档
3. 统一 Server Actions 和 REST API 审核/运行逻辑，消除重复
4. 实现 workflow 模板系统（从 config/workflows/*.json 加载）
5. Agent API 使用文档

## Repo Rules
- `main` 分支：唯一开发分支
- `frontend` / `backend` 分支已合并归档
- 使用 Conventional Commits
- 每次提交后推送到远程
