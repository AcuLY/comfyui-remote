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
- `a898978` feat(frontend): wire job edit forms to patch api
- `c7202ef` feat(review): wire queue batch actions to api

Current state:
- 已有待审核队列页
- 已有宫格审核页
- 已有单图查看页
- 已有回收站页
- 已有 LoRA 页骨架
- 已有大任务详情和参数编辑页骨架
- 队列 / jobs / trash / loras 已优先读取真实 API，并保留 mock fallback
- 宫格审核页现在会优先读取 `/api/runs/:id` 的真实 run 数据，并在接口不可用时回退到 mock reviewGroups
- 宫格页上一组 / 下一组导航会优先基于真实 queue 列表计算，缺失时再回退到 mock 邻居，避免页面直接断掉
- 回收站页已对齐 `/api/trash` 返回结构，真实数据缺少预览图时也不会渲染报错
- LoRA 页面已接入真实上传表单：通过 server action 提交到 `/api/loras`，会校验 category / file，并在成功后刷新列表
- job 详情页 / 大任务编辑页 / position 编辑页 已改为优先读取 `/api/jobs/:id`，并在字段缺失时回退到 jobs 列表与本地模板默认值，避免后端数据尚未补齐时页面直接 notFound 或空白
- job 详情页的 position 列表会展示真实 latest run 状态与 pending 计数，便于先验证 job flow 的只读链路
- 宫格审核页的批量保留 / 删除按钮已接到真实 `/api/runs/:id/review/keep|trash`，支持客户端多选、提交态禁用、成功/失败反馈，并在提交后 refresh 当前页数据
- job 编辑页与 position 编辑页已改为真实 server action 表单，直接调用后端 `PATCH /api/jobs/:id` 与 `PATCH /api/jobs/:id/positions/:jobPositionId`，并在成功后 revalidate jobs/job detail 页面
- 表单现在会处理缺失 ID、batch size 非法值、接口失败提示与提交态禁用，方便本机先验证最小保存链路
- job detail 页的“运行整组 / 运行本节”已接到真实 `POST /api/jobs/:jobId/run` 与 `POST /api/jobs/:jobId/positions/:jobPositionId/run`，支持提交态禁用、成功/失败反馈与成功后 refresh/revalidate
- 禁用状态的 position 现在会在按钮层直接阻止单独运行，避免前端继续误触发已知会被后端拒绝的动作
- 已确认 frontend worktree 当前 `npm run lint` 可通过（包含本轮 run 按钮真实接线）

### Backend
Latest pushed commits:
- `6782994` feat(worker): consume queued runs in worker pass
- `887fe11` feat(worker): add queued run scaffold and payload drafts

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
- 目前尚未接入 ComfyUI prompt submit / history polling / 输出下载 / 缩略图生成，也尚未做完整本机启动验证

## Next Suggested Milestones
1. 验证并补齐本机 `npm install` / 全仓 `npm run lint` / 最小启动链路
2. 接入 ComfyUI prompt submit / history polling / 输出下载，把 worker 从本地状态机推进到真实执行链路
3. 预留图片缩略图生成与文件移动服务
4. 视情况补宫格页提交后的局部状态优化（如成功后清空选择 / 更细粒度提示）
5. 视需要补一个最小 worker 触发入口（脚本或受控 API）以便本机端到端验证

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
