# v0.5 Workflow 集成 & LoRA/采样器参数化 — 设计文档

> 状态：✅ 已完成
> 日期：2026-03-29

## 1. 背景与目标

`docs/workflow.api.json` 是标准的 ComfyUI API 格式工作流文件。用户点击"运行任务"时，系统需要：
1. 将小节（Section）的参数填入该 JSON 模板
2. 提交给 ComfyUI 执行

---

## 2. workflow.api.json 节点映射

基于 `docs/workflow.api.json` 的实际内容：

| 节点 ID | class_type | 用途 | 输入来源 |
|---------|-----------|------|---------|
| 1 | CheckpointLoaderSimple | 加载模型 | 全局默认 |
| **511** | Text Multiline | 正向提示词文本 | 小节 positivePrompt |
| **513** | Text Multiline | 负向提示词文本 | 小节 negativePrompt |
| 4 | CLIPTextEncode | KS1 正提示词编码 | text←511, clip←522 |
| 12 | CLIPTextEncode | KS1 负提示词编码 | text←513, clip←522 |
| 519 | CLIPTextEncode | KS2 正提示词编码 | text←511, clip←36 |
| 520 | CLIPTextEncode | KS2 负提示词编码 | text←513, clip←36 |
| **407** | EmptyLatentImage | 初始潜空间 | width, height, batch_size |
| **522** | Power Lora Loader (rgthree) | **LoRA 1** | model←1, clip←1 |
| **36** | Power Lora Loader (rgthree) | **LoRA 2** | model←1, clip←1 |
| **3** | KSampler | **KSampler1** (第一阶段) | model←522 |
| **425** | LatentUpscale | 放大潜空间 | samples←3 |
| **427** | KSampler | **KSampler2** (高清修复) | model←36, latent←425 |
| 410 | VAEDecode | 解码图像 | samples←427, vae←1 |
| **515** | Image Save | 保存图像 | images←410 |

### 节点链路

```
Checkpoint(1)
  ├→ 522(lora1) → model → KSampler1(3)
  │                        ↓ latent
  │                     425(LatentUpscale)
  │                        ↓ latent
  └→ 36(lora2)  → model → KSampler2(427)
                            ↓ samples
                         410(VAEDecode) → 515(ImageSave)
```

- **LoRA 1** (节点 522)：接在 checkpoint 后，输出 model/clip 给 KSampler1 和 CLIP 编码器 4/12
- **LoRA 2** (节点 36)：接在 checkpoint 后，输出 model/clip 给 KSampler2 和 CLIP 编码器 519/520
- 当 `upscaleFactor=1` (跳过高清修复)：删除节点 425、427、36，VAEDecode(410) 直接从 KS1(3) 读取

---

## 3. 参数化字段映射

### 3.1 提示词

| 参数 | 目标节点 | 字段 |
|------|---------|------|
| 正提示词 | 511 (Text Multiline) | `inputs.text` |
| 负提示词 | 513 (Text Multiline) | `inputs.text` |

### 3.2 图像尺寸

| 参数 | 目标节点 | 字段 |
|------|---------|------|
| 短边像素 | 407 (EmptyLatentImage) | `inputs.width` |
| 长边像素 | 407 | `inputs.height` |
| batch_size | 407 | `inputs.batch_size` |
| 短边×放大 | 425 (LatentUpscale) | `inputs.width` |
| 长边×放大 | 425 | `inputs.height` |

### 3.3 LoRA

| 列表 | 目标节点 | 说明 |
|------|---------|------|
| lora1 | 522 (Power Lora Loader) | KSampler1 分支 |
| lora2 | 36 (Power Lora Loader) | KSampler2 分支（仅高清修复时） |

**Power Lora Loader 条目格式**：
```json
{
  "lora_1": { "on": true, "lora": "category/filename.safetensors", "strength": 0.8 },
  "lora_2": { "on": true, "lora": "other.safetensors", "strength": 0.5 }
}
```

### 3.4 KSampler1 参数（节点 3）

| 参数 | 默认值 |
|------|-------|
| steps | 30 |
| cfg | 4 |
| sampler_name | euler_ancestral |
| scheduler | karras |
| denoise | 1 |
| seed | 根据 seedPolicy |

### 3.5 KSampler2 参数（节点 427）

| 参数 | 默认值 |
|------|-------|
| steps | 30 |
| cfg | 7 |
| sampler_name | dpmpp_2m |
| scheduler | karras |
| denoise | 0.6 |
| seed | 根据 seedPolicy |

### 3.6 Image Save 输出路径

| 目标节点 | 字段 | 格式 |
|---------|------|------|
| 515 (Image Save) | `inputs.output_path` | `{项目名}/{序号}.{小节名}` |

### 3.7 Seed 策略

每个 KSampler 有独立的 seed 策略 (`seedPolicy1`, `seedPolicy2`)：
- `random`：生成随机数
- `fixed`：使用固定值 42

---

## 4. 数据模型

### 4.1 Preset + PresetVariant

统一的提示词预设，每个预设包含：
- `prompt` / `negativePrompt`：正/负提示词
- `lora1` / `lora2`：LoRA 绑定列表
- `defaultParams`：JSON 扩展参数

### 4.2 ProjectSection LoRA 配置

```typescript
type PositionLoraConfig = {
  lora1: LoraEntry[];  // lora1 列表（可编辑）
  lora2: LoraEntry[];  // lora2 列表（可编辑）
};
```

创建小节时，从 presetBindings 的各分类 preset 自动导入 lora1/lora2。

### 4.3 ProjectSection KSampler 参数

```typescript
type KSamplerParams = {
  steps?: number;
  cfg?: number;
  sampler_name?: string;
  scheduler?: string;
  denoise?: number;
  seedPolicy?: string;
};
```

存储在 `ksampler1 Json?` 和 `ksampler2 Json?` 字段。

---

## 5. Workflow 填充器

### 文件：`src/server/services/workflow-prompt-builder.ts`

```typescript
type WorkflowBuildInput = {
  workflowTemplate: Record<string, unknown>;
  positivePrompt: string;
  negativePrompt: string;
  shortSidePx: number;
  longSidePx: number;
  batchSize: number;
  upscaleFactor?: number;  // 默认 2，设为 1 跳过高清修复
  lora1List: LoraBinding[];  // 填入节点 522
  lora2List: LoraBinding[];  // 填入节点 36
  ksampler1: KSamplerParams;
  ksampler2: KSamplerParams;
  outputPath: string;
};
```

### 填充逻辑

1. 提示词：设置 511.text 和 513.text
2. 尺寸：设置 407 的 width/height/batch_size
3. 放大：设置 425 的 width/height（跳过时删除 425/427/36）
4. LoRA 1：填充节点 522
5. LoRA 2：填充节点 36（仅高清修复时）
6. KSampler1：设置节点 3 的参数
7. KSampler2：设置节点 427 的参数（仅高清修复时）
8. 输出路径：设置 515 的 output_path

---

## 6. 前端 UI

### 6.1 小节 LoRA 管理

两栏布局（lora1 + lora2），均支持拖拽排序：

```
┌─────────────────────────────────────────┐
│ LoRA 1                                 │
│ ┌─────────────────────────────────────┐ │
│ │ ≡ trt_v0.3_noobai_cwhj  w:0.93 ✕  │ │
│ │ ≡ rella               w:0.38 ✕  │ │
│ │              [+ 添加 LoRA]          │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ LoRA 2                                 │
│ ┌─────────────────────────────────────┐ │
│ │ ≡ lightingSlider       w:0.31 ✕   │ │
│ │              [+ 添加 LoRA]          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

LoRA 列表顺序即 workflow 中 `lora_1`, `lora_2`, ... 的填充顺序。

### 6.2 生成参数（项目编辑 / 小节编辑共用组件）

| 参数 | 组件 |
|------|------|
| 画幅 | `<select>` 下拉（1:1/2:3/3:4/9:16/3:2/4:3/16:9） |
| 短边像素 | `<input type="number">` |
| Batch Size | `<input type="number">` + `BatchSizeQuickFill` (1/2/4/8/16) |
| 放大倍数 | `<input type="number">` + `UpscaleFactorQuickFill` (1×/1.5×/2×/2.5×/3×) |
| Seed 策略 | `<select>` 下拉（随机/固定） |
