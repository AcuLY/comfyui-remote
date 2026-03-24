# Development Progress

## Final Goal
完成 ComfyUI Remote 的本机可运行版本，覆盖：
- 大任务管理
- Position Run 队列与宫格审图
- 回收站恢复
- LoRA 上传到受控路径
- 前后端真实数据闭环
- Worker / ComfyUI 最小可运行链路

## Current State
### Frontend
最新重要提交：
- `8f5f409` fix(frontend): resolve server fetch origin from request headers
- `8c70ed0` feat(loras): load upload categories from path maps
- `5d45596` fix(queue): derive review neighbors from queue api

当前已完成：
- queue / review / single image / trash / jobs / lora 页面已建立
- 队列、jobs、trash、loras 已优先读取真实 API，并保留 fallback
- 单图 / 宫格审图已接 keep / trash 真实提交
- job create / copy / edit / run 的前端动作已接上真实接口
- LoRA 上传表单已接真实 `/api/loras`
- frontend 当前 lint / build 基线可通过

### Backend
最新重要提交：
- `13800fd` feat(agent): add position run endpoint
- `c647790` feat(agent): add update and review endpoints
- `b5a7d73` feat(agent): add run context endpoint

当前已完成：
- Prisma schema、seed、bootstrap 已有
- queue / jobs / runs / trash / loras / agent 已有最小真实 API
- review keep / trash / restore 已有真实逻辑
- job create / copy / patch / run 已有真实逻辑
- worker scaffold 已能消费 queued run
- 已接上 ComfyUI prompt submit / history polling
- 已支持输出下载/复制、ImageResult 落库、缩略图生成
- backend 当前 lint / build 基线可通过

## Verified Baseline
- `npm install` 可在 frontend/backend worktree 完成
- frontend: `cmd /c npm run lint`、`cmd /c npm run build` 可通过
- backend: `cmd /c npm run lint`、`cmd /c npm run build` 可通过
- 已有最小本机创建链路：`/jobs/new` -> 创建 draft -> 跳转到 edit
- 已有最小 worker 本地触发入口：`POST /api/local/worker/pass?limit=1`

## Active Gaps
- 前端部分页面仍保留 mock fallback，尚未全部切到真实数据主链路
- 本机从 seed -> enqueue -> local worker -> ComfyUI -> output images 的完整手动验证记录还不够清晰
- 文件归档策略（如 raw / kept / trashed）还未正式定稿并实现
- Character / Scene / Style / PositionTemplate 的正式管理入口还未补齐

## Next Recommended Steps
1. 补一条清晰、可复现的本机手动验证文档
2. 继续减少 queue / jobs / detail 页对 mock fallback 的依赖
3. 视需要补文件移动/归档逻辑
4. 视需要补模板配置管理入口
5. 继续完善 agent 写接口

## Repo / Branch Rules
- `main`: 共享文档、整合基线
- `frontend`: 前端页面、交互、页面级数据接入
- `backend`: Prisma、API、worker、文件处理、ComfyUI 对接
- 使用 Conventional Commits
- 每次提交后立即 push 到对应远程分支

## Automation Status
- 之前的自动开发 cron 已停用，当前以人工整理和接手友好为主
