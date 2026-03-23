# Worker skeleton

当前已补上最小 scaffold：
- `repository.ts`：读取 queued `PositionRun` 并整理成 worker snapshot
- `payload-builder.ts`：把 `resolvedConfigSnapshot` 规范化，并产出 worker 可读的 ComfyUI prompt draft
- `src/server/services/comfyui-service.ts`：校验 prompt draft、提交 `/prompt`、轮询 `/history/:promptId`
- `index.ts`：执行一次 worker pass，当前会 claim queued run、组装 draft、调用 ComfyUI，并按结果写回 `done` / `failed`
- `src/app/api/local/worker/pass/route.ts`：本地手动触发入口，只允许从 `localhost` 发起 `POST`，默认处理 1 个 queued run（`limit` 最大 10）

本地调用示例：
```bash
curl -X POST "http://localhost:3000/api/local/worker/pass?limit=1"
```

后续这里负责：
- 读取待执行 PositionRun
- 调用 ComfyUI HTTP API（当前已接入 submit + history polling）
- 下载输出图片
- 生成缩略图
- 写入数据库
- 执行图片移入回收站与恢复
