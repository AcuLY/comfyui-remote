# Handoff

## 这是什么
ComfyUI Remote 是一个移动优先的 ComfyUI 管理后台。核心目标是把：
- 大任务管理
- Position Run 运行
- 宫格审图
- 回收站
- LoRA 上传
- 参数编辑
- Worker / ComfyUI 对接
- Agent 接口
放进一个统一系统里。

## 当前代码组织
- `main`：文档和整合基线
- `frontend`：页面、server action、前端数据接线
- `backend`：Prisma、API、worker、文件处理、ComfyUI 对接

## 当前完成度（接手时最该知道的）
### Frontend
已具备：
- `/queue` 队列页
- `/queue/[runId]` 宫格审核页
- `/queue/[runId]/images/[imageId]` 单图页
- `/trash` 回收站页
- `/jobs` / `/jobs/[jobId]` / `/jobs/new` / 编辑页
- `/assets/loras` LoRA 页

当前前端状态：
- 多数页面优先读真实 API，接口不可用时保留 mock fallback
- 审图 keep / trash 已接真实接口
- job create / copy / edit / run 已有真实动作接线
- build / lint 基线目前可通过

### Backend
已具备：
- Prisma schema
- seed / bootstrap
- queue / jobs / runs / trash / loras / agent 路由骨架
- review keep / trash / restore 真实逻辑
- job create / copy / patch / run 真实逻辑
- local worker pass
- ComfyUI prompt submit + history polling
- 输出图落库、缩略图生成、ImageResult 更新
- Agent context / update / review / single-position run 最小接口

当前后端状态：
- 已不是纯 mock API
- 已有最小 worker -> ComfyUI -> 输出落库链路
- build / lint 基线目前可通过

## 当前最主要的剩余工作
1. 进一步减少前端对 mock fallback 的依赖
2. 补一条清晰、可复现的本机手动验证路径
3. 视需要补 raw / kept / trashed 目录组织或文件归档逻辑
4. 视需要补 Character / Scene / Style / PositionTemplate 管理入口
5. 持续把 agent 写接口补完整

## 推荐接手顺序
### 如果你接前端
优先看：
- `src/app/queue/*`
- `src/app/jobs/*`
- `src/app/assets/loras/*`
- `src/lib/server-data.ts`

建议先做：
- 继续减少 mock fallback
- 完善错误提示 / loading / 提交反馈
- 做本机实际交互验证

### 如果你接后端
优先看：
- `prisma/schema.prisma`
- `src/app/api/**`
- `src/server/repositories/**`
- `src/server/services/**`
- `src/server/worker/**`

建议先做：
- 补本机验证说明
- 压实 worker / ComfyUI / output 链路
- 完善 job / run / review / lora 真实接口细节

## 接手前建议先看
1. `README.md`
2. `docs/design-v0.1.md`
3. `docs/development-progress.md`
4. `docs/development-todo.md`

## 当前文档状态
- `development-progress.md`：保留当前态，不再记录过细流水
- `development-todo.md`：只放尚未完成或仍值得跟进的项
- 如果新增大量历史细节，应优先放到 git history，而不是继续把 progress 写成日志
