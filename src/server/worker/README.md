# Worker skeleton

当前已补上最小 scaffold：
- `repository.ts`：读取 queued `PositionRun` 并整理成 worker snapshot
- `payload-builder.ts`：把 `resolvedConfigSnapshot` 规范化，并产出占位的 ComfyUI prompt draft
- `index.ts`：执行一次 worker pass，当前只扫描 / 组装 draft，不会真正调用 ComfyUI 或修改 run 状态

后续这里负责：
- 读取待执行 PositionRun
- 调用 ComfyUI HTTP API
- 下载输出图片
- 生成缩略图
- 写入数据库
- 执行图片移入回收站与恢复
