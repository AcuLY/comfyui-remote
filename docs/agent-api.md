# Agent API 使用说明

ComfyUI Remote 提供一套专为 AI Agent / 自动化脚本设计的 HTTP API，用于：
- 获取 Project 和 Run 的完整上下文（含参数、prompt、结果摘要）
- 修改 Project 和 Section 参数
- 触发单个 Section 运行
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
| GET | `/api/agent/projects` | 列出所有 Project（支持搜索/筛选） |
| GET | `/api/agent/projects/:projectId/context` | 获取 Project 完整上下文 |
| POST | `/api/agent/projects/:projectId/update` | 批量修改 Project 和 Section 参数 |
| POST | `/api/agent/projects/:projectId/run-all` | 触发所有 enabled Section 运行 |
| POST | `/api/agent/sections/:sectionId/run` | 触发单个 Section 运行 |
| GET | `/api/agent/runs/:runId/context` | 获取 Run 结果上下文 |
| POST | `/api/agent/runs/:runId/review` | 批量审核图片 |
| GET | `/api/workflows` | 列出 Workflow 模板 |
| GET | `/api/workflows/:templateId` | 获取 Workflow 模板详情 |
| ALL | `/api/mcp` | MCP Server（Streamable HTTP） |

---

## 1. GET `/api/agent/projects`

列出所有 Project。支持可选的搜索和筛选参数。

### Query 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `search` | string | 按标题或角色名搜索 |
| `status` | string | 按状态筛选（`draft` / `queued` / `running` / `partial_done` / `done` / `failed`） |
| `hasPending` | string | 筛选含待审核图片的 Project（`true` / `false`） |

### 响应

返回 Project 列表（简要信息）。

---

## 2. GET `/api/agent/projects/:projectId/context`

获取一个 Project 的完整上下文信息，包含所有 Section 的当前参数、最新 Run 状态、图片审核摘要等。

### 响应示例

```json
{
  "ok": true,
  "data": {
    "project": {
      "id": "clxxx...",
      "title": "Anya Beach Scene",
      "slug": "anya-beach-scene",
      "status": "done",
      "notes": null,
      "sectionCount": 3,
      "enabledSectionCount": 3,
      "presetBindings": [
        { "categoryId": "cat1", "presetId": "preset1", "variantId": "var1" },
        { "categoryId": "cat2", "presetId": "preset2" }
      ],
      "presetNames": ["Anya (Default)", "Beach"],
      "promptOverview": {
        "positivePrompt": "1girl, anya forger, pink hair, beach, ocean, sunset...",
        "negativePrompt": "bad anatomy, extra limbs, blurry",
        "projectLevelOverrides": { "aspectRatio": "3:4", "batchSize": 4 }
      }
    },
    "summary": {
      "sectionsWithLatestRunCount": 3,
      "sectionsWithoutRunsCount": 0,
      "latestRunStatusCounts": { "done": 3 },
      "latestRunImageSummary": {
        "totalCount": 12,
        "pendingCount": 8,
        "keptCount": 3,
        "trashedCount": 1
      }
    },
    "sections": [
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

## 3. POST `/api/agent/projects/:projectId/update`

批量修改 Project 级别参数和 Section 级别参数。支持在一次请求中同时修改多个 Section。

### 请求体

```json
{
  "project": {
    "presetBindings": [
      { "categoryId": "cat1", "presetId": "preset1", "variantId": "var1" },
      { "categoryId": "cat2", "presetId": "preset2" }
    ],
    "aspectRatio": "3:4",
    "batchSize": 4
  },
  "sections": [
    {
      "sectionId": "clyyy...",
      "positivePrompt": "smiling, happy expression",
      "negativePrompt": "sad, angry",
      "aspectRatio": "1:1",
      "batchSize": 2,
      "seedPolicy": "random"
    }
  ]
}
```

### Project 支持的字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `presetBindings` | array | 预制绑定数组 `[{ categoryId, presetId, variantId? }]` |
| `aspectRatio` | string \| null | 画幅比例（如 `"3:4"`、`"1:1"`） |
| `batchSize` | number \| null | 每次生成图片数 |

### Section 支持的字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `sectionId` | string | **必填**，Section ID |
| `positivePrompt` | string \| null | 正向提示词覆盖 |
| `negativePrompt` | string \| null | 负向提示词覆盖 |
| `aspectRatio` | string \| null | 画幅覆盖 |
| `batchSize` | number \| null | 批量大小覆盖 |
| `seedPolicy` | string \| null | Seed 策略（`"random"` 或 `"fixed"`） |

### 响应

返回更新后的 Project 上下文（与 `/context` 端点格式相同）。

---

## 4. POST `/api/agent/projects/:projectId/run-all`

触发 Project 中所有 enabled 的 Section 运行，为每个 Section 创建排队的 Run。

### 请求体

无需请求体。

### 响应

```json
{
  "ok": true,
  "data": {
    "projectId": "clxxx...",
    "result": {
      "projectId": "clxxx...",
      "projectTitle": "Anya Beach Scene",
      "projectStatus": "queued",
      "queuedRunCount": 3,
      "runs": [...]
    },
    "context": { "...更新后的 Project 上下文..." }
  }
}
```

---

## 5. POST `/api/agent/sections/:sectionId/run`

为指定 Section 创建一个新的排队 Run。Worker 会自动消费并执行。

### 请求体

无需请求体。

### 响应示例

```json
{
  "ok": true,
  "data": {
    "projectId": "clxxx...",
    "sectionId": "clyyy...",
    "result": {
      "projectId": "clxxx...",
      "projectTitle": "Anya Beach Scene",
      "projectStatus": "queued",
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
    "context": { "...更新后的 Project 上下文..." }
  }
}
```

---

## 6. GET `/api/agent/runs/:runId/context`

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

## 7. POST `/api/agent/runs/:runId/review`

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

## 8. GET `/api/workflows`

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

## 9. GET `/api/workflows/:templateId`

获取单个 Workflow 模板的完整信息，包括变量定义和节点图。

### 响应

返回完整的 `WorkflowTemplate` 对象，包含 `variables` 和 `prompt` 字段。

---

## 典型 Agent 工作流

### 场景 1：自动调参 + 重跑

```
1. GET /api/agent/projects/:projectId/context          # 获取当前参数和结果
2. POST /api/agent/projects/:projectId/update          # 修改 prompt 或参数
3. POST /api/agent/sections/:sectionId/run             # 触发重跑
4. (等待 Worker 完成...)
5. GET /api/agent/runs/:runId/context           # 获取新结果
6. POST /api/agent/runs/:runId/review           # 审核图片
```

### 场景 2：批量审核

```
1. GET /api/agent/projects/:projectId/context           # 获取所有 Section 的图片摘要
2. 遍历有 pendingCount > 0 的 Section
3. GET /api/agent/runs/:runId/context            # 获取图片列表
4. POST /api/agent/runs/:runId/review            # keep 好的，trash 差的
```

### 场景 3：使用自定义 Workflow 模板

```
1. GET /api/workflows                             # 列出可用模板
2. POST /api/agent/projects/:projectId/update             # 通过 Section 的 extraParams 设置 workflowTemplateId
3. POST /api/agent/sections/:sectionId/run               # 运行（Worker 会自动加载对应模板）
```

---

## Workflow 模板系统

Workflow 模板定义在 `config/workflows/*.json` 中，每个文件包含：

- **id**：唯一标识符
- **name**：显示名称
- **description**：描述
- **variables**：可替换变量（如 `positivePrompt`、`width`、`seed` 等）
- **prompt**：ComfyUI API 节点图（含 `{{variable}}` 占位符）

当 `PositionTemplate.defaultParams` 或 `ProjectSection.extraParams` 中包含 `workflowTemplateId` 字段时，Worker 会自动从 `config/workflows/` 加载对应模板并替换变量。

### Prompt 解析优先级

1. `extraParams.comfyPrompt` / `workflowApiPrompt` / `apiPrompt`（完整自定义节点图）
2. `extraParams.workflowTemplateId`（从模板文件加载）
3. 内置 SDXL txt2img fallback（无需任何配置）

### 添加新模板

1. 将 ComfyUI workflow 导出为 API 格式（在 ComfyUI 中使用 "Save (API Format)"）
2. 创建 `config/workflows/your-template.json`，添加 `id`、`name`、`variables` 等元数据
3. 在节点图中用 `{{variable}}` 替换需要动态替换的值
4. 在 Section 模板设置中选择新 workflow

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

---

## MCP Server（Model Context Protocol）

ComfyUI Remote 内置 MCP Server，端点为 `POST /api/mcp`（Streamable HTTP transport）。任何支持 MCP 的客户端（Claude Desktop、Cursor 等）都可以直接连接使用。

### 配置方法

在 MCP 客户端配置中添加：

```json
{
  "mcpServers": {
    "comfyui-remote": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### 可用 Tools

| Tool 名称 | 描述 |
|-----------|------|
| `list_projects` | 列出所有 Project（支持搜索/状态筛选） |
| `update_project` | 修改 Project 参数（prompt、LoRA、画幅、批量） |
| `update_project_section` | 修改 Project 中特定 Section 的参数 |
| `run_all_sections` | 触发 Project 中所有 enabled Section 运行 |
| `run_section` | 触发单个 Section 运行 |
| `review_images` | 批量审核图片（keep / trash） |
| `list_prompt_blocks` | 列出 Section 的所有提示词块 |
| `add_prompt_block` | 添加新的提示词块（角色/场景/风格/Section/自定义） |
| `update_prompt_block` | 修改提示词块内容（标签/正面/负面） |
| `remove_prompt_block` | 删除提示词块 |
| `reorder_prompt_blocks` | 重排序提示词块 |

### 可用 Resources

| URI 模式 | 描述 |
|----------|------|
| `comfyui://projects/{projectId}/context` | Project 完整上下文（含 Section 的 promptBlocks 和 promptDraft） |
| `comfyui://runs/{runId}/context` | Run 结果上下文 |
| `comfyui://workflows` | Workflow 模板列表 |
| `comfyui://workflows/{templateId}` | 模板详情 |
| `comfyui://projects/{projectId}/revisions` | 修订历史列表 |
| `comfyui://projects/{projectId}/revisions/{n}` | 修订快照 |
| `comfyui://sections/{sectionId}/blocks` | Section 的提示词块列表 |

### MCP Agent 典型工作流

```
1. 调用 list_projects → 发现可操作的 Project
2. 读取 comfyui://projects/{id}/context → 了解当前参数和结果（含 promptBlocks）
3. 调用 update_project → 优化提示词（或使用 prompt block tools 精细控制）
4. 调用 run_all_sections → 触发运行
5. （等待 Worker 完成...）
6. 读取 comfyui://runs/{id}/context → 查看生成结果
7. 调用 review_images → 保留好的、删除差的
```

### Prompt Block 管理工作流（v0.2）

```
1. 调用 list_prompt_blocks(sectionId) → 查看当前块
2. 调用 add_prompt_block → 添加自定义提示词块
3. 调用 update_prompt_block → 修改某个块的内容
4. 调用 reorder_prompt_blocks → 调整块的顺序
5. 调用 remove_prompt_block → 删除不需要的块
```

### 迁移说明

对于在 v0.2 之前创建的 Project（Section 没有 PromptBlocks），Worker 会自动回退到旧的提示词拼接逻辑。可以通过以下方式迁移：

```bash
# 查看哪些 Section 没有 PromptBlocks
DRY_RUN=1 npx tsx src/scripts/migrate-prompt-blocks.mts

# 执行迁移
npx tsx src/scripts/migrate-prompt-blocks.mts
```
