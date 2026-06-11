# Manager LoRA Training Frontend Alignment

日期：2026-06-08
状态：前端原型对齐活文档。后续对话中每确认一项，就更新本文。

## 1. 文档用途

本文用于沉淀 LoRA Training v2 前端原型的已确认约束、待确认路由、页面复用方向和实现边界，避免只依赖聊天上下文。

后续确认方式：

- 不再一次性推进多个待确认项。
- 按路由逐个确认页面的具体设计。
- 每个路由页面需要先确认：页面目标、使用场景、信息架构、主要组件、主操作、跳转关系、空/错误/加载状态。
- 单个路由页面确认完成后，再更新本文。
- 未确认的页面只保留草案，不进入实现计划。

权威上游：

- `docs/plans/2026-06-07-manager-lora-training-docs-index.md`
- `docs/plans/2026-06-07-manager-lora-training-final-technical-design.md`
- `docs/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md`

历史参考：

- 旧 `CharacterLoraTraining*` 文档只可参考 artifact 安全、worker 组织等局部经验。
- 新前端不得继承旧 `CharacterLoraTraining*` 命名、`/character-lora-training/**` 路由、benchmark/promotion 闭环或旧页面结构。

## 2. 已确认约束

### 2.1 全局 work mode

确认状态：已确认。后续不再把全局导航与模式切换作为待确认项反复确认。

- 新增全局工作模式：`generation` 和 `lora_training`。
- 默认工作模式为 `generation`。
- 工作模式持久化在浏览器 `localStorage`，key 为 `comfyui-manager:work-mode`。
- 如果持久化值缺失或非法，回退到 `generation`。
- 工作模式是资源空间上下文，不是第二套导航。
- 工作模式切换入口放在设置页。
- 切换工作模式后不自动跳转。
- 切换工作模式后不重绘导航结构，只影响资源入口的目标路由。
- 底部导航需要显示一个轻量状态图标，提示当前处于生图模式还是 LoRA 训练模式。
- mode 状态图标固定放在底部导航最右边；它不是第七个导航入口，只负责提示当前 mode。
- 生图模式显示图片/生图语义图标，LoRA 训练模式显示训练/烧瓶语义图标。
- mode 状态图标不负责切换 mode；切换仍只在设置页进行。
- mode 状态图标需要 `title` / `aria-label`，例如“当前模式：LoRA 训练”。

### 2.2 底部导航

确认状态：已确认。底部导航资源项、mode 路由解析原则、共享模型/设置入口均已确认。

底部导航统一为 6 个跨模式资源入口：

```text
运行 / 项目 / 预制 / 模板 / 模型 / 设置
```

已确认：

- 原底部导航的独立 `LoRA训练` 入口删除。
- 原 `待审核` 入口统一改名为 `运行`。
- 导航项本身不随 mode 改名。
- 点击 `运行`、`项目`、`预制`、`模板` 时，按当前 mode 进入对应资源路由。
- `模型` 在两个 mode 下保持共享。
- `设置` 是全局设置页，两个 mode 下保持共享。

路由解析草案：

```text
generation:
  运行 -> /queue
  项目 -> /projects
  预制 -> /assets/presets
  模板 -> /assets/templates
  模型 -> /assets/models
  设置 -> /settings

lora_training:
  运行 -> /training/runs
  项目 -> /training/projects
  预制 -> /training/presets
  模板 -> /training/templates
  模型 -> /assets/models
  设置 -> /settings
```

### 2.3 旧前端删除

已确认：

- 旧 `/character-lora-training/**` 前端全量删除。
- 不保留旧前端 debug 入口。
- 不做旧路由重定向。
- 后续不再需要旧前端入口。

前端清理范围草案：

- 删除 `src/app/character-lora-training/**`。
- 从底部导航删除 `LoRA训练` 项。
- 从 route fallback/page pattern 中移除 `/character-lora-training/**`。
- 清理旧前端对 `@/lib/actions/character-lora-training` 的引用。
- 清理旧 task panel 中面向 character-lora job 的 UI 入口；未来按 `TrainingGenerationTask` 重新接入。

是否同步删除旧 API/service/worker 尚未确认；当前只确认旧前端不再作为入口或主路径存在。

### 2.4 原型制作原则

确认状态：已确认。后续所有 LoRA Training v2 前端原型都按本节检查。

原型目标：

- 原型用于逐页确认信息架构、字段来源、主操作、跳转关系和状态处理，不直接代表最终组件拆分。
- 每次只推进一个页面或一组强相关状态；未确认的页面只保留草案，不进入实现计划。
- 原型必须优先复用现有生图模块的导航、页面密度、暗色 token、字号、卡片、lightbox、tab 和列表交互模式。
- 不从旧 `/character-lora-training/**` 页面继承视觉、路由、命名或 benchmark/promotion 闭环。

数据原则：

- 原型里每一项假数据都必须能映射到主设计里的实体字段、关系、计数或字段计算值。
- 找不到字段来源的数据不得进入主 UI；只能记录为“待补设计”或“待确认”。
- 不展示当前 Training v2 没有稳定来源的资源信息，例如 GPU 型号、VRAM、训练缓存、跨 tab 聚合负载。
- 不为了画面丰满伪造结果；`running` / `queued` / `failed` 状态的结果或产物区域应为空。
- 生成任务按已确认规则处理：一个 `TrainingGenerationTask` 只产出一张图片或一段文本。

交互原则：

- 列表卡片本身负责跳转；不额外放 `进入详情` / `查看结果` / `查看文本` 这类重复导航按钮。
- 当前筛选 tab 已表达的信息，不在卡片或列表区域重复展示。
- 图片结果、数据集样本等视觉资产默认使用缩略图；点击后按生图模块审核图方式打开大图预览。
- caption / prompt 等长文本默认收起或截断展示；需要完整阅读时在详情、展开区或预览层展示。
- 详情页只展示当前任务执行所需的最终输入和最终输出，不做 provenance 追踪视图，除非后续单独确认调试/历史模式。
- 顶部只放与当前对象直接相关的跳转按钮；不把跳转入口做成解释性正文卡片。

文档原则：

- 每完成或调整一个页面原型，需要同步更新本文的页面设计、字段映射和待确认项。
- 若用户在浏览器注释或对话中确认了规则，应从“待确认”移入“已确认”，避免反复讨论。

2026-06-11 统一视觉重写补充：

- 原型必须统一走 `docs/prototypes/assets/lora-training-shared.css` 和 `docs/prototypes/assets/lora-training-shared.js`，只有页面特有布局允许少量局部 CSS。
- 共享资源引用需要带版本号，避免浏览器继续使用旧导航或旧 lightbox 脚本缓存。
- 列表跳转项使用真实 `<a href>`；不再使用 `data-href` 加脚本模拟卡片跳转。
- 不使用 `href="#"` 作为占位链接；尚未有真实页面时必须补占位原型或移除跳转。
- 带操作按钮的任务卡拆成“内容链接 + 独立操作按钮”，禁止把按钮放进链接里。
- 底部导航模型入口指向共享模型页原型；mode 图标只显示当前模式，不承担切换。
- 状态视觉优先使用低权重 `status-note` / `state-line`；只有过滤 tab 和计数 badge 使用较强视觉。
- 项目列表和项目总览中的资料、小节、结果池摘要改为紧凑横向信息，不再占满多行卡片。
- 项目总览正文只保留角色资料、最近任务、训练入口和最近产物；小节、结果池、数据集由 tab 页面负责。
- 小节列表不展示确定进度条；`TrainingSectionRun` / `TrainingGenerationTask` 当前只有状态和时间字段，没有 `currentStep` / `totalSteps`，只能展示最近生成状态。确定进度条只用于 `TrainingRun`。
- 小节列表参考生图模块的 section cards：页面有小节导航 rail，卡片主体跳小节详情，最近结果使用固定 4 格缩略槽，运行/排序是独立操作按钮；不使用独立指标块、大状态胶囊或列表级进度条。空间足够时卡片保持双列，窄屏再退为单列。
- 小节详情页的场景块必须提供导入预制、添加本地块、编辑、排序和删除入口，分别对应 `TrainingSceneDescriptionBlock.sceneDescriptionPresetId`、`localText`、`sortOrder` 和块删除；结果区使用结果池同款多列小缩略图，点击缩略图打开 lightbox，不在详情正文直接铺开大图。
- 结果池参考生图审核/结果网格的密度：项目级结果以多列小缩略图卡展示，点击图片打开 lightbox；移动端也不退化为单列大图。
- 数据集页 readiness 摘要压入当前草稿标题行或训练准备区，不单独使用大面积 `metric-grid`；kept 草稿样本使用结果池同款多列小缩略图。
- 数据集冻结版本页也使用结果池同款小缩略图；`TrainingDatasetRevisionItem.captionSnapshot`、`snapshotArtifactId`、`filePathSnapshot` 作为只读快照展示，不用大图铺满正文。
- 运行页默认展示“生成任务 / 完成”，状态 tab 顺序固定为“完成 / 进行中 / 排队 / 失败/取消”。
- 生成详情页只展示最终输入 prompt、输入图和最终输出；不再展示来源拆解或上下文快照。
- 训练详情页必须展示训练集样本 caption，caption 默认截断，可展开；样本图片可 lightbox 放大。
- 成功训练详情页必须提供“创建预制”窄入口；仅当 `TrainingRun.finalLoraArtifactId` 存在且 `presetCreatedAt` 为空时显示，不展开 benchmark/promotion workflow。
- 模板小节的场景块管理和项目小节保持同一心智：导入预制、添加本地块、编辑、排序、删除，对应 `TrainingTemplateSectionSceneDescriptionBlock.sceneDescriptionPresetId` / `localText` / `sortOrder`。
- 所有图片元素需要 `alt`、`width`、`height`；装饰性图标需要 `aria-hidden="true"`；交互控件保留可见 focus。
- 移动端 444px 宽度下核心页面不得出现横向溢出。

### 2.5 原型页面计划

确认状态：首版全量 HTML 原型已补齐。后续按用户浏览器反馈逐页调整。

已完成 / 正在迭代：

| 页面 | 原型文件 | 状态 | 说明 |
| --- | --- | --- | --- |
| `/training/runs` | `docs/prototypes/manager-lora-training-runs-prototype.html` | 已有首版 | 运行列表，含生成任务 / 训练任务 tab 和状态筛选 |
| `/training/runs/generation/[taskId]` | `docs/prototypes/manager-lora-training-generation-detail-prototype.html` | 已有首版 | 生成任务详情，支持完成 / 进行中 / 排队 / 失败空结果态 |
| `/training/runs/training/[trainingRunId]` | `docs/prototypes/manager-lora-training-training-detail-prototype.html` | 已有首版 | 训练任务详情，支持完成 / 进行中 / 排队 / 失败空产物态 |
| `/training/projects` | `docs/prototypes/manager-lora-training-projects-prototype.html` | 已有首版 | LoRA 训练项目列表，复用现有项目列表密度；状态筛选仅区分当前 / 已归档，卡片展示资料、结果池、dataset 和最近训练摘要 |
| `/training/projects/new` | `docs/prototypes/manager-lora-training-project-new-prototype.html` | 已有首版 | 新建 LoRA 训练项目，承接模板选择、项目基础字段、初始角色资料和小节 |
| `/training/projects/[trainingProjectId]` | `docs/prototypes/manager-lora-training-project-detail-prototype.html` | 已有首版 | 项目总览，保留关键指标、角色资料卡、最近任务和启动训练入口；小节、结果池、数据集通过 tab 进入 |
| `/training/projects/[trainingProjectId]/profile` | `docs/prototypes/manager-lora-training-project-profile-prototype.html` | 已有首版 | 角色资料页，合并角色文本与 original/generated/auxiliary reference images；不展示字段状态侧栏 |
| `/training/projects/[trainingProjectId]/sections` | `docs/prototypes/manager-lora-training-project-sections-prototype.html` | 已有首版 | 小节列表，参考生图 section rail + section cards，固定结果缩略槽和独立运行/排序操作 |
| `/training/projects/[trainingProjectId]/sections/[sectionId]` | `docs/prototypes/manager-lora-training-project-section-detail-prototype.html` | 已有首版 | 小节详情，scene blocks、resolved preview、生成入口和小节结果小缩略图同页展示 |
| `/training/projects/[trainingProjectId]/results` | `docs/prototypes/manager-lora-training-project-results-prototype.html` | 已有首版 | 项目级结果池，多列小缩略图，pending/kept/rejected、caption 缩略和 lightbox |
| `/training/projects/[trainingProjectId]/dataset` | `docs/prototypes/manager-lora-training-project-dataset-prototype.html` | 已有首版 | 数据集 readiness 压入标题摘要，kept 草稿小缩略图、freeze、revision 列表和启动训练主入口 |
| `/training/projects/[trainingProjectId]/dataset/revisions/[revisionId]` | `docs/prototypes/manager-lora-training-project-dataset-revision-prototype.html` | 已有首版 | 冻结版本详情，snapshot 样本、captionSnapshot、manifest、关联 TrainingRun |
| `/training/projects/[trainingProjectId]/training-runs` | `docs/prototypes/manager-lora-training-project-training-runs-prototype.html` | 已有首版 | 项目内 scoped training run list；详情仍跳全局 training run detail |
| `/training/projects/[trainingProjectId]/generation-tasks` | `docs/prototypes/manager-lora-training-project-generation-tasks-prototype.html` | 已有首版 | 项目内 scoped generation task list；详情仍跳全局 generation task detail |
| `/training/presets` | `docs/prototypes/manager-lora-training-presets-prototype.html` | 已有首版 | 训练场景预制列表 / 分类 / 文件夹 |
| `/training/presets/[presetId]` | `docs/prototypes/manager-lora-training-preset-detail-prototype.html` | 已有首版 | 训练场景预制详情 / 编辑 / usage |
| `/training/presets/sort-rules` | `docs/prototypes/manager-lora-training-preset-sort-rules-prototype.html` | 已有首版 | 训练场景预制分类和 preset sortOrder 管理 |
| `/training/templates` | `docs/prototypes/manager-lora-training-templates-prototype.html` | 已有首版 | 训练模板列表 |
| `/training/templates/new` | `docs/prototypes/manager-lora-training-template-new-prototype.html` | 已有首版 | 新建训练模板 |
| `/training/templates/[templateId]/edit` | `docs/prototypes/manager-lora-training-template-edit-prototype.html` | 已有首版 | 模板编辑，project-level guidance、section settings、preset/local blocks |
| `/training/templates/[templateId]/sections/[sectionIndex]` | `docs/prototypes/manager-lora-training-template-section-prototype.html` | 已有首版 | 模板小节编辑；后续仍可确认是否并入 edit 页面 |
| `/settings` work mode 切换 | `docs/prototypes/manager-lora-training-settings-mode-prototype.html` | 已有首版 | 设置页工作模式切换；切换不跳转，导航文案不变 |

可并入现有页面或待确认：

| 页面 / 能力 | 当前规划 |
| --- | --- |
| `/settings` work mode 切换 | 需要确认是否单独做原型；目前只确认切换入口在设置页 |
| `/training/projects/[trainingProjectId]/edit` | 已确认并入项目总览 / profile 表单，不单独做页面 |
| `/training/projects/[trainingProjectId]/training-runs` | 项目内 scoped list，可复用 `/training/runs` 列表并过滤项目；详情仍跳全局 `/training/runs/training/[trainingRunId]` |
| `/training/projects/[trainingProjectId]/generation-tasks` | 项目内 scoped list，可复用 `/training/runs` 的生成任务列表；详情仍跳全局 `/training/runs/generation/[taskId]` |
| `TrainingTextRevision` UI | 不规划独立页面；如需要展示，做成具体文本字段旁的历史/恢复抽屉 |

### 2.6 全量首版原型字段来源

首版原型中所有假数据必须落到下列表、字段、关系或前端计算值；若后续某个页面需要展示这里没有来源的信息，先补设计文档再进入 UI。

通用：

| 原型展示 | 来源 |
| --- | --- |
| 底部导航 `运行 / 项目 / 预制 / 模板 / 模型 / 设置` | 前端 shell 固定导航；按 `workMode` 解析资源路由 |
| 右侧 mode 图标 `LoRA 训练` | `workMode = lora_training` |
| 设置页 mode switch | 前端持久化 key `comfyui-manager:work-mode` |
| `active / archived` | `TrainingProject.status`；`active` 的前端展示名暂定为 `当前`，后续可改名 |
| `queued / running / succeeded / failed / cancelled` | `TrainingGenerationTask.status` 或 `TrainingRun.status` |
| `updatedAt / createdAt / startedAt / finishedAt / archivedAt / frozenAt` 时间文案 | 对应实体时间字段，前端格式化 |
| `gpt-image-2`、`Qwen2.5-VL` | `TrainingGenerationTask.model` |
| `1024x1536`、`quality high` | `TrainingGenerationTask.paramsJson` 或 `TrainingSectionRun.generationParamsJson` |
| 点击卡片跳转 | 对应实体 `id` 拼接当前确认的 route |

项目与角色资料：

| 原型展示 | 来源 |
| --- | --- |
| 项目基础字段 `name / slug` | `TrainingProject.name` / `TrainingProject.slug` |
| `imagePromptGuidance / imagePromptFormat / captioningGuidance / trainingCaptionFormat` | `TrainingProject` 同名字段；模板导入时复制 |
| `trainingDefaultsJson` 摘要 | `TrainingProject.trainingDefaultsJson` |
| `资料 完整 / 待补` | `TrainingCharacterProfile` 是否存在，且 `loraUsagePrompt`、`characterDetailPrompt`、必要参考图满足 readiness 规则 |
| `loraUsagePrompt` | `TrainingCharacterProfile.loraUsagePrompt` |
| `characterDetailPrompt` | `TrainingCharacterProfile.characterDetailPrompt` |
| 参考图类型 `original / generated / auxiliary` | `TrainingCharacterImage.imageType` |
| 参考图 label / note | `TrainingCharacterImage.label` / `TrainingCharacterImage.note` |
| 参考图缩略图 / lightbox | `TrainingCharacterImage.artifactId -> TrainingArtifact.filePath/storageKey` |
| 生成资料 / 生成参考图入口 | 创建 `TrainingGenerationTask`，成功后通过 output apply 到 profile 字段或 `TrainingCharacterImage` |

小节、结果池和生成任务：

| 原型展示 | 来源 |
| --- | --- |
| 小节名、启用、排序 | `TrainingSection.name` / `enabled` / `sortOrder` |
| 点击小节卡片主体 | `TrainingSection.id`，跳 `/training/projects/[trainingProjectId]/sections/[sectionId]` |
| 小节数量 | `count(TrainingSection where trainingProjectId = project.id)` |
| scene block 顺序 | `TrainingSceneDescriptionBlock.sortOrder` |
| scene block 来源 `preset / local` | `TrainingSceneDescriptionBlock.sourceType` |
| preset block 文案 | `TrainingSceneDescriptionBlock.sceneDescriptionPresetId -> TrainingSceneDescriptionPreset.sceneDescriptionText` |
| local block 文案 | `TrainingSceneDescriptionBlock.localText` |
| resolved sceneDescription | `GET /api/training/sections/:sectionId/scene-description` 返回 `{ text, blocks }` |
| `生成训练图` | `POST /api/training/sections/:sectionId/runs`，创建 `TrainingSectionRun` 和 `TrainingGenerationTask` |
| `run #12` | `TrainingSectionRun.runIndex` |
| 小节生成中状态 | `TrainingSectionRun.status` 或关联 `TrainingGenerationTask.status`；不展示百分比进度 |
| 小节 run 最终 prompt | `TrainingSectionRun.imagePromptText` |
| 小节 run scene snapshot | `TrainingSectionRun.sceneDescriptionText` |
| 结果池图片 | `TrainingImageResult.artifactId -> TrainingArtifact` |
| 结果池缩略图 | `TrainingImageResult.thumbnailArtifactId -> TrainingArtifact` |
| `pending / kept / rejected` | `TrainingImageResult.reviewStatus` |
| 结果池数量 | `count(TrainingImageResult where trainingProjectId = project.id and reviewStatus = status)` |
| caption 缩略 / 展开 | `TrainingImageResult.trainingCaption` |
| 拒绝原因 | `TrainingImageResult.removeReason` |
| `保留 / 拒绝` | `POST /api/training/image-results/:imageResultId/review` 更新 `reviewStatus` |
| scoped generation task list | `GET /api/training/projects/:projectId/generation-tasks` |
| 生成任务详情跳转 | `TrainingGenerationTask.id -> /training/runs/generation/[taskId]` |

数据集与训练：

| 原型展示 | 来源 |
| --- | --- |
| readiness `kept / 缺 caption / active run` | `GET /api/training/projects/:projectId/dataset-readiness` |
| `dataset v5` | `TrainingDatasetRevision.version` |
| dataset `ready / freezing / failed` | `TrainingDatasetRevision.status` |
| dataset item count | `TrainingDatasetRevision.itemCount` |
| manifest 文件名 | `TrainingDatasetRevision.manifestArtifactId -> TrainingArtifact.filePath/storageKey` |
| 冻结样本缩略图 | `TrainingDatasetRevisionItem.snapshotArtifactId -> TrainingArtifact` |
| 冻结样本 caption | `TrainingDatasetRevisionItem.captionSnapshot` |
| 冻结样本排序 | `TrainingDatasetRevisionItem.sortOrder` |
| `Freeze` | `POST /api/training/projects/:projectId/dataset-revisions` |
| `启动训练` | `POST /api/training/projects/:projectId/training-runs` |
| 训练配置 base、steps、resolution、runner | `TrainingRun.configArtifactId -> TrainingArtifact` 解析摘要，或 `TrainingRun.runSummaryJson` 中配置摘要 |
| scoped training run list | `GET /api/training/projects/:projectId/training-runs` |
| `step 1280 / 2400` | `TrainingRun.currentStep` / `TrainingRun.totalSteps` |
| `等待 GPU / 调度暂停` | `TrainingRun.waitReason = gpu_busy / scheduler_paused` |
| final LoRA 文件名 | `TrainingRun.finalLoraArtifactId -> TrainingArtifact.filePath/storageKey` |
| 训练任务详情跳转 | `TrainingRun.id -> /training/runs/training/[trainingRunId]` |

预制与模板：

| 原型展示 | 来源 |
| --- | --- |
| 预制分类 `name / slug / icon / color` | `TrainingSceneDescriptionPresetCategory` 同名字段 |
| 分类顺序 | `TrainingSceneDescriptionPresetCategory.sortOrder` |
| scene 拼接顺序 | `TrainingSceneDescriptionPresetCategory.sceneDescriptionOrder` |
| 文件夹树 | `TrainingSceneDescriptionPresetFolder.parentId` / `sortOrder` |
| 预制 `name / slug / sceneDescriptionText / notes` | `TrainingSceneDescriptionPreset` 同名字段 |
| 预制启用状态 | `TrainingSceneDescriptionPreset.isActive` |
| 预制排序 | `TrainingSceneDescriptionPreset.sortOrder` |
| 预制 usage | `TrainingSceneDescriptionPreset.projectBlocks` / `templateBlocks` 计数与引用列表 |
| 删除预制 | `DELETE /api/training/scene-description/presets/:presetId/cascade`，软删除后 `isActive = false` |
| 模板 `name / slug / description / isActive / sortOrder` | `TrainingTemplate` 同名字段 |
| 模板 guidance | `TrainingTemplate.imagePromptGuidance` / `imagePromptFormat` / `captioningGuidance` / `trainingCaptionFormat` |
| 模板训练默认值 | `TrainingTemplate.trainingDefaultsJson` |
| 模板小节 | `TrainingTemplateSection.name` / `enabled` / `sortOrder` / `sectionDefaultsJson` |
| 模板小节 block | `TrainingTemplateSectionSceneDescriptionBlock.sourceType` / `sceneDescriptionPresetId` / `localText` / `sortOrder` |
| 从模板创建项目 | `POST /api/training/templates/:templateId/projects` |
| 项目保存为模板 | `POST /api/training/projects/:projectId/save-as-template` |

## 3. 待逐项确认的前端路由树

下面是基于文档和对话整理出的完整路由草案。需要后续逐项确认。

### 3.1 顶层入口

```text
/training/runs
/training/projects
/training/presets
/training/templates
```

共享入口：

```text
/assets/models
/settings
```

不应存在：

```text
/character-lora-training/**
/projects/[projectId]/training
/training/benchmark*
/training/promotion*
/training/evaluation*
/training/agent-tasks*
```

### 3.2 运行路由

确认状态：运行列表页已阶段性确认；运行模块仍需继续确认详情页。run 详情使用全局运行空间路由，不嵌在项目下；项目/小节结果页仍嵌在项目路径下。

生图模块参考：

```text
/queue
/queue/[runId]
/projects/[projectId]/results
/projects/[projectId]/sections/[sectionId]/results
```

Training 路由草案：

```text
/training/runs
/training/runs/generation/[taskId]
/training/runs/training/[trainingRunId]
```

说明：

- `TrainingGenerationTask` 是图片/文本生成任务的 canonical 运行详情。
- `TrainingSectionRun` 不是独立的全局详情路由；它是某些训练集图片生成任务的 section 上下文，通过 `TrainingSectionRun.generationTaskId -> TrainingGenerationTask.id` 关联。
- `TrainingRun` 是真正 LoRA 训练执行。
- 运行页只把 `TrainingGenerationTask` 和 `TrainingRun` 当作两类可点击任务。
- 项目内 run 列表和 section run 列表只作为 scoped views，不拥有 run detail canonical route。

#### `/training/runs` 页面设计

确认状态：首版列表页结构已阶段性确认，已做独立 HTML 高保真原型；运行模块仍需继续细化详情页。

原型文件：

```text
docs/prototypes/manager-lora-training-runs-prototype.html
```

已确认：

- 页面标题只显示“运行”，不加副标题或解释性文案。
- 顶部任务类型使用两个 tab：`训练任务` / `生成任务`。
- 页面默认展示 `生成任务`。
- 默认展示的 `生成任务` 放在任务类型 tab 左侧。
- 顶部不展示刷新按钮或时间范围筛选；任务类型 tab 下方直接进入状态 tab。
- `/training/runs` 不展示跨 tab 聚合计数。
- 状态 tab 顺序为：`完成` / `进行中` / `排队` / `失败 / 已取消`。
- 页面默认状态 tab 为 `完成`。
- `完成` / `进行中` / `排队` / `失败 / 已取消` 的数量只跟随当前任务类型 tab：`生成任务` tab 查 `TrainingGenerationTask`，`训练任务` tab 查 `TrainingRun`。
- 状态数量只放在状态 tab badge 中，不再放页面顶部共享概览，也不在当前状态列表区域重复展示标题或计数。
- 不使用“需要处理”直接聚合 `failed + cancelled`；取消通常不代表需要处理。若要突出异常，默认使用 `失败` 或 `异常`。
- `可用 GPU`、`VRAM`、`训练缓存` 当前没有稳定的新 Training v2 前端数据来源；除非后续实现 `/api/training/scheduler/status` 或明确资源探测接口，否则不在首版 `/training/runs` 顶部概览展示。
- 旧 `/api/character-lora-training/gpu-task-lock` 只代表旧 character-lora 链路的 GPU task lock，不作为新 LoRA Training v2 的资源来源。
- 页面视觉和布局密度参考现有生图模块 `/queue`：紧凑标题、顶部 tab bar、两列任务卡片流。
- 原型样式 token 需要贴近现有前端：Geist 字体、`#09090b` 背景、`#111217/#171923` 面板、`white/10` 边框、`zinc` 文本层级、active 使用 `sky-500/12 + sky-300`，进度使用生图运行页的 amber 语义。
- 任务状态使用横向 tab/筛选切换，不把 `进行中`、`排队`、`完成`、`失败 / 已取消` 四块纵向全部铺开。
- `训练任务` 展示 `TrainingRun` 列表，不混入图片/文本生成任务。
- `生成任务` 展示 `TrainingGenerationTask` 列表，覆盖训练流程中的图片生成和文本生成任务。
- 两个任务类型 tab 内都支持按任务生命周期筛选：`进行中`、`排队`、`完成`、`失败 / 已取消`。
- `完成` 必须是独立列表，不做“今日完成”之类的摘要卡片替代。
- `排队` 是任务状态；`等待 GPU`、`等待生图队列空闲`、`调度暂停` 等只作为 queued 任务行内的 wait reason 标签展示。
- 卡片内禁止展示与当前状态 tab 重复的状态 tag，例如 `生成中`、`训练中`、`排队`、`已完成`、`失败`。
- 不提供 `进入详情`、`查看结果`、`查看文本`、打开图标等导航按钮；点击任务卡片本身进入对应详情或结果页。
- `TrainingRun` 进度属于卡片正文信息，放在项目/版本信息下方的全宽进度行；终止/删除等危险操作固定在卡片右上角操作区，不与进度共用布局容器。
- `完成`、`进行中`、`排队`、`失败 / 已取消` 下的任务卡片都能点击进入对应 canonical 详情页；非完成态详情页保留任务、输入、进度、等待或错误信息，但结果/产物区域为空。
- 完成的图片生成任务卡片展示结果缩略图，来源于对应 output artifact 或已转入结果池后的 `TrainingImageResult` thumbnail。
- 完成的文本生成任务卡片展示结果文本预览，来源于 `TrainingGenerationTaskOutput.textValue`；文本生成任务不展示图片缩略图。
- 页面可保留轻量负载侧栏，但不展示完成统计作为核心入口。
- 训练任务完成后可提供窄入口“创建预制”，但不在运行页展开完整 promotion workflow。
- 生成任务卡片统一点击进入 `/training/runs/generation/[taskId]`；如果任务关联 `TrainingSectionRun`，详情页展示所属 section、`sceneDescriptionText` 和 `imagePromptText` 等上下文。

#### `/training/runs` 原型假数据字段映射

原则：

- 原型中出现的每个假数据都必须能对应到设计文档里的实体字段、关系计数或由字段直接计算出的展示值。
- 找不到字段来源的数据不得进入原型，只能记录为“待补设计”。
- 不使用旧 `/character-lora-training/**` 实体、API 或 worker lock 作为新原型的数据来源。

页面级 UI：

| 原型展示 | 来源 |
| --- | --- |
| `LoRA 训练` mode 标识 | 前端 `workMode = lora_training`，持久化 key `comfyui-manager:work-mode` |
| `生成任务` tab | `TrainingGenerationTask` 列表视图 |
| `训练任务` tab | `TrainingRun` 列表视图 |
| 状态 tab 计数 | 当前任务类型下按 `status` 查询计数 |
| 默认选中的状态 tab `完成` | 前端默认筛选 `status = completed` |

`生成任务` tab：

| 原型展示 | 实体 / 字段 |
| --- | --- |
| 项目名，例如 `Kira Stage Suit` | `TrainingProject.name` |
| 任务类型文案，例如 `训练集图片生成`、`单图 Caption 生成`、`图片提示词生成`、`参考图生成` | `TrainingGenerationTask.taskType` |
| `图片` / `文本` chip | `TrainingGenerationTask.generationKind` |
| 当前状态列表归属，不在卡片上重复展示 | `TrainingGenerationTask.status` |
| 点击卡片进入生成任务详情 | `TrainingGenerationTask.id`，跳 `/training/runs/generation/[taskId]` |
| 所属小节，例如 `小节 舞台灯光` | 若任务有关联 `TrainingSectionRun`，通过 `TrainingSectionRun.trainingSectionId -> TrainingSection.name` 展示上下文 |
| `输入 1 张图片` | `count(TrainingGenerationInputReference)`，按 `inputKind` / `artifactId` 过滤图片输入；单任务可有多个输入引用，但只产出一个 output |
| `输出 1 张图片`、`输出 1 条 caption`、`输出 1 段描述` | 首版一个 `TrainingGenerationTask` 最多一个 `TrainingGenerationTaskOutput` |
| 完成图片生成任务卡片缩略图 | 已转入结果池时使用 `TrainingImageResult.thumbnailArtifactId -> TrainingArtifact.filePath/storageKey`；未转入结果池时使用 `TrainingGenerationTaskOutput(outputKind=image).artifactId/filePath`；原型 bitmap 只是该 artifact 的视觉占位 |
| 完成文本生成任务卡片预览，例如 `银白短发、冷调蓝眼...` | `TrainingGenerationTaskOutput(outputKind=text).textValue` 的前端截断展示 |
| `model gpt-image-2`、`model Qwen2.5-VL` | `TrainingGenerationTask.model` |
| `创建于 16:12` | `TrainingGenerationTask.createdAt` |
| `完成于 15:20` | `TrainingGenerationTask.finishedAt` |
| `已应用 14:49` | `TrainingGenerationTaskOutput.appliedAt` |
| `GPT-Image-2 返回空结果` | `TrainingGenerationTask.errorMessage` |

#### `/training/runs/generation/[taskId]` 页面设计

确认状态：已开始 HTML 高保真原型；首个原型覆盖 `image_generation + TrainingSectionRun` 上下文的完成态详情。

原型文件：

```text
docs/prototypes/manager-lora-training-generation-detail-prototype.html
```

当前设计：

- 页面标题使用 `项目名 / 任务类型`，不加副标题。
- 顶部使用紧凑页面标题，不做 hero 化大标题。
- 顶部只保留返回运行、mode 标识和必要状态/chip；mode 标识在同一行右侧，不另起大块。
- 顶部右侧需要提供与生图详情页相同语义的相关跳转：跳转小节、查看结果、项目详情；不把这些做成卡片正文里的解释性入口。
- 详情页第一屏优先展示输出结果入口，但图片任务不直接在正文铺开全尺寸输出图。
- 图片任务默认按生图模块审核界面处理：展示缩略图审核卡，点击缩略图进入 lightbox/预览层查看大图。
- 文本任务后续应展示 text output preview。
- `TrainingGenerationTask` 是 canonical 详情主体；如果有关联 `TrainingSectionRun`，只把 section run 作为上下文区展示。
- 不使用独立 metric 卡片展示项目/小节/模型/完成时间；这些信息并入“任务”字段表，避免浪费空间。
- 与生图模块一致，详情页只展示最终请求输入：最终 prompt 和最终输入图片附件；不展示这些输入分别来自角色档案、参考图、preset、补充文本等 provenance。
- `TrainingSectionRun.imagePromptText` 是本次训练集图片生成实际送给图片模型的最终 prompt；可作为 `最终输入 / Prompt` 展示。
- `TrainingSectionRun.sceneDescriptionText` 是生成 `imagePromptText` 的中间上下文，除非后续专门做调试/追溯视图，否则不在首版生成详情页展示。
- 不展示 raw JSON；`paramsJson` 如需出现，拆成 provider/model/size/quality 等字段。
- 输出图已经进入结果池时，可展示 `TrainingImageResult.reviewStatus` 并提供 `保留` / `拒绝` 操作。
- `running` / `queued` / `failed` 状态的生成任务仍进入同一个 `/training/runs/generation/[taskId]` 详情；输出区显示空结果，不伪造缩略图或文本。
- `queued` 任务通常已有最终请求输入时可展示最终 prompt / 输入附件；如果某类任务尚未渲染最终输入，详情页只展示任务字段和空输出。
- `failed` 任务详情展示 `TrainingGenerationTask.errorMessage` 对应的失败原因，输出区保持为空。

原型假数据字段映射：

| 原型展示 | 实体 / 字段 |
| --- | --- |
| `Vela Neon Jacket / 训练集图片生成` | `TrainingProject.name` + `TrainingGenerationTask.taskType` |
| `完成` | `TrainingGenerationTask.status = succeeded` |
| `图片` | `TrainingGenerationTask.generationKind = image_generation` |
| `小节 舞台灯光` | `TrainingSectionRun.trainingSectionId -> TrainingSection.name` |
| `跳转小节` | 若任务关联 `TrainingSectionRun.trainingSectionId`，跳 `/training/projects/[trainingProjectId]/sections/[trainingSectionId]` |
| `查看结果` | 若任务关联 `TrainingSectionRun.trainingSectionId`，跳 `/training/projects/[trainingProjectId]/sections/[trainingSectionId]/results` |
| `项目详情` | `TrainingGenerationTask.trainingProjectId`，跳 `/training/projects/[trainingProjectId]` |
| 缩略图审核卡 | 已转入结果池时使用 `TrainingImageResult.thumbnailArtifactId -> TrainingArtifact.filePath/storageKey`；未转入结果池时可使用 `TrainingGenerationTaskOutput(outputKind=image).artifactId` 派生缩略图；原型 bitmap 只是该 artifact 的视觉占位 |
| lightbox 大图 | `TrainingGenerationTaskOutput(outputKind=image).artifactId/filePath`；若已转结果池，也可使用 `TrainingImageResult.artifactId` |
| `结果池 · 待审核` | 已存在 `TrainingImageResult`，且 `TrainingImageResult.reviewStatus = pending` |
| `1024 x 1536` | `TrainingImageResult.width` / `TrainingImageResult.height`，或 output artifact metadata |
| `保留` / `拒绝` | 更新 `TrainingImageResult.reviewStatus = kept/rejected` |
| `最终输入 / Prompt` | 对于关联 `TrainingSectionRun` 的训练集图片生成，使用 `TrainingSectionRun.imagePromptText`；其他 generation task 使用任务渲染后的最终 prompt 文本 |
| `最终输入 / 输入图片 image 1` | `TrainingGenerationInputReference(inputKind=internal_image or supplemental_image).snapshotArtifactId/artifactId/snapshotFilePath`，只展示最终附件，不展示 source provenance |
| `gpt-image-2 · 1024x1536 · high` | `TrainingGenerationTask.model` / `paramsJson.size` / `paramsJson.quality` |
| `15:18`、`15:18 - 15:20` | `TrainingGenerationTask.createdAt` / `startedAt` / `finishedAt` |
| `15:20` | `TrainingGenerationTask.finishedAt` |
| `1 张图片 · 已进入结果池` | 一个 image output + 关联 `TrainingImageResult` 存在 |
| `尚无输出` / 空输出区 | `TrainingGenerationTask.status != succeeded`，或没有 `TrainingGenerationTaskOutput` |
| 失败原因，例如 `GPT-Image-2 返回空结果` | `TrainingGenerationTask.errorMessage` |

#### `/training/runs/training/[trainingRunId]` 页面设计

确认状态：已开始 HTML 高保真原型；首个原型覆盖 `TrainingRun.status = succeeded` 且已有 final LoRA artifact 的完成态详情。

原型文件：

```text
docs/prototypes/manager-lora-training-training-detail-prototype.html
```

当前设计：

- 页面标题使用 `项目名 / dataset vN`，不加副标题。
- 顶部提供与生图详情页同类的相关跳转：项目详情、数据集版本、模型资产；不把这些做成解释性正文卡片。
- 页面主体展示训练运行的最终状态、最终 LoRA、训练配置、训练日志、数据集样本和训练摘要。
- 不展示 benchmark、promotion、推荐权重等旧 LoRA 闭环；成功后只保留窄入口“创建预制”。
- 不展示 GPU 型号、VRAM、训练缓存等当前 `TrainingRun` 没有稳定字段来源的数据。
- 数据集样本展示 frozen revision 中的样本缩略图和 caption 摘要，不追溯这些样本来自哪个生成任务或原始上传来源。
- 数据集样本卡片以缩略图为主，caption 只做收起态短摘要，不能挤压缩略图尺寸。
- 点击数据集样本后按生图模块审核图的方式打开大图预览，并在预览层展示完整 caption。
- `running` / `queued` / `failed` 状态的训练任务仍进入同一个 `/training/runs/training/[trainingRunId]` 详情。
- 非完成态不展示 final LoRA 文件名、下载、创建预制等结果操作；产物区域显示“尚未生成 final LoRA”或“未生成 final LoRA”。
- `running` 详情展示当前 step / 进度 / runner，并可展示当前日志预览。
- `queued` 详情展示 `waitReason` / `schedulerMessage`，训练日志为空或尚未创建。
- `failed` 详情展示 `errorMessage`，没有 final LoRA 时仍保留 config/log artifact 信息。

原型假数据字段映射：

| 原型展示 | 实体 / 字段 |
| --- | --- |
| `Vela Neon Jacket / dataset v5` | `TrainingProject.name` + `TrainingDatasetRevision.version` |
| `完成` | `TrainingRun.status = succeeded` |
| `训练任务` | 当前页面 canonical 对象是 `TrainingRun` |
| `项目详情` | `TrainingRun.trainingProjectId`，跳 `/training/projects/[trainingProjectId]` |
| `数据集版本` | `TrainingRun.trainingDatasetRevisionId`，跳 `/training/projects/[trainingProjectId]/dataset/revisions/[revisionId]` |
| `模型资产` | `TrainingRun.finalLoraArtifactId`，跳对应 artifact / model asset 详情 |
| `vela_neon_v05.safetensors` | `TrainingRun.finalLoraArtifactId -> TrainingArtifact.filePath/storageKey` |
| `final LoRA` | `TrainingArtifact.storageRole` / artifact 用途由 `TrainingRun.finalLoraArtifactId` 关系确定 |
| `142 MB` | `TrainingArtifact.fileSize` |
| `完成于 16:21` | `TrainingRun.finishedAt` |
| `创建预制` | `TrainingRun.finalLoraArtifactId` 存在，且 `TrainingRun.presetCreatedAt` 为空 |
| `下载` | 下载 `TrainingRun.finalLoraArtifactId -> TrainingArtifact` 文件 |
| `训练耗时 31 分钟` | `TrainingRun.startedAt` / `TrainingRun.finishedAt` 计算 |
| `最终 step 2400 / 2400` | `TrainingRun.currentStep` / `TrainingRun.totalSteps` |
| `runner local_wsl_sd_scripts` | `TrainingRun.runnerType` |
| `训练配置` 中的 base、network dim、alpha、batch、learning rate、resolution | `TrainingRun.configArtifactId -> TrainingArtifact` 解析出的训练配置摘要，或 `TrainingRun.runSummaryJson` 中的配置摘要 |
| `训练日志` | `TrainingRun.trainingLogArtifactId -> TrainingArtifact` 的日志预览 |
| `项目 Vela Neon Jacket` | `TrainingRun.trainingProjectId -> TrainingProject.name` |
| `dataset v5 · 42 张图片` | `TrainingDatasetRevision.version` + `TrainingDatasetRevision.itemCount` |
| `创建时间 15:47` | `TrainingRun.createdAt` |
| `运行时间 15:50 - 16:21` | `TrainingRun.startedAt` / `TrainingRun.finishedAt` |
| `状态 succeeded` | `TrainingRun.status` 原始状态值 |
| `配置 artifact training-config-v5.toml` | `TrainingRun.configArtifactId -> TrainingArtifact.filePath/storageKey` |
| `日志 artifact training-run-20260610.log` | `TrainingRun.trainingLogArtifactId -> TrainingArtifact.filePath/storageKey` |
| 数据集样本缩略图 `001` - `004` | `TrainingDatasetRevisionItem.snapshotArtifactId -> TrainingArtifact.filePath/storageKey`，按 `sortOrder` 展示前几个样本 |
| 数据集样本 caption 摘要 | `TrainingDatasetRevisionItem.captionSnapshot`，卡片上前端做行数截断展示 |
| 数据集样本大图预览 | `TrainingDatasetRevisionItem.snapshotArtifactId -> TrainingArtifact.filePath/storageKey`，点击样本卡片打开 |
| 预览层完整 caption | `TrainingDatasetRevisionItem.captionSnapshot` |
| `loss 0.061 final · 0.084 mid` | `TrainingRun.runSummaryJson` |
| `保存产物 final LoRA、训练配置、训练日志` | `finalLoraArtifactId` / `configArtifactId` / `trainingLogArtifactId` 是否存在 |
| `预制状态 尚未创建` | `TrainingRun.presetCreatedAt` 为空 |
| `尚未生成 final LoRA` | `TrainingRun.status in (queued, running)` 且 `finalLoraArtifactId` 为空 |
| `未生成 final LoRA` | `TrainingRun.status = failed` 且 `finalLoraArtifactId` 为空 |
| `等待原因 gpu_busy / comfyui_queue_active / scheduler_paused` | `TrainingRun.waitReason` |
| `等待手动恢复队列` | `TrainingRun.schedulerMessage` |
| 失败原因，例如 `3 张图片缺少 caption` | `TrainingRun.errorMessage` |
| `无 final LoRA，不能创建` | `TrainingRun.finalLoraArtifactId` 为空，因此不显示创建预制入口 |

`训练任务` tab：

| 原型展示 | 实体 / 字段 |
| --- | --- |
| 项目名，例如 `Azure Idol` | `TrainingProject.name` |
| `dataset v4` | `TrainingDatasetRevision.version`，经 `TrainingRun.trainingDatasetRevisionId` 关联 |
| 当前状态列表归属，不在卡片上重复展示 | `TrainingRun.status` |
| 点击卡片进入训练任务详情 | `TrainingRun.id`，跳 `/training/runs/training/[trainingRunId]` |
| `step 1280 / 2400` | `TrainingRun.currentStep` / `TrainingRun.totalSteps` |
| 进度百分比 | 由 `currentStep / totalSteps` 计算 |
| `等待 GPU`、`等待生图队列空闲`、`调度暂停` | `TrainingRun.waitReason` |
| `等待手动恢复队列` | `TrainingRun.schedulerMessage` |
| `LoRA vela_neon_v05.safetensors` | `TrainingArtifact.filePath` 或 `TrainingArtifact.storageKey`，经 `TrainingRun.finalLoraArtifactId` 关联 |
| `训练 31 分钟` | 由 `TrainingRun.startedAt` / `TrainingRun.finishedAt` 计算 |
| `完成于 16:21` | `TrainingRun.finishedAt` |
| `3 张图片缺少 caption` | `TrainingRun.errorMessage` |
| `创建预制` 按钮可用 | `TrainingRun.finalLoraArtifactId` 存在，且 `TrainingRun.presetCreatedAt` 为空 |

已从原型移除或禁止直接展示的数据：

| 展示意图 | 原因 |
| --- | --- |
| 跨 `生成任务` + `训练任务` 的运行中/排队/失败总数 | 用户确认不要聚合 |
| `可用 GPU` / `VRAM` / `训练缓存` | 当前 Training v2 没有稳定数据来源 |
| 生成任务进度百分比、`目标 80 张`、`目标 24 条 prompt`、batch size / image count | 首版一个 `TrainingGenerationTask` 只产出一段文本或一张图片，不支持批量输出 |
| 生成任务 `等待前置图片`、依赖任务、优先级 | 当前没有 generation task dependency / priority / waitReason 字段 |
| 训练任务硬件名，例如 `RTX 4090` | `TrainingRun` 当前只有 `runnerType`，没有 GPU 型号字段 |

待确认是否补充设计：

- 是否需要给 `TrainingGenerationTask` 增加 `waitReason` 或 dependency relation，用于展示“等待前置任务”等排队原因。
- 是否需要在 `/api/training/scheduler/status` 中明确 GPU/VRAM/训练缓存等资源字段。

#### 启动训练入口

确认状态：草案，待页面原型确认。

推荐入口：

- 主入口放在 `/training/projects/[trainingProjectId]/dataset`：数据集 readiness、caption 缺失、kept 图片数量、revision 选择都在这里，最适合承接 `startTrainingRun(projectId, revisionId?, config)`。
- `/training/projects/[trainingProjectId]` 项目总览可放一个顶部 CTA `启动训练`；点击后如果数据集已 ready，则打开启动训练配置抽屉或跳到 dataset 页对应区域；如果未 ready，则跳到 dataset readiness。
- `/training/projects/[trainingProjectId]/training-runs` 如果保留 scoped list，可放次级 `启动训练` 按钮，但不作为唯一入口。

按钮状态：

- 数据集未 ready：禁用或变成 `准备数据集`，展示缺失 caption / kept 数量不足等原因。
- 存在同项目 active `TrainingRun`：禁用 `启动训练`，提示同一 `TrainingProject` 禁止多个 active `TrainingRun`。
- 可启动时：创建新的 immutable `TrainingDatasetRevision` 或选择已有 revision，然后创建 `TrainingRun`。

### 3.3 项目路由

候选完整树：

```text
/training/projects
/training/projects/new
/training/projects/[trainingProjectId]
/training/projects/[trainingProjectId]/profile
/training/projects/[trainingProjectId]/sections
/training/projects/[trainingProjectId]/sections/[sectionId]
/training/projects/[trainingProjectId]/results
/training/projects/[trainingProjectId]/dataset
/training/projects/[trainingProjectId]/dataset/revisions/[revisionId]
/training/projects/[trainingProjectId]/training-runs
/training/projects/[trainingProjectId]/generation-tasks
```

页面职责草案：

- `new`：新建 LoRA 训练项目，承接模板选择、项目基础字段和初始资料输入。
- `[trainingProjectId]`：项目总览，保留关键指标、角色资料卡、最近任务和启动训练入口；不重复铺小节、结果池、数据集正文卡片，这些资源通过 tab 和各自页面进入。
- `profile`：角色资料页，合并编辑 `loraUsagePrompt` / `characterDetailPrompt` / captioning guidance，并管理 original/generated/auxiliary reference images，自由 `label` / `note`，不做 fixed slots。
- `sections`：训练小节列表、启用状态、排序。
- `sections/[sectionId]`：sceneDescription blocks、resolved sceneDescription preview、section run 列表、生成入口和该小节结果；不再拆独立 section results 页。
- `results`：项目级训练结果池，聚合所有 `TrainingImageResult`，支持 pending/kept/rejected、caption、result upload。
- `dataset`：readiness、kept 草稿、freeze 操作、revision 列表。
- `dataset/revisions/[revisionId]`：冻结快照详情。
- `training-runs`：项目内训练执行列表和 start training 入口；详情链接到全局 `/training/runs/training/[trainingRunId]`。
- `generation-tasks`：项目内 AI 生成任务列表；详情链接到全局 `/training/runs/generation/[taskId]`。
- `TrainingTextRevision`：文本 checkpoint/restore 不是 live source of truth；不做独立页面，若要暴露给用户则做在具体文本字段旁的历史/恢复抽屉。

#### `/training/projects` 页面设计

确认状态：已开始 HTML 高保真原型；首版用于确认 LoRA 训练模式下项目列表的密度、卡片信息层级和字段来源。

原型文件：

```text
docs/prototypes/manager-lora-training-projects-prototype.html
```

当前设计：

- 页面标题为 `项目`，顶部右侧仅保留 `新建` 主按钮，跳 `/training/projects/new`。
- 列表状态筛选使用 `TrainingProject.status`：`当前` / `已归档`。其中 `当前` 是 `active` 的暂定前端展示名，后续可改名。
- 项目卡片整体点击进入 `/training/projects/[trainingProjectId]`，不放 `进入详情` 类按钮。
- 项目卡片不展示项目状态 chip，避免和当前状态 tab 重复；已完成、已取消等生命周期只来自 latest `TrainingRun` 或 `TrainingGenerationTask` 摘要。
- 卡片不复制普通生图项目的文件夹/目录信息，因为当前 `TrainingProject` 没有 folder 字段。
- 卡片展示最近结果缩略图、资料完整性、小节数量、结果池 kept 数、latest dataset revision 和 latest training run 摘要。
- 不展示 GPU / VRAM / 训练缓存 / 跨 tab 负载等没有 `TrainingProjectSummary` 稳定来源的数据。

原型假数据字段映射：

| 原型展示 | 实体 / 字段 |
| --- | --- |
| 状态 tab `当前 / 已归档` | `TrainingProject.status = active / archived` 聚合；`当前` 是 `active` 的暂定展示名 |
| `新建` | 跳 `/training/projects/new`，对应 `POST /api/training/projects` 或 `POST /api/training/templates/:templateId/projects` |
| 项目名，例如 `Vela Neon Jacket` | `TrainingProject.name` |
| `更新于 16:28` | `TrainingProject.updatedAt` |
| `归档于 15:44` | `TrainingProject.archivedAt` |
| 项目卡片不展示项目状态 chip | 避免重复当前 tab；项目级状态只用于筛选 |
| 卡片点击 | `TrainingProject.id`，跳 `/training/projects/[trainingProjectId]` |
| 最近训练图片缩略图 | 最近 `TrainingImageResult.thumbnailArtifactId -> TrainingArtifact.filePath/storageKey`；原型 bitmap 只是 artifact 视觉占位 |
| `资料 完整 / 待补` | `TrainingCharacterProfile` 是否存在，且 `loraUsagePrompt`、`characterDetailPrompt`、必要参考图满足前端 readiness 规则 |
| `小节 6 个` | `count(TrainingSection where trainingProjectId = project.id)` |
| `结果池 42 已保留` | `count(TrainingImageResult where trainingProjectId = project.id and reviewStatus = kept)` |
| `dataset v5` | latest `TrainingDatasetRevision.version` |
| `dataset ... ready` | latest `TrainingDatasetRevision.status = ready` |
| `42 张图片` | `TrainingDatasetRevision.itemCount` |
| `8 张缺 caption` | 项目 dataset readiness summary：kept result 中缺少 `TrainingImageResult.trainingCaption` 的数量 |
| `最近训练 · 已完成 · vela_neon_v05.safetensors` | latest `TrainingRun.status = succeeded` + `TrainingRun.finalLoraArtifactId -> TrainingArtifact.filePath/storageKey` |
| `训练中 · step 1280 / 2400` | latest active `TrainingRun.status = running` + `currentStep` / `totalSteps` |
| `排队 · 等待 GPU` | latest active `TrainingRun.status = queued` + `waitReason = gpu_busy` |
| `排队 · 调度暂停` | latest active `TrainingRun.status = queued` + `waitReason = scheduler_paused` |

待确认：

- 哪些项目子资源必须是一等页面，哪些只做详情页内 section/drawer。
- `generation-tasks` 是否需要项目内 scoped 列表页，还是只需要从各业务页面直接跳全局任务详情。
- 项目内 `training-runs` 是否需要独立 scoped list，还是由项目总览和全局运行页覆盖。

### 3.4 预制路由

候选树：

```text
/training/presets
/training/presets/[presetId]
/training/presets/sort-rules
```

说明：

- 管理 `TrainingSceneDescriptionPresetCategory`、`TrainingSceneDescriptionPresetFolder`、`TrainingSceneDescriptionPreset`。
- Training preset 是单段 `sceneDescriptionText`。
- 初版不做 variants。
- 不包含普通 preset 的 positive/negative/lora1/lora2/linked variants 结构。
- 删除 preset 要先查 usage，展示影响的 TrainingSection / TrainingTemplateSection blocks，然后 cascade remove mutable refs + soft delete。

已确认：

- 需要 `/training/presets/sort-rules` 独立页面。
- 是否需要类似普通 preset group 的概念。当前主设计未要求，默认不做。

### 3.5 模板路由

候选树：

```text
/training/templates
/training/templates/new
/training/templates/[templateId]/edit
/training/templates/[templateId]/sections/[sectionIndex]
```

说明：

- `TrainingTemplate` 是创建 `TrainingProject` 的一次性 seed，不是 live dependency。
- Template -> Project 导入时复制 project-level guidance/defaults、section settings、blocks。
- preset block 保留 live binding。
- local block 复制 `localText`。
- 不保存 `sourceTemplateId` / `sourceBlockId` / `sourceSectionId`。
- Project -> Template 保存时同样按镜像复制，不保存 provenance。

待确认：

- 模板 section 编辑是否沿用 index 路由 `[sectionIndex]`，还是改为稳定 id 路由 `[sectionId]`。

## 4. 页面复用原则

Training 前端不是复制旧 `character-lora-training` 页面，也不是只把普通生图页面换文案。

应复用现有生图模块的成熟页面模式：

- 资源列表页：运行、项目、模板。
- 分类/文件夹管理：预制。
- 项目详情壳：项目状态、摘要、操作区、分区入口。
- Section 编辑与排序：小节和 block。
- 图片结果审查：grid、批量 keep/reject、lightbox、caption。
- 模板实例化：template -> project。
- 删除/归档安全边界：project-level cleanup。

Training 自己新增或强化的前端能力：

- `TrainingGenerationTask` 统一生成任务面板。
- `ReferencePicker` 多级源树。
- Dataset freeze/readiness/revision。
- `TrainingRun` scheduler waitReason、进度、artifact、create preset 窄入口。
- mutable 编辑态与 immutable 历史快照的清晰区分。

## 5. 关键 UI/UX 约束

来自主设计的硬约束：

- 不使用旧 prototype 视觉样式。
- 前端原型应对齐现有 ComfyUI Manager 的架构、导航层级、组件密度和信息层级。
- 不做 fixed reference slots。
- 不做 `viewSlot` enum。
- 不做内置 reference label suggestions。
- 初版不做 quick chips。
- `ReferencePicker` 必须用显式多级 source tree。
- 点击 reference candidate 只预览，不直接添加；必须显式“添加”。
- 不把 raw JSON/debug block 作为主 UI。
- 不做 embedded Manager LLM agent。
- 不做 `/agent-tasks` internal reasoning queue。
- 不做 LoRA benchmark/evaluation/recommended weights。
- 不做 full promotion workflow。
- 不做 inference negative prompt。
- 不做 caption strategy selector。

## 6. 生成任务面板草案

所有 Training AI 文本/图片生成都走 `TrainingGenerationTask`。

面板结构：

```text
1. 任务元信息区域
2. 任务内容调整区
3. 渲染区
```

任务元信息区域：

- `generationKind`
- `taskType`
- provider/model/status metadata

任务内容调整区：

- selected reference chips/cards
- 添加引用
- `TrainingGenerationTask.supplementalPrompt`
- supplemental image upload

渲染区：

- AI-chat-style input preview
- image references / supplemental images as attachments
- internal text references + supplementalPrompt 合成完整 text block
- outputs
- apply output

可引用文本源：

- `TrainingCharacterProfile.loraUsagePrompt`
- `TrainingCharacterProfile.characterDetailPrompt`
- `TrainingSection.sceneDescription`
- `TrainingSceneDescriptionBlock.localText` 或 resolved preset text
- `TrainingSceneDescriptionPreset.sceneDescriptionText`
- `TrainingSectionRun.sceneDescriptionText`
- `TrainingSectionRun.imagePromptText`
- `TrainingImageResult.trainingCaption`
- `TrainingImageResult.supplementalPrompt`
- `TrainingGenerationTaskOutput.textValue`

可引用图片源：

- `TrainingCharacterImage`
- `TrainingImageResult.artifactId`
- `TrainingGenerationTaskOutput(outputKind=image).artifactId`
- `TrainingDatasetRevisionItem.snapshotArtifactId`

## 7. 待确认清单

后续按下面顺序逐项确认并更新本文：

1. `/training/projects/[id]` 的子页面边界：哪些独立页面，哪些嵌入详情页。
2. `training-runs` / `generation-tasks` 是否需要项目内 scoped 列表页。
3. 启动训练配置抽屉放在 dataset 页内，还是做独立步骤页。
4. 模板 section 使用 `[sectionIndex]` 还是 `[sectionId]`。
5. 旧 API/service/worker 是否在本轮一并删除，还是只删除旧前端。
6. 首版前端原型的最小可验收页面集。

已确认不再作为待确认项：

- `/training/projects/[trainingProjectId]/profile` 和角色参考图管理合并成角色资料页。
- `/training/projects/[trainingProjectId]/sections/[sectionId]/results` 不做独立页，小节结果并入小节详情。
- `/training/projects/new` 需要独立页面原型。
- `/training/projects/[trainingProjectId]/edit` 并入项目总览 / profile，不做独立页。
- `TrainingTextRevision` 不做独立页面；如需要展示，做成具体字段旁的历史/恢复抽屉。
- `/training/presets/sort-rules` 需要独立页面原型。
