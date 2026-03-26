# Development Progress

## Project Overview

ComfyUI Remote — 移动优先的 ComfyUI 管理后台，覆盖：
- 大任务管理 + Position Run 队列
- 宫格审图 + 回收站恢复
- LoRA 上传
- Worker / ComfyUI 对接
- Agent API + MCP Server
- Prompt Block 提示词块系统

## Current State (2026-03-26)

单体 Next.js 项目（App Router），前后端统一在 `main` 分支。v0.1 和 v0.2 功能全部完成。

### 技术栈
- Next.js (App Router) + Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma ORM
- Worker 执行引擎（ComfyUI HTTP API 对接）
- MCP Server（Model Context Protocol）

### 页面清单（17 个页面）
| 路径 | 状态 |
|------|------|
| `/` → 重定向到 `/queue` | ✅ |
| `/queue` | ✅ 真实数据 |
| `/queue/[runId]` | ✅ 多选审核 + 快捷操作 |
| `/queue/[runId]/images/[imageId]` | ✅ 单图审核 + 快捷操作 |
| `/jobs` | ✅ 创建/编辑/复制/运行 |
| `/jobs/new` | ✅ 创建表单 |
| `/jobs/[jobId]` | ✅ 详情 + 修订历史 |
| `/jobs/[jobId]/edit` | ✅ 参数编辑 |
| `/jobs/[jobId]/positions/[positionId]/edit` | ✅ Position 编辑 |
| `/jobs/[jobId]/positions/[positionId]/blocks` | ✅ 提示词块编辑器 |
| `/trash` | ✅ 恢复按钮 |
| `/assets/loras` | ✅ 上传表单 |
| `/settings` | ✅ 设置首页 |
| `/settings/characters` | ✅ CRUD |
| `/settings/scenes` | ✅ CRUD |
| `/settings/styles` | ✅ CRUD |
| `/settings/positions` | ✅ CRUD |
| `/settings/workflows` | ✅ 模板列表 + 导入 |

### API 路由清单

**核心业务 API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/jobs` | GET/POST | 任务列表 / 创建 |
| `/api/jobs/[jobId]` | GET/PATCH | 任务详情 / 更新 |
| `/api/jobs/[jobId]/copy` | POST | 复制任务 |
| `/api/jobs/[jobId]/run` | POST | 运行整个任务 |
| `/api/jobs/[jobId]/positions/[jobPositionId]` | PATCH | 更新 Position 配置 |
| `/api/jobs/[jobId]/positions/[jobPositionId]/run` | POST | 运行单个 Position |
| `/api/jobs/[jobId]/revisions` | GET | 修订历史列表 |
| `/api/jobs/[jobId]/revisions/[n]` | GET | 修订快照 |
| `/api/queue` | GET | 审核队列 |
| `/api/runs/[runId]` | GET | Run 详情 |
| `/api/runs/[runId]/review/keep` | POST | 批量保留 |
| `/api/runs/[runId]/review/trash` | POST | 批量删除 |
| `/api/images/[imageId]/restore` | POST | 恢复图片 |
| `/api/images/[...path]` | GET | 图片文件代理 |
| `/api/trash` | GET | 回收站列表 |
| `/api/loras` | GET | LoRA 列表 |
| `/api/job-create-options` | GET | 创建任务选项 |
| `/api/path-maps` | GET | 路径映射 |
| `/api/audit-logs` | GET | 审计日志 |
| `/api/workflows` | GET | Workflow 模板列表 |
| `/api/workflows/[id]` | GET | 模板详情 |
| `/api/workflows/import` | POST | 导入 workflow |
| `/api/health` | GET | 健康检查 |

**Worker API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/worker/process` | POST | Worker 处理 |
| `/api/worker/status` | GET | Worker 状态 |
| `/api/local/worker/pass` | POST | 本地手动触发 |

**Agent API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/agent/jobs` | GET | Job 列表（搜索/筛选） |
| `/api/agent/jobs/[jobId]/context` | GET | Job 上下文 |
| `/api/agent/jobs/[jobId]/update` | PATCH | AI 更新 Job |
| `/api/agent/jobs/[jobId]/run-all` | POST | AI 触发全部运行 |
| `/api/agent/positions/[jobPositionId]/run` | POST | AI 触发 Position 运行 |
| `/api/agent/runs/[runId]/context` | GET | Run 上下文 |
| `/api/agent/runs/[runId]/review` | POST | AI 审图 |
| `/api/mcp` | ALL | MCP Server |

## Next Steps

v0.3 Workflow 集成，详见 `design-v0.3-workflow-integration.md`。

## Repo Rules
- `main` 分支：唯一开发分支
- 使用 Conventional Commits
- 每次提交后推送到远程
