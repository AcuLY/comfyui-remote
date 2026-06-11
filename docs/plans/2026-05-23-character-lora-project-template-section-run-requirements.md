# Character LoRA Training 现状梳理与 Project / Template / Section / Run 化需求

> 历史状态：本文属于 2026-05 `CharacterLoraTraining*` 旧方案，只作背景参考。当前 LoRA Training v2 文档入口是 `docs/plans/2026-06-07-manager-lora-training-docs-index.md`，主设计以 `docs/plans/2026-06-07-manager-lora-training-final-technical-design.md` 为准。新开发不得从本文继承 `CharacterLoraTraining*` 命名、`/character-lora-training/**` 路由、benchmark/promotion 闭环或页面结构。

日期：2026-05-23
范围：`character-lora-training` 模块的数据模型、API、前端页面、worker 流程，以及把用户提出的 Manager `project/template/section/run` 心智模型映射到 LoRA 训练领域后的改造需求。

## 1. 结论摘要

当前模块已经不是单纯脚本，而是一个完整的 LoRA 训练工作台：它有独立 Prisma 数据模型、API、前端 job workbench、artifact 体系、worker queue、GPU lock、训练完成后的 benchmark/promotion 闭环。

现状最接近的领域心智模型是：

- `CharacterLoraTrainingJob` = 一个 LoRA training project，约束为“一个角色 + 一个主要服装/形态 + 一个 base checkpoint/家族 + 一个 prompt/canonical/dataset lineage”。
- `CharacterLoraSectionTemplate` = section template，但目前是全局散列模板，不属于某个顶层 template/recipe。
- `CharacterLoraJobSection` = project section 的 LoRA 版，表示一个训练数据覆盖目标，如正面、侧面、背面、鞋袜细节、表情等。
- `CharacterLoraGenerationRun` = section/canonical 生成 run，支持 parent run、provider、prompt、input images 和输出候选图。
- `CharacterLoraCandidateImage` + review/caption = section run 的输出审核层，决定哪些图进入 dataset。
- `CharacterLoraDatasetRevision` = immutable frozen dataset，类似把 project sections 的 kept outputs 打包成一次可训练输入。
- `CharacterLoraTrainingRun` = trainer run，执行 sd-scripts/kohya 等外部训练命令并产出 safetensors/checkpoints/log。
- `CharacterLoraBenchmarkRun` = 训练后复用普通 Manager project/preset 的测试 run，生成七段 benchmark evidence。
- `CharacterLoraPromotionDecision` = 人工审核后的最终发布 gate。

主要缺口：还没有顶层的 `LoRA Template / Recipe` 模型来统一 section templates、默认 canonical/prompt rules、训练配置和 benchmark matrix；前端也是一个很长的 job 页面，而不是像 Manager project 那样以 template → project → section → run 逐层展开；workers 需要外部启动，Manager 只负责队列/锁/状态，不负责守护进程生命周期。

## 2. 当前模块入口与文件范围

主要入口：

- 数据模型：`prisma/schema.prisma`
- 契约类型：`src/server/character-lora-training/contracts.ts`
- Repository：`src/server/repositories/character-lora-training-repository.ts`
- 服务层：`src/server/services/character-lora-training/*.ts`
- API：`src/app/api/character-lora-training/**/route.ts`
- 前端列表页：`src/app/character-lora-training/page.tsx`
- 前端工作台：`src/app/character-lora-training/[jobId]/page.tsx` + `job-workbench-client.tsx`
- Worker：`scripts/character-lora-training/*.ts`
- 运行手册：`docs/plans/2026-05-23-character-lora-worker-runbook.md`

服务层按职责拆分：

- `job-service.ts`：job CRUD。
- `source-image-service.ts`：参考图上传、把 source 注册成候选图。
- `canonical-service.ts`：canonical 图生成、mock complete、手动注册、选择/拒绝。
- `prompt-card-service.ts`：Prompt Card version 创建、从 section correction 提升为新 prompt card。
- `section-template-service.ts`：默认 section templates、模板复制、job sections 实例化、暂停/恢复。
- `phase3-service.ts`：section generation run、candidate review、caption、dataset freeze、worker task lease/heartbeat/complete/fail。
- `training-service.ts`：训练入队、GPU lock、training complete/cancel。
- `benchmark-promotion-service.ts`：benchmark template/status、benchmark enqueue/complete/cleanup、promotion decision、final preset promotion。
- `report-service.ts`：job report、diagnostic summary、markdown report。
- `artifact-service.ts`：artifact root/path/hash/write/redaction。

## 3. 当前数据模型

### 3.1 枚举

- `CharacterLoraJobStatus`：job 生命周期。
- `CharacterLoraImageReviewStatus`：candidate image 审核状态，包含 pending/keep/reject/excluded 等。
- `CharacterLoraRunStatus`：queued/running/done/failed/cancelled 等运行状态。
- `CharacterLoraArtifactKind`：artifact 分类。
- `CharacterLoraWorkerType`：image_generation、dataset_freeze、training、benchmark、promotion 等 worker 类型。
- `CharacterLoraDecisionStatus`：promotion decision 状态。

### 3.2 核心表

#### `CharacterLoraTrainingJob`

表示一个 LoRA training project。关键字段：

- 基础身份：`slug`、`characterName`、`triggerToken`、`status`、`phase`。
- 训练范围：`trainingScope`，包含 purpose、primaryOutfitOrForm、scopeNote、derivedStates、是否禁止多角色/多服装等。
- caption/模型：`captionStrategy`、`baseCheckpointName`、`baseCheckpointPath`、`baseCheckpointHash`、`baseFamily`。
- 产物根目录：`artifactRoot`。
- 当前指针：`currentCanonicalVersionId`、`currentPromptCardVersionId`、`selectedDatasetRevisionId`、`promotedPresetId`。
- 关系：source images、canonical versions、prompt cards、sections、generation runs、candidate images、dataset revisions、training runs、benchmark runs、promotion decisions、artifacts、worker tasks。

#### `CharacterLoraSourceImage`

原始/参考图。关键字段：`role`、`artifactId`、`filePath`、`sha256`、`width/height`、`provenance`、`sortOrder`。

当前 role 包括：`source`、`setting`、`local_reference`、`manual_canonical`、`rerun_reference`。

#### `CharacterLoraCanonicalVersion`

标准 identity anchor 图版本。关键字段：`version`、`status`、`sourceRunId`、`imageArtifactId`、`selectedAt`、`notes`。Prompt Card、Sections、Dataset Revision 都可以绑定 canonical version，从而保留 lineage。

#### `CharacterLoraPromptCardVersion`

角色提示词与特征卡版本。关键字段：`canonicalVersionId`、`version`、`triggerToken`、`identityTraits`、`outfitTraits`、`negativeTraits`、`finalPromptDraft`、`changeReason`。

#### `CharacterLoraSectionTemplate`

全局 section 模板。关键字段：`key`、`name`、`description`、`angleTag`、`promptTemplate`、`negativeTemplate`、`targetCandidateCount`、`targetKeepCount`、`sortOrder`、`isActive`。

当前没有顶层 template/recipe 归属，所有 active templates 都是全局池。

#### `CharacterLoraJobSection`

某个 job 下由模板实例化出的 section。关键字段：`templateId`、`key`、`name`、`canonicalVersionId`、`promptCardVersionId`、`targetCandidateCount`、`targetKeepCount`、`status`、`keepCount`、`rejectCount`、`pendingCount`、`sortOrder`。

这是 LoRA 训练数据覆盖单元，对应普通 Manager 的 `ProjectSection`。

#### `CharacterLoraGenerationRun`

canonical 或 section 的图像生成尝试。关键字段：`sectionId`、`kind`、`parentRunId`、`status`、`provider`、`hostModel`、`imageModel`、`hostInstruction`、`visualPrompt`、`negativePrompt`、`toolParams`、`inputImages`、`requestArtifactId`、`responseSummary`、`errorSummary`。

这是 LoRA 图像生成侧的 run，对应普通 Manager 的 `Run`，但仅负责生成训练候选图，不代表训练本身。

#### `CharacterLoraCandidateImage`

生成 run 的输出候选图。关键字段：`sectionId`、`generationRunId`、`artifactId`、`filePath`、`sha256`、`width/height/fileSize`、`reviewStatus`、`rejectReasons`、`reviewNote`、`captionDraft`、`includedDatasetRevisionId`。

#### `CharacterLoraDatasetRevision`

冻结后的不可变训练数据集版本。关键字段：`version`、`status`、`canonicalVersionId`、`promptCardVersionId`、`captionStrategy`、`itemCount`、`sourceCount`、`syntheticCount`、`selectedManifestArtifactId`、`metadataJsonlArtifactId`、`captionAuditArtifactId`、`trainDir`、`frozenAt`。

#### `CharacterLoraDatasetItem`

dataset revision 内的单项训练样本。关键字段：`candidateImageId`、`imageArtifactId`、`captionArtifactId`、`captionText`、`repeatCount`、`sourceWeight`、`sortOrder`。

#### `CharacterLoraTrainingRun`

训练执行记录。关键字段：`datasetRevisionId`、`status`、`launcher`、`resolvedConfig`、`configArtifactId`、`dryRunSummaryArtifactId`、`logArtifactId`、`outputDir`、`finalSafetensorsArtifactId`、`finalSha256`、`metadataSummary`、`currentStep`、`targetSteps`、`lossSnapshot`、`cancelRequestedAt`。

#### `CharacterLoraTrainingCheckpoint`

训练 checkpoint。关键字段：`trainingRunId`、`step`、`artifactId`、`sha256`、`metrics`。

#### `CharacterLoraBenchmarkRun`

训练后 benchmark 记录。关键字段：`trainingRunId`、`status`、`loraAssetId`、`testPresetId`、`testProjectId`、`templateId`、`checkpointMatrix`、`weightMatrix`、`reportArtifactId`、`recommendedWeight`、`resultSummary`、临时 preset/project cleanup 字段。

#### `CharacterLoraPromotionDecision`

人工发布决策。关键字段：`benchmarkRunId`、`status`、`selectedLoraAssetId`、`selectedCheckpoint`、`defaultRecommendedWeight`、`perVariantWeightOverrides`、`variantPromptDrafts`、`decisionReason`、`rejectedReturnPoint`、`promotedCategoryId`、`promotedPresetId`、`reportArtifactId`。

#### `CharacterLoraArtifact`

所有关键文件/图片/日志/报告的索引。关键字段：`kind`、`relativePath`、`absolutePath`、`sha256`、`byteSize`、`mimeType`、`redactionLevel`、`metadata`。

#### `CharacterLoraWorkerTask`

内部 worker queue。关键字段：`workerType`、`targetType`、`targetId`、`status`、`payload`、`leaseOwner`、`leaseExpiresAt`、`attemptCount`、`progressJson`、`heartbeatAt`、`errorSummary`。

## 4. 当前 API 面

### 4.1 Job 与 report

- `GET /api/character-lora-training/jobs`
- `POST /api/character-lora-training/jobs`
- `GET /api/character-lora-training/jobs/[jobId]`
- `PATCH /api/character-lora-training/jobs/[jobId]`
- `GET /api/character-lora-training/jobs/[jobId]/report`
- `POST /api/character-lora-training/jobs/[jobId]/report`
- `GET /api/character-lora-training/gpu-task-lock`

### 4.2 Source / artifact / image

- `GET /api/character-lora-training/jobs/[jobId]/source-images`
- `POST /api/character-lora-training/jobs/[jobId]/source-images`
- `GET /api/character-lora-training/jobs/[jobId]/images`
- `GET /api/character-lora-training/jobs/[jobId]/artifacts/image`
- `POST /api/character-lora-training/images/review`
- `PATCH /api/character-lora-training/images/[imageId]/caption`

### 4.3 Canonical / Prompt Card

- `POST /api/character-lora-training/jobs/[jobId]/canonical/generate`
- `POST /api/character-lora-training/jobs/[jobId]/canonical/manual`
- `POST /api/character-lora-training/jobs/[jobId]/canonical/[versionId]/select`
- `POST /api/character-lora-training/jobs/[jobId]/canonical/[versionId]/reject`
- `POST /api/character-lora-training/generation-runs/[runId]/mock-complete-canonical`
- `GET /api/character-lora-training/jobs/[jobId]/prompt-cards`
- `POST /api/character-lora-training/jobs/[jobId]/prompt-cards`

### 4.4 Section / generation run / dataset

- `GET /api/character-lora-training/section-templates`
- `POST /api/character-lora-training/section-templates`
- `GET /api/character-lora-training/jobs/[jobId]/sections`
- `POST /api/character-lora-training/jobs/[jobId]/sections/instantiate`
- `PATCH /api/character-lora-training/sections/[sectionId]`
- `POST /api/character-lora-training/sections/[sectionId]/runs`
- `GET /api/character-lora-training/jobs/[jobId]/dataset-revisions`
- `POST /api/character-lora-training/jobs/[jobId]/dataset-revisions`

### 4.5 Training

- `GET /api/character-lora-training/jobs/[jobId]/training-runs`
- `POST /api/character-lora-training/dataset-revisions/[revisionId]/training-runs`
- `POST /api/character-lora-training/training-runs/[trainingRunId]/cancel`

### 4.6 Benchmark / Promotion

- `GET /api/character-lora-training/jobs/[jobId]/benchmark-runs`
- `POST /api/character-lora-training/jobs/[jobId]/benchmark-runs`
- `GET /api/character-lora-training/training-runs/[trainingRunId]/benchmark-runs`
- `POST /api/character-lora-training/training-runs/[trainingRunId]/benchmark-runs`
- `POST /api/character-lora-training/benchmark-runs/[benchmarkRunId]/complete`
- `POST /api/character-lora-training/benchmark-runs/[benchmarkRunId]/cleanup`
- `POST /api/character-lora-training/benchmark-runs/[benchmarkRunId]/decisions`
- `GET /api/character-lora-training/jobs/[jobId]/promotion-decisions`
- `POST /api/character-lora-training/promotion-decisions/[decisionId]/promote`

### 4.7 Worker queue

- `GET /api/character-lora-training/worker/status`
- `GET /api/character-lora-training/worker/tasks/next`
- `POST /api/character-lora-training/worker/tasks/[taskId]/heartbeat`
- `POST /api/character-lora-training/worker/tasks/[taskId]/complete`
- `POST /api/character-lora-training/worker/tasks/[taskId]/fail`

## 5. 当前前端页面

### 5.1 列表页 `/character-lora-training`

功能块：

- 顶部统计：任务数、草稿、训练中、已发布、GPU 锁。
- 新建训练任务：角色名、trigger、checkpoint browser、base checkpoint path/hash/family、caption strategy、初始参考图、training scope、禁止混角色/多服装、高级 derived states。
- 任务列表：按角色/trigger/checkpoint 过滤，进入 job workbench。

### 5.2 Job workbench `/character-lora-training/[jobId]`

页面已经按阶段分块：

1. `Job 概览`：base checkpoint、当前 canonical/prompt/dataset 指针、artifact root。
2. `Source`：上传参考图；source role；把 source 注册为候选图。
3. `Canonical`：用 provider/size/quality/reference images 入队 canonical；手动注册 canonical；mock complete；选择/拒绝 canonical version。
4. `Prompt Card`：绑定 canonical version，维护 trigger、identityTraits、outfitTraits、negativeTraits、finalPromptDraft；支持旧 canonical/旧 prompt card 提示。
5. `Sections`：从全局 section templates 实例化；复制模板；设置下一次 section 入队 provider/size/quality/userInstruction/reference images；暂停/恢复 section；对单个 section 入队 run；选择 parentRunId。
6. `Review / Dataset`：按 section 和 review status 过滤候选图；批量 keep/reject/excluded/pending；填写 reject reason/note；编辑每张 caption；冻结 dataset revision；显示 revision lineage。
7. `Training`：选择 frozen dataset，选择 launcher/profile/queue policy；配置 post-training benchmark；高级/专家训练参数；入队训练；显示训练 run 并支持 cancel。
8. `Benchmark / Promotion`：手动入队 benchmark；显示 benchmark runs；mock complete；cleanup temp project/preset；创建 approved/rejected decision；发布预检/真实发布。
9. `Report / Diagnostics`：全链路 report、risk、recommended return point、一键跳转到诊断建议入口。

当前 UX 已覆盖 LoRA 训练闭环，但层级仍是“一个超长 job page”。如果要贴近 Manager project/template/section/run，应把这些阶段改造成更明确的 project/recipe/section/run 导航，而不是继续堆叠所有表单。

## 6. 当前 worker 流程

### 6.1 `image-worker.ts`

- lease `image_generation` task。
- payload 包含 jobId、generationRunId 和完整 image generation request。
- provider 支持 `mock-local` 和 `openai-codex`。
- openai-codex 路径会把 input artifact 转为 data URL，调用 Codex Responses endpoint，解析 image_generation 结果。
- 写入 provider request redacted artifact、response summary、candidate image artifact。
- 调用 worker complete API，服务端再根据 run kind 创建 canonical version 或 candidate images。

### 6.2 `dataset-freeze-worker.ts`

- lease `dataset_freeze` task。
- 当前 worker 很薄：发送 materializing heartbeat，然后调用 completeTask。
- 真正冻结逻辑主要由服务端完成：从 keep images/captions 创建 manifest、metadata jsonl、caption audit、trainDir 和 dataset items。

### 6.3 `training-worker.ts`

- lease `training` task。
- 从 job report 解析 jobRoot、dataset trainDir、training config artifact、outputDir、cancel signal path。
- 需要外部环境变量 `CHARACTER_LORA_TRAINING_COMMAND`；非 dry-run 时由该命令执行真实 trainer。
- 支持 dry-run + mock-complete，生成 mock safetensors/checkpoint。
- 运行中持续从 log 解析 progress/loss/step，heartbeat 到 Manager。
- 完成后扫描 outputDir 的 safetensors，确定 final/checkpoints/log/hash/metadata summary，调用 training complete API。
- 如果有 cancel signal，会拒绝注册成功并标记失败/取消。

### 6.4 `benchmark-worker.ts`

- lease `benchmark` task。
- 从 benchmark run 取临时 Manager project/test preset、checkpoint matrix、weight matrix。
- 调用普通 Manager `runProject`，等待 project runs 完成，汇总每个 run/section 的状态。
- 生成 resultSummary 和 diagnosticSuggestions，完成 benchmark run。
- promotion 仍是人类 gate：benchmark done + lora asset + evidence 后，创建 decision，再 promote 到最终 preset。

### 6.5 `worker-common.ts`

- 统一 manager client、token/env 读取、task lease/heartbeat/complete/fail、project run 访问、artifact path 工具。
- 当前 Manager 不负责 worker 守护进程生命周期；worker 必须由命令行/外部服务启动。
- `worker-queue.ts` 提供常驻队列 supervisor，一次性拉起 image/dataset/training/benchmark 四类 poll worker，并在子 worker 退出时自动重启，避免任务已经入队但没有进程领取。
- `GET /api/character-lora-training/worker/status` 提供全局队列状态：总计数、每类 worker 的 queued/running/failed/cancelled/done、最近 heartbeat、未 lease 的 queued 数和过期 running lease 数。

## 7. 现有端到端流程

当前真实流程可以描述为：

1. 创建 LoRA training job：角色名、trigger、base checkpoint、training scope、初始参考图。
2. 上传/管理 source images。
3. canonical 阶段：生成或手动注册标准图，选择 current canonical version。
4. Prompt Card 阶段：基于 canonical 维护 identity/outfit/negative traits 和最终 prompt draft。
5. Section 阶段：从 section templates 实例化 job sections，并按 section 生成候选图；rerun 不覆盖旧 run，可挂 parentRunId。
6. Review 阶段：人工 keep/reject/excluded/pending，编辑 caption。
7. Freeze 阶段：把 kept candidates 冻结成 immutable dataset revision。
8. Training 阶段：选择 dataset revision，生成 resolved config/TOML，创建 training run + worker task + GPU lock。
9. Training worker 阶段：真实 trainer 产出 safetensors/log/checkpoints；服务端登记 final artifact/hash。
10. Benchmark 阶段：注册/copy LoRA asset，创建临时 Manager preset/project，按 checkpoint/weight matrix 运行测试。
11. Promotion 阶段：人工审核 benchmark evidence，approved 后 promote 到最终角色 preset；rejected 可回到建议 return point。
12. Report/Diagnostics：保存 markdown/json 报告，给出风险和下一步入口。

## 8. `project/template/section/run` 到 LoRA 训练的映射

### 8.1 Project

普通 Manager：一个最终图片生成项目，包含 sections 和 runs，目标是产出可发布图片。

LoRA 领域：一个 `CharacterLoraTrainingJob`，建议在 UI 文案中称为 `LoRA Project` 或 `Training Project`。目标不是直接产出最终图片，而是产出“可训练 dataset + safetensors + benchmark evidence + 可发布 preset”。

边界建议：一个 LoRA Project 只覆盖一个角色的一个主要服装/形态/皮肤，不混多套官方服装；不同形态应该新建 project，最终 preset 也分开。

### 8.2 Template

普通 Manager：`ProjectTemplate` 决定项目默认 sections、prompt block、workflow/run 配置。

LoRA 领域：建议引入顶层 `LoRA Training Template / Recipe`。它应包含：

- 默认 source 要求和 canonical 规则。
- 默认 Prompt Card schema/placeholder。
- 一组 section templates：front、side、back、detail、expression/action 等。
- 默认 caption strategy。
- 默认 training profile：resolution、rank/alpha、steps、LR、train text encoder、precision、trainer launcher。
- 默认 benchmark matrix：checkpoint matrix、LoRA weight matrix、七段 benchmark template。
- 默认 promotion variant drafts。

当前现状：只有 `CharacterLoraSectionTemplate`，没有顶层 recipe。需要补一个顶层模型或至少补一个 template snapshot JSON。

### 8.3 Section

普通 Manager：`ProjectSection` 是一个 prompt/workflow 片段，运行后生成该 section 的最终图片候选。

LoRA 领域：`CharacterLoraJobSection` 是训练数据覆盖目标，建议称为 `Coverage Section` 或 `Dataset Section`。每个 section 的目标是收集足够的 keep images，而不是产出最终图片。

每个 section 应继续保留：绑定 canonical version、prompt card version、target candidate count、target keep count、status、keep/reject/pending counters、sort order、暂停/恢复。

### 8.4 Run

普通 Manager：`Run` 是一次 ComfyUI/project section 执行。

LoRA 领域有三类 run，应避免混淆：

- `Generation Run`：canonical/section 的图像生成尝试，已有 `CharacterLoraGenerationRun`。这是最接近普通 `Run` 的部分。
- `Training Run`：trainer 执行，已有 `CharacterLoraTrainingRun`。
- `Benchmark Run`：训练后测试，已有 `CharacterLoraBenchmarkRun`，内部会创建普通 Manager project runs。

交互上建议把 `Run` 作为统一概念展示，但加 type/lane：`Generate`、`Train`、`Benchmark`。Section 下面只展示 generation runs；job 级 timeline 展示 generation/training/benchmark/promotion 全部事件。

### 8.5 Output / Review / Dataset

普通 Manager：run outputs 通常是用户要看的最终图。

LoRA 领域：run outputs 是 `CandidateImage`，必须经过 review/caption 才能进入 `DatasetRevision`。因此 LoRA 的 `Dataset Revision` 是普通 Manager 没有的关键中间层，应作为 Project 与 Training Run 之间的明确 gate。

## 9. 改造需求与范围

### P0：术语与导航重构

目标：让用户不用理解当前内部模型，也能按 Manager 熟悉的 `project/template/section/run` 流程操作。

需求：

1. 列表页把 `任务` 文案逐步调整为 `LoRA Projects / Training Projects`。
2. Job workbench 顶部增加固定阶段导航：Project Overview、Sources、Canonical、Prompt Card、Sections、Review Dataset、Train、Benchmark、Promote、Report。
3. 每个阶段显示“当前 gate 是否满足”和“下一步按钮”，减少超长页面中的迷失。
4. 在 Section 区把 section 行展开为：section metadata、latest run、run history、candidate review summary。
5. 在 Training/Benchmark 区把 run 明确标为 `Training Run` / `Benchmark Run`，避免和 section generation run 混淆。

### P0：顶层 LoRA Template / Recipe

目标：补齐普通 Manager `ProjectTemplate` 在 LoRA 域的等价物。

推荐模型：

- `CharacterLoraTrainingTemplate`
  - `id`
  - `key` unique
  - `name`
  - `description`
  - `baseFamily`
  - `captionStrategyDefault`
  - `canonicalDefaults` JSON
  - `promptCardDefaults` JSON
  - `trainingDefaults` JSON
  - `benchmarkDefaults` JSON
  - `promotionDefaults` JSON
  - `isActive`
  - `sortOrder`
  - timestamps

Section template 归属可二选一：

- 简单方案：给 `CharacterLoraSectionTemplate` 加 `trainingTemplateId`，一个 section template 只属于一个 recipe。
- 复用方案：新增 join 表 `CharacterLoraTrainingTemplateSection`，允许同一 section template 被多个 recipe 复用，并在 join 表保存 sort/order/default overrides。

Job 应保存 template lineage：

- `trainingTemplateId`：源 template。
- `trainingTemplateSnapshot` JSON：创建 job 时的 template 快照，保证 template 后续修改不影响旧 job。

### P0：从 Template 创建 Project

需求：

1. 创建 job 时先选 `LoRA Template / Recipe`。
2. 选中 template 后自动带出 section set、caption strategy、default training profile、benchmark matrix。
3. 仍允许手动覆盖 base checkpoint、trigger、source roles、target counts、训练强度等。
4. Job 创建后应立即显示哪些 sections 已实例化，哪些 gate 尚未满足。

兼容策略：

- 初期可以把当前 active `CharacterLoraSectionTemplate` 打包成一个默认 recipe：`character_identity_default`。
- 旧 job 没有 `trainingTemplateId` 时，report 显示 `Legacy / no template`，功能保持可用。

### P0：Section Run 体验

当前已有 `parentRunId`、`userInstruction`、source reference images、pause/resume、promote correction to prompt card。需要把它们产品化为明确的 rerun 工作流：

1. 每个 section 有 `Run again` 按钮，打开轻量表单：自然语言修正、引用图、是否沿用上一 run、是否作为 parent。
2. Rerun 永远新建 generation run，不覆盖旧 run。
3. Run history 显示 provider、model、prompt/correction、input image roles、输出数量、keep/reject 结果。
4. 本地 section 修正默认只影响该 run；只有点击 `提升为全局 Prompt Card 修正` 才新建 Prompt Card version。
5. 如果 current canonical / prompt card 与 section 绑定版本不一致，section 行应显示 stale lineage badge，并提供“用当前 lineage 重新实例化/新建 run”。

### P0：Dataset Revision Gate

现有 freeze 机制已经正确，需要在 UI/需求上强化 gate：

1. 只有 keep images 才能进入 dataset revision。
2. 如果没有 current canonical 或 prompt card，禁止 freeze。
3. 如果 caption 缺失或存在 rejected/pending 不足以达到目标 keep count，应给明确 blocker/warning。
4. Freeze 后 revision 不可变；任何 review/caption 改动都只能创建新 revision。
5. Training 表单只允许选择 frozen/ready revision，默认使用最新 revision。

### P1：训练配置模板化

当前训练参数分 ordinary/advanced/expert，且服务端会解析 profile defaults。后续 recipe 应把这些参数变成模板默认值：

- Normal：target steps、rank/alpha、resolution、caption strategy、train text encoder、training strength/profile。
- Advanced：UNet LR、TE LR、batch/grad accumulation、save interval、source/synthetic weight、weight test matrix。
- Expert：optimizer、scheduler、cache latents、cache text encoder、clip skip、noise offset、min SNR、network args。

验收：从 recipe 创建 job 后，不填高级参数也能得到完整 resolved config；覆盖参数只影响当前 training run，不修改 recipe。

### P1：Worker 可观测性与启动状态

当前 worker 外部运行，Manager 只管理任务和状态。需要：

1. Workbench 展示每类 worker 的最近 heartbeat/task 状态。
2. Report 中列出 queued/running/failed tasks 和 lease owner。
3. 对 training worker 明确显示：是否配置 `CHARACTER_LORA_TRAINING_COMMAND`、当前 dry-run/mock/real mode、输出目录、log artifact。
4. 提供 `worker-queue.ts` 常驻 supervisor 和 `npm run character-lora:workers` / `npm run character-lora:workers:mock`，但不要求 Next.js 自动启动 worker。
5. 提供 `worker/status` API；如果队列中有 queued task 且没有 running/heartbeat，Workbench 需要明确显示应启动 queue supervisor，而不是让用户误以为任务已经在执行。

### P1：Benchmark/Promotion 与普通 Manager Project 的桥接说明

当前 benchmark 已经创建临时 preset/project 并复用普通 Manager project run。需求上要明确：

1. Benchmark 是 LoRA Project 的验证 run，但执行载体是普通 Manager test project。
2. `BenchmarkRun.testProjectId/testPresetId` 是临时资源，review/promotion 后可以 cleanup。
3. Promotion 必须是人工 gate；不自动发布。
4. rejected decision 需要返回点：canonical、prompt card、section generation、dataset revision、training config、weight selection 等。

### P2：报告与审计

1. 每个 job report 输出当前 pointers、lineage、artifact root、dataset/train/benchmark/promotion summary。
2. 每次 promotion 输出 promotion-report artifact，记录 selected checkpoint、weight、variant prompts、LoRA asset、decision reason。
3. Provider request 必须保存 redacted artifact；不得落明文 token/key。
4. Artifact paths 优先相对 jobRoot 展示；绝对路径只在调试区显示。

## 10. 非目标 / 保持约束

- 不支持一个 job 混多个官方服装/形态/皮肤；不同形态新建 project 和最终 preset。
- 不自动发布 LoRA；必须有 benchmark evidence 和人工 promotion decision。
- 不把 provider/API token 写入 report 或 artifact；只允许 redacted request/summary。
- 不要求 Manager 第一版自动管理 worker 进程生命周期；外部常驻 worker queue supervisor + UI 状态足够。
- 不在 Dataset Revision 上做可变编辑；修改必须新建 revision。

## 11. 建议的实施切片

1. `terminology-nav`：只改 UI 文案和 job workbench 导航，不改 DB。
2. `training-template-model`：新增顶层 LoRA Training Template/Recipe 模型和迁移脚本，创建默认 recipe。
3. `create-from-template`：创建 job 时选择 recipe，自动实例化 sections，保存 template snapshot。
4. `section-run-history`：把 section 的 generation runs 做成可展开 history/rerun 面板。
5. `worker-observability`：workbench/report 展示 worker/task/heartbeat 状态，提供 `worker/status` API 和常驻 worker queue supervisor。
6. `benchmark-bridge-copy`：把 Benchmark 与普通 Manager project/preset 的关系在 UI/report 中解释清楚，并强化 cleanup/promotion gate。

## 12. 验收标准

- 用户可以从一个默认 LoRA recipe 创建新的 training project，并自动获得默认 sections。
- 用户可以理解每个 section 对应哪个训练数据目标，并对单个 section 进行 run/rerun/review。
- 每张候选图都能追溯到 generation run、section、canonical version、prompt card version、provider request artifact。
- Freeze dataset 后 revision 不会被后续 review/caption 修改污染。
- Training run 能显示 resolved config、log、progress、final safetensors/hash/checkpoints。
- Training 完成后可自动或手动创建 benchmark run；benchmark run 能关联临时 Manager project/preset。
- Promotion 必须有 done benchmark、LoRA asset、selected checkpoint、weight、variant prompts 和人工 approved decision。
- 旧 job 在没有顶层 recipe 的情况下仍可打开、训练、benchmark 和 promotion。
