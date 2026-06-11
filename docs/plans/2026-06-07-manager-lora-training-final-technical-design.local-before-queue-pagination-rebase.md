# ComfyUI Manager LoRA Training — 最终技术设计文档

日期：2026-06-07
状态：设计定稿，可进入开发计划阶段
范围：数据结构、业务行为、服务/API 边界、生成任务模型、训练集冻结、Artifact 生命周期。本文不记录具体 UI 视觉样式。

2026-06-07 架构补充决策：

- mutable 编辑区和 immutable 训练历史彻底分离；
- dataset freeze 时复制 revision-scoped snapshot artifact；
- Training 初版训练集图片和参考图生成使用远端 GPT-Image-2 / `codex_gpt_image2` provider，不走 ComfyUI workflow，也不占用本地 ComfyUI queue；
- `TrainingRun` 通过统一本地 GPU scheduler 获取执行权；
- 本地训练脚本细节封装在 runner adapter 内；
- text version 首版使用轻量通用 checkpoint 表；
- 历史 run / task / dataset snapshot 不随 preset 或业务 row 删除而改写。

## 1. 设计原则

### 1.1 模块边界

LoRA Training 模块负责：

- 训练集图片生成与审核；
- 角色/Profile 文本与角色参考图管理；
- scene description 预制、模板、项目、小节；
- 生成任务输入引用、补充提示词、输出记录；
- caption 生成与编辑；
- 训练数据集冻结；
- 本地 LoRA 训练运行；
- 最终 LoRA 文件、训练配置、日志、训练摘要、hash 记录；
- 狭义的“从成功训练运行创建角色 Preset”后续入口。

不属于本模块：

- LoRA 测试/benchmark 矩阵；
- 推荐权重选择；
- 广义 preset promotion / evaluation 流程；
- 最终推理 negative prompt；
- Manager 内嵌 LLM agent / agent task 队列。

### 1.2 与现有生图模块对齐

Training 模块应尽量镜像现有生图模块的成熟结构：

- template/project 双表；
- template section 导入 project section 时复制 row；
- preset-bound block 使用 live binding；
- local/custom block 保存本地文本；
- 编辑 preset-bound block 时解除绑定转 local；
- 删除 preset 时先查 usage，提示受影响 block，确认后 cascade-remove block/reference，再 soft delete preset；
- 项目 delete/archive 才做文件清理；普通业务 row 删除不直接清理底层文件。

### 1.3 UI 记录范围

本文只记录 UI 结构和行为，不记录具体样式：

- layout 区域划分可以记录；
- source tree 层级可以记录；
- 视觉颜色、间距、卡片样式、具体组件外观不作为设计定稿；
- 进入开发阶段后，具体 UI 视觉需要重新设计。

---

## 2. 顶层实体关系

```text
TrainingTemplate
  -> TrainingTemplateSection[]
    -> TrainingTemplateSectionSceneDescriptionBlock[]

TrainingProject
  -> TrainingCharacterProfile
    -> TrainingCharacterImage[]
  -> TrainingSection[]
    -> TrainingSceneDescriptionBlock[]
    -> TrainingSectionRun[]
      -> TrainingImageResult[]
  -> TrainingGenerationTask[]
    -> TrainingGenerationInputReference[]
    -> TrainingGenerationTaskOutput[]
  -> TrainingDatasetRevision[]
    -> TrainingDatasetRevisionItem[]
  -> TrainingRun[]
  -> TrainingTextRevision[]
  -> Artifact[]
```

产品层可以使用简单标签：Template、Project、Section、Run、Image。代码/DB/entity 名称使用 `Training*` 前缀，保持与普通生图模块隔离。

---

## 3. Template / Project 镜像关系

### 3.1 TrainingTemplate

`TrainingTemplate` 是创建 `TrainingProject` 的一次性 seed，不是项目的 live dependency。

建议字段：

```text
id
name
slug?
description?
imagePromptGuidance
imagePromptFormat
captioningGuidance
trainingCaptionFormat
trainingDefaultsJson?
sortOrder
isActive
createdAt
updatedAt
```

### 3.2 TrainingTemplateSection

模板小节保存模板侧的小节配置。

```text
id
trainingTemplateId
name?
sortOrder
enabled
sectionDefaultsJson?
createdAt
updatedAt
```

### 3.3 TrainingProject

`TrainingProject` 是 Training 模块的主项目，也是 Artifact 生命周期边界。

建议字段：

```text
id
name
slug
status = draft | active | completed | archived | cancelled?
archivedAt?
imagePromptGuidance
imagePromptFormat
captioningGuidance
trainingCaptionFormat
trainingDefaultsJson?
createdAt
updatedAt
```

注意：

- 不保存 `sourceTemplateId` / `sourceProjectId` / template provenance；
- template import 后项目字段成为 runtime source of truth；
- project 保存为 template 时也按镜像复制，不保留项目 provenance。

### 3.4 Template -> Project 导入

```text
TrainingTemplate              -> TrainingProject
TrainingTemplateSection       -> TrainingSection
TrainingTemplateSectionSceneDescriptionBlock -> TrainingSceneDescriptionBlock
```

复制规则：

- project-level guidance/format/defaults 从 template 复制到 project；
- section settings 从 template section 复制到 project section；
- preset block 保留 `sceneDescriptionPresetCategoryId` 和 `sceneDescriptionPresetId`；
- local block 复制 `localText`；
- `sortOrder` / `enabled` 原样复制；
- 不保留 `templateBlockId` / `sourceBlockId` / `sourceSectionId`。

### 3.5 Project -> Template 保存

```text
TrainingProject               -> TrainingTemplate
TrainingSection               -> TrainingTemplateSection
TrainingSceneDescriptionBlock -> TrainingTemplateSectionSceneDescriptionBlock
```

规则同导入方向：preset live binding 保留，local 文本复制，不保存 provenance。

---

## 4. SceneDescription 预制、分类、文件夹、Block

### 4.1 命名

当前统一使用：

- domain text：`sceneDescription`
- preset text field：`sceneDescriptionText`
- category text composition order：`sceneDescriptionOrder`

不使用旧的 `trainingTarget` / `targetText` 命名作为当前 Training 小节主文本。

### 4.2 TrainingSceneDescriptionPresetCategory

Training 专属分类表，不与普通生图 preset category 共表。

```text
id
name
slug
icon?
color?
sortOrder              # UI 显示排序
sceneDescriptionOrder  # sceneDescription 文本合成排序
createdAt
updatedAt
```

不要复制普通生图 category 的字段：

```text
positivePromptOrder
negativePromptOrder
lora1Order
lora2Order
```

### 4.3 TrainingSceneDescriptionPresetFolder

镜像普通生图 preset folder tree，但 Training 专属。

```text
id
categoryId
parentId?
name
sortOrder
createdAt
updatedAt
```

删除规则：empty-only。只有没有子 folder、没有 preset、没有相关引用时才能删除。

### 4.4 TrainingSceneDescriptionPreset

一个 preset 就是一段 reusable `sceneDescriptionText`。初版不做 variants。

```text
id
categoryId
folderId?
name
slug
sceneDescriptionText
notes?
sortOrder
isActive
createdAt
updatedAt
```

建议约束：

```text
@@unique([categoryId, slug])
@@unique([categoryId, id])
@@index([categoryId, folderId, sortOrder])
```

删除行为同步生图模块：

```text
delete preset UI action
-> get usage
-> 列出受影响 TrainingSection / TrainingTemplateSection blocks
-> 用户确认
-> 删除相关 scene-description blocks/references
-> TrainingSceneDescriptionPreset.isActive = false
```

DB hard delete 对已有引用保持 restrict。

删除影响范围：

- 只影响当前 mutable template/project block 和未运行 draft task reference；
- 已运行 `TrainingGenerationInputReference.snapshotText` 不改；
- `TrainingSectionRun.sceneDescriptionText` 不改；
- `TrainingDatasetRevisionItem.sceneDescriptionText` 不改；
- 引用 inactive preset 的 draft task 在 UI 中标记为不可用，用户需要重新选择。

### 4.5 Block 表

模板侧：

```text
TrainingTemplateSectionSceneDescriptionBlock
- id
- trainingTemplateSectionId
- sceneDescriptionPresetCategoryId
- sourceType = preset | local
- sceneDescriptionPresetId?
- localText?
- sortOrder
- enabled
- createdAt
- updatedAt
```

项目侧：

```text
TrainingSceneDescriptionBlock
- id
- trainingSectionId
- sceneDescriptionPresetCategoryId
- sourceType = preset | local
- sceneDescriptionPresetId?
- localText?
- sortOrder
- enabled
- createdAt
- updatedAt
```

规则：

- `sourceType = preset`：必须有 `sceneDescriptionPresetId`，`localText` 为空；
- `sourceType = local`：必须有 `localText`，仍必须有 category id，用于分组和合成排序；
- preset block live binding：不复制 preset 文本，render 时读取当前 preset 文本；
- 编辑 preset-bound block：解除绑定，转为 `sourceType = local`，保存编辑后的 `localText`；
- block 微行为对齐现有生图 prompt block 逻辑。

### 4.6 sceneDescription 组装

组装时动态计算：

```text
1. 取 enabled blocks
2. 按 category.sceneDescriptionOrder 排序
3. 同一 category 内按 block.sortOrder 排序
4. preset block resolve preset.sceneDescriptionText
5. local block 使用 localText
6. trim 空内容
7. 用换行拼接
```

历史快照保存到：

```text
TrainingSectionRun.sceneDescriptionText
TrainingDatasetRevisionItem.sceneDescriptionText
```

---

## 5. Prompt / Text 模型

### 5.1 核心文本层

```text
TrainingCharacterProfile.loraUsagePrompt
- 简洁 LoRA 调用提示词/tag block
- caption 必须以前缀形式使用

TrainingCharacterProfile.characterDetailPrompt
- 详细角色描述
- 用于训练集图片生成，帮助图像模型保持角色细节

sceneDescription
- 小节希望生成的训练图片内容
- 包括 view / pose / framing / background / variation / avoid constraints
- 不放角色稳定身份、角色特定不对称细节

TrainingGenerationTask.supplementalPrompt
- 生成面板任务级补充提示词
- DB column: supplemental_prompt
- 按 taskType 解释

TrainingImageResult.supplementalPrompt
- 单张结果图的补充上下文
- DB column: supplemental_prompt
- caption/freeze 使用

TrainingSectionRun.imagePromptText
- 某次 section run 实际发给图像模型的完整 prompt
- 可编辑、可重跑、可被后续任务引用

TrainingImageResult.trainingCaption
- 单张训练结果图的当前 caption
```

### 5.2 Guidance / Format 字段

四个字段是 template/project-owned defaults：

```text
imagePromptGuidance
imagePromptFormat
captioningGuidance
trainingCaptionFormat
```

存储位置：

- `TrainingTemplate` 保存模板默认值；
- 创建/import project 时复制到 `TrainingProject`；
- project copy 是 runtime source of truth；
- 初版不做 `TrainingTemplateSection` / `TrainingSection` override。

### 5.3 Image prompt 渲染

```text
characterDetailPrompt
+ sceneDescription
+ TrainingGenerationTask.supplementalPrompt
+ imagePromptGuidance
+ imagePromptFormat
-> TrainingSectionRun.imagePromptText
```

默认 `imagePromptFormat` 形状：

```text
Generate a finished anime character illustration.

Character:
{characterDetailPrompt}

Scene:
{sceneDescription}

Supplemental prompt:
{supplementalPrompt}

Guidance:
{imagePromptGuidance}
```

`imagePromptGuidance` 应 provider-agnostic，只描述如何写视觉 prompt。不要混入 workflow metadata、工具调用说明、dataset bookkeeping。

### 5.4 Caption 渲染

```text
actual image
+ loraUsagePrompt
+ sceneDescription
+ TrainingImageResult.supplementalPrompt
+ TrainingGenerationTask.supplementalPrompt
+ captioningGuidance
+ trainingCaptionFormat
-> TrainingImageResult.trainingCaption
```

默认 `trainingCaptionFormat` 形状：

```text
Caption the provided image for a character LoRA dataset.

Required prefix:
{loraUsagePrompt}

Scene context:
{sceneDescription}

Image-specific supplemental prompt:
{imageSupplementalPrompt}

Task supplemental prompt:
{supplementalPrompt}

Guidance:
{captioningGuidance}
```

caption 规则：

- 实际图片内容优先；
- `loraUsagePrompt` 是必要前缀；
- caption body 主要记录变量：pose、view、crop、expression、action、background、lighting、props、extra characters、interaction；
- 角色身份、稳定外观、默认服装由 `loraUsagePrompt` 表示，不在 caption body 反复描述；
- image-model-facing text 不默认进入 caption，因为里面可能有未实际出现的意图。

### 5.5 Text version / restore point

所有主要文本字段 autosave。版本是语义 checkpoint，不是每个 keystroke。

首版使用轻量通用表：

```text
TrainingTextRevision
- id
- trainingProjectId
- entityType
- entityId
- fieldName
- textValue
- reason = ai_generation | before_overwrite | idle_checkpoint | run_snapshot | dataset_freeze | start_training
- sourceTaskId?
- sourceRunId?
- createdAt
```

规则：

- 当前可编辑文本仍保存在业务实体字段；
- `TrainingTextRevision` 只保存可恢复的语义 checkpoint；
- checkpoint 不参与业务渲染的 live source of truth；
- restore 时把 `textValue` 写回对应业务字段，并在覆盖前再生成 `before_overwrite` checkpoint；
- 历史 `TrainingSectionRun` / `TrainingDatasetRevisionItem` snapshot 不依赖此表恢复。

checkpoint 时机：

- AI generation / regeneration；
- destructive overwrite 前；
- blur/idle 后合并提交；
- actual prompt used by generation run；
- dataset freeze / start training。

初版不要求用户手动 pin/star/checkpoint。

---

## 6. 角色/Profile 与参考图

### 6.1 TrainingCharacterProfile

一个 `TrainingProject` 对应一个 profile。

```text
id
trainingProjectId
loraUsagePrompt
characterDetailPrompt
loraUsagePromptGenerationTaskId?
characterDetailPromptGenerationTaskId?
createdAt
updatedAt
```

### 6.2 TrainingCharacterImage

角色参考图实体，直接指向 `Artifact`，不走 `TrainingImageResult`。

```text
id
trainingCharacterProfileId
artifactId
imageType = original_reference | generated_reference | auxiliary_reference
label?
note?
sortOrder
sourceGenerationTaskOutputId?
createdAt
updatedAt
```

规则：

- 初版没有固定 reference slots；
- 不使用 `viewSlot` enum；
- 不提供 front/left/right/back/close-up/detail/expression 等内置 label 建议；
- `label` / `note` 是自由文本；
- 参考图默认不进入最终训练集；
- 如果参考图要进入训练结果池，用户显式执行“加入结果/加入训练集”，创建新的 `TrainingImageResult(sourceType = result_upload, artifactId = same artifact)`。

---

## 7. Artifact 文件模型与生命周期

### 7.1 Artifact 是项目级资源

初版 `Artifact` 是 `TrainingProject` 级资源。

```text
Artifact
- id
- trainingProjectId
- storageKey / filePath
- storageRole = mutable_source | revision_snapshot | run_output | protected_output | temp
- mimeType
- fileSize
- sha256?
- width?
- height?
- lifecycleStatus = active | archived_cleaned | deleted
- createdAt
- updatedAt
```

规则：

- 不做 `ArtifactReference` 表；
- 不做 refCount；
- 业务实体 inside 同一个 project 可以共享同一个 artifact；
- 普通业务 row 删除不物理删除 artifact 文件；
- dataset freeze 时复制 selected/kept image 到 revision-scoped snapshot artifact；
- `revision_snapshot` artifact 是 TrainingRun 的读取源，不依赖结果池 mutable 文件；
- final LoRA / config / manifest / selected dataset snapshot / necessary logs 使用 `protected_output` 或等价保护标记；
- 只有 `TrainingProject` delete/archive 服务负责物理清理。

### 7.2 普通业务删除

以下操作只删除/更新业务 row，不删除底层文件：

```text
delete/reject/remove TrainingCharacterImage
remove/reject TrainingImageResult
remove task input/output
remove supplemental image input
remove dataset item row
```

### 7.3 Project delete

```text
delete TrainingProject
-> cancel active generation/caption/training work
-> delete project-local business rows through project cascades
-> clean project artifact/work directories with safe path checks
```

### 7.4 Project archive

Archive 前置条件：

```text
- 至少一个 succeeded TrainingRun
- final LoRA / training config / dataset revision snapshot / run summary 已导出、打包，或保存到非 disposable 工作区
```

Archive 保护输出：

```text
final LoRA artifact
training config
dataset revision manifest
frozen captions
selected/frozen dataset image files
run summary
necessary logs
```

Archive 清理对象：

```text
rejected/pending images not included in frozen dataset
generated results not included in any frozen dataset
temporary supplemental images
task draft outputs
intermediate checkpoints
cache files
ComfyUI output directories
temporary outputs from failed/cancelled tasks
```

Archive 只能通过 project-level flow 触发，不能由单张图片删除、任务删除、dataset item 删除触发。

---

## 8. TrainingSection / TrainingSectionRun / TrainingImageResult

### 8.1 TrainingSection

```text
id
trainingProjectId
name?
sortOrder
enabled
sectionDefaultsJson?
latestRunId?
createdAt
updatedAt
```

`TrainingSection` 不保存长期 `currentImagePromptText`。小节稳定内容来自 sceneDescription blocks；每次实际图像 prompt snapshot 保存到 run。

### 8.2 TrainingSectionRun

```text
id
trainingProjectId
trainingSectionId
trainingCharacterProfileId
generationTaskId
runIndex
sceneDescriptionText       # assembled sceneDescription snapshot
imagePromptText            # actual prompt sent to image model
provider?
model?
generationParamsJson?
status = queued | running | succeeded | failed | cancelled
errorMessage?
createdAt
updatedAt
startedAt?
finishedAt?
```

职责：

- 保存 section/run 业务 provenance；
- 保存实际用于生成的 prompt snapshot；
- 不直接存图片文件；图片文件由 `TrainingImageResult.artifactId` 指向。

### 8.3 TrainingImageResult

训练结果池图片。只有它能进入最终训练数据集。

```text
id
trainingProjectId
trainingCharacterProfileId
artifactId
sourceType = section_run | result_upload
trainingSectionRunId?       # section_run only
generationTaskOutputId?
reviewStatus = pending | kept | rejected
trainingCaption?
captionGenerationTaskId?
supplementalPrompt?
removedAt?
removeReason?
filePathSnapshot?
thumbnailArtifactId?
width?
height?
mimeType?
fileSize?
sha256?
createdAt
updatedAt
```

来源：

```text
sourceType = section_run
- 来自小节生图结果
- 必须有 trainingSectionRunId
- 默认 reviewStatus = pending

sourceType = result_upload
- 来自训练集/结果一览页手动上传
- 没有 section/run ownership
- 默认 reviewStatus = kept
```

规则：

- 不加 `datasetIncluded`；
- 当前训练集草稿由 `reviewStatus = kept` 表示；
- overview/freeze 只收集 `kept`；
- 已进入任意 `TrainingDatasetRevisionItem` 的结果图不能 hard delete；
- UI 移除历史已冻结结果时设置 `removedAt`，不删除 revision snapshot；
- result_upload 可有 `supplementalPrompt`；
- section_run 也可有单图 `supplementalPrompt`，叠加在 section sceneDescription 上；
- 不加 `sortOrder`，排序来自 section order + run/image creation time；result_upload 永远排在 section images 后，按上传时间排序。

---

## 9. 统一生成任务模型

### 9.1 TrainingGenerationTask

所有 Training AI 文本/图片生成都使用统一 task。

```text
id
trainingProjectId
generationKind = text_generation | image_generation
taskType
supplementalPrompt?
status = queued | running | succeeded | failed | cancelled
provider?
model?
paramsJson?
errorMessage?
createdAt
updatedAt
startedAt?
finishedAt?
```

`generationKind`：

```text
text_generation
image_generation
```

`taskType`：

```text
profile_text_generation
scene_description_generation
image_prompt_generation
caption_generation
trainingset_generation
reference_image_generation
```

`TrainingGenerationTask.supplementalPrompt` 是生成面板任务级“补充提示词”，不建成 `TrainingGenerationInputReference(inputKind=supplemental_text)`。

### 9.1.1 图像生成 Provider

Training 初版的训练集图片和参考图生成使用 GPT-Image-2，通过既有 standalone Codex OAuth adapter；不使用 ComfyUI workflow 作为初版 Training 生图后端。

```text
provider = codex_gpt_image2
model = gpt-image-2
paramsJson.hostModel = gpt-5.5
paramsJson.size = 1024x1536        # full-body / portrait default
paramsJson.quality = high
paramsJson.background = opaque
```

首版不支持 ComfyUI 风格的 batch size / image count 参数。一个 `TrainingGenerationTask` 只产出一个最终 output：

- `generationKind = image_generation`：产出一张图片；
- `generationKind = text_generation`：产出一段文本；
- GPT-Image-2 provider 按一次请求一张图处理；
- 如需多张训练图、多张参考图或多段文本，创建多个 `TrainingGenerationTask`，而不是在一个 task 内批量输出。

参考实现：

```text
/mnt/d/Luca/Code/LoRATrainingMVP/scripts/codex_gpt_image2.py
```

执行边界：

```text
Training prompt renderer / UI task
-> 生成并保存 TrainingSectionRun.imagePromptText
-> 解析 internal_image / supplemental_image 引用
-> codex_gpt_image2 provider adapter
-> Codex Responses API image_generation tool, model gpt-image-2
-> TrainingGenerationTaskOutput(outputKind=image, artifactId)
-> TrainingImageResult 或 TrainingCharacterImage
```

`codex_gpt_image2` adapter 只做 transport/provider 工作：读取已渲染 prompt 与输入图片，构造 Codex Responses payload，强制 `image_generation` tool，解析 streaming/SSE 图片结果，保存 PNG/metadata 并返回 artifact。角色、场景、小节目标、补充提示词、引用图角色等视觉决策不放在 adapter 里。

请求里的 host `instructions` 与真实视觉 prompt 分开记录：`instructions` 只是让 host model 调用 `image_generation`；真正约束画面的文本是 `imagePromptText` / input text。

ComfyUI 仍可作为普通生图模块或未来本地/fallback provider，但不是 Training 初版 dataset/reference image generation 的主路径。LoRA `TrainingRun` 本身继续走 local runner / WSL / sd-scripts，不是 ComfyUI workflow。

### 9.2 TrainingGenerationInputReference

统一记录 task 输入引用和 supplemental uploaded images。

```text
id
trainingGenerationTaskId
inputKind = internal_text | internal_image | supplemental_image
sourceEntityType?
sourceEntityId?
sourceField?
artifactId?             # image reference or supplemental image
snapshotText?
snapshotArtifactId?
snapshotFilePath?
role?
purpose?
sortOrder
createdAt
```

输入类型：

```text
internal_text
- 项目内文本引用

internal_image
- 项目内图片引用

supplemental_image
- task-local 上传图片
```

任务级 supplemental prompt 不在此表；它直接在 task 上。

### 9.3 可引用文本源

```text
TrainingCharacterProfile.loraUsagePrompt
TrainingCharacterProfile.characterDetailPrompt
TrainingSection.sceneDescription              # assembled current value
TrainingSceneDescriptionBlock.localText       # or resolved preset text
TrainingSceneDescriptionPreset.sceneDescriptionText
TrainingSectionRun.sceneDescriptionText       # historical snapshot
TrainingSectionRun.imagePromptText            # historical prompt
TrainingImageResult.trainingCaption
TrainingImageResult.supplementalPrompt
TrainingGenerationTaskOutput.textValue
```

### 9.4 可引用图片源

```text
TrainingCharacterImage
- original_reference
- generated_reference
- auxiliary_reference

TrainingImageResult.artifactId
- section_run result images
- result_upload images

TrainingGenerationTaskOutput(outputKind=image).artifactId
TrainingDatasetRevisionItem image snapshots   # explicit history/frozen-version picker only
```

不作为普通引用源：

```text
raw Artifact rows
category/folder rows
TrainingTemplate rows after import
TrainingRun logs/config/final LoRA artifacts
guidance/format fields as arbitrary references
```

### 9.5 TrainingGenerationTaskOutput

```text
id
trainingGenerationTaskId
outputKind = text | image
textValue?
artifactId?
filePath?
targetEntityType?
targetEntityId?
targetField?
appliedAt?
createdAt
```

规则：

- 首版业务不变量：一个 `TrainingGenerationTask` 最多创建一个最终 `TrainingGenerationTaskOutput`；
- 文本输出保存生成时 `textValue`；业务实体字段保存当前可编辑值；
- 图片输出保存 `artifactId`；业务实体也指向同一个 artifact；
- 不复制图片文件；
- output 可记录应用到哪个业务实体/字段。

### 9.6 生成面板结构

结构定稿，不记录视觉样式：

```text
1. 任务元信息区域
2. 任务内容调整区
3. 渲染区
```

任务元信息区域：

- `generationKind`
- `taskType`
- provider/model/status 等执行 metadata

任务内容调整区：

```text
引用内容选择
- selected reference chips/cards
- 添加引用

补充提示词
- TrainingGenerationTask.supplementalPrompt

自上传图片
- supplemental_image upload
```

渲染区：

- AI-chat-style input preview；
- image references / supplemental images 作为 attachment；
- internal text references + supplementalPrompt 合成一个完整 text block；
- 不把 raw JSON/code block 作为主 UI。

### 9.7 ReferencePicker

多级源列表必须显式展示一级/二级层级：

```text
文本
- 角色/Profile 文本
- SceneDescription
- Caption / 结果图补充说明
- 历史 Run / Task Output 文本

图片
- 角色参考图
- 训练结果图
- 历史图片输出

历史 / 冻结版本
- 冻结数据集图像快照
```

行为：

- 点击 candidate 只预览，不添加；
- 预览区展示 title/source/type/text excerpt 或 image metadata；
- 只有显式“添加”才成为 task selected reference；
- running task 时 snapshot 到 `TrainingGenerationInputReference`；
- 初版无 quick chips、无固定 slots、无 label suggestions。

---

## 10. 训练集一览、Caption、Freeze

### 10.1 训练集/结果一览页

每个 `TrainingProject` 有训练集/结果一览页，聚合：

- 所有 section run 产生的 `TrainingImageResult`；
- 结果页手动上传的 `TrainingImageResult(sourceType=result_upload)`。

展示/管理：

- reviewStatus：pending / kept / rejected；
- 默认只汇总 kept 作为当前训练集草稿；
- 显示 caption，未生成时提示生成/编辑；
- 支持对多张图片批量发起 caption generation，但每张图片创建独立的单输出 `TrainingGenerationTask`：
  - all kept without captions；
  - selected images；
  - single regenerate。

### 10.2 TrainingDatasetRevision

每次 start training 创建新的 immutable revision，即使内容与之前相同。

```text
TrainingDatasetRevision
- id
- trainingProjectId
- status?
- createdAt
```

创建时序：

```text
startTrainingRun
-> validateTrainingDatasetReadiness(projectId)
-> createTrainingDatasetRevision(projectId)
-> createTrainingRun(projectId, trainingDatasetRevisionId, config)
```

`TrainingRun.trainingDatasetRevisionId` 是 run -> revision 的唯一运行关系；需要从 revision 找 run 时反查 `TrainingRun`。

### 10.3 TrainingDatasetRevisionItem

```text
id
trainingDatasetRevisionId
sourceTrainingImageResultId
sourceArtifactId
snapshotArtifactId
filePathSnapshot
captionSnapshot
loraUsagePromptSnapshot
sceneDescriptionText
supplementalPromptSnapshot
captionContextSnapshot?
width?
height?
aspectBucket?
sortOrder?
createdAt
```

规则：

- item 引用 selected/kept `TrainingImageResult`；
- freeze 时复制 selected/kept image 到 revision-scoped `snapshotArtifactId`；
- snapshot image/file refs、caption、sceneDescription、supplementalPrompt、loraUsagePrompt；
- `TrainingRun` 读取 frozen revision，不读取当前 mutable rows；
- later edits 只影响下一次 revision/run；
- `sourceTrainingImageResultId` / `sourceArtifactId` 只用于 provenance；
- `snapshotArtifactId` / `filePathSnapshot` 是训练实际读取源；
- normal UI 不要求用户管理 revision。

### 10.4 Freeze readiness

只检查不可避免的运行要求：

- 至少一个 kept image；
- selected/kept images 有非空 caption；
- referenced artifact/file 存在；
- local runner/script/config 必需项存在。

不做 broad checklist gate：

- 不要求固定参考图槽位；
- 不要求标签/label 填写；
- 不要求用户选择 caption strategy。

---

## 11. TrainingRun

### 11.1 TrainingRun 字段

```text
id
trainingProjectId
trainingDatasetRevisionId
status = queued | running | succeeded | failed | cancelled
baseCheckpointId?
configArtifactId?
trainingLogArtifactId?
finalLoraArtifactId?
runSummaryJson?
progressJson?
currentStep?
totalSteps?
waitReason? = comfyui_queue_active | gpu_busy | scheduler_paused | none
waitingSince?
schedulerMessage?
runnerType? = local_wsl_sd_scripts
runnerWorkspacePath?
errorMessage?
createdPresetId?
createdPresetVariantId?
presetCreatedAt?
createdAt
updatedAt
startedAt?
finishedAt?
```

命名：

- 最终 `.safetensors` 用 `finalLoraArtifactId`；
- 训练摘要用 `runSummaryJson` / “训练摘要”，不要叫 `reportJson`；
- raw stdout/stderr/progress/warnings/errors 用 `trainingLogArtifactId`；
- config 如 `training.toml` 用 `configArtifactId`。

### 11.2 状态和取消

```text
queued | running | succeeded | failed | cancelled
```

不增加 `waiting` 状态。等待本地 ComfyUI 队列、GPU 互斥或 scheduler 暂停时保持 `queued`，并使用：

```text
waitReason
waitingSince
schedulerMessage
```

取消语义：

- queued：直接标记 cancelled；
- running：写 cancel signal file，由 local runner 轮询；
- graceful exit 超时后可 force-kill；
- active run 不允许清理中间产物；
- finished/failed/cancelled 后可显式 cleanup intermediate outputs；
- final artifacts 受保护。

### 11.3 并发和本地 GPU 协调

初版：

- 同一 `TrainingProject` 禁止多个 active `TrainingRun`；
- `TrainingRun` 直接由本地 runner / WSL / sd-scripts 执行，不是 ComfyUI workflow；
- `TrainingRun` queued/running/progress/cancel/log 进入系统维护任务列表；
- `TrainingRun` 通过统一本地 GPU scheduler 获取执行权；
- Training 初版 image generation 走 `codex_gpt_image2` / GPT-Image-2 provider，不占用本地 ComfyUI queue；
- 当本地 LoRA `TrainingRun` running 时，不需要因为 GPT-Image-2 远端生图而等待 ComfyUI queue；但如果未来启用本地/ComfyUI image-generation fallback，则该 fallback 必须遵守本地 GPU/ComfyUI queue 协调；
- 如果 start training 时本地 ComfyUI queue 非空，TrainingRun 保持 `queued`，设置 `waitReason = comfyui_queue_active`，等 queue 空后自动开始；
- 多个 TrainingRuns 跨项目 queued 时 FIFO，只跑一个；
- 不做复杂 starvation/fairness；现有普通生图 queue-jump 行为仍可延迟训练。

### 11.4 Runner adapter

训练脚本细节封装在 runner adapter 内，不直接散落在 project / run service。

接口职责：

```text
TrainingRunner
- prepareDatasetAndConfig(runId)
- start(runId)
- pollProgress(runId)
- requestCancel(runId)
- collectArtifacts(runId)
```

首版 adapter：

```text
local_wsl_sd_scripts
```

每个 run 使用独立 workspace，保存：

```text
cancel.requested
progress.jsonl
stdout/stderr logs
training config
intermediate outputs
final LoRA
```

业务层只依赖 runner adapter 返回的状态、progress、artifact path/hash，不依赖具体 shell 命令和脚本目录结构。

### 11.5 成功后 Preset handoff

成功 `TrainingRun` 且有 `finalLoraArtifactId` 时提供窄入口：创建角色 Preset。

规则：

- 一个 default variant；
- prompt 使用 frozen/snapshot `loraUsagePromptSnapshot`；
- `negativePrompt = null`；
- final LoRA 绑定到 `lora1` 和 `lora2`，默认 weight `1.0`；
- 在 `TrainingRun` 记录 created preset/variant ids 和 timestamp，防止重复创建。

广义 benchmark、推荐权重、promotion 不在本模块。

---

## 12. 项目删除 / 归档清理

### 12.1 Delete TrainingProject

对齐现有生图项目 `deleteProjectCompletely` 思路。

```text
delete TrainingProject
-> cancel active generation/caption/training tasks
-> cancel/interrupt local queued/running work where applicable
-> delete project-local business rows through cascades
-> clean project artifact/work directories
-> clean temp/trash/cache/output dirs with safe path checks
```

### 12.2 Archive TrainingProject

对齐现有生图项目 archive 思路，但 Training 有自己的前置条件。

前置条件：

```text
- 至少一个 succeeded TrainingRun
- final LoRA 已保存
- training config 已保存
- dataset revision snapshot 已保存
- run summary 已保存
- 必要日志已保存
```

Archive 过程：

```text
archive TrainingProject
-> validate prerequisites
-> cancel active work if needed
-> export/package protected outputs if not already packaged
-> clean disposable project work artifacts
-> mark archivedAt / archived status
```

Protected archive outputs：

```text
final LoRA artifact
training config
dataset revision manifest
frozen captions
selected/frozen dataset image files
run summary
necessary logs
```

Disposable cleanup：

```text
rejected/pending images not included in frozen dataset
generated results not included in any frozen dataset
temporary supplemental images
task draft outputs
intermediate checkpoints
cache files
ComfyUI output directories
temporary outputs from failed/cancelled tasks
```

---

## 13. 路由与模块组织

### 13.1 Navigation mode

不保留独立底部导航 `LoRA训练`。使用全局 work-mode switch：

```text
generation | lora_training
```

LoRA training mode 下导航映射：

```text
运行 -> /training/runs
项目 -> /training/projects, /training/projects/[trainingProjectId]
预制 -> /training/presets
模板 -> /training/templates
模型 / 设置 -> 暂时共享或沿用当前路由
```

不要嵌套到普通 project route：

```text
不要：/projects/[projectId]/training
使用：/training/projects/[trainingProjectId]
```

### 13.2 代码组织建议

遵循当前项目组织风格，不引入新的 `src/features/<feature>` 大重构。

```text
src/app/training/*
- route/page code

src/app/training/components/*
- route-local UI components

src/lib/actions/training/*
- server actions split by concern

src/server/repositories/training/*
- DB reads/writes/query composition

src/server/services/training/*
- business flows/use cases

src/server/worker/training/*
- text/image/caption/freeze/training workers

src/lib/training/*
- contracts/enums/validation/prompt rendering/shared types
```

服务按职责拆分：

```text
projects
profiles
character-images
scene-description-presets
sections
section-runs
image-results
captions
generation-tasks
dataset-revisions
training-runs
artifacts
project-cleanup
```

---

## 14. API / Service 行为清单

### 14.1 Project / Template

```text
createTrainingProjectFromTemplate(templateId, input)
saveTrainingProjectAsTemplate(projectId, input)
archiveTrainingProject(projectId)
deleteTrainingProjectCompletely(projectId)
```

### 14.2 Presets / Blocks

```text
create/update/delete TrainingSceneDescriptionPresetCategory
create/update/delete TrainingSceneDescriptionPresetFolder
create/update/delete TrainingSceneDescriptionPreset
getTrainingSceneDescriptionPresetUsage(presetId)
deleteTrainingSceneDescriptionPresetCascade(presetId)
create/update/reorder TrainingSceneDescriptionBlock
resolveTrainingSectionSceneDescription(sectionId)
detachPresetBlockToLocal(blockId, editedText)
```

### 14.3 Generation tasks

```text
createTrainingGenerationTask(input)
addTrainingGenerationInputReference(taskId, reference)
uploadSupplementalImage(taskId, file)
renderTrainingGenerationTaskPreview(taskId)
runTrainingGenerationTask(taskId)
applyTrainingGenerationTaskOutput(outputId, target)
```

### 14.4 Image results / captions

```text
createTrainingImageResultFromSectionRun(outputId, runId)
uploadTrainingImageResult(projectId, file, supplementalPrompt?)
setTrainingImageReviewStatus(imageResultId, status)
updateTrainingImageSupplementalPrompt(imageResultId, text)
generateCaptionForImage(imageResultId, taskInput)
generateCaptionsForKeptImages(projectId, mode)
updateTrainingCaption(imageResultId, caption)
createTrainingTextRevision(input)
restoreTrainingTextRevision(textRevisionId)
```

### 14.5 Freeze / training

```text
validateTrainingDatasetReadiness(projectId)
createTrainingDatasetRevision(projectId)
startTrainingRun(projectId, revisionId, config)
cancelTrainingRun(trainingRunId)
scheduleNextTrainingRun()
pollTrainingRunProgress(trainingRunId)
cleanupTrainingRunIntermediateArtifacts(trainingRunId)
createPresetFromTrainingRun(trainingRunId)
```

---

## 15. 约束与校验

### 15.1 Block mutual exclusivity

```text
sourceType = preset
- requires preset id
- forbids localText
- category id must match preset.categoryId

sourceType = local
- requires localText
- requires category id
- no preset id
```

### 15.2 ImageResult source rules

```text
sourceType = section_run
- requires trainingSectionRunId

sourceType = result_upload
- forbids trainingSectionRunId
```

### 15.3 Dataset freeze rules

```text
- only reviewStatus = kept enters revision
- each TrainingRun gets a new immutable TrainingDatasetRevision
- TrainingRun reads revision items, not current mutable image/caption rows
- freeze copies each selected source image into revision-scoped snapshot artifact
- revision item keeps provenance refs separately from training snapshot refs
```

### 15.4 Artifact deletion rules

```text
- no business-row cascade delete to Artifact
- no refCount table initial version
- project delete/archive is the only physical cleanup boundary
- no hard delete of TrainingImageResult that is referenced by any dataset revision
- protected output and revision snapshot artifacts are excluded from disposable archive cleanup
```

### 15.5 UI/UX structural rules

```text
- no fixed reference slots
- no viewSlot enum
- no built-in reference-label suggestions
- no quick chips initial version
- ReferencePicker uses explicit multi-level source tree
- preview-before-add is required
- prototype visual style is non-canonical
```

---

## 16. 非目标 / 禁止项

初版不要实现：

- embedded Manager LLM agent；
- `/agent-tasks` internal reasoning queue；
- LoRA benchmark/evaluation/recommended weights；
- full promotion workflow；
- inference negative prompt；
- caption strategy selector；
- fixed reference slots；
- reference label suggestions；
- ArtifactReference table；
- artifact refCount；
- TrainingImageResult.datasetIncluded；
- TrainingImageResult.sortOrder；
- variants for `TrainingSceneDescriptionPreset`；
- template provenance fields on project rows；
- section-level overrides for guidance/format fields；
- raw JSON/debug block as primary render UI；
- direct cascade delete from business rows to Artifact files。

---

## 17. 开发前检查点

进入实现计划前，应确认：

1. Prisma schema 采用本文 entity / enum / relation / constraint；
2. Training route 与普通 generation route 隔离；
3. artifact 文件路径按 `TrainingProject` 隔离；
4. project delete/archive service 参考现有 generation project cleanup，并保留 safe path checks；
5. generation task model 先实现 task/input/output 通用骨架；
6. sceneDescription preset/block resolver 先实现，再接 image prompt/caption render；
7. dataset freeze 和 TrainingRun 读取 immutable revision；
8. freeze 时复制 revision-scoped snapshot artifact；
9. `TrainingTextRevision` 的 checkpoint/restore 服务先定义清楚；
10. `TrainingRun` 的 scheduler waitReason 与 runner adapter 边界先定义清楚；
11. 只记录 UI 结构，不复用当前原型视觉样式。

---

## 18. 当前设计状态

当前无 active design issue。本文可以作为后续 implementation plan 的输入。
