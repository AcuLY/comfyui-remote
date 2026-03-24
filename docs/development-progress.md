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

## Verified Baseline
- `npm run lint` 通过
- `npm run build` 通过
- 所有页面 HTTP 200 可访问
- 关键操作按钮（批量保留/删除、恢复、运行、复制、创建、编辑、上传）已渲染

## Active Gaps
- Worker / ComfyUI 对接尚未实现（runJob/runPosition 目前只创建 PositionRun 记录，无实际 worker 消费）
- 文件归档策略（raw / kept / trashed 目录组织）尚未实现
- LoRA 上传的真实文件写入磁盘尚未实现（当前只做数据库登记）
- Character / Scene / Style / PositionTemplate 管理入口尚未实现
- 本机完整链路文档（seed → create job → enqueue → worker → ComfyUI → output）尚未补

## Next Recommended Steps
1. 实现 Worker scaffold + ComfyUI API 对接
2. 补文件归档逻辑（LoRA 真实写入 + 图片 trash/restore 文件移动）
3. 补 Character / Scene / Style / PositionTemplate 管理入口
4. 补完整本机验证文档

## Repo Rules
- `main` 分支：唯一开发分支
- 使用 Conventional Commits
- 每次提交后推送到远程
