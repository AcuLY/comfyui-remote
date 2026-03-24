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

### 页面清单
| 路径 | 状态 |
|------|------|
| `/queue` | ✅ 真实数据 |
| `/queue/[runId]` | ✅ 真实数据 + 交互接线 |
| `/queue/[runId]/images/[imageId]` | ✅ 真实数据 + 交互接线 |
| `/jobs` | ✅ 真实数据 + 交互接线 |
| `/jobs/[jobId]` | ✅ 真实数据 + 交互接线 |
| `/trash` | ✅ 真实数据 + 恢复按钮 |
| `/assets/loras` | ✅ 真实数据（只读列表） |

## Verified Baseline
- `npm run lint` 通过
- `npm run build` 通过
- 所有页面 HTTP 200 可访问
- 关键操作按钮（批量保留/删除、恢复、运行、复制）已渲染

## Active Gaps
- 参数编辑页（从宫格三点菜单或 Job 详情进入）尚未实现
- Job 创建页 `/jobs/new` 尚未实现
- LoRA 上传功能尚未实现（当前只有只读列表）
- Worker / ComfyUI 对接尚未实现（runJob/runPosition 目前只创建 PositionRun 记录，无实际 worker 消费）
- 文件归档策略（raw / kept / trashed 目录组织）尚未实现
- Character / Scene / Style / PositionTemplate 管理入口尚未实现
- 本机完整链路文档（seed → create job → enqueue → worker → ComfyUI → output）尚未补

## Next Recommended Steps
1. 实现参数编辑页（宫格三点菜单 + Job 详情入口）
2. 实现 Job 创建页 `/jobs/new`
3. 实现 LoRA 上传功能
4. 实现 Worker scaffold + ComfyUI API 对接
5. 补文件归档逻辑
6. 补 Character / Scene / Style / PositionTemplate 管理入口
7. 补完整本机验证文档

## Repo Rules
- `main` 分支：唯一开发分支
- 使用 Conventional Commits
- 每次提交后推送到远程
