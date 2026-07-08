# 本机验证指南

Classification: runbook
Update trigger: auth token workflow, `npm run dev` / `next dev` startup, `next start` production verification, ComfyUI connectivity, protected pages, database bootstrap, or local end-to-end verification changes.

从零开始搭建、运行并验证 ComfyUI Remote 的完整链路。

## Service And Auth Matrix

| Scope | Command or route | Verification | Boundary |
| --- | --- | --- | --- |
| Dev service | `npm run dev` or `next dev` | Open `http://localhost:3000/login` or another local route. | Dev-service start/stop/restart rules live in `agent-rules/dev-service.md`; do not upgrade this into production verification. |
| Local production service | `npm run start` or `next start` after a production build | Verify the configured local production port, such as `/login`, through `agent-rules/deploy/verification.md`. | Only use this when the task is explicitly production-service verification or deploy flow. |
| Auth token | `GET /api/auth/verify` | Read the token from project-root `.env`, set it as the expected auth cookie/header for protected pages, and verify the response without printing the token. | The token value must never be hard-coded, logged, or committed. |
| Protected pages | `/projects`, `/queue`, `/assets/*`, `/settings/*`, and training pages when auth is enabled | Verify after `/api/auth/verify` succeeds; redirects to `/login` mean the auth context was not applied. | Keep local UI verification compatible with the `.env` token workflow in `AGENTS.md`. |
| ComfyUI runtime | `COMFY_API_URL` and `/api/worker/status` | Confirm the worker status response reports ComfyUI connectivity before queue/run checks. | `/api/queue` is the review queue; active work state is owned by `/api/worker/status`, `/api/queue-data`, `pause-active`, and `resume-paused`. |

## 前置条件

- Node.js 20+
- Docker（用于运行 PostgreSQL）
- ComfyUI 实例（本地或远程，默认 `http://127.0.0.1:8188`）
- 至少一个 SDXL checkpoint 模型（如 `sd_xl_base_1.0.safetensors`）

## Step 1: 环境准备

```bash
# 1. 克隆并安装依赖
git clone <repo-url> comfyui-remote
cd comfyui-remote
npm install

# 2. 启动 PostgreSQL
docker compose up -d

# 3. 配置环境变量
cp .env.example .env
```

编辑 `.env`，根据你的环境修改：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/comfyui_manager"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
COMFY_API_URL="http://127.0.0.1:8188"
MODEL_BASE_DIR="/path/to/ComfyUI/models"
OUTPUT_BASE_PATH="/path/to/managed-or-comfy-output"
```

- `COMFY_API_URL`：你的 ComfyUI API 地址
- `MODEL_BASE_DIR`：ComfyUI 的模型目录，用于推导 `loras` 和 `checkpoints` 子目录
- `OUTPUT_BASE_PATH`：图片 serving 根目录；默认读取项目 `data/images`，设计壳或本地验证需要展示外部输出时可指向对应目录。Worker 生成结果会写入 managed `data/images`，必要时通过 ComfyUI `/view` 下载输出。

## Step 2: 初始化数据库

```bash
# 生成 Prisma client
npm run prisma:generate

# 运行 migration + seed（填充测试角色、场景、风格、Section 模板）
npm run db:bootstrap
```

## Step 3: 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 ，应该看到待审核队列页面（初始为空）。

## Step 4: 创建项目

1. 点击底部导航 **Projects** 进入任务列表
2. 点击 **创建新任务**
3. 填写任务标题，选择 Character / Scene / Style
4. 勾选要启用的 Section（如 portrait, full_body 等）
5. 提交创建

或者通过 REST API：

```bash
curl -X POST http://localhost:3000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Test Project",
    "presetBindings": [{ "categoryId": "<category-id>", "presetId": "<preset-id>" }]
  }'
```

> 提示：可通过 `GET /api/project-create-options` 获取可用的 Character / Scene / Style / Section ID。

## Step 5: 运行任务（入队）

**通过页面：** 在 Project 详情页点击 **Run All** 或对单个 Section 点击 **Run**。

**通过 API：**

```bash
# 运行整个任务
curl -X POST http://localhost:3000/api/projects/<projectId>/run

# 或运行单个 Section
curl -X POST http://localhost:3000/api/projects/<projectId>/sections/<sectionId>/run
```

此时 Run 状态变为 `queued`。

## Step 6: Worker 执行

⚠️ **确保 ComfyUI 已启动且可访问**（`COMFY_API_URL` 指向的地址可达）。

Worker 会自动轮询并处理 `queued` 状态的 Run。Worker 会执行以下流程：
1. claim 一个 `queued` 的 Run
2. 规范化配置快照
3. 构建 ComfyUI prompt draft
4. 提交到 ComfyUI `/prompt` 接口
5. 轮询 ComfyUI `/history/:promptId`
6. 下载/复制输出图片到 `data/images/<project>/<section>/run-XX/raw/`
7. 使用 sharp 生成缩略图到 `data/images/<project>/<section>/run-XX/thumb/`
8. 写入 ImageResult 记录
9. 标记 Run 为 `done`

成功响应示例：

```json
{
  "scannedAt": "2026-03-24T...",
  "queuedRunCount": 1,
  "claimedRunCount": 1,
  "skippedRunCount": 0,
  "failedRunCount": 0,
  "drafts": [...]
}
```

## Step 7: 审图

1. 回到首页 `/queue`，可以看到刚完成的 Run
2. 点击进入宫格审核页
3. 多选图片，点击 ✅ 保留 或 🗑 删除
4. 被删除的图片会移入 `data/images/.trash/` 目录

## Step 8: 回收站恢复

1. 回到 `/queue`
2. 切换到 `回收站` tab
3. 点击恢复，图片文件移回原始路径，状态变回 `pending`

## 验证 Worker 状态

```bash
curl http://localhost:3000/api/worker/status
```

返回队列统计和 ComfyUI 连通性信息。

## 验证 Agent API

```bash
# 获取 Project 上下文
curl http://localhost:3000/api/agent/projects/<projectId>/context

# 获取 Run 上下文
curl http://localhost:3000/api/agent/runs/<runId>/context

# AI 审图
curl -X POST http://localhost:3000/api/agent/runs/<runId>/review \
  -H 'Content-Type: application/json' \
  -d '{"imageIds": ["<imageId>"], "action": "keep"}'
```

## 常见问题

### Worker 返回 `failed`
- 检查 `COMFY_API_URL` 是否可达
- 检查 ComfyUI 是否正在运行
- 查看响应中的 `errorMessage` 字段获取详细信息

### 图片不显示
- 确认 `OUTPUT_BASE_PATH` 指向当前需要展示的 managed image 根目录，或保留默认 `data/images`
- 确认 Worker 能通过 HTTP 从 ComfyUI `/view` 接口下载输出并写入 managed image 目录

### 数据库连接失败
- 确认 Docker 中的 PostgreSQL 正在运行：`docker compose ps`
- 确认 `DATABASE_URL` 配置正确

## 目录结构（运行时）

```
data/
├── images/
│   ├── <project-slug>/
│   │   └── <section-slug>/
│   │       └── run-01/
│   │           ├── raw/     ← 原始图片
│   │           └── thumb/   ← 缩略图
│   └── .trash/              ← 回收站
│       └── <imageId>/
│           └── 01.png
└── assets/
    └── loras/
        ├── styles/
        ├── poses/
        └── misc/
```
