# Development Progress

## Final Goal
完成 ComfyUI Remote 整个项目的开发，使其在本机可以无报错启动并完成核心流程：
- 大任务管理
- Position Run 队列与宫格审图
- 回收站恢复
- LoRA 上传到受控路径
- 基础 API / 数据层 / Worker 骨架
- 前后端接到真实数据而不是纯 mock

完成后：删除本项目的 15 分钟 cron 定时任务。

## Working Directories
- Main repo: `D:\luca\code\myproject\comfyui-manager`
- Frontend worktree: `D:\luca\code\myproject\comfyui-manager-frontend`
- Backend worktree: `D:\luca\code\myproject\comfyui-manager-backend`

## Branch Rules
- `main`: 共享文档、整合基线
- `frontend`: 前端页面、交互、页面级数据接入
- `backend`: Prisma、API、文件处理、worker、ComfyUI 对接

## Commit / Push Rules
- 必须使用 Conventional Commits
- 每次提交后必须立即 push 到对应远程分支
- 优先做小步可验证改动

## Current Status
### Frontend
Latest pushed commits:
- `8c70ed0` feat(loras): load upload categories from path maps
- `5d45596` fix(queue): derive review neighbors from queue api
- `b35684f` fix(jobs): wire detail copy action

Current state:
- 已有待审核队列页
- 已有宫格审核页
- 已有单图查看页
- 已有回收站页
- 已有 LoRA 页骨架
- 已有大任务详情和参数编辑页骨架
- 队列 / jobs / trash / loras 已优先读取真实 API，并保留 mock fallback
- 宫格审核页现在会优先读取 `/api/runs/:id` 的真实 run 数据，并在接口不可用时回退到 mock reviewGroups
- 宫格页上一组 / 下一组导航现已统一基于真实 queue 列表计算，不再伪造 mock 邻居；若当前 run 暂未出现在队列列表中，则安全地不渲染上一组 / 下一组链接，避免真实数据与导航错位
- 回收站页已对齐 `/api/trash` 返回结构，真实数据缺少预览图时也不会渲染报错
- LoRA 页面已接入真实上传表单：通过 server action 提交到 `/api/loras`，会校验 category / file，并在成功后刷新列表
- job 详情页 / 大任务编辑页 / position 编辑页 已改为优先读取 `/api/jobs/:id`，并在字段缺失时回退到 jobs 列表与本地模板默认值，避免后端数据尚未补齐时页面直接 notFound 或空白
- job 详情页的 position 列表会展示真实 latest run 状态与 pending 计数，便于先验证 job flow 的只读链路
- 宫格审核页的批量保留 / 删除按钮已接到真实 `/api/runs/:id/review/keep|trash`，支持客户端多选、提交态禁用、成功/失败反馈，并在提交后 refresh 当前页数据
- job 编辑页与 position 编辑页已改为真实 server action 表单，直接调用后端 `PATCH /api/jobs/:id` 与 `PATCH /api/jobs/:id/positions/:jobPositionId`，并在成功后 revalidate jobs/job detail 页面
- 表单现在会处理缺失 ID、batch size 非法值、接口失败提示与提交态禁用，方便本机先验证最小保存链路
- job detail 页的“运行整组 / 运行本节”已接到真实 `POST /api/jobs/:jobId/run` 与 `POST /api/jobs/:jobId/positions/:jobPositionId/run`，支持提交态禁用、成功/失败反馈与成功后 refresh/revalidate
- 禁用状态的 position 现在会在按钮层直接阻止单独运行，避免前端继续误触发已知会被后端拒绝的动作
- 宫格审核页提交成功后现在会立即清空本地多选，并自动忽略当前 run 数据里已不存在的旧选中项，减少 refresh 前后残留勾选带来的误操作
- 已确认 frontend worktree 当前 `npm run lint` 可通过（包含本轮宫格页提交后本地状态收口）
- 已确认 frontend/backend worktree 当前 `npm install` 可在本机完成（依赖已是 up to date）
- 已修复 frontend `src/app/jobs/actions.ts` 的重复导出与类型收窄问题；`npm run build` 现可通过
- 已为 frontend/backend 设置 `next.config.ts -> turbopack.root = __dirname`，消除多 lockfile 场景下的 workspace root 推断警告
- jobs 列表页现在会展示后端返回的真实启用 position 数、最近一次 run 状态与 pending/total 审核统计，并把首页“编辑/运行整组”入口直接接到真实页面与 server action，继续减少 jobs 首页对 mock 信息的依赖
- jobs 列表页的“复制”按钮已接到真实 server action：会调用后端 `POST /api/jobs/:jobId/copy` 复制整条任务及其 position 覆盖，创建新的 draft，并在成功后提供进入新草稿编辑页的入口
- jobs 列表页已接上 query-string 驱动的筛选 UI（search/status/enabledOnly/hasPending），支持关键词搜索、状态过滤、仅看有启用 position、仅看 latest run 仍有 pending 审核的任务，也保留 `/jobs?...` 可分享/可回放的筛选链接
- jobs 列表页已新增“新建任务”入口；frontend 新增 `/jobs/new` 页面与真实 server action 表单，可选择 Character / Scene / Style / Position templates 并直接调用 `POST /api/jobs` 创建 draft
- `/jobs/new` 的创建动作现已在成功后直接 `redirect` 到 `/jobs/:id/edit`，并为表单补上提交态 `aria-busy`；本轮已再次确认 frontend worktree `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（提交：`53c1294` `fix(jobs): redirect after draft creation`）
- 已补一条最小创建链路验证记录：当前本机链路已具备 `/jobs/new` 读取真实 `GET /api/job-create-options`、提交真实 `POST /api/jobs`、成功后由 frontend server action `redirect` 到 `/jobs/:id/edit` 的闭环；本轮基于最新已推送 frontend/backend 提交与再次检查的三个 worktree 状态，将该链路记录为当前最小可操作启动路径
- 单图查看页 `/queue/:runId/images/:imageId` 已改为优先读取真实 `GET /api/runs/:id` 返回的 run 图片数据，不再是纯 mock-only 页面；单图页的“保留 / 删除”按钮也已复用真实 review server action，支持直接提交单张 keep / trash 并在成功后 refresh 当前 run 数据
- 已再次确认 frontend worktree `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（包含本轮单图页真实数据与单张审图动作接线）
- job detail 页原本只是占位的“复制任务”按钮现已复用真实 `JobCopyButton` / `copyJobAction`，详情页与 jobs 列表页的复制行为一致；frontend worktree 已再次验证 `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（提交：`b35684f` `fix(jobs): wire detail copy action`）
- 宫格审核页右上角“参数编辑”已不再是死按钮：当前会优先使用真实 `GET /api/runs/:id` 返回的 `jobId` / `jobPositionId` 跳转到对应 position 编辑页；mock fallback 场景则保持禁用态，避免错误跳转
- LoRA 上传页不再把分类写死在前端：现在会优先读取真实 `/api/path-maps` 的 `loraCategories` 并渲染上传下拉选项，接口不可用时才回退到内置默认分类
- LoRA 上传页会同时展示当前分类到相对目录的映射，方便本机直接确认上传目标路径；upload server action 也已移除前端硬编码分类白名单，改为只校验非空并直接复用后端返回的错误信息
- 本轮已再次确认 frontend worktree `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（提交：`8c70ed0` `feat(loras): load upload categories from path maps`）

### Backend
Latest pushed commits:
- `b5a7d73` feat(agent): add run context endpoint
- `133dc1a` feat(agent): add job context endpoint
- `cd0cc35` feat(review): expose run edit identifiers

Current state:
- 已有 Prisma schema 草案
- 已有 db/env/api-response 基础层
- 已有 queue/jobs/trash/loras API 占位
- 已有 LoRA 路径映射与上传服务骨架
- 已实现 keep / trash / restore 的最小真实审图逻辑（Prisma + TrashRecord）
- 已把 review 接口请求校验与错误映射上收至 service 层，路由更薄，后续更容易接前端真实调用
- 已新增 `GET /api/runs/:id`：会从 Prisma 真实读取单个 PositionRun 的标题 / 角色 / position / 审核图片列表，供宫格页直接渲染
- run 详情接口会优先返回 `thumbPath`，否则回退到原图路径；图片标签按稳定顺序生成两位编号，便于宫格页先跑通
- keep 动作现在会同时关闭未恢复的 TrashRecord，避免图片从回收站“保留”后状态残留
- `/api/loras` 现在会把 BigInt/Date 转成可安全 JSON 返回的结构，避免真实 LoRA 列表接口在序列化阶段报错
- LoRA 上传现在会把 category / env 配置错误区分成明确的 4xx/5xx 响应，前端接真实上传表单时更容易处理
- 已增加 `prisma/seed.ts` 与 `npm run db:bootstrap`：当前可用 `generate + db push + seed` 一次性初始化本地数据库
- seed 会写入 queue/jobs/trash/loras 相关的最小样例数据，便于本机先跑通 API 与页面
- 已确认 backend worktree 当前 `npm run lint` 可通过（包含本轮 jobs run enqueue 接口改动）
- 已补上 job 保存入口：`PATCH /api/jobs/:id` 可保存任务级 prompt / LoRA / aspect ratio / batch size 覆盖
- 已补上 position 保存入口：`PATCH /api/jobs/:id/positions/:jobPositionId` 可保存 position 级 prompt / aspect ratio / batch size / seed policy 覆盖
- 已补上最小可用的 run 入口：`POST /api/jobs/:jobId/run` 会为所有启用 position 创建 `queued` 的 `PositionRun`，递增 `runIndex`，更新 `latestRunId`，必要时把 job 状态置为 `queued`
- 已补上最小可用的单 position run 入口：`POST /api/jobs/:jobId/positions/:jobPositionId/run` 会校验 position 属于当前 job 且已启用，再创建单条 `queued` run
- jobs service 已统一 PATCH / run 请求的 ID 校验与错误映射，空 position / disabled position 会返回明确 409，便于前端下一步直接接运行按钮
- 已补上 worker 最小 scaffold：`src/server/worker/index.ts` 可扫描 queued runs；`repository.ts` 会读取待执行 run 快照；`payload-builder.ts` 会把 `resolvedConfigSnapshot` 规范化并产出占位的 ComfyUI prompt draft
- worker pass 现在会真实消费 queued runs：逐条 claim 为 `running`、执行最小 processing step，并在成功时写回 `done`、失败时写回 `failed` 与 `errorMessage`
- `repository.ts` 已补上 worker 侧 claim / complete 流程：会写 `startedAt` / `finishedAt`、清理旧错误、回填 `comfyPromptId` / `outputDir`（若有）并同步更新 CompleteJob 状态
- worker report 现在会返回本轮 claimed / skipped / failed 计数及每条 run 的最终状态，便于后续挂接真实 ComfyUI 调用前先验证状态机
- 已确认 backend worktree 当前 `npm run lint` 可通过（本轮使用 `cmd /c npm run lint` 以绕过本机 PowerShell execution policy 对 `npm.ps1` 的限制）
- 已补一个本地受控 worker 触发入口：`POST /api/local/worker/pass?limit=1`，仅允许 localhost 访问，默认处理 1 条 queued run（最多 10 条），便于本机先验证 queue -> worker 的最小闭环
- backend README 与 worker README 已同步更新本地手动触发说明；worker 现在会校验 draft、向 ComfyUI 提交 `/prompt`，并轮询 `/history/:promptId`，提交成功时回写 `comfyPromptId`
- worker 若在提交、轮询或超时阶段失败，会把 run 标记为 `failed` 并记录错误，便于先验证真实 ComfyUI 状态回写链路
- 已新增 `COMFY_REQUEST_TIMEOUT_MS` / `COMFY_HISTORY_POLL_INTERVAL_MS` / `COMFY_HISTORY_MAX_ATTEMPTS` 到 env 示例，方便本机调 ComfyUI 时控制超时与轮询频率
- backend worktree 当前 `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（包含本轮 ComfyUI 提交/轮询接线）
- worker 现会从 ComfyUI history 提取输出图片清单，优先从本地 `IMAGE_BASE_DIR` 复制原图，缺失时回退到 ComfyUI `/view` 下载，再把文件落到受控的 `data/images/<job>/<position>/run-xx/raw/`
- worker 完成 run 时会同步重建该 run 的 `ImageResult` 记录，并写回 `filePath` / `fileSize`；失败时会清理本轮受控输出目录，避免残留半成品
- worker 现在会为每张持久化后的输出图生成 `data/images/<job>/<position>/run-xx/thumb/NN.jpg` 缩略图，并回填 `ImageResult.thumbPath` / `width` / `height`
- backend worktree 当前 `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（包含本轮缩略图与元数据提取改动）
- 本轮再次验证 backend worktree `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过，且已消除 workspace root 推断警告
- jobs 列表接口现在会返回真实启用 position 数、最新 run 时间/状态，以及该最新 run 的 pending/total 审核统计，方便前端 jobs 首页直接展示真实概览
- jobs 列表接口已支持 query params：`search`（title / slug / character / scene / style）/ `status` / `enabledOnly` / `hasPending`；查询校验放在 service 层，路由只负责解析 searchParams 并返回统一错误结构
- 已补 `POST /api/jobs/:jobId/copy`：会复制 job 基础配置、jobLevelOverrides 与全部 position 覆盖，自动生成唯一 title/slug，并把新任务创建为 `draft`
- backend/frontend worktree 当前 `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（包含本轮 jobs 列表筛选与搜索链路）
- 已在 backend worktree 实装 `POST /api/jobs` 的最小真实创建链路：校验 `title` / `characterId` / 可选 scene/style preset / `positionTemplateIds`，创建 draft `CompleteJob` 与有序 `CompleteJobPosition`，并返回现有 job detail 结构
- job 创建会基于 title 生成唯一 slug，并对 Character / ScenePreset / StylePreset / PositionTemplate 缺失或 disabled 场景返回明确错误映射，便于下一步前端接入“新建任务”表单
- 本轮已再次验证 backend worktree `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（包含本轮 draft job creation API 改动）
- `POST /api/jobs` 已于 backend 分支提交并 push（`96802d2` feat(jobs): add draft job creation api）；本次提交实际通过 `cmd /c git ...` 完成，绕过了 PowerShell 直跑 git commit 时的 worktree lock/quote 问题
- backend 已新增 `GET /api/job-create-options`，会返回当前可用的 Character / ScenePreset / StylePreset / PositionTemplate 元数据，供新建任务表单直接读取真实选项
- `GET /api/runs/:id` 现在会额外返回真实 `jobId` 与 `jobPositionId`，供队列宫格页直接跳转回对应的 position 参数编辑页，进一步减少 review flow 上的占位按钮
- backend 已新增 agent 上下文接口：`GET /api/agent/jobs/:jobId/context` 会返回 job 概览、已启用 position 的 resolved prompt/config 与最新 run 汇总，便于后续自动化或外部 agent 直接读取结构化任务上下文
- backend 已新增 `GET /api/agent/runs/:runId/context`：会返回 run / job / position 元数据、`resolvedConfigSnapshot`、输出图片清单与 review 汇总，便于后续 agent 审图或诊断 run，而不必复用前端宫格专用 payload
- 本轮再次验证 backend worktree `cmd /c npm run lint` 与 `cmd /c npm run build` 可通过（包含 agent run context endpoint）
- 本轮重新检查三个 worktree 均干净，且当前分支头分别为：main `a0121ce`、frontend `8c70ed0`、backend `b5a7d73`
- frontend/backend 当前仍可继续作为本机可启动基线

## Next Suggested Milestones
1. 视需要补一次本机手动验证记录（seed -> enqueue -> local worker pass -> ComfyUI history -> output images）
2. 继续减少 jobs / queue / detail 页对 mock fallback 的依赖，并补真实启动链路中的剩余缺口
3. 视情况补文件移动/归档服务（若后续 review flow 需要从 raw 拆分 kept/trashed 路径）
4. 视需要把 Character / Scene / Style / PositionTemplate 管理页或配置来源补成更正式的可维护入口
5. 继续补 agent 侧写接口（如结构化 review/update），让现有 agent context endpoint 逐步形成读写闭环

## Cron Job
- Job ID: `44d5a257-0ff6-4dee-a6e9-e249a0399055`
- Schedule: every 15 minutes
- Mode: isolated, no-deliver

创建成功后要把 Job ID 回填到这里。

## Per-Run Protocol
每次被 cron 唤起后：
1. 先读 `docs/design-v0.1.md`
2. 再读本文件 `docs/development-progress.md`
3. 再读 `docs/development-todo.md`
4. 检查三个 worktree 的 git status 与最近提交
5. 只做一个或少数几个连续的小目标，不要同时改太多层
6. 完成后更新 progress / todo 文档
7. 该提交推到对应分支后再结束本轮
8. 如果项目已经达到最终目标，执行 `openclaw cron rm <job-id>` 删除定时任务，并在文档中标记完成
