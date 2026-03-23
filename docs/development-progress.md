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
- `043a0dd` feat(frontend): wire lora upload form
- `de0d859` feat(frontend): prefer api data with mock fallback

Current state:
- 已有待审核队列页
- 已有宫格审核页
- 已有单图查看页
- 已有回收站页
- 已有 LoRA 页骨架
- 已有大任务详情和参数编辑页骨架
- 队列 / jobs / trash / loras 已优先读取真实 API，并保留 mock fallback
- 回收站页已对齐 `/api/trash` 返回结构，真实数据缺少预览图时也不会渲染报错
- LoRA 页面已接入真实上传表单：通过 server action 提交到 `/api/loras`，会校验 category / file，并在成功后刷新列表
- 已确认 frontend worktree 当前 `npm run lint` 可通过（包含本轮 LoRA 上传改动）

### Backend
Latest pushed commits:
- `d2f2633` feat(backend): add local prisma bootstrap seed
- `b74b4b1` fix(backend): make lora api json-safe

Current state:
- 已有 Prisma schema 草案
- 已有 db/env/api-response 基础层
- 已有 queue/jobs/trash/loras API 占位
- 已有 LoRA 路径映射与上传服务骨架
- 已实现 keep / trash / restore 的最小真实审图逻辑（Prisma + TrashRecord）
- 已把 review 接口请求校验与错误映射上收至 service 层，路由更薄，后续更容易接前端真实调用
- keep 动作现在会同时关闭未恢复的 TrashRecord，避免图片从回收站“保留”后状态残留
- `/api/loras` 现在会把 BigInt/Date 转成可安全 JSON 返回的结构，避免真实 LoRA 列表接口在序列化阶段报错
- LoRA 上传现在会把 category / env 配置错误区分成明确的 4xx/5xx 响应，前端接真实上传表单时更容易处理
- 已增加 `prisma/seed.ts` 与 `npm run db:bootstrap`：当前可用 `generate + db push + seed` 一次性初始化本地数据库
- seed 会写入 queue/jobs/trash/loras 相关的最小样例数据，便于本机先跑通 API 与页面
- 目前尚未接入真实数据库迁移和完整业务逻辑

## Next Suggested Milestones
1. 前端改为优先读取真实 API，保留 mock fallback
2. 后端补种子数据 / 初始化方案，方便本地跑起来
3. 打通 queue/jobs/trash/loras 的最小真实闭环
4. 增加图片 review keep/trash/restore 的真实逻辑
5. 增加 LoRA 上传前端真实调用
6. 接入 worker scaffold 与 ComfyUI run pipeline

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
