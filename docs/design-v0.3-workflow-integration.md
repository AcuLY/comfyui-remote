# v0.3 Workflow 集成 & LoRA/采样器参数化 — 设计文档

> 状态：Phase 1-3 已完成（Schema + Types + Workflow Builder + Worker 集成）
> 日期：2026-03-26

## 1. 背景与目标

`docs/workflow.api.json` 是标准的 ComfyUI API 格式工作流文件。用户点击"运行任务"时，系统需要：
1. 将小节（Position）的参数填入该 JSON 模板
2. 提交给 ComfyUI 执行

当前系统有基本的提示词/画幅/batch/seed 支持，但缺少：
- 标准 workflow 填充器（现有 fallback-prompt-builder 只生成简单 SDXL 图）
- LoRA 分区管理（角色 lora、lora1、lora2）
- 双 KSampler 参数（KSampler1 + KSampler2）

---

## 2. workflow.api.json 节点映射

基于 `docs/workflow.api.json`，各节点与小节参数的对应关系：

| 节点 ID | `_meta.title` | `class_type` | 填充来源 |
|---------|---------------|-------------|---------|
| 1 | Load Checkpoint | CheckpointLoaderSimple | 全局/模板默认 |
| **3** | **KSampler1** | KSampler | 小节 ksampler1 参数 |
| **4** | CLIP Text Encode (pos) | CLIPTextEncode | 正提示词（引用 511） |
| 9 | Preview Image | PreviewImage | — |
| **12** | CLIP Text Encode (neg) | CLIPTextEncode | 负提示词（引用 513） |
| **24** | Power Lora Loader | Power Lora Loader (rgthree) | **lora1** 节点（KS2 分支，model from 36） |
| **25** | Power Lora Loader | Power Lora Loader (rgthree) | **lora2** 节点（KS2 分支，model from 24） |
| **36** | lora 2 | Power Lora Loader (rgthree) | **lora2** 节点（KS2 分支入口，model from 482） |
| **407** | Empty Latent Image | EmptyLatentImage | width=短边, height=长边, batch_size |
| 410 | VAE Decode | VAEDecode | KSampler1 输出 |
| **425** | Upscale Latent | LatentUpscale | width=长边×放大系数, height=短边×放大系数 |
| **427** | **KSampler2** | KSampler | 小节 ksampler2 参数 |
| 482 | character lora | Power Lora Loader (rgthree) | **角色 LoRA** |
| **511** | positive prompt | Text Multiline | 正提示词文本 |
| **513** | negative prompt | Text Multiline | 负提示词文本 |
| **515** | Image Save | Image Save | output_path = 大任务名/序号.小节名 |
| 519 | CLIP Text Encode | CLIPTextEncode | KSampler2 正提示词（引用 511） |
| 520 | CLIP Text Encode | CLIPTextEncode | KSampler2 负提示词（引用 513） |
| **522** | lora 1 | Power Lora Loader (rgthree) | **lora1** 节点（KS1 分支，model from 482） |
| **524** | Power Lora Loader | Power Lora Loader (rgthree) | **lora2** 节点（KS1 分支，model from 522） |

### LoRA 链路分析

```
Checkpoint(1)
  → character lora(482)    # 角色专属 LoRA（大任务自带）
    → lora 1(522)          # lora1 列表（KS1 分支）
      → Power Lora Loader(524)  # lora2（KS1 用）
        → KSampler1 model(3)
    → lora 2(36)           # lora2 列表（KS2 分支入口）
      → Power Lora Loader(24)   # lora1（KS2 用）
        → Power Lora Loader(25)  # lora2（KS2 用）
          → KSampler2 model(427)
```

**关键发现**：
- KS1 链路：`Checkpoint → 482(char) → 522(lora1) → 524(lora2) → KSampler1(3)`
- KS2 链路：`Checkpoint → 482(char) → 36(lora2) → 24(lora1) → 25(lora2) → KSampler2(427)`
- 两条链路共享 `character lora(482)` 后分岔
- `lora 1` 需要填入 522（KS1用）和 24（KS2用）两个节点
- `lora 2` 需要填入 524（KS1用）、36 和 25（KS2用）三个节点
- CLIP 编码也分支：KS1 用 4/12（clip from 524），KS2 用 519/520（clip from 25）

**填充策略**：相同的 lora1 列表填入 522 和 24，相同的 lora2 列表填入 524、36 和 25。

---

## 3. 参数化字段映射

### 3.1 提示词

| 参数 | 目标节点 | 字段 |
|------|---------|------|
| 正提示词 | 511 (Text Multiline) | `inputs.text` |
| 负提示词 | 513 (Text Multiline) | `inputs.text` |

### 3.2 图像尺寸

| 参数 | 目标节点 | 字段 | 说明 |
|------|---------|------|------|
| 短边像素 | 407 (Empty Latent Image) | `inputs.width` | 根据 aspectRatio 判断短/长边 |
| 长边像素 | 407 | `inputs.height` | |
| batch_size | 407 | `inputs.batch_size` | |
| 长边×放大 | 425 (Upscale Latent) | `inputs.width` | 放大系数默认 2 |
| 短边×放大 | 425 | `inputs.height` | |

### 3.3 角色 LoRA

| 参数 | 目标节点 | 字段 |
|------|---------|------|
| 角色 LoRA 路径 | 482 (character lora) | `inputs.lora_1.lora` |

角色 LoRA 来源：`CompleteJob.characterLoraPath`（大任务级别）

### 3.4 LoRA 1 / LoRA 2

**LoRA 1 节点**（522 + 24）：
- 522 节点（`lora 1`）：KS1 分支的 lora1，模型来自 482
- 24 节点（`Power Lora Loader`）：KS2 分支的 lora1，模型来自 36
- 填充方式：将小节的 lora1 列表同时填入 522 和 24 两个节点

**LoRA 2 节点**（524 + 36 + 25）：
- 524 节点：KS1 分支的 lora2，模型来自 522
- 36 节点（`lora 2`）：KS2 分支的 lora2 入口，模型来自 482
- 25 节点：KS2 分支的 lora2 续接，模型来自 24
- 填充方式：将小节的 lora2 列表同时填入 524、36 和 25 三个节点

**Power Lora Loader 的 lora 条目格式**：
```json
{
  "lora_N": {
    "on": true,
    "lora": "category\\filename.safetensors",
    "strength": 0.8
  }
}
```
其中 `N` 从 1 开始递增。

### 3.5 KSampler1 参数（节点 3）

| 参数 | 目标字段 | 默认值 |
|------|---------|-------|
| steps | `inputs.steps` | 30 |
| cfg | `inputs.cfg` | 4 |
| sampler_name | `inputs.sampler_name` | euler_ancestral |
| scheduler | `inputs.scheduler` | karras |
| denoise | `inputs.denoise` | 1 |
| seed | `inputs.seed` | 根据 seedPolicy |

### 3.6 KSampler2 参数（节点 427）

| 参数 | 目标字段 | 默认值 |
|------|---------|-------|
| steps | `inputs.steps` | 30 |
| cfg | `inputs.cfg` | 7 |
| sampler_name | `inputs.sampler_name` | dpmpp_2m |
| scheduler | `inputs.scheduler` | karras |
| denoise | `inputs.denoise` | 0.6 |
| seed | `inputs.seed` | 根据 seedPolicy |

### 3.7 Image Save 输出路径

| 参数 | 目标节点 | 字段 | 格式 |
|------|---------|------|------|
| output_path | 515 (Image Save) | `inputs.output_path` | `{大任务名}/{序号}.{小节名}` |

小节名中空格替换为下划线。例如：`"MyJob/1.close_up_shot"`

### 3.8 Seed 策略

每个 KSampler 有独立的 seed 策略：
- `random`：生成随机数
- `fixed`：使用固定值 42
- `increment`：基于 positionRunId 或 runIndex 递增

当前方案：seedPolicy 拆分为 `seedPolicy1` 和 `seedPolicy2`，默认均为 `"random"`。

---

## 4. 数据模型变更

### 4.1 PositionTemplate LoRA 拆分

**当前**：`loraBindings Json?`（单一列表）

**改为**：
```
lora1: Json?    // Array<LoraBinding>，lora1 列表
lora2: Json?    // Array<LoraBinding>，lora2 列表
```

删除 `loraBindings`，新增 `lora1` 和 `lora2`。

### 4.2 ScenePreset / StylePreset 移除 LoRA

**当前**：`loraBindings Json?`

**改为**：删除 `loraBindings` 字段。

场景和风格的 LoRA 不再在预设级别绑定，而是在小节级别通过 lora1/lora2 手动管理。

### 4.3 Character LoRA 保持不变

`Character.loraPath`（主 LoRA）和 `Character.loraBindings`（扩展列表）保持不变，映射到 workflow 的 `character lora` 节点（482）。

### 4.4 CompleteJobPosition 增加 KSampler 参数

**新增字段**：
```
ksampler1: Json?   // KSamplerParams
ksampler2: Json?   // KSamplerParams
```

**KSamplerParams 类型**：
```typescript
type KSamplerParams = {
  steps?: number;          // 默认 30（KSampler1）/ 30（KSampler2）
  cfg?: number;            // 默认 4（KSampler1）/ 7（KSampler2）
  sampler_name?: string;   // 默认 "euler_ancestral"（KSampler1）/ "dpmpp_2m"（KSampler2）
  scheduler?: string;      // 默认 "karras"
  denoise?: number;        // 默认 1（KSampler1）/ 0.6（KSampler2）
  seedPolicy?: string;     // "random" | "fixed" | "increment"，默认 "random"
};
```

### 4.5 CompleteJobPosition LoRA 配置重构

**当前**：`loraConfig Json?`（`{ entries: LoraEntry[] }`）

**改为**：
```
loraConfig: Json?   // 保留但结构变更
```

**新的 loraConfig 结构**：
```typescript
type PositionLoraConfig = {
  characterLora: LoraEntry[];   // 从大任务角色带入（只读展示）
  lora1: LoraEntry[];           // lora1 列表（可编辑，来自 position template 或手动添加）
  lora2: LoraEntry[];           // lora2 列表（可编辑，来自 position template 或手动添加）
};
```

### 4.6 PositionTemplate 默认参数更新

**新增字段**：
```
defaultKsampler1: Json?   // KSamplerParams defaults for KSampler1
defaultKsampler2: Json?   // KSamplerParams defaults for KSampler2
```

### 4.7 完整字段变更总结

| 模型 | 操作 | 字段 |
|------|------|------|
| ScenePreset | 删除 | `loraBindings` |
| StylePreset | 删除 | `loraBindings` |
| PositionTemplate | 删除 | `loraBindings` |
| PositionTemplate | 新增 | `lora1 Json?` |
| PositionTemplate | 新增 | `lora2 Json?` |
| PositionTemplate | 新增 | `defaultKsampler1 Json?` |
| PositionTemplate | 新增 | `defaultKsampler2 Json?` |
| CompleteJobPosition | 新增 | `ksampler1 Json?` |
| CompleteJobPosition | 新增 | `ksampler2 Json?` |
| CompleteJobPosition | 修改 | `loraConfig` 结构重构 |

---

## 5. LoRA 管理调整

### 5.1 LoRA 分类体系

小节的 LoRA 分为三个独立列表：

| 列表 | 来源 | 是否可编辑 | workflow 节点 |
|------|------|----------|-------------|
| characterLora | 大任务角色自动带入 | 否（跟随角色设置） | 482 (character lora) |
| lora1 | position 模板预设 + 手动添加 | 是 | 522→24 (lora 1) |
| lora2 | position 模板预设 + 手动添加 | 是 | 36→25 (lora 2) |

### 5.2 创建小节时的 LoRA 初始化

当通过 PositionTemplate 创建 CompleteJobPosition 时：
1. **characterLora**：从 Character 自动填入
2. **lora1**：从 PositionTemplate.lora1 复制
3. **lora2**：从 PositionTemplate.lora2 复制

### 5.3 迁移策略

- 现有 PositionTemplate 的 `loraBindings` 数据迁移到 `lora1`
- 现有 ScenePreset/StylePreset 的 `loraBindings` 数据丢弃（或迁移到关联的 position template 的 lora2）
- 现有 CompleteJobPosition 的 `loraConfig.entries` 按 source 分组迁移

---

## 6. Workflow 填充器设计

### 6.1 新增文件

`src/server/services/workflow-prompt-builder.ts`

### 6.2 核心函数

```typescript
type WorkflowBuildInput = {
  workflowTemplate: Record<string, unknown>;  // docs/workflow.api.json 的内容
  positivePrompt: string;
  negativePrompt: string;
  shortSidePx: number;
  longSidePx: number;
  batchSize: number;
  upscaleFactor: number;           // 默认 2
  characterLora: LoraBinding[];    // 角色 lora（填入节点 482）
  lora1List: LoraBinding[];        // lora1 列表（填入节点 24）
  lora2List: LoraBinding[];        // lora2 列表（填入节点 36 + 524）
  ksampler1: KSamplerParams;
  ksampler2: KSamplerParams;
  outputDir: string;               // "大任务名/序号.小节名"
};

function buildWorkflowPrompt(input: WorkflowBuildInput): Record<string, unknown>;
```

### 6.3 填充逻辑

1. **深拷贝** workflow template
2. **提示词**：设置 511.text 和 513.text
3. **尺寸**：设置 407 的 width/height/batch_size，425 的 width/height
4. **角色 LoRA**：设置 482 的 lora_1
5. **LoRA 1**：清除 522 和 24 节点现有 lora，按 lora1List 填充两个节点
6. **LoRA 2**：清除 524、36 和 25 节点现有 lora，按 lora2List 填充三个节点
7. **KSampler1**：设置节点 3 的 steps/cfg/sampler_name/scheduler/denoise/seed
8. **KSampler2**：设置节点 427 的 steps/cfg/sampler_name/scheduler/denoise/seed
9. **输出路径**：设置 515 的 output_path = `{大任务名}/{小节sortOrder}.{小节名}`

---

## 7. Worker 集成

### 7.1 优先级调整

```
1) explicit comfyPrompt in extraParams      → 直接使用
2) workflowTemplateId (config/workflows/)   → 使用 workflow-template-service
3) NEW: 标准 workflow.api.json 填充         → 使用 workflow-prompt-builder
4) built-in fallback                        → 使用 fallback-prompt-builder
```

### 7.2 自动使用标准 workflow

当小节配置了 ksampler1 或 ksampler2 参数时，自动使用 `docs/workflow.api.json` 作为模板（通过 workflow-prompt-builder 填充），无需用户手动指定 workflowTemplateId。

---

## 8. 前端 UI 变更

### 8.1 小节编辑页面 LoRA 管理

当前 LoRA 是一个统一列表，改为三个独立区块：

```
┌─────────────────────────────────────────┐
│ 角色 LoRA (character lora)              │
│ ┌─────────────────────────────────────┐ │
│ │ 🔒 Kokoro-10.safetensors  w:0.98   │ │  ← 只读，来自大任务
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ LoRA 1                                 │
│ ┌─────────────────────────────────────┐ │
│ │ trt_v0.3_noobai_cwhj    w:0.93  ✕  │ │  ← 可编辑
│ │ rella                  w:0.38  ✕  │ │
│ │              [+ 添加 LoRA]          │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ LoRA 2                                 │
│ ┌─────────────────────────────────────┐ │
│ │ lightingSlider         w:0.31  ✕   │ │  ← 可编辑
│ │ 2dRealPhoto_Background w:0.31  ✕   │ │
│ │              [+ 添加 LoRA]          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 8.2 KSampler 参数表单

在 SectionParamsForm 中新增两个 KSampler 配置区域：

```
┌─────────────────────────────────────────┐
│ KSampler1 (第一阶段)                     │
│ steps: [30]  cfg: [4]                   │
│ sampler: [euler_ancestral ▼]            │
│ scheduler: [karras ▼]  denoise: [1.0]  │
│ seed: [random ▼]                        │
├─────────────────────────────────────────┤
│ KSampler2 (第二阶段/高清修复)            │
│ steps: [30]  cfg: [7]                   │
│ sampler: [dpmpp_2m ▼]                  │
│ scheduler: [karras ▼]  denoise: [0.6]  │
│ seed: [random ▼]                        │
└─────────────────────────────────────────┘
```

### 8.3 PositionTemplate 编辑

PositionTemplate 的 LoRA 编辑也拆分为 lora1 和 lora2，并新增 defaultKsampler1/defaultKsampler2 编辑。

---

## 9. 开发计划（分阶段）

### Phase 1: Schema + Types
- [x] Prisma schema 变更（PositionTemplate, ScenePreset, StylePreset, CompleteJobPosition）
- [x] 生成 migration
- [x] 更新 TypeScript 类型（lora-types.ts, worker/types.ts, server-data.ts）
- [ ] 数据迁移脚本（现有 loraBindings → lora1/lora2）

### Phase 2: Workflow Prompt Builder
- [x] 新建 `workflow-prompt-builder.ts`
- [x] 实现标准 workflow.api.json 填充逻辑
- [x] 集成到 comfyui-service.ts 的优先级链路

### Phase 3: 后端 API + Worker 适配
- [x] 更新 job-service / actions 支持 ksampler1/ksampler2 参数
- [x] 更新 worker 的 ComfyPromptDraft 类型
- [x] 更新 resolvedConfigSnapshot 包含新字段（含 sortOrder）
- [x] 更新 createJob/copyJob 逻辑

### Phase 4: 前端 UI
- [ ] LoRA 编辑器三栏分区（characterLora / lora1 / lora2）
- [ ] KSampler 参数表单（SectionParamsForm 扩展）
- [ ] PositionTemplate 编辑页更新

### Phase 5: 迁移 + 测试
- [ ] 编写数据迁移脚本
- [ ] 端到端测试（创建任务 → 填充 workflow → 提交 ComfyUI）
