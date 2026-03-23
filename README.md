# ComfyUI Remote

单仓库项目，长期目标是承载移动端审图、大任务管理、LoRA 上传、ComfyUI 调度、Agent 接口与 worker。

## 分支
- `frontend`：页面与交互
- `backend`：Prisma、API、worker、文件处理
- `main`：整合基线

## 当前后端基础
- Prisma 数据模型草案：`prisma/schema.prisma`
- Prisma client 入口：`src/lib/db.ts`
- API 返回工具：`src/lib/api-response.ts`
- 环境变量封装：`src/lib/env.ts`
- repository 骨架：`src/server/repositories/*`
- API 占位：`src/app/api/**`
- 路径映射：`config/path-maps.json`
- LoRA 上传服务：`src/server/services/lora-upload-service.ts`
- worker 目录：`src/server/worker/`

## 本地准备
1. 复制 `.env.example` 为 `.env`
2. 填写 `DATABASE_URL`
3. 执行：
```bash
npm install
npm run db:bootstrap
npm run lint
npm run dev
```

### 本地手动触发 worker pass
- 启动 `npm run dev` 后，可用 `POST /api/local/worker/pass?limit=1` 手动触发一次 worker pass。
- 该接口只允许 `localhost / 127.0.0.1 / ::1` 访问，默认处理 1 个 queued run，`limit` 最大 10。
- 当前 pass 会 claim queued run、校验 draft、向 ComfyUI 提交 `/prompt`，再轮询 `/history/:promptId`。
- 若 history 返回完成状态，会把 `PositionRun` 标记为 `done` 并回写 `comfyPromptId`；提交、轮询或超时失败则会标记为 `failed` 并记录错误。
- 当前仍未下载图片或生成缩略图；要让提交成功，`resolvedConfigSnapshot.extraParams` 里需要带实际的 ComfyUI graph（优先读取 `comfyPrompt`，也兼容 `workflowApiPrompt`）。

### 本地数据库 bootstrap
- `npm run prisma:db:push`：把当前 Prisma schema 同步到本地数据库（适合当前尚未正式维护 migration 的阶段）
- `npm run prisma:seed`：写入一组可直接驱动 queue / jobs / trash / loras 页面与 API 的最小样例数据
- `npm run db:bootstrap`：串联 generate + db push + seed，作为新的本地初始化默认入口

当前 seed 会写入：
- 2 个角色（Nakano Miku / Tangtang）
- 2 个 scene preset + 2 个 style preset
- 3 个 position template
- 2 个 complete job
- 3 个 position run（含待审核 / 已保留 / 已回收状态图片）
- 1 条 trash record
- 2 条 LoRA asset 记录

## 下一步
1. 接入真实 PostgreSQL
2. 生成 migration 并验证 Prisma client
3. 完成 queue/jobs/trash/loras 的真实 API
4. 增加 LoRA 上传与回收站恢复
5. 接入 ComfyUI worker
