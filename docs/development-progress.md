# Development Progress

## Final Goal
完成 ComfyUI Remote 的本机可运行版本，覆盖：
- 大任务管理
- Position Run 队列与宫格审图
- 回收站恢复
- LoRA 上传到受控路径
- 前后端真实数据闭环
- Worker / ComfyUI 最小可运行链路

## Current State (2026-03-24)

当前为单体 Next.js 项目（App Router），前后端统一在 `main` 分支。

### 已完成 — Phase 1: 数据库基础设施 + 页面真实数据
提交 `3fd72a0`:
- PostgreSQL docker-compose.yml
- Prisma schema + initial migration + seed 脚本
- `src/lib/prisma.ts` Prisma client 单例
- `src/lib/server-data.ts` 服务端查询层（getQueueItems / getReviewGroup / getJobs / getJobDetail / getTrashItems 等）
- 所有页面从 mock-data 迁移到真实 Prisma 查询
- 移除 `src/lib/mock-data.ts`

### 已完成 — Phase 2: 交互接线 + 新页面
提交 `1f89c73`:
- `src/lib/actions.ts` Server Actions：
  - reviewImages（批量 keep/trash）
  - restoreImage（从回收站恢复）
  - runJob（运行整组）/ runPosition（运行单节）
  - copyJob（复制大任务，含 Prisma JSON 类型桥接）
- `/trash` 回收站页面 + RestoreButton 客户端组件
- `/assets/loras` LoRA 资源列表页面
- `ReviewGrid` 客户端组件：多选 + 批量保留/删除
- `ImageActions` 客户端组件：单图保留/删除
- `JobActions` 客户端组件：编辑/复制/运行
- `JobDetailActions` + `PositionRunButton`：运行整组/复制/运行单节

### 已完成 — Phase 3: Job 创建/编辑 + LoRA 上传
提交 `1191391`:
- `/jobs/new` Job 创建页：Character / Scene / Style 选择 + Position 多选
- `/jobs/[jobId]/edit` 参数编辑页：Job 级别字段 + Position 级别覆盖参数
- `createJob` / `updateJob` Server Actions
- LoRA 上传表单：分类选择 + 文件上传 + 路径预览
- `uploadLora` Server Action（数据库登记，文件写入待接）
- `getJobFormOptions` / `getJobEditData` 服务端查询函数
- Jobs 列表页添加"创建新任务"按钮
- Job 详情页和列表页编辑按钮链接到 `/edit`

### 已完成 — Phase 5: 配置管理 + LoRA 文件写入
- `/settings` 设置首页：四个配置入口 + Worker 状态链接
- `/settings/characters` 角色 CRUD 管理
- `/settings/scenes` 场景 CRUD 管理
- `/settings/styles` 风格 CRUD 管理
- `/settings/positions` Position 模板 CRUD 管理
- 通用 `ConfigManager` 客户端组件：行内编辑 / 新增 / 软删除
- Character / ScenePreset / StylePreset / PositionTemplate CRUD Server Actions
- LoRA 上传现已实现真实文件写入磁盘（`data/assets/loras/<category>/`）
- AppShell 底部导航添加"设置"入口

### 页面清单
| 路径 | 状态 |
|------|------|
| `/queue` | ✅ 真实数据 |
| `/queue/[runId]` | ✅ 真实数据 + 交互接线 |
| `/queue/[runId]/images/[imageId]` | ✅ 真实数据 + 交互接线 |
| `/jobs` | ✅ 真实数据 + 交互接线 + 创建入口 |
| `/jobs/new` | ✅ 创建表单 |
| `/jobs/[jobId]` | ✅ 真实数据 + 交互接线 + 编辑入口 |
| `/jobs/[jobId]/edit` | ✅ 参数编辑表单 |
| `/trash` | ✅ 真实数据 + 恢复按钮 |
| `/assets/loras` | ✅ 真实数据 + 上传表单 |

### API 路由清单
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/worker/process` | POST | 手动触发 Worker 消费 queued runs |
| `/api/worker/status` | GET | Worker 状态 + ComfyUI 连通性 |
| `/api/images/[...path]` | GET | 本地图片文件服务 |

## Verified Baseline
- `npm run lint` 通过
- `npm run build` 通过
- 所有页面 HTTP 200 可访问
- 关键操作按钮（批量保留/删除、恢复、运行、复制、创建、编辑、上传）已渲染
- `GET /api/worker/status` 返回正确的队列统计和 ComfyUI 连通性

## Active Gaps
- Worker 实际执行需要运行中的 ComfyUI 实例（可通过 `COMFYUI_URL` 环境变量配置）
- 图片 trash/restore 文件移动尚未实现（当前只更新 DB 状态，不移动实际文件）
- Prompt builder 当前只支持基础 SDXL txt2img workflow，需要支持自定义 workflow 模板
- 本机完整链路文档尚未补

## Next Recommended Steps
1. 实现图片 trash/restore 文件移动逻辑
2. 实现 workflow 模板系统（从 config/workflows/*.json 加载）
3. 补完整本机验证文档
4. Agent API 路由

## Repo Rules
- `main` 分支：唯一开发分支
- 使用 Conventional Commits
- 每次提交后推送到远程
