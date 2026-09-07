# 生产与训练命名及小节扩展边界

确认日期：2026-09-07。本文件记录用户逐组确认的设计调整；相关定义已同步到原决策文档。本版不开发视频生成，也不确定任何视频实体、模块、接口或组件名称。

## 本轮已确认范围

| ID | 决定 | 当前设计要求 |
| --- | --- | --- |
| `FC-01` | 模块标识对称 | 使用 `production` 与 `training`；代码目录为 `modules/production/**`、`modules/training/**`，页面为 `/production/**`、`/training/**`，API 为 `/api/production/**`、`/api/training/**`。默认任务入口为 `/production/tasks`；有有效导航记录时仍按 IA-01 恢复页面。训练功能本版仍只涵盖 LoRA。 |
| `FC-02` | 生产公共项目与模板 | `ProductionProject` 与 `ProductionTemplate` 是生产模块中的同级概念，不带区别图片/视频的前缀。同一个生产项目与模板在结构上允许未来包含不同类型的小节；不为每种生成类型另建独立的项目体系。生产与训练两个模块仍各自拥有项目、模板和业务生命周期。 |
| `FC-03` | 小节分型 | 生产公共小节为 `ProductionSection`，本版图片专属配置为与其一对一的 `ProductionImageSection`；模板由 `ProductionTemplateSection` 与一对一 `ProductionTemplateImageSection` 构成。统一项目容器、小节列表和组织操作读取公共记录的类型；参数编辑、生成配置和结果视图由对应类型负责。本版只实现和显示图片小节。 |
| `FC-04` | 文件夹与排序 | `ProductionProjectFolder` 组织生产项目；`ProductionSectionFolder` 组织项目中的小节；`ProductionTemplateSectionFolder` 组织模板中的小节。项目或模板内的文件夹、小节列表和排序是公共组织能力，允许未来容纳不同类型，不按图片/视频各建一套组织树。 |
| `FC-05` | 图片任务与执行尝试 | 使用 `ProductionImageTask` 与 `ProductionImageAttempt`。项目任务入口可统一查看已接入的任务类型，类型、状态和计数明确区分；各类型分别负责自己的配置、结果要求、执行记录和重试规则，共享适用的状态展示、耗时和反馈协议。不得因统一入口合并为万能业务 Task。 |
| `FC-06` | 图片结果与文件资产 | `ProductionImageResult` 保存图片结果所属小节/任务、审核状态及用途标记；`ProductionImageArtifact` 管理文件路径、尺寸、缩略图和文件生命周期。二者归属 `ProductionProject`。未来视频输入素材应有独立业务身份，文件为图片并不使其自动成为图片生成结果；本轮不决定物理复制或引用方式。 |
| `FC-07` | 图片配置与附属对象 | 图片预制及分类、文件夹、变体、组等使用 `ProductionImagePreset` 命名体系；图片提示词片段、LoRA 配置、回收站及批量打码分别采用下方名称表。项目图片小节与模板图片小节复用配置协议，各自拥有记录；从模板导入项目仍深复制，已有 Preset 绑定规则不变。 |
| `FC-08` | 项目级操作范围 | 本版“运行整个项目”明确为“生成全部图片小节”；未来其他类型是否参与批量运行届时再定。项目归档/删除、小节复制/删除由公共层组织、各类小节负责自身配置/结果/文件处理，本版只有已有图片逻辑。图片重试、审核、彻底删除语义不变；当前项目导出仍是图片交付包，保留 JPEG、ZIP、P站、预览和封面规则。 |
| `FC-09` | 训练实体简化 | 所有既有正式 `LoraTraining*` 实体统一简化为 `Training*`，例如 `TrainingProject`、`TrainingTemplate`、`TrainingSection`、`TrainingImageArtifact`、`TrainingImageGenerationTask`、`TrainingRun`。命名变化不增加训练能力，不修改既有候选、Caption、训练运行和 checkpoint 的生命周期。 |
| `FC-10` | 接口与文档命名层次 | 公共项目、模板和小节组织使用公共名称；图片生成配置、任务和结果使用明确的图片类型名称。有明确类型上下文的接口字段仍可使用 `sectionId`、`taskId` 等简称；统一列表记录明确对象类型。模型清单与跨类型技术引用使用正式名称，域内 UI 继续使用自然的“小节”“任务”等文案。 |
| `FC-11` | 逐组确认后及时写回 | 用户反馈当前讨论组时，未评论的条目按所展示建议确认，有评论的条目按用户修订处理；该规则只适用于当前组，不把尚未逐组讨论的审视建议全部视为批准。每轮先更新本文件及受影响的设计文档和设计输入，再继续下一组。文档更新不表示页面获批或功能已经实施。既有审核 ID 不重编号，旧实现证据与历史快照保留真实旧名。 |
| `FC-12` | 角色生图提示词字段 | TrainingCharacterProfile 的 productionPrompt 改为 imageProductionPrompt，明确表示后续生图用的角色 tag 提示词。领域定义、GET/PATCH、前端设计输入和迁移映射同步更新；三个角色文本字段的内容、可空和修改历史规则不变，不新增视频提示词字段。 |
| `FC-13` | 图片导出目录（FS-04） | 用户修订后的交付包路径为 `<EXPORT_ROOT>/<项目名>/<slug>.zip`；外层文件夹直接使用项目名称，不使用 slug，中间不加 images 层。ZIP 文件名和包内图片命名规则保持，项目删除仍保留交付文件。 |
| `FC-14` | 内部数据目录（FS-01～03） | 按用户“未评论项视为确认”的反馈，生产图片资产采用 `<APP_DATA_ROOT>/production/projects/<projectId>/images/`，应用侧训练项目图片采用 `<APP_DATA_ROOT>/training/projects/<projectId>/images/`，图片 Workflow 采用 `<APP_DATA_ROOT>/production/workflows/image/`。内部项目目录使用稳定 projectId；SQLite、日志、ComfyUI 模型目录及训练执行工作区保持既有约定，视频目录本版不定。 |
| `FC-15` | 公共小节与图片配置（SC-01～03） | ProductionSection 只拥有项目、文件夹、名称、类型、排序等组织信息及小节身份；ProductionImageSection 拥有图片专属配置和关联，与公共记录一对一。模板同样分为 ProductionTemplateSection 与 ProductionTemplateImageSection。名称和排序不在配置层重复保存；用户/API仍操作一个逻辑小节，领域服务协调公共与专属记录的整体创建、复制和删除。本版仅接入图片类型，不确定未来视频实体名称。 |
| `FC-16` | 共享记录的业务目标身份（ID-01～03） | 修改历史以 module + resourceType + resourceId 完整定位目标，查询、恢复和删除均使用这一身份。涉及业务对象的审计、日志及相关页面跳转使用相同协议，区分所属模块、公共小节、具体配置和任务；resourceId 对应声明的类型，不以相近名称或当前页面猜测目标。平台只负责记录和路由，校验、恢复与清理由所属模块或小节类型处理。界面仍显示自然业务名称，不增加身份输入表单；无业务目标的系统日志不虚构资源ID。 |
| `FC-17` | 执行层职责（EXE-01～03） | ComfyUI 通信、队列同步、文件传输和受控进程操作属于生产模块内公共技术服务；图片 Workflow 校验、参数注入、输出识别、图片结果与资产落盘属于图片专属适配器。GPU 协调继续属于 shared 平台，保留单目标、单 GPU、训练优先及现有互斥/恢复规则，恢复调用生产公共进程服务。未来新增执行类型时须明确接入协调边界；本版不实现视频调度、多实例或通用执行平台。 |

## 当前名称对照

| 原新版名称或已存在对象 | 已确认名称 |
| --- | --- |
| `ImageProductionProject` | `ProductionProject` |
| `ImageProductionTemplate` | `ProductionTemplate` |
| `ImageProductionProjectFolder` | `ProductionProjectFolder` |
| `ImageProductionSectionFolder` | `ProductionSectionFolder` |
| 生产模板中的小节文件夹 | `ProductionTemplateSectionFolder` |
| 原生产小节的公共组织部分 | `ProductionSection` |
| `ImageProductionSection` 的图片配置部分 | `ProductionImageSection` |
| 原生产模板小节的公共组织部分 | `ProductionTemplateSection` |
| 生产模板中的图片配置部分 | `ProductionTemplateImageSection` |
| `ImageProductionTask` | `ProductionImageTask` |
| `ImageProductionAttempt` | `ProductionImageAttempt` |
| `ImageProductionImage` | `ProductionImageResult` |
| `ImageArtifact` | `ProductionImageArtifact` |
| `ImageProductionPreset` 及分类/文件夹/变体/组等子实体 | `ProductionImagePreset` 及相应子实体 |
| `ImageProductionPromptSegment` | `ProductionImagePromptSegment` |
| `ImageProductionLoraEntry` | `ProductionImageLoraEntry` |
| `ImageTrashEntry` | `ProductionImageTrashEntry` |
| `CensoringBatchTask` | `ProductionImageCensoringBatchTask` |
| `CensoringBatchItem` | `ProductionImageCensoringBatchItem` |
| `LoraTraining*` | `Training*` |
| `TrainingCharacterProfile.productionPrompt` | `TrainingCharacterProfile.imageProductionPrompt` |

这张表中的旧名称只用于解释目标设计变更。旧数据库、源码证据和已删除旧模型名称仍按真实来源记录；生产运行代码尚未按本文件迁移。表中未列出的子实体按已确认的所属聚合和前缀统一，不新增原设计不存在的业务对象。

## 本版排除与尚未确认事项

本版向前兼容所需的逐组讨论已收口，处理索引见 [审视收口记录](../evidence/2026-09-07-forward-compatibility-closure.md)。以下视频事项属于未来范围；其余实现细节遵循已确认合同，不构成本轮继续确认或恢复当前 UI 设计的前置条件。

- 不开发视频生成，不增加视频小节入口、任务、资产库、工作流、播放器或空占位功能；此前讨论中举例的视频类型名称不作为命名约定。
- 未来视频仍处在生产项目的小节扩展范围内；其具体输入、执行及资产模型届时设计。
- 图片结果用作其他生成类型输入时，物理文件复制或引用方式未定；不因此改变本版已确认的图片彻底删除语义。
- 项目归档、删除和批量操作的公共分发边界已确认，未来小节类型的具体行为及是否参与项目批量生成未定。
- 模块目录、页面和 API 前缀以及 FS-01～04 当前文件目录已确认；文件名、缩略图及打码版本的细部组织仍由所属图片资产逻辑负责。当前是设计更新，实际文件转换按 MIG-05 在新版迁移阶段执行，视频目录本版不定。
- 平台目标身份及执行层职责已按 FC-16/17 确认；未来视频的具体 GPU 占用与任务行为在接入时设计，本版仅实现已有参与者。
- 通用组织、图片专属 API 语义及公共/图片配置一对一结构已确认；本版沿用 03-http-api.md 的路由清单，实现时细化请求/响应 Schema，不为视频提前新增或改名接口。

## 来源与联动

用户在本轮对话中依次确认了公共 Project/Template 与小节分型、任务与 Attempt、结果与 Artifact、公共文件夹、图片配置及附属对象、项目级操作、模块路由，随后要求训练实体前缀统一简化、每轮确认后及时更新文档，并确认角色提示词字段采用 imageProductionPrompt。本文件只归纳这些确认，未把前期审视报告的全部建议视为批准。

已核对同仓库的“整理项目当前状态”任务：该任务在建立设计分支后使用的正式文档入口就是本目录的 README.md，与本轮更新为同一组文件。更早的 `.tmp/product-refactor/production-feature-inventory-2026-08-26.md` 是整理来源，原文保存在 evidence/source-inventory.md；维护中的定义以本目录的分主题决策为准，不复制为两套独立的当前设计。

对应定义见 [领域模型](02-domain-models.md)、[HTTP API](03-http-api.md)、[前端设计](04-design-and-components.md)、[设置](01-settings.md)、[平台功能](06-platform-features.md)、[图片生产功能](07-image-production-features.md)、[训练功能](08-lora-training-features.md)。[迁移](05-stack-and-migration.md)保留源数据真实性；[Figma 审核入口](../figma/README.md)在继续页面设计前使用最新确认内容。
