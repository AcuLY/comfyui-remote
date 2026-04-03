# Development Progress

## Project Overview

ComfyUI Remote — 移动优先的 ComfyUI 管理后台，覆盖：
- 项目管理 + Section Run 队列
- 宫格审图 + 回收站恢复
- 结果 Gallery + 精选标记 + 图片整合导出
- LoRA 文件管理 + 级联选择器
- 双 KSampler 参数 + Workflow 模板填充
- Worker / ComfyUI 对接
- Agent API + MCP Server
- Prompt Block 提示词块系统

## Current State (2026-03-27)

单体 Next.js 项目（App Router），前后端统一在 `main` 分支。v0.1 ~ v0.5 功能全部完成。

### 技术栈
- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- PostgreSQL 16 或 SQLite（可插拔），Prisma 7 ORM
- Worker 执行引擎（ComfyUI HTTP API 对接）
- MCP Server（Model Context Protocol）
- sharp（图片处理 / 缩略图 / 导出压缩）
- archiver（ZIP 打包）

### 页面清单（17 个页面）
| 路径 | 状态 |
|------|------|
| `/` → 重定向到 `/queue` | ✅ |
| `/queue` | ✅ 真实数据 |
| `/queue/[runId]` | ✅ 多选审核 + 快捷操作 |
| `/queue/[runId]/images/[imageId]` | ✅ 单图审核 + 快捷操作 |
| `/projects` | ✅ 创建/编辑/复制/运行 |
| `/projects/new` | ✅ 动态分类选择器 + presetBindings |
| `/projects/[projectId]` | ✅ 详情 + 修订历史 + 缩略图条 + 图片整合导出 |
| `/projects/[projectId]/edit` | ✅ 参数编辑 |
| `/projects/[projectId]/sections/[sectionId]/edit` | ✅ Section 编辑（KSampler1/2 + LoRA 三栏） |
| `/projects/[projectId]/sections/[sectionId]/blocks` | ✅ 提示词块编辑器 |
| `/projects/[projectId]/sections/[sectionId]/results` | ✅ 结果 Gallery（Lightbox + 精选标记） |
| `/trash` | ✅ 恢复按钮 |
| `/assets/loras` | ✅ 文件管理器（浏览 / 上传 / 移动 / 备注） |
| `/assets/prompts` | ✅ 提示词分类与预设管理（CRUD + 拖拽排序） |
| `/settings` | ✅ 设置首页 |
| `/settings/workflows` | ✅ 模板列表 + 导入 |

### API 路由清单

**核心业务 API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/projects` | GET/POST | 任务列表 / 创建 |
| `/api/projects/[projectId]` | GET/PATCH | 任务详情 / 更新 |
| `/api/projects/[projectId]/copy` | POST | 复制任务 |
| `/api/projects/[projectId]/run` | POST | 运行整个任务 |
| `/api/projects/[projectId]/sections/[sectionId]` | PATCH | 更新 Section 配置 |
| `/api/projects/[projectId]/sections/[sectionId]/run` | POST | 运行单个 Section |
| `/api/projects/[projectId]/revisions` | GET | 修订历史列表 |
| `/api/projects/[projectId]/revisions/[n]` | GET | 修订快照 |
| `/api/queue` | GET | 审核队列 |
| `/api/runs/[runId]` | GET | Run 详情 |
| `/api/runs/[runId]/review/keep` | POST | 批量保留 |
| `/api/runs/[runId]/review/trash` | POST | 批量删除 |
| `/api/images/[imageId]/restore` | POST | 恢复图片 |
| `/api/images/[imageId]/featured` | POST | 切换精选状态 |
| `/api/images/[...path]` | GET | 图片文件代理 |
| `/api/trash` | GET | 回收站列表 |
| `/api/loras` | GET/POST | LoRA 列表 / 上传（支持 targetDir） |
| `/api/loras/browse` | GET | LoRA 目录浏览（文件系统扫描） |
| `/api/loras/move` | POST | LoRA 文件移动 |
| `/api/loras/notes` | PUT | LoRA 文件备注（upsert） |
| `/api/project-create-options` | GET | 创建任务选项 |
| `/api/path-maps` | GET | 路径映射 |
| `/api/audit-logs` | GET | 审计日志 |
| `/api/workflows` | GET | Workflow 模板列表 |
| `/api/workflows/[id]` | GET | 模板详情 |
| `/api/workflows/import` | POST | 导入 workflow |
| `/api/health` | GET | 健康检查 |
| `/api/logs` | GET | 运行日志查询 |

**Worker API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/worker/process` | POST | Worker 处理 |
| `/api/worker/status` | GET | Worker 状态 |
| `/api/local/worker/pass` | POST | 本地手动触发 |

**Agent API**
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/agent/projects` | GET | Project 列表（搜索/筛选） |
| `/api/agent/projects/[projectId]/context` | GET | Project 上下文 |
| `/api/agent/projects/[projectId]/update` | PATCH | AI 更新 Project |
| `/api/agent/projects/[projectId]/run-all` | POST | AI 触发全部运行 |
| `/api/agent/sections/[sectionId]/run` | POST | AI 触发 Section 运行 |
| `/api/agent/runs/[runId]/context` | GET | Run 上下文 |
| `/api/agent/runs/[runId]/review` | POST | AI 审图 |
| `/api/mcp` | ALL | MCP Server |

## Version History

### v0.6 — 实体重命名
- CompleteJob → Project（项目）、CompleteJobPosition → ProjectSection（小节）、JobRevision → ProjectRevision
- URL 路径：/jobs → /projects、/positions → /sections
- Agent API 和 MCP Server 端点同步更新
- 全部文档同步更新术语

### v0.5 — 统一提示词分类系统
- 新增 PresetCategory + Preset + PresetVariant 通用模型，替代硬编码的 Character/Scene/Style/PositionTemplate
- 新增提示词管理页 `/assets/prompts`（分类 + 预设 CRUD，拖拽排序）
- 任务创建/编辑表单改为动态分类选择器 + presetBindings
- addSection 按分类排序自动生成 PromptBlock
- 展示层（队列、任务列表等）从 presetBindings 批量解析名称
- 删除旧设置页面和旧 CRUD actions
- 数据迁移脚本 `prisma/migrate-presets.ts`

### v0.4 — 结果管理 + LoRA 文件管理
- 独立结果 Gallery 页（按 Run 分组、3-5 列网格、Lightbox 放大）
- 精选标记（星形按钮 + F 快捷键，缩略图星标）
- 图片整合导出（kept→zip + featured→pixiv/，sharp 转 JPG）
- LoRA 文件管理器（磁盘目录浏览、上传、跨目录移动）
- LoRA 级联选择器（底部弹窗逐级目录导航）
- LoRA 备注（数据库绑定，文件移动时跟随）
- 结果缩略图条（Project 详情小节列表展示最近图片）

### v0.3 — Workflow 集成
- LoRA 分区管理（lora1 / lora2 二分区编辑）
- 双 KSampler 参数（可折叠面板，含 steps/cfg/sampler/scheduler/denoise/seed）
- 标准 workflow.api.json 填充器
- Prisma schema 适配 + Worker 集成

### v0.2 — Prompt Block 系统
- Prompt Block 提示词块（5 种类型，拖拽排序，库导入）
- 审图快捷操作（批量保留/删除 + 自动跳转下一组）

### v0.1 — 基础功能
- 数据库 + 页面 + Worker + Agent API + MCP Server

## Repo Rules
- `main` 分支：唯一开发分支
- 使用 Conventional Commits
- 每次提交后推送到远程
