# ComfyUI Manager 设计文档 v0.1

## 目标
做一个移动优先的 ComfyUI 管理后台，用来：
- 按 Character → 大任务 → Position Run 管理生成任务
- 以宫格方式批量审核图片
- 支持回收站恢复
- 在网页里直接管理提示词、画幅、 LoRA 等参数
- 支持直接运行整组任务或单个 position
- 为后续 Agent / AI 接入保留标准接口

## 非目标（当前阶段）
- 不做登录和权限系统
- 不把 git 作为主流程依赖
- 不先做 AI 调参功能
- 不做永久删除/回收站清空功能

## 技术选型
- 前端：Next.js（App Router）
- UI：Tailwind CSS + shadcn/ui
- 数据库：PostgreSQL
- ORM：Prisma
- 后台任务：Node worker
- 文件存储：本地磁盘
- 图片生成：ComfyUI HTTP API
- Agent 接口：HTTP API（后续可包一层 MCP）

## 核心对象模型

### 1. Character
固定角色配置：
- id
- name
- slug
- prompt
- **negativePrompt** (v0.2 新增)
- loraPath
- notes
- createdAt / updatedAt

### 2. ScenePreset
场景地点配置：
- id
- name
- prompt
- **negativePrompt** (v0.2 新增)
- notes

### 3. StylePreset
风格配置：
- id
- name
- prompt
- **negativePrompt** (v0.2 新增)
- notes

### 4. PositionTemplate
通用、可插拔的 position 模板：
- id
- name
- slug
- prompt
- negativePrompt
- defaultLoraConfig（可为空）
- defaultAspectRatio
- defaultBatchSize
- defaultSeedPolicy
- defaultParams（json）
- enabled

### 5. CompleteJob
一次完整大任务，由以下组成：
- characterId
- scenePresetId
- stylePresetId
- jobLevelPromptOverrides（json）
- status（draft / queued / running / partial_done / done / failed）
- createdAt / updatedAt

### 6. CompleteJobPosition
大任务中启用的某个 position（小节）：
- completeJobId
- **positionTemplateId (nullable, v0.2 改为可选)** — 不再强制绑定 PositionTemplate，支持无模板的自定义小节
- sortOrder
- enabled
- positivePrompt
- negativePrompt
- paramOverrides（json）
- latestRunId（可空）
- **promptBlocks[] (v0.2 新增)** — 提示词块列表，支持增删、排序、自定义编辑

### 6.1. PromptBlock (v0.2 新增)
提示词块，每个小节由多个块有序组成：
- id
- completeJobPositionId
- type (character / scene / style / position / custom)
- sourceId (可选，引用 Character/Scene/Style/PositionTemplate 的 ID)
- label (显示标签)
- positive (正面提示词内容)
- negative (负面提示词内容)
- sortOrder

**提示词模型变更说明（v0.2）**：
- Character/Scene/Style/PositionTemplate 都是预制的提示词块来源
- 新建小节时，角色/地点/风格的块自动填入
- 可从 Position 提示词库选一组导入
- 可添加自定义块
- 所有块支持调整顺序、编辑内容、删除
- 最终按顺序 join 成完整 positive/negative 发给 ComfyUI

### 7. PositionRun
某个大任务中的单个 position 实际运行记录：
- completeJobId
- completeJobPositionId
- runIndex
- status（queued / running / done / failed / cancelled）
- resolvedConfigSnapshot（json）
- comfyPromptId（可空）
- outputDir
- startedAt / finishedAt
- errorMessage

### 8. ImageResult
某次 run 生成的单张图片：
- positionRunId
- filePath
- thumbPath
- width / height
- fileSize
- reviewStatus（pending / kept / trashed）
- reviewAt（可空）
- createdAt

### 9. TrashRecord
软删除记录：
- imageResultId
- originalPath
- trashPath
- deletedAt
- restoredAt（可空）
- reason（可空）
- operator（system / user / agent）

### 10. LoraAsset
本地 LoRA 文件登记：
- id
- name
- category
- fileName
- absolutePath
- relativePath
- size
- source
- notes
- uploadedAt

### 11. AuditLog
操作日志：
- entityType
- entityId
- action
- payload（json）
- actorType（user / system / agent）
- createdAt

## 审核状态定义
- pending：待审核，出现在待审核队列
- kept：审核通过，留在正常目录，不再出现在待审核队列
- trashed：移入回收站，可恢复

## 主要页面

### 1. 待审核队列
默认入口。
展示最新 Position Run 倒序列表，并显示：
- Character
- Position 名称
- 生成时间
- 未审核数量
- 总张数
- 快速进入宫格页

### 2. 宫格审核页
单位是一个 Position Run。
支持：
- 宫格展示（单页最多 9 张）
- 多选
- 批量保留
- 批量删除
- 单张放大查看
- 左右切换上一组/下一组 run
- 三点菜单进入参数编辑

### 3. 单张查看页 / Lightbox
支持：
- 查看大图
- 左右切换同组图片
- 返回宫格
- 查看基础元数据

### 4. 大任务详情页
展示：
- Character / Scene / Style 配置
- position 列表
- 每个 position 的当前参数覆盖
- 最近运行状态
- 支持运行整个大任务
- 支持单独运行某个 position
- 支持复制大任务

### 5. 参数编辑页
两个入口：
- 结果页三点菜单
- 大任务详情页
默认编辑“当前大任务”的配置，不改全局 position 模板。
字段首版包含：
- character prompt
- scene prompt
- style prompt
- positive prompt override
- negative prompt override
- LoRA
- 画幅
- batch size
- seed policy
- extra params（json）

### 6. 回收站页
展示：
- 已删除图片
- 原所属 run
- 删除时间
- 恢复按钮

### 7. LoRA 资源页
支持：
- 上传 LoRA 文件
- 选择目标分类路径
- 查看当前已登记的 LoRA
- 复制/查看目标路径

## 文件组织建议

### 项目配置目录
使用磁盘配置文件保存较稳定的模板类数据：
- config/characters/*.json
- config/scene-presets/*.json
- config/style-presets/*.json
- config/position-templates/*.json
- config/path-maps.json
- config/workflows/*.json

### 运行数据
运行态数据以 PostgreSQL 为主。

### 图片文件
- data/images/<job>/<run>/raw/
- data/images/<job>/<run>/thumb/
- data/images/.trash/

### LoRA 文件
- data/assets/loras/characters/
- data/assets/loras/styles/
- data/assets/loras/poses/
- data/assets/loras/misc/

实际可通过 path map 映射到 ComfyUI 本地 models/loras 对应目录。

## 关键流程

### 1. 创建并运行大任务
1. 创建 CompleteJob
2. 选择 Character / Scene / Style
3. 勾选 position 列表并设置覆盖参数
4. 点击运行全部
5. 系统为每个启用 position 生成 PositionRun
6. worker 依次/并发调用 ComfyUI API
7. 下载输出、生成缩略图、写入数据库

### 2. 运行单个 position
1. 进入大任务详情
2. 对某个 position 点“运行”
3. 生成新的 PositionRun
4. worker 执行并回写结果

### 3. 审核图片
1. 进入待审核队列
2. 打开某个 PositionRun 宫格
3. 勾选若干图片
4. 点击“保留”或“删除”
5. 保留：更新 reviewStatus=kept
6. 删除：文件移入回收站，写 TrashRecord，reviewStatus=trashed

### 4. 恢复图片
1. 进入回收站
2. 选择图片点击恢复
3. 文件移回 originalPath
4. 更新 TrashRecord.restoredAt
5. ImageResult.reviewStatus 改回 pending 或 kept（首版建议恢复为 pending）

### 5. 上传 LoRA
1. 进入 LoRA 资源页
2. 上传文件并选择目标分类
3. 后端按 path map 写入对应本地目录
4. 写入 LoraAsset 记录

## API 初稿

### Job / Run
- GET /api/jobs
- POST /api/jobs
- GET /api/jobs/:id
- PATCH /api/jobs/:id
- POST /api/jobs/:id/copy
- POST /api/jobs/:id/run
- POST /api/jobs/:id/positions/:jobPositionId/run
- GET /api/runs/:id
- GET /api/queue

### Prompt Blocks (v0.2)
- GET /api/jobs/:jobId/positions/:jobPositionId/blocks — 列出某个小节的所有提示词块
- POST /api/jobs/:jobId/positions/:jobPositionId/blocks — 创建新提示词块（body 为对象）
- POST /api/jobs/:jobId/positions/:jobPositionId/blocks — 重排序（body 为 blockId 数组）
- PATCH /api/jobs/:jobId/positions/:jobPositionId/blocks/:blockId — 更新某个块的内容
- DELETE /api/jobs/:jobId/positions/:jobPositionId/blocks/:blockId — 删除某个块

**前端页面（v0.2 Phase 3）**：
- `/jobs/[jobId]/positions/[positionId]/blocks` — 提示词块编辑器页面
- `PromptBlockEditor` 客户端组件：块列表、内联编辑、新增/删除、上下移动排序、合成提示词预览
- 类型标签（角色/场景/风格/Position/自定义）带颜色区分
- Job 详情页 Position 列表显示 block 数量 + 快捷入口
- Server Actions：list/add/update/delete/reorder

**迁移工具（v0.2 Phase 4）**：
- `src/scripts/migrate-prompt-blocks.mts` — 为旧 Position 补生成 PromptBlocks（支持 `DRY_RUN=1`）

**MCP Server（v0.2 Phase 4）**：
- 5 个 PromptBlock Tools：`list_prompt_blocks` / `add_prompt_block` / `update_prompt_block` / `remove_prompt_block` / `reorder_prompt_blocks`
- 1 个 Resource：`comfyui://positions/{positionId}/blocks`
- Job context resource 已包含每个 Position 的 `promptBlocks` 数组和 `promptDraft`

### Review
- POST /api/runs/:id/review/keep
- POST /api/runs/:id/review/trash
- POST /api/images/:id/restore
- GET /api/trash

### Assets
- GET /api/loras
- POST /api/loras/upload
- GET /api/path-maps

### Agent / Automation
- GET /api/agent/jobs/:id/context
- POST /api/agent/jobs/:id/update
- POST /api/agent/runs/:id/review
- POST /api/agent/positions/:jobPositionId/run

## Worker 职责
- 轮询或消费待执行 PositionRun
- 组装 ComfyUI API payload
- 提交 /prompt
- 轮询 /history
- 下载输出图片
- 生成缩略图
- 写入 ImageResult
- 更新 PositionRun 状态
- 记录错误与日志

## 版本历史建议
不用 git 做主事实源，但仍建议做系统内版本记录：
- 大任务每次保存生成一条 revision
- 可记录 diff payload
- 便于以后回溯“这一轮参数怎么改过”

## AI / Agent 扩展位
先不开发 AI 调参，但接口设计要支持：
- 读取某个 job 的完整上下文
- 读取某个 position run 结果摘要
- 提交结构化参数修改建议
- 触发单个 position 重跑
- 批量审图操作

## 实现状态

> ✅ v0.1 和 v0.2 的所有功能均已实现。详见 `development-progress.md`。
>
> v0.3 规划详见 `design-v0.3-workflow-integration.md`。
