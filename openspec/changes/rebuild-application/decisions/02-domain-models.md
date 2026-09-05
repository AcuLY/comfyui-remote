# 领域模型、资源边界与修改历史

本文件记录本轮对话已确认的新版目标，尚不代表运行代码已实现。编号保留原清单 ID；冲突时采用最新用户决策及 [最终口径](00-final-decisions.md)，旧实现列仅供数据转换核对。

## A7. Shared 修改历史协议

修改历史与审计日志职责分离：修改历史用于查看差异和恢复可编辑业务内容；审计日志用于记录谁在何时执行了什么操作。Shared 只统一记录、查询、分页和通用界面，不直接理解或任意修改各模块业务表；图像生产与 LoRA 训练分别注册自己的快照、校验、摘要和恢复处理器。

| ID | 能力 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `RV-01` | 与审计日志的边界 | shared | 修改历史用于差异和恢复；审计日志用于操作追踪。一次可恢复修改可以同时产生一条 RevisionEntry 和一条 AuditLog，但两者不共享 payload，也不能互相替代 |
| `RV-02` | 统一模型与领域适配 | shared + 模块处理器 | 删除 `SectionChangeLog`、`PresetChangeLog`、`PresetGroupChangeLog`、`TrainingTextRevision` 等专属记录模型，改用一个 shared `RevisionEntry` 表；shared 根据 module/resourceType/scope 路由到模块注册的 capture、validate、summarize 和 restore 处理器，绝不直接按 JSON 任意更新业务表 |
| `RV-03` | 图像生产覆盖范围 | image-production adapter | 覆盖 Section 的 Prompt、LoRA 和生成参数，以及 Preset、Variant、Group、Template 的可编辑配置；项目名称、文件夹移动等普通元数据只写审计，不提供恢复 |
| `RV-04` | LoRA 训练覆盖范围 | lora-training adapter | 覆盖三个角色文本、Section Caption、Prompt Segment、输入图片关系、Provider 参数、代表图片，以及 Prompt Preset、Template 的可编辑配置 |
| `RV-05` | 排除范围 | shared 固定协议 | Task、Attempt、TrainingRun、checkpoint 和图片字节不创建修改历史；它们使用不可变快照或自身生命周期。删除、回收站和任务状态变化只写审计 |
| `RV-06` | 记录时机与粒度 | 模块领域事务 | 每次成功的新增、编辑、删除、排序、绑定或解绑请求最多产生一条对应逻辑范围的记录；无实际变化时不记录。只记录明确保存的语义操作，不记录每次键盘输入、后台进度、idle checkpoint、start training 或 dataset freeze 等伪修订原因 |
| `RV-07` | RevisionEntry 内容 | shared / SQLite | 每条保存 module、resourceType、resourceId、scope、schemaVersion、单份完整 snapshot、summary、actorType 和 createdAt；不同时保存 before/after。差异在读取时与相邻快照或当前状态计算，图片、完整任务 payload、Token 和秘密不得进入 snapshot |
| `RV-08` | 恢复 | 模块领域事务 | 恢复只作用于该记录的逻辑范围；模块处理器先验证实体、schemaVersion 和领域约束，再在同一事务中保存当前状态的新 RevisionEntry 并应用目标快照，因此恢复后仍可撤销。shared 不绕过模块服务直接写库 |
| `RV-09` | 保留策略 | shared / SQLite | 不设数量或时间上限，不自动删除；按 resourceType、resourceId、scope、createdAt 建索引并强制分页。归档项目保留历史，彻底删除资源时由模块删除事务同步删除对应 RevisionEntry；只有实际体积形成负担后才另行设计手工清理能力 |
| `RV-10` | 界面与 HTTP 接口 | shared UI + 模块 API | 在具体编辑页提供统一“修改历史”抽屉，展示时间、操作者、摘要和差异并支持恢复，不建设全局历史中心。前端与 Agent 共用规范的历史查询、详情和恢复 HTTP 接口，恢复仍进入对应模块处理器和审计流程 |

## A8. Shared 实体与跨模块关系

“Shared”只用于生命周期确实跨模块的资源与基础协议，不因两个模块都出现 Project、Task、Preset、Template 或 Artifact 等名称就强行共表。图像生产与 LoRA 训练保持对等，但对等不表示业务实体和功能必须完全相同。

| ID | 关系 | 所有权 | 决策 |
| --- | --- | --- | --- |
| `SI-01` | 项目身份 | 两个业务模块 | 不建立 shared Project；分别使用 ImageProductionProject 与 LoraTrainingProject，各自拥有数据库、API、路由和生命周期 |
| `SI-02` | 两类项目直接关联 | 无 | 不增加项目外键。训练 checkpoint 经用户复制并由模型模块扫描后成为独立模型文件，图像生产只引用 shared 模型业务键；复制后的模型与原训练项目完全解绑 |
| `SI-03` | 项目通用界面 | shared UI primitives | 只复用项目卡片、排序、归档提示等中性组件，不复用或交叉调用另一模块的具体页面、服务或数据库实体 |
| `SI-04` | 模型资源 | shared 模型模块 | 模型文件是真正 shared 的业务资源；模型模块直接扫描当前 compute target 的 ComfyUI `models` 根目录，统一向两个模块提供 checkpoint、LoRA 等文件选择能力 |
| `SI-05` | 模型文件身份与任务快照 | shared 模型模块 + 模块配置 | 使用“模型类型 + 相对 `models` 根目录路径”作为业务键；文件移动后由受管移动操作更新当前可编辑引用。Project、Section、Preset 和 Template 保存业务键，Task/TrainingRun 创建时保存实际绝对路径快照，之后不得随当前文件位置改写 |
| `SI-06` | 模型元数据与缺失处置 | shared 模型模块 / SQLite | 普通备注、Trigger words、Civitai URL 和缺失状态按模型业务键保存；扫描不到时保留记录并显示缺失，不自动换成同名文件。按 MODEL-009 支持清理无当前引用的缺失记录，或由用户选择同类型文件替换旧记录及当前可编辑引用；历史快照永不重写 |
| `SI-07` | 图片与 Artifact | 各业务模块 / 项目 | 不建立跨模块、跨项目的全局图片库或全局 Hash 去重；各项目只在自身范围内保证同一字节不重复保存并管理引用生命周期。Shared 只提供安全读取、缩略图和文件操作基础设施 |
| `SI-08` | Preset 与 Template | 两个业务模块 | 两模块分别拥有自己的 Preset、Group 和 Template；可以共享编辑器基础组件与修改历史协议，但不共享业务表或允许跨模块绑定 |
| `SI-09` | 任务实体 | 两个业务模块 + shared 协议 | 图像生产 Task、训练素材生成 Task、TrainingRun 分别建模；只共享状态展示、耗时记录、通知和日志协议，不合并为万能 Task 表 |
| `SI-10` | 跨模块归档与删除 | 两个业务模块 | 归档或删除任一项目不得级联修改另一模块。项目对 shared 模型只保存引用，模型模块不提供应用内文件删除，因此项目删除也不得删除 ComfyUI 模型文件 |

## A9. Shared 最终领域模型

Shared 数据模型只保存真正跨模块的配置、资源索引和平台记录；模块专属设置、项目、任务、Preset、Template、图片关系和业务状态不得塞入 shared 表。所有动态设置继续使用结构化列或结构化单例记录，不建立任意 key-value 配置系统。

| ID | 领域模型 | 形态 | 决策 |
| --- | --- | --- | --- |
| `SD-01` | `SharedSettings` | SQLite 单例 | 保存日志最低级别、轮转大小/数量和页面、服务端请求、内部阶段的慢事件阈值；使用明确结构和校验，不使用任意 key-value 表 |
| `SD-02` | `ComputeTarget` | SQLite 单例 | 保存当前 local/SSH 模式、SSH user/host/port/私钥路径及目标身份；全应用最多一条当前配置，不提供 Target 列表 |
| `SD-03` | `ComputeTargetState` | SQLite 单例运行状态 | 与 ComputeTarget 配置分开，保存 gpuState、restartRequired、最后检查/恢复时间和最后错误；频繁状态变化不得改写配置记录 |
| `SD-04` | `ModelFileRecord` | SQLite 文件投影 | 以 modelKind + relativePath 为唯一业务键，保存 present/missing 状态、普通备注、Trigger words、Civitai URL、最近扫描时间等元数据；取代旧 LoraAsset 身份，同时覆盖 checkpoint、LoRA 和其他已支持模型类型 |
| `SD-05` | `PinnedModelFolder` | SQLite 有序关系 | 保存相对 ComfyUI `models` 根目录的文件夹路径和置顶顺序；目录缺失时保留记录并显示缺失，用户可取消置顶 |
| `SD-06` | `RevisionEntry` | SQLite 通用记录 | 使用 RV-01～RV-10 的单快照模型；shared 负责记录、索引、分页和路由，模块处理器负责捕获、校验、摘要与恢复 |
| `SD-07` | `AuditLog` | SQLite 追加记录 | 只保存操作者、动作、目标、结果和时间等最小审计信息，不保存完整业务快照、Prompt、图片、Token 或秘密；与 RevisionEntry 独立 |
| `SD-08` | 非数据库状态 | 环境变量 / 浏览器 / 文件 | AUTH_TOKEN、APP_DATA_ROOT、EXPORT_ROOT 和 Codex auth 文件指针来自环境变量；主题、SFW、导航偏好在浏览器；结构化日志写轮转文件，不建立数据库副本或 fallback |
| `SD-09` | GPU 协调 | 无独立表 | 删除 GpuTaskLock。协调服务通过图像 Task/Attempt 的 submitted/running/提交 claim 和 TrainingRun pending/running 状态，在同一 SQLite 事务内决定提交或训练启动；状态记录本身是唯一真相 |

## A10. 图像生产最终领域模型

新版使用明确的 ImageProduction 命名空间；旧 `Project`、`Run`、`ImageResult`、`CensoringTask` 等名称只作为迁移来源，不继续承担跨模块或含义模糊的身份。配置实体保存当前可编辑真相，任务保存创建时不可变快照，Attempt 保存每次真实 ComfyUI 提交，图片和回收站使用独立生命周期。

| ID | 领域模型 | 决策 |
| --- | --- | --- |
| `IPD-01` | `ImageProductionProject` | 保存名称、唯一 slug、active/archived、项目文件夹、排序、Section 默认参数、唯一封面引用、lastExportedAt、最新 ZIP 路径和最小导出摘要；活动任务数、待审核数等实时派生，不复制任务状态 |
| `IPD-02` | `ImageProductionProjectFolder` | 多级树结构，保存父文件夹和同级顺序；删除非空文件夹时由同一领域操作连同全部子文件夹和项目处理，不提供删除时迁移内容 |
| `IPD-03` | `ImageProductionSectionFolder` | 项目内多级树结构并保存同级顺序；Template 使用自己的同构文件夹实体，导入项目时完整复制层级、父子关系和 Section 归属 |
| `IPD-04` | `ImageProductionSection` | 保存名称、文件夹、项目内顺序、画幅/尺寸/生成数量/放大参数、Checkpoint 模型业务键、两阶段 KSampler 和 Seed 策略等当前权威配置；不保存 enabled、任务状态或历史任务参数 |
| `IPD-05` | `ImageProductionPromptSegment` | 有序 Segment，只能是 CustomText 或 PresetBinding；正向/负向内容、名称和来源明确，不维护另一份可编辑整段 Prompt。Group 导入仍产生多个独立 PresetBinding Segment |
| `IPD-06` | `ImageProductionLoraEntry` | 保存第一/第二阶段、模型业务键、权重、顺序、是否启用和来源；手动 LoRA、Preset LoRA、转为手动及 Section 停用关系使用明确字段，UI 不暴露 tombstone 等实现词 |
| `IPD-07` | Preset 聚合 | 保留 ImageProductionPresetCategory、PresetFolder、Preset、PresetVariant、PresetVariantLink、PresetGroup、PresetGroupMember 和 CategorySlot；Group 始终组合多个独立 Preset/Variant，保留嵌套与循环检测，不融合成员内容 |
| `IPD-08` | Template 聚合 | ImageProductionTemplate、TemplateSection、TemplateSectionFolder、Segment、Binding 和 LoRA 使用与项目 Section 同构的配置协议，但拥有独立业务表和物理删除生命周期；导入/另存时按已确认规则深复制 |
| `IPD-09` | `ImageProductionTask` | 取代旧 Run；保存 Project、Section、创建时完整 resolved config/Prompt/Workflow JSON 快照、预期输出数量、当前状态、等待原因、提交 claim 和累计阶段耗时。任务输入不可在创建后修改 |
| `IPD-10` | `ImageProductionAttempt` | 每次真正向 ComfyUI 提交时创建，保存 promptId、内部状态、submittedAt、startedAt、finishedAt、排队/生成耗时、错误和中断原因；同一 Task 重试新增 Attempt，但不新建 Task |
| `IPD-11` | `ImageProductionImage` | 保存所属 Task、Project、Section、项目内 ImageArtifact、审核状态 pending/kept、P站/预览布尔标记和可选打码 Artifact；唯一封面引用保存在 Project。任务不存在部分成功，只有完成任务才产生正式图片记录 |
| `IPD-12` | `ImageArtifact` | 只在同一 ImageProductionProject 内按 Hash 复用图片字节，保存受管路径、缩略图、尺寸和引用状态；不与 LoRA 训练 Artifact 共表，不跨项目复用 |
| `IPD-13` | `ImageTrashEntry` | 保存图片及原 Project/Section/Task、原路径、删除时间等恢复上下文；恢复成功后删除 TrashEntry，永久删除时清理图片关系、缩略图、原图/打码字节和封面引用 |
| `IPD-14` | `CensoringBatchTask` / `CensoringBatchItem` | 一次“P站＋预览＋封面”批量打码对应一个用户任务，每张去重后的图片对应一个 Item 并保存执行结果；手工单图打码和单图自动打码直接更新图片打码 Artifact，不创建大量批量任务 |
| `IPD-15` | 导出状态 | 不建立导出历史表或版本实体；Project 只保存最新导出时间、ZIP 绝对路径和最小摘要。每次重新导出覆盖上一份，项目删除仍保留 EXPORT_ROOT 中的交付文件 |

## A11. LoRA 训练最终领域模型

LoRA 训练的当前可编辑真相归 Project/Profile/Section，训练素材候选统一归 Section，训练启动时直接创建不可变 TrainingRunSample，不再经过 DatasetVersion。训练素材图片和实际 LoRA 训练都保留自己的任务与 Attempt，但只共享状态、耗时、日志和反馈协议，不与图像生产任务共表。

| ID | 领域模型 | 决策 |
| --- | --- | --- |
| `LTD-01` | `LoraTrainingProject` | 保存名称、active/archived、排序、可选 Base checkpoint 业务键和项目训练默认参数；不需要 slug，也不保存缺图、缺 Caption、生成中或训练中等派生业务状态 |
| `LTD-02` | `LoraTrainingCharacterProfile` | 与 Project 一对一，只保存允许为空的 triggerToken、characterDescription、productionPrompt；Section Caption 不进入 Profile |
| `LTD-03` | `LoraTrainingImageArtifact` | 只在同一个 LoraTrainingProject 内按 Hash 保存一份图片字节、受管路径、尺寸和引用状态；不跨项目或模块复用 |
| `LTD-04` | `LoraTrainingReferenceImage` | 引用项目 Artifact，保存 name、可选 description 和 sortOrder；删除参考图关系时，仍被 Section、Task 或 TrainingRunSample 引用的字节继续保留 |
| `LTD-05` | `LoraTrainingSection` | 保存名称、项目内 sortOrder、size/quality/background、候选数量、权威 trainingCaption 和唯一 selectedImageId；不保存 enabled 或独立 generationPrompt |
| `LTD-06` | `LoraTrainingSectionInput` | 保存 Section、Artifact、顺序和可选用途说明；输入可来自项目参考图库、Section 手工上传或历史生成结果，创建项目时上传的参考图默认建立到每个初始 Section 的输入关系 |
| `LTD-07` | `LoraTrainingPromptSegment` | 有序 CustomText/PresetBinding；确定性解析完整生图 Prompt 和可选 Caption 初始参考，但不得自动覆盖 Section 当前 trainingCaption |
| `LTD-08` | Prompt Preset 聚合 | 保留一层 LoraTrainingPromptPresetCategory、PromptPreset 和简单 PromptPresetGroup。Preset 保存生图文本和可选 Caption 参考；Group 只是多个独立 Preset 的有序组合，不融合内容，也不增加 Variant 或嵌套 Group |
| `LTD-09` | Template 聚合 | LoraTrainingTemplate 保存名称、排序、Base checkpoint、训练默认参数及 TemplateSection；TemplateSection 与项目 Section 使用同一参数、Segment、Caption 和候选数量协议，创建项目时按既定规则深复制 |
| `LTD-10` | `LoraTrainingImageGenerationTask` | 保存 Section、完整 Prompt/Segment/输入图片/Provider 参数快照、请求候选数、pending/running/completed/failed/cancelled 状态、等待原因和阶段耗时；Task 输入创建后不可修改 |
| `LTD-11` | `LoraTrainingImageGenerationAttempt` | 一次 Attempt 可发起若干次一次一张的 Provider 调用。部分调用成功时保留已生成候选，Task 因结果数量不足进入 failed；重试仍属于同一 Task 并只生成缺少的候选数，既不丢弃成功图片也不重复花费 |
| `LTD-12` | `LoraTrainingImage` | 统一表示生成或手工上传的 Section 候选并引用 Artifact；生成来源 Task/Attempt 允许为空。没有 reviewStatus 或 Caption，是否采用只由 Section.selectedImageId 表达 |
| `LTD-13` | `LoraTrainingRun` | 启动训练时保存最终训练参数、Base checkpoint 路径快照、pending/running/completed/failed/cancelled 状态、进度、等待原因、阶段耗时以及 manifest、日志和工作区路径；输入创建后不可修改 |
| `LTD-14` | `LoraTrainingRunAttempt` | 同一 TrainingRun 故障重试时新增，保存目标机器快照、启动/结束时间、错误、受管进程身份和使用的 sd-scripts 恢复状态；修改训练样本或核心参数时才创建新 TrainingRun |
| `LTD-15` | `LoraTrainingRunSample` | 保存当次 Section ID/名称/顺序、代表图片及 Artifact 引用和 Caption 文本快照；不复制图片字节，也不依赖 DatasetVersion，来源生成 Task 可从 LoraTrainingImage 追溯 |
| `LTD-16` | `LoraTrainingCheckpoint` | 保存 Run、Attempt、step、模型 Artifact、可选 sd-scripts 恢复状态路径、创建时间和文件可用状态；任意 checkpoint 均可由用户复制到 ComfyUI LoRA 模型目录，不建立唯一 final checkpoint |
| `LTD-17` | 归档后的 checkpoint | 项目归档删除 checkpoint 和恢复状态的实际文件，但保留 checkpoint 最小记录、step、原路径和所属 Run/Attempt 用于查看训练历史；此前复制到模型目录的文件完全独立 |
| `LTD-18` | 删除的旧实体 | 移除 TrainingDatasetRevision/Item、TrainingSectionRun、通用 TrainingGenerationTaskOutput、PromptCardVersion 和专属 TrainingTextRevision；训练输入预览是实时查询，不新增 Preview 实体 |
