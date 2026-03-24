# Agent API 使用说明

ComfyUI Remote 提供一套专为 AI Agent / 自动化脚本设计的 HTTP API，用于：
- 获取 Job 和 Run 的完整上下文（含参数、prompt、结果摘要）
- 修改 Job 和 Position 参数
- 触发单个 Position 运行
- 批量审核图片（保留 / 删除）

所有端点前缀为 `/api/agent/`，返回统一的 JSON 格式。

---

## 通用响应格式

### 成功

```json
{
  "ok": true,
  "data": { ... }
}
```

### 失败

```json
{
  "ok": false,
  "error": {
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

---

## 端点概览

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/agent/jobs/:jobId/context` | 获取 Job 完整上下文 |
| POST | `/api/agent/jobs/:jobId/update` | 批量修改 Job 和 Position 参数 |
| POST | `/api/agent/positions/:jobPositionId/run` | 触发单个 Position 运行 |
| GET | `/api/agent/runs/:runId/context` | 获取 Run 结果上下文 |
| POST | `/api/agent/runs/:runId/review` | 批量审核图片 |
| GET | `/api/workflows` | 列出 Workflow 模板 |
| GET | `/api/workflows/:templateId` | 获取 Workflow 模板详情 |

---

## 1. GET `/api/agent/jobs/:jobId/context`

获取一个 Job 的完整上下文信息，包含所有 Position 的当前参数、最新 Run 状态、图片审核摘要等。

### 响应示例

```json
{
  "ok": true,
  "data": {
    "job": {
      "id": "clxxx...",
      "title": "Anya Beach Scene",
      "slug": "anya-beach-scene",
      "status": "done",
      "notes": null,
      "positionCount": 3,
      "enabledPositionCount": 3,
      "character": { "id": "...", "name": "Anya", "slug": "anya" },
      "scenePreset": { "id": "...", "name": "Beach", "slug": "beach" },
      "stylePreset": { "id": "...", "name": "Realistic", "slug": "realistic" },
      "promptOverview": {
        "characterPrompt": "1girl, anya forger, pink hair...",
        "scenePrompt": "beach, ocean, sunset...",
        "stylePrompt": "photorealistic, 8k...",
        "characterLoraPath": "characters/anya-v2.safetensors",
        "jobLevelOverrides": { "aspectRatio": "3:4", "batchSize": 4 }
      }
    },
    "summary": {
      "positionsWithLatestRunCount": 3,
      "positionsWithoutRunsCount": 0,
      "latestRunStatusCounts": { "done": 3 },
      "latestRunImageSummary": {
        "totalCount": 12,
        "pendingCount": 8,
        "keptCount": 3,
        "trashedCount": 1
      }
    },
    "positions": [
      {
        "id": "clyyy...",
        "sortOrder": 1,
        "enabled": true,
        "name": "Standing",
        "slug": "standing",
        "latestRun": {
          "id": "clzzz...",
          "runIndex": 2,
          "status": "done",
          "totalCount": 4,
          "pendingCount": 3,
          "keptCount": 1,
          "trashedCount": 0
        },
        "promptDraft": {
          "positive": "1girl, anya forger, pink hair, beach, ocean, sunset, photorealistic, 8k, standing pose",
          "negative": "bad anatomy, extra limbs, blurry"
        },
        "resolvedConfig": { "...完整参数快照..." }
      }
    ]
  }
}
```

---

## 2. POST `/api/agent/jobs/:jobId/update`

批量修改 Job 级别参数和 Position 级别参数。支持在一次请求中同时修改多个 Position。

### 请求体

```json
{
  "job": {
    "characterPrompt": "1girl, anya forger, pink hair, green eyes...",
    "scenePrompt": "indoor, classroom...",
    "stylePrompt": "anime style, clean lines...",
    "characterLoraPath": "characters/anya-v3.safetensors",
    "aspectRatio": "3:4",
    "batchSize": 4
  },
  "positions": [
    {
      "jobPositionId": "clyyy...",
      "positivePrompt": "smiling, happy expression",
      "negativePrompt": "sad, angry",
      "aspectRatio": "1:1",
      "batchSize": 2,
      "seedPolicy": "random"
    }
  ]
}
```

### Job 支持的字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `characterPrompt` | string | 角色提示词 |
| `scenePrompt` | string \| null | 场景提示词 |
| `stylePrompt` | string \| null | 风格提示词 |
| `characterLoraPath` | string | 角色 LoRA 文件路径 |
| `aspectRatio` | string \| null | 画幅比例（如 `"3:4"`、`"1:1"`） |
| `batchSize` | number \| null | 每次生成图片数 |

### Position 支持的字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `jobPositionId` | string | **必填**，Position ID |
| `positivePrompt` | string \| null | 正向提示词覆盖 |
| `negativePrompt` | string \| null | 负向提示词覆盖 |
| `aspectRatio` | string \| null | 画幅覆盖 |
| `batchSize` | number \| null | 批量大小覆盖 |
| `seedPolicy` | string \| null | Seed 策略（`"random"` 或 `"fixed"`） |

### 响应

返回更新后的 Job 上下文（与 `/context` 端点格式相同）。

---

## 3. POST `/api/agent/positions/:jobPositionId/run`

为指定 Position 创建一个新的排队 Run。Worker 会自动消费并执行。

### 请求体

无需请求体。

### 响应示例

```json
{
  "ok": true,
  "data": {
    "jobId": "clxxx...",
    "jobPositionId": "clyyy...",
    "result": {
      "jobId": "clxxx...",
      "jobTitle": "Anya Beach Scene",
      "jobStatus": "queued",
      "queuedRunCount": 1,
      "runs": [
        {
          "runId": "clnew...",
          "runIndex": 3,
          "status": "queued",
          "createdAt": "2025-03-24T10:00:00.000Z"
        }
      ]
    },
    "context": { "...更新后的 Job 上下文..." }
  }
}
```

---

## 4. GET `/api/agent/runs/:runId/context`

获取单个 Run 的完整上下文，包含所有图片结果和审核状态。

### 响应示例

```json
{
  "ok": true,
  "data": {
    "run": {
      "id": "clzzz...",
      "runIndex": 2,
      "status": "done",
      "startedAt": "2025-03-24T10:01:00.000Z",
      "finishedAt": "2025-03-24T10:02:30.000Z",
      "outputDir": "/data/images/anya-beach-scene/standing"
    },
    "images": [
      {
        "id": "climg1...",
        "filePath": "/data/images/.../raw/output_0001.png",
        "thumbPath": "/data/images/.../thumb/output_0001.webp",
        "reviewStatus": "pending",
        "width": 896,
        "height": 1152
      }
    ],
    "summary": {
      "totalCount": 4,
      "pendingCount": 3,
      "keptCount": 1,
      "trashedCount": 0
    }
  }
}
```

---

## 5. POST `/api/agent/runs/:runId/review`

批量审核图片。可以选择保留（keep）或删除到回收站（trash）。

### 请求体

```json
{
  "action": "keep",
  "imageIds": ["climg1...", "climg3..."]
}
```

或：

```json
{
  "action": "trash",
  "imageIds": ["climg2...", "climg4..."],
  "reason": "blurry faces"
}
```

### 参数说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `action` | string | **必填**，`"keep"` 或 `"trash"` |
| `imageIds` | string[] | **必填**，要操作的图片 ID 列表 |
| `reason` | string | 可选，仅 trash 时使用，记录删除原因 |

### 响应

```json
{
  "ok": true,
  "data": {
    "action": "keep",
    "result": { "updatedCount": 2 },
    "context": { "...更新后的 Run 上下文..." }
  }
}
```

---

## 6. GET `/api/workflows`

列出所有可用的 Workflow 模板摘要。

### 响应示例

```json
{
  "ok": true,
  "data": [
    {
      "id": "sdxl-txt2img",
      "name": "SDXL Text-to-Image",
      "description": "Basic SDXL txt2img workflow with optional LoRA support.",
      "version": "1.0.0",
      "builtIn": true,
      "variableCount": 11,
      "nodeCount": 7
    },
    {
      "id": "sdxl-txt2img-hires",
      "name": "SDXL Text-to-Image + HiRes Fix",
      "description": "SDXL txt2img with a second KSampler pass for higher resolution.",
      "version": "1.0.0",
      "builtIn": false,
      "variableCount": 12,
      "nodeCount": 10
    }
  ]
}
```

---

## 7. GET `/api/workflows/:templateId`

获取单个 Workflow 模板的完整信息，包括变量定义和节点图。

### 响应

返回完整的 `WorkflowTemplate` 对象，包含 `variables` 和 `prompt` 字段。

---

## 典型 Agent 工作流

### 场景 1：自动调参 + 重跑

```
1. GET /api/agent/jobs/:jobId/context          # 获取当前参数和结果
2. POST /api/agent/jobs/:jobId/update          # 修改 prompt 或参数
3. POST /api/agent/positions/:positionId/run   # 触发重跑
4. (等待 Worker 完成...)
5. GET /api/agent/runs/:runId/context           # 获取新结果
6. POST /api/agent/runs/:runId/review           # 审核图片
```

### 场景 2：批量审核

```
1. GET /api/agent/jobs/:jobId/context           # 获取所有 Position 的图片摘要
2. 遍历有 pendingCount > 0 的 Position
3. GET /api/agent/runs/:runId/context            # 获取图片列表
4. POST /api/agent/runs/:runId/review            # keep 好的，trash 差的
```

### 场景 3：使用自定义 Workflow 模板

```
1. GET /api/workflows                             # 列出可用模板
2. POST /api/agent/jobs/:jobId/update             # 通过 Position 的 extraParams 设置 workflowTemplateId
3. POST /api/agent/positions/:positionId/run      # 运行（Worker 会自动加载对应模板）
```

---

## Workflow 模板系统

Workflow 模板定义在 `config/workflows/*.json` 中，每个文件包含：

- **id**：唯一标识符
- **name**：显示名称
- **description**：描述
- **variables**：可替换变量（如 `positivePrompt`、`width`、`seed` 等）
- **prompt**：ComfyUI API 节点图（含 `{{variable}}` 占位符）

当 `PositionTemplate.defaultParams` 或 `CompleteJobPosition.extraParams` 中包含 `workflowTemplateId` 字段时，Worker 会自动从 `config/workflows/` 加载对应模板并替换变量。

### Prompt 解析优先级

1. `extraParams.comfyPrompt` / `workflowApiPrompt` / `apiPrompt`（完整自定义节点图）
2. `extraParams.workflowTemplateId`（从模板文件加载）
3. 内置 SDXL txt2img fallback（无需任何配置）

### 添加新模板

1. 将 ComfyUI workflow 导出为 API 格式（在 ComfyUI 中使用 "Save (API Format)"）
2. 创建 `config/workflows/your-template.json`，添加 `id`、`name`、`variables` 等元数据
3. 在节点图中用 `{{variable}}` 替换需要动态替换的值
4. 在 Position 模板设置中选择新 workflow

---

## 触发 Worker 执行

Worker 不会自动轮询。需要在 Run 入队后手动触发：

```bash
# 本地开发
curl -X POST "http://localhost:3000/api/local/worker/pass?limit=5"

# 或使用旧版兼容接口
curl -X POST "http://localhost:3000/api/worker/process?limit=5"
```

Worker 会扫描所有 `queued` 状态的 Run 并执行。
