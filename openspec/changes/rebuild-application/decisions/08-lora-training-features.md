# LoRA 训练功能清单

本文件记录本轮对话已确认的新版目标，尚不代表运行代码已实现。编号保留原清单 ID；冲突时采用最新用户决策及 [最终口径](00-final-decisions.md)，旧实现列仅供数据转换核对。模块与实体命名按 [向前兼容补充决策](09-forward-compatibility.md) 更新。

新版模块统一为 `training`，与 `production` 对称；代码目录为 `modules/training/**`，页面为 `/training/**`，HTTP API 为 `/api/training/**`。所有新版正式实体的原 LoraTraining 前缀统一简化为 Training，完整定义见领域模型；本版功能仍仅涵盖 LoRA 训练，不因命名而扩展能力。旧实现、证据列和明确移除的历史模型保留真实旧名；角色资料使用 imageProductionPrompt 表达后续生图用的 tag 提示词。

## C. LoRA Training 模式

### C1. 壳层、运行中心与项目生命周期

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-SHELL-001` | LoRA Training 工作模式入口 | 当前 `/training` 转 `/training/runs`，catch-all 承载全部生产路由 | 现用 | TrainingApp、Prisma snapshot | training page/app | 保留工作模式但按 TS-01 重写路由：正式入口为 `/training/**`，使用 React Router 页面路由；移除旧 Next.js `/training` 重定向/catch-all 和 TrainingApp 分发入口 |
| `TRN-SHELL-002` | LoRA Training 路由 | 当前自有 23 route pattern/matcher | 现用/技术债 | 自定义 matcher 与 Next 路由重复 | `src/features/training/routes.ts` | 移除旧自定义 matcher；Projects、Tasks、Templates、Prompt Presets 及项目内 Profile/Sections/Materials/TrainingRuns 由 React Router 模块路由定义承载，保持对称、可辨认 URL 和浏览器历史 |
| `TRN-SHELL-003` | LoRA Training ModuleShell | 当前独立 Shell 依赖 DesignDemoShell/theme/feedback/routing | 现用/技术债 | shared AppShell 协议 | training shell/runtime | 保留模块外壳职责但彻底重做：接入 shared AppShell、主题、反馈与导航协议，拥有和图像生产完全对等的 LoRA Training ModuleShell；一级导航为项目、任务、模板、Prompt Preset，模型/设置只在 shared 导航出现 |
| `TRN-AUTO-001` | LoRA Training HTTP API | 当前 `GET /api/training` 手写巨型端点/Agent flow manifest | 隐藏/外部自动化 | 外部 Agent 与前端应共用领域 API | training root route | 移除手写能力清单和专用 Agent flow。前端与 Agent 共用 `/api/training/**` 领域 API、验证和 Token 鉴权，不另建 `/agent/**`；来源 actor 写统一审计。接口文档以后由 shared schema/OpenAPI 生成，不在业务 Route 硬编码流程；新版 `/api/training/**` 按新的正式合同重建，不保留旧接口别名或兼容代理 |
| `TRN-RUN-001` | 全局运行中心 | `/training/runs` 合并 GenerationTask 与 TrainingRun | 现用 | 当前把所有生成任务压成 generation，把 LoRA 训练作为 training | training runs page | 保留并重做为“任务”入口：任务中心只管理训练素材生成任务和 LoRA 训练运行；Agent/用户维护的角色分析、Prompt 和 Caption 在项目工作流中管理，不与任务混排；训练输入预览不是运行记录 |
| `TRN-RUN-002` | 运行筛选 | completed/running/queued/failed 过滤 | 现用 | DB 状态映射丢失 draft/cancelled，并把取消伪装成 failed | runs UI | 保留并重做：两类真实执行任务接入 shared 状态协议并支持按任务类型、状态、时间和项目查询；构图候选、代表图和 Caption 完整性属于 Section 就绪状态，不作为任务状态 |
| `TRN-RUN-003` | 项目范围运行列表 | 项目下 generation-tasks 与 training-runs 两页 | 现用 | projectId | scoped runs page | 保留并合并为项目“任务”视图：按类型/状态/时间筛选训练素材生成 Task 与 LoRA TrainingRun；不再维护两套孤立列表逻辑 |
| `TRN-RUN-004` | Generation Task 详情 | 当前展示输入、输出、错误和状态 | 现用 | GenerationTask/Input/Result | run detail | 保留并重做：展示 Segment/Binding 快照、resolved Prompt、输入图片、Provider 参数、Attempts、错误和全部候选结果，并提供“应用本次参数到当前 Section”；同时显示 Provider 等待、实际生成、重试 Attempt 和总耗时 |
| `TRN-RUN-005` | TrainingRun 详情 | 当前展示进度、产物和错误 | 现用 | TrainingRun/Sample/Checkpoint | run detail | 保留并重做：展示 TrainingRunSample、resolvedConfig、进度、checkpoint、日志、取消/失败重试，以及 pending 等待、staging/准备、实际训练和总耗时；checkpoint 可执行“复制到 ComfyUI LoRA 模型目录”，并显示/复制本机或远程源文件绝对路径 |
| `TRN-RUN-006` | 运行隐藏 | UI “删除”非 draft 运行时只写 `hiddenAt` | 现用/软删 | 无恢复 API | run-visibility-service | 移除 hiddenAt 和“删除即隐藏”语义。运行记录保留或通过明确清理/删除操作处理；终态删除按 LAPI-09、LAPI-13 和项目清理规则执行；被 Section/输入/RunSample 引用的候选处置仍需按最终口径中的引用保护细化 |
| `TRN-RUN-007` | 运行取消 | 当前 Generation/Training cancel API 主要写 DB 状态 | 现用/高风险 | worker/provider/受管进程 | cancel routes | 保留并修复：训练素材生成取消必须通知实际 Provider/worker；LoRA TrainingRun 取消必须终止受管训练进程，确认后才写 cancelled，不得标成 failed |
| `TRN-RUN-008` | 运行重试 | 当前 Generation 重建 task、Training 重建 TrainingRun | 现用 | Task Attempt、sd-scripts state | retry services | 保留并区分：训练素材 Task 参数不变时在同一 Task 下新建 Attempt，需修改时先应用到 Section 再创建新 Task；LoRA 训练故障从最近 sd-scripts state 显式重试同一 TrainingRun，核心参数/输入改变才建新 Run |
| `TRN-PROJ-001` | Training 项目列表 | `/training/projects` 当前/归档项目 | 现用 | TrainingProject | projects page | 保留并重做：active 与永久只读 archived 分区/筛选展示；项目业务状态只持久化 active/archived，缺选图、缺 Caption、生成/训练中等均实时派生 |
| `TRN-PROJ-002` | 项目拖拽排序 | 写 `sortOrder` | 现用 | TrainingProject | project-order-service | 保留：active 项目支持拖拽持久化 sortOrder；归档项目不参与 active 排序 |
| `TRN-PROJ-003` | 项目详情与当前完整性 | 当前汇总 profile、references、sections、results、dataset、runs 缺项 | 现用 | 多个 Training 模型 | project detail | 保留并重做：聚合三个角色文本、参考图、Section/代表结果/Caption、生成任务、TrainingRun/checkpoint 和归档状态；提供项目级“训练素材”工作台集中查看每个 Section 的候选/代表图并编辑 Caption；不再使用 DatasetVersion 或持久化 draft/ready/training 项目状态 |
| `TRN-PROJ-004` | 项目归档 | 写 `status=archived` / `archivedAt` | 现用 | 当前不清理文件 | archive route/service | 保留并重构为永久只读归档：不要求选择或登记唯一最终 LoRA。保留 Project/Profile/Section、Section Caption、参考图、生成 Task/Result、TrainingRun/Sample、训练参数/manifest/必要日志及业务文件；删除该项目 Training checkpoint 输出目录中的全部模型文件、runner 临时 workspace、缓存和失败临时文件。此前复制到 ComfyUI LoRA 模型目录的模型完全独立、不受归档影响；不提供清理预览或恢复为 active |
| `TRN-PROJ-005` | 项目恢复 | 归档项目恢复 active | 现用 | TrainingProject | restore route | 移除：新版归档是永久只读状态，不实现恢复/取消归档功能。保留数据是为了查看、追溯和必要时人工复现，不代表项目能重新变为 active |
| `TRN-PROJ-006` | 项目硬删除 | DELETE 级联删除 DB 大量 Training 记录 | 现用/高风险 | 当前不删除磁盘目录，产生孤儿文件 | project delete service | 保留并重构为真正彻底删除：删除 Project、Profile、Section、生成 Task/Result、TrainingRun/Sample/Checkpoint、参考图、生成图片、日志、manifest、项目 Training checkpoint 输出目录和临时目录。ComfyUI LoRA 模型目录中的复制文件从未与项目绑定，删除项目不得查询、提示或删除这些模型；不提供清理预览 |
| `TRN-PROJ-007` | 隐藏项目 | service 存在 `hiddenAt`，无生产路由调用 | 隐藏/未接线 | 兼容残留 | project-visibility-service | 新版移除 `hiddenAt` 和未接线隐藏服务；项目只有 active、永久只读 archived，以及彻底删除三种生命周期 |
| `TRN-PROJ-008` | 归档写保护 | 当前部分 reference/profile/section API 仍可改归档项目 | 部分/缺陷 | 新版需统一 policy | 多个 Training services | 保留并修复：归档项目所有业务写接口统一拒绝修改，包括 Profile、Section、Caption、参考图、生成和训练；仅允许读取、下载保留文件及执行“删除项目” |

### C2. 项目创建、档案、参考图与文本历史

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-CREATE-001` | 统一 TrainingProject 创建入口 | 当前空白项目走 `/training/projects/new` | 现用 | TrainingProject/Profile/Template | project form/service | 保留并合并：只有一个新建项目页面；表单内可选 TrainingTemplate。未选择则创建空白项目，选择后立即把模板的名称建议、Base checkpoint 和训练默认参数预填到同一表单供编辑，提交创建时再深复制剩余 TemplateSection/Segment/Binding/Caption/生成参数 |
| `TRN-CREATE-002` | 可选 Template 创建 | 当前另有从模板复制全树流程 | 现用 | TrainingTemplate 全树 | project-template-copy-service | 合并进 `TRN-CREATE-001`，不再提供独立“从模板创建”入口。创建后项目不随 Template 更新；深复制 Segment 行，PresetBinding 继续引用 Preset，CustomText 复制文本 |
| `TRN-CREATE-003` | 选择共享 checkpoint | 项目新建读取 `/api/models?kind=checkpoint` | 现用/共享依赖 | 模型管理 | project form | 保留模型管理模块选择器，但创建项目时不必选择。Template 可预填默认模型身份，Project 允许为空；真正启动 TrainingRun 时必须从共享模型管理模块选择有效 Base checkpoint，不允许手填绝对路径 |
| `TRN-CREATE-004` | 从其他项目选引用 | 当前可挑选已有 reference/kept 结果并复制到新项目 | 现用 | 跨项目文件读取/复制 | reference picker/create service | 移除且不列入后续 shared 规划：不做跨项目媒体引用、选择或复用。用户需要旧图片时自行复制粘贴/重新上传到新项目 |
| `TRN-CREATE-005` | 新建时上传参考图 | 本地文件上传并写 references | 现用/写文件 | `data/images/training/.../references` | create hooks/services | 保留但不作为创建必填：统一创建表单只要求项目名称；Template、Base checkpoint、参考图和 triggerToken 都可为空。创建时若上传图片则每张只落盘一个 Artifact/Blob 并按 Hash 去重；参考图可在项目创建后随时补充 |
| `TRN-CREATE-006` | 初始化 sections | 新建时预置/复制/启停初始 sections | 现用 | TrainingSection | project create form | 保留并简化：从 TemplateSection 完整初始化 Section 参数区；不再复制 enabled。创建项目时上传的全部角色参考图默认填入每个 Section 的有序输入图片列表，但各列表只创建指向同一 Artifact 的轻量关系，不复制文件。项目创建后新增的角色参考图保持可选，并提供“添加到全部构图”批量动作，不静默改动既有 Section |
| `TRN-CREATE-007` | 未落地创建配置 | baseModel、captionStrategy、perSectionImageCount、trainingSteps 基本不进入执行 | 部分/表单承诺 | 删除或真正接线 | project form/service | 拆分并真正接线：图片候选数量已归每个 TemplateSection/Section；Base model 与训练参数默认值归 TrainingTemplate 顶层，创建项目时复制到 TrainingProject，启动训练时允许覆盖并固化到 TrainingRun。不存在独立 captionStrategy；Caption 是 Section 普通文本 |
| `TRN-CREATE-008` | 未落地自动流程 | autoGenerateSamples、autoFreezeDataset 可被 schema 接受但无自动执行 | 部分 | 不能当现成功能 | project create schema | 新版移除 `autoGenerateSamples`、`autoFreezeDataset` 等不会执行的 schema 字段和 API 参数，不保留虚假自动流程 |
| `TRN-PROFILE-001` | 角色档案 | `/profile` 编辑 `loraUsagePrompt` 与角色细节 JSON；triggerToken 只展示/创建时设置，不能在该页持久修改 | 现用 | TrainingCharacterProfile | profile page/service | 保留并重构：角色级文本只有三个一等字段——后续生产触发词 `triggerToken`（不得与项目 URL `slug` 混淆）、Agent 分析后由用户审核的完整 `characterDescription`、由完整描述简化为 tag 形式供后续生图使用的 `imageProductionPrompt`。三个字段都允许为空，triggerToken 不根据项目名称自动生成；前端使用普通单行/多行编辑组件和规范 GET/PATCH 接口。训练 Caption 属于 Section，不归入角色文本 |
| `TRN-PROFILE-002` | profileSummary 与生成任务关联残留 | 参数不持久化，现有 Profile 还含若干文本生成 Task 关联 | 部分/缺失 | 已确认三个权威文本字段 | profile service/schema | 移除 profileSummary、loraUsagePromptGenerationTaskId、characterDetailPromptGenerationTaskId 等残留；Profile 只保留 triggerToken、characterDescription、imageProductionPrompt |
| `TRN-REF-001` | 参考图上传 | 写文件、TrainingArtifact、TrainingCharacterImage | 现用/写文件 | references 目录 | reference API | 保留并重构：项目参考图使用 Artifact/Blob 单份存储和 Hash 去重；Section 输入、Task 输入快照和其他引用都复用同一字节对象，只保存关系、顺序及当时 Hash |
| `TRN-REF-002` | 参考图名称、说明与排序 | 当前 PATCH label/note/sortOrder | 现用 | TrainingCharacterImage | reference API/UI | 保留但改用明确名称：`name` 是项目内短名称，默认取文件名，用于缩略图、选择器和 Prompt 引用；`description` 是可选的角色/用途说明；`sortOrder` 控制项目参考图库顺序。删除含义模糊的 label/note 命名；某张图在具体 Section 中承担的角色可由 SectionInput 自己的可选说明覆盖 |
| `TRN-REF-003` | 删除参考图 | 当前只删关系，不删 Artifact 或文件 | 现用/生命周期不完整 | 会遗留磁盘资产 | reference delete route | 保留删除关系能力并重构文件生命周期：从角色参考图列表移除不等于立即删除底层字节；只要仍被 Section、生成 Task、结果或 TrainingRun 输入快照引用，Artifact/Blob 就必须保留。无任何引用后才进入可清理状态 |
| `TRN-REF-004` | 参考图加入结果池 | 复用引用图为 TrainingImageResult | 现用 | CharacterImage/Artifact/ImageResult | add-to-results route | 移除：原始角色参考图只作为 Section 生图输入；训练集只使用 Section 选中的生成结果，不再把参考图转换为结果候选 |
| `TRN-REF-005` | 已有 Artifact 注册为参考图 | 当前隐藏 API 可按 artifactId/relativePath 注册 | 隐藏/API-only | 主要用于内部写入，不应成为跨项目入口 | reference-images POST | 简化为模块内部服务：供本项目上传去重和 Section 手工输入转项目参考图等受控流程使用，不作为普通跨网络公开 API，也不支持从其他 TrainingProject Artifact 注册 |
| `TRN-TEXT-001` | 文本修订历史 | Profile 保存自动创建 revision；Caption revision 只有显式调用 text-revisions POST 才创建，普通 caption 保存/PATCH 不自动版本化 | 现用/不一致 | TrainingTextRevision | text-revision-service | 保留并迁移到 RV-01～RV-10：三个角色文本和 Section Caption 的明确保存操作统一创建 shared RevisionEntry；Caption 所有权按新版模型归 Section，不再给 ImageResult 建文本修订。删除 TrainingTextRevision 专属模型和旧 reasons |
| `TRN-TEXT-002` | 文本历史恢复 | 覆盖前先写 before_overwrite，再恢复旧内容 | 现用 | Profile/ImageResult | restore route | 保留并统一到 shared 修改历史抽屉和恢复接口；由 training adapter 校验并恢复角色文本或 Section Caption，恢复前的当前状态作为一条普通新 RevisionEntry 保存，不再使用 before_overwrite 特殊 reason |
| `TRN-TEXT-003` | PromptCardVersion 兼容概念 | 实际映射当前 Profile，不是真正多版本实体 | 兼容/命名不实 | 已确认普通文本字段，修订后续 shared 化 | profile/text code | 移除 PromptCardVersion 名称、兼容映射和接口；当前 Profile 直接返回三个权威文本字段，修改历史按 RV-01～RV-10 接入 RevisionEntry 通用协议 |

### C3. Training sections 与场景描述

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-SEC-001` | 项目 sections 列表 | `/training/projects/:id/sections` | 现用 | TrainingSection | sections page | 保留并迁移到正式 `/training/projects/:id/sections`；作为项目内视图展示 Section 顺序、代表图、Caption 完整性和近期生成任务，不使用 `enabled` 状态 |
| `TRN-SEC-002` | Section CRUD/复制/启停 | 新建、复制、编辑、删除、enabled | 现用 | TrainingSection | project-section-service | 保留新建/复制/编辑/删除，移除 enabled 启停语义；需要保留既有任务历史但退出当前训练方案的场景，后续在归档/删除组单独设计，不复用 enabled |
| `TRN-SEC-003` | Section 排序 | 拖拽持久化 | 现用 | sortOrder | reorder API | 保留：`TrainingSection.sortOrder` 只表示同一个 TrainingProject 内构图项的展示、Agent 处理和 Dataset 排列顺序；`TrainingTemplateSection.sortOrder` 则表示同一模板内的初始顺序，创建项目时复制过去。它不是跨项目的全局顺序 |
| `TRN-SEC-004` | Section 详情 | `/sections/:sectionId` 编辑场景并查看结果；seed hook 只有 UI-local 状态，没有实际 PATCH/持久化合同 | 现用+部分 | Section/Bindings/Runs | section detail UI | 保留并重做为长期“构图生成工作区”：系统字段为 id、name 和项目内 sortOrder；Section 保存有序 PromptSegment（PresetBinding 或 CustomText）、有序输入图片、图片 size/quality/background 等 Provider 参数、候选数量、唯一代表结果及权威 trainingCaption。界面实时展示 resolved Prompt，并通过普通组件/规范 HTTP 接口维护 |
| `TRN-BLOCK-001` | Section Prompt Segment CRUD | 当前新建/编辑/删除/排序 TrainingSceneDescriptionBlock | 现用 | PromptSegment | scene-block service | 保留并重构为有序 Segment：每段只能是持续 `preset_binding` 或 `custom_text`。完全手写 Prompt 可只使用一个长 CustomText；不存在另一份独立可编辑 generationPrompt，避免绑定结构与整段文本双重真相 |
| `TRN-BLOCK-002` | 绑定 Prompt Preset | 当前从 Training preset 导入块，多为文本快照 | 现用/快照 | Preset/Binding | scene-block service | 保留并升级为稳定 Binding：Section 可同时绑定场景 A、姿势 B、机位 C 等多个 Preset，并按 Segment.sortOrder 确定性解析；绑定在 Preset 更新后使用新内容，不再只是一次性文本插入 |
| `TRN-BLOCK-003` | Detach Preset Binding | 当前把 preset 来源块改为本地文本 | 现用 | Binding/CustomText | detach route | 保留：detach 时把当前解析文本复制为 CustomText 并删除 Binding，之后不再随 Preset 变化；支持单 Segment detach，不引入隐藏 fallback |
| `TRN-BLOCK-004` | Resolved Prompt/Caption baseline | 当前 scene-description 与 imagePrompt 合同分散 | 现用/分散 | bindings + custom text | resolved route、section detail | 保留并统一：确定性编译器按顺序解析所有 Segment，生成透明可预览的 resolved generation Prompt；Preset 可提供可选 Caption 文本，同一绑定列表可生成 Caption 初始基线，但不得自动覆盖 Section 已编辑的权威 trainingCaption。每次 Task 必须保存实际 resolved Prompt 和 Segment 轻量快照 |
| `TRN-BLOCK-005` | 旧公开 ID 兼容 | publicSectionId/publicBlockIds 同时支持旧 ID | 兼容 | 数据 JSON 中旧身份 | services/repositories | 移除：新版 Segment/Binding 只使用稳定数据库 ID，不保留 publicSectionId/publicBlockIds 双身份兼容 |
| `TRN-SEC-005` | 全量重建 section 集合 | 隐藏接口会删除并重建全部 sections/blocks | 隐藏/高风险 | ID 稳定性和引用 | `setTrainingProjectSectionCollection` | 新版移除隐藏的全量删除重建接口；只使用单项 CRUD、复制和排序，保持 Section ID、任务及结果引用稳定 |

### C4. Dataset 图片 Generation 与结果审核

2026-08-26 对 `D:\Luca\Code\MyProject\gpt-image-2-generator` 做了只读实践样本核对：SQLite 中有 274 个生成任务、84 个有任务的 section、其中 65 个 section 含多个版本，平均每个有任务 section 3.23 个任务；73 个 section 选择了一个成功任务作为 representative。1766 条输入图片引用只有 93 个不同原始文件名，说明项目参考图被跨构图/版本大量复用。两个角色之间存在 23 组相同 A/B/C 构图编号；每组取首次完整 Prompt 比较，词汇 Jaccard 相似度平均约 0.243，标题/段落结构 Jaccard 平均约 0.083。该证据只说明不能把任意历史最终 Prompt 无损反向拆回固定 Blocks；它不能否定从已知角色上下文、Preset Binding 和自定义文本正向、确定性地编译 Prompt。历史 Prompt 中反复出现 Reference roles、Global character rules、Shot request、Background rule、Hard avoid 等语义段，反而为绑定模型提供了一定支持。最终 Task 无论采用何种编辑模型，都必须保存实际提交的完整 Prompt 快照。独立项目和历史数据均未修改。

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-GEN-001` | Section 生成工作区 | 当前为 Section 创建独立 generation task draft | 现用 | TrainingGenerationTask | compose page | 保留但归入 Section：Section 固定展示 Segment/Binding 编辑器、resolved Prompt、输入图片和参数。点击生成才创建不可变 Task。历史 Task 提供“应用到当前 Section”，恢复其 Segment 快照、输入顺序和 Provider 参数后再编辑/生成，不修改历史 Task |
| `TRN-GEN-002` | 训练集图片生成 | 当前 UI 图片任务只暴露训练集图片生成 | 现用 | GPT-Image worker | compose/task service | 保留为唯一图片生成任务：每条 Task 快照 Section 当时的 Segment/Binding 结构、resolved Prompt、输入图片和 Provider 参数，并可产生多个候选；不建立 sourceTask/correction 派生模型，历史应用动作只覆盖当前 Section |
| `TRN-GEN-003` | 角色描述/说明文本任务 | UI 可创建 text_generation，但 worker 不消费 | 部分/阻塞 | 会永久 queued | provider policy/worker discovery | 移除为任务类型：Agent 分析与用户指正直接写入角色资料，不创建 text_generation 队列；修订历史作为 shared 通用能力后续核对 |
| `TRN-GEN-004` | Caption 类型任务 | 底层支持，但实际 Caption 页另走同步伪生成 | 部分/重复 | 两套语义 | task service/caption service | 移除为任务类型：Agent/用户直接编辑 Section Caption，不创建 Caption worker 任务；Caption 完整性属于 Section 和 Dataset readiness |
| `TRN-GEN-005` | Section 输入图片选择 | 当前 GenerationTask 绑定 profile/scene/CharacterImage/历史结果 | 现用 | SectionInput/TaskInput snapshot | inputs route | 保留并重做：有序输入列表归 Section；输入区提供项目参考图库快速选择器（缩略图、多选、全选/取消、加入并排序），同时支持 Section 手动上传和引用历史生成结果。SectionInput 可写可选用途说明；Task 快照保存 Artifact ID、顺序、说明和 Hash，不复制字节 |
| `TRN-GEN-006` | Supplemental 图片 | 上传任务本地补充图 | 现用/写文件 | task supplemental 目录 | 合并：不再区分 supplemental 与其他输入图片；Section 手动上传的图片也只落盘一次并注册 Artifact，Section 与所有 Task 快照复用同一字节对象 |
| `TRN-GEN-007` | Generation preview | 当前预览最终 payload 后再入队 | 现用 | Section resolved state | preview route | 保留在 Section 工作区：预览 resolved Prompt 并逐段标明 Preset/CustomText 来源，同时显示输入图片顺序、Provider 参数和候选数量；确认生成后才创建 Task 快照 |
| `TRN-GEN-008` | Generation run/cancel | 当前 draft -> queued -> running -> done/failed/cancelled | 现用 | Task + worker | run/cancel routes | 保留并按 LTD-10～LTD-11 简化：Task 保存构图 ID、Segment 轻量快照、实际 resolved Prompt、有序 Artifact/Hash 快照、Provider 参数、请求候选数、状态/时间/错误和候选结果。一次 Attempt 可执行多次单图调用；部分成功候选保留，Task 因数量不足标 failed，重试同一 Task 只补缺少数量。用户调整必须先改 Section 再建新 Task；TrainingSectionRun 合并删除 |
| `TRN-GEN-009` | Generation output 列表 | 读取 worker 输出并映射结果候选 | 现用 | TaskOutput/ImageResult | outputs route | 保留候选结果能力并迁移为 TrainingImage：每次训练素材生成 Task 可产生多个候选，部分成功也直接进入 Section 候选集合；候选没有审核状态，Section 通过唯一 selectedImageId 选择当前最接近“权威训练素材”定义的代表图片。Section Caption 描述权威训练素材本身，更换或清空代表图片都不得自动清空或修改 Caption |
| `TRN-GEN-010` | 候选加入角色参考图库 | 当前按 SHA 去重后复用 Artifact 为 CharacterImage | 现用 | 不复制字节 | generation-output-service | 保留：任意 Section 候选可零拷贝注册为本项目角色参考图，填写 name/description 后用于后续 Section 快速选择；这不等于把原始参考图直接加入训练输入样本 |
| `TRN-GEN-011` | 输出应用到 result pool | 当前基本 no-op | 占位 | 结果已直接属于 Section | generation-output-service | 移除：生成与手动上传都会直接给 Section 创建 TrainingImage，不存在额外“应用到结果池”步骤 |
| `TRN-GEN-012` | 参考图生成任务类型 | `reference_image_generation` 仅为底层/API 类型，当前生产 UI 不暴露 | 隐藏/API-only | GPT-Image worker | 移除：原始角色参考图由用户添加并作为 Section 生成输入，不保留独立“参考图生成”任务类型 |
| `TRN-GEN-013` | Draft GenerationTask 删除 | 当前 draft Task 可物理删除，非 draft 只 hidden | 现用/双语义 | 新版无独立 Task Draft | generation-task DELETE | 移除：生成参数长期保存在 Section，确认生成时才创建 Task，因此不存在待物理删除的 GenerationTask draft；终态历史删除按 LAPI-09 执行；被引用候选的具体处置见最终口径中的待细化边界 |
| `TRN-RESULT-001` | 项目“训练素材”汇总页 | 当前 `/results` 是无明确流程的候选池 | 现用 | TrainingSection/ImageResult/Caption | results page | 保留并全面重做：按 Section 汇总候选数量、当前唯一代表图和权威 Caption；支持集中选择/更换代表图、编辑 Caption、查看缺选图/缺 Caption 的 Section，并跳转 Section 详情。它不是 reviewStatus Results Pool |
| `TRN-RESULT-002` | Section 候选区 | 当前 Section 详情查看和审核结果 | 现用 | TrainingSection/ImageResult | section workspace | 保留并简化：同一候选集合同时接收生成和手动上传的图片；选择关系只由 Section.selectedResultId 表达，无 keep/reject 状态 |
| `TRN-RESULT-003` | 结果 keep/reject | `pending -> keep/reject` | 现用 | reviewStatus | review route | 移除：新版删除 `reviewStatus` 及 keep/reject 状态机。候选图片只有“是否被构图唯一选中”这一关系；全部抛弃时该构图不选择任何候选并可创建下一次生成，旧候选仍随历史生成任务保留或由清理功能处理 |
| `TRN-RESULT-004` | Section 手动添加图片 | 当前上传会写结果并可能伪造完成 Task/Run | 隐藏/API-only/写文件 | TrainingImageResult/Artifact | image upload | 保留并统一：手动上传与生成本质相同，都是为指定 Section 创建一条 TrainingImage。上传结果直接进入同一候选集合，generationTaskId 为空，不伪造 Task/Run，也不建立独立 sourceType 业务分类 |
| `TRN-RESULT-005` | 结果编辑 | PATCH 只支持 `captionDraft` 与 `reviewStatus` | 现用 | TrainingImageResult | image result route | 简化：删除候选结果上的 `reviewStatus` 和 Caption 字段编辑；结果只维护图片 Artifact 与来源 Task。最终选中/取消选中、训练 Caption 均由 Section 接口负责 |
| `TRN-RESULT-006` | 候选结果删除 | 当前只写 removedAt/removeReason，不删文件 | 现用/软删 | Selected/TrainingRunSample 可能引用 | image result delete | 保留明确删除：候选未被 Section 选中且未被 TrainingRunSample 引用时可删除结果记录；否则必须先解除引用。底层 Artifact 仅在所有引用归零后清理，不再用 removedAt 长期伪删除 |
| `TRN-CAP-001` | 单图 Caption API | 若未传文本，生成固定模板字符串；当前 UI 无调用者 | 隐藏/API-only/伪生成 | 不调用 AI provider | caption-service | 移除伪生成并改变所有权：Caption 由 Agent 或用户作为 Section 对“权威训练素材”的普通多行文本定义，通常在选出代表图片后编写，但数据所有权不依赖代表图片；提供规范 Section GET/PATCH 接口，不创建 Caption task，也不伪造固定内容。更换/清空代表图片不得自动改动 Caption |
| `TRN-CAP-002` | 批量 Caption | selected、kept_without_captions 或显式 map | 现用 | 同步写 trainingCaption | captions route | 简化保留批量写入能力：Agent 可提交 `sectionId -> trainingCaption` 映射；删除 imageResult selected/kept/reviewStatus 查询语义，目标范围由显式 Section ID 决定 |
| `TRN-CAP-003` | Caption 任务展示 | 返回 synthetic completed task，不创建真实 Task | 部分/命名不实 | UI 可能误认异步 AI | caption-service | 移除：Caption 不再展示为任务，删除 synthetic completed task 响应 |

### C5. 数据集与 TrainingRun

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-DATA-001` | 训练输入预览 | 当前 Dataset readiness 检查 kept 数量和 Caption 缺口 | 现用/分散 | ImageResult；UI 额外读取 TrainingRun | 保留为实时查询而非领域实体：没有 `selectedResultId` 的 Section 直接忽略；有代表图的 Section 只要求同时存在非空 `trainingCaption`。只要至少存在一组“代表图片 + Caption”即可启动一次训练，不额外检查角色描述、生产 Prompt、活动生成任务或文件 Hash |
| `TRN-DATA-002` | 启动训练并创建输入快照 | 当前先创建 DatasetRevision，再从 Revision 创建 TrainingRun | 现用/核心 | manifest/items | project dataset service | 合并进 TrainingRun 创建：用户预览当前训练输入后点击启动，应用一次性创建 TrainingRun、最终训练参数快照和本次输入样本快照；不再预先创建或选择训练集版本，也不保留独立 Revision/Freeze/Create Version 流程 |
| `TRN-DATA-003` | 独立训练集版本列表/详情 | 当前 `/dataset` 与 `/dataset/revisions/:id` | 现用 | Revision/Items/Artifact | dataset pages/routes | 移除：不再存在 `TrainingDatasetVersion`、版本列表和详情路由。历史训练使用了哪些图片与 Caption，直接在对应 TrainingRun 详情中查看 |
| `TRN-DATA-004` | TrainingRun 输入样本 | 当前 RevisionItem 固化 caption/path | 现用 | RevisionItem | freeze logic | 保留快照能力并迁移为 `TrainingRunSample`：每条只保存 TrainingRun ID、Section ID、当次排列顺序、选中结果 ID、图片 Artifact 引用和 Caption 文本副本；来源生成 Task 可由选中结果追溯，不重复复制 Prompt 或 Provider 参数 |
| `TRN-DATA-005` | TrainingRun 样本图片复用 | 当前 RevisionItem 指向原 Artifact，不复制图片 | 现用/高耦合 | 删除源文件会破坏历史 revision | dataset model | 保留零拷贝并补强生命周期：`TrainingRunSample` 引用 Artifact/Blob，不复制图片；TrainingRun 历史存在期间底层字节必须保留，源候选关系删除不能破坏历史训练输入 |
| `TRN-DATA-006` | 训练预览/启动规则一致性 | 当前 readiness 与 freeze 门槛不一致 | 缺陷 | 新版需统一 | readiness/freeze services | 保留并修复：实时预览和启动训练使用同一条最小规则——只纳入有代表图且 Caption 非空的 Section；未选图 Section 被忽略。启动事务创建的 TrainingRunSample 永久不随 Section 后续修改而变化 |
| `TRN-TRAIN-001` | 创建 TrainingRun | 当前从 dataset revision 入队，默认 2400 steps | 现用 | TrainingRun/Revision | 保留并重构：点击启动训练时直接从当前 Section 状态创建 TrainingRun 及其 `TrainingRunSample[]`，不依赖训练集版本。TrainingTemplate 的训练默认参数复制到 Project，启动时允许修改，TrainingRun 保存最终解析后的完整参数快照；具体参数项后续逐个核对 |
| `TRN-TRAIN-002` | 启动输入校验 | 当前允许非 ready revision 入队 | 缺陷 | 可能训练不完整数据 | create run service | 简化：不再校验 Revision；只要求当前至少存在一组“代表图片 + 非空 Caption”。启动时将这些内容一次性写成 TrainingRun 输入快照 |
| `TRN-TRAIN-003` | 全应用活动 TrainingRun 限制 | 当前每项目最多一个未隐藏 queued/running | 现用 | DB query | create run | 保留并收紧：假设应用只运行在单 GPU 设备上，全应用同时最多一个 `pending` 或 `running` 的 LoRA TrainingRun，不按项目或 compute target 分片，也不设计多 GPU 并行 |
| `TRN-TRAIN-004` | Training 进度与中间模型 | 当前 worker 只回报 step、消息、scheduler 数据 | 现用 | TrainingRun.progress | progress route | 保留进度并扩展：新增应用可配置 `checkpointEverySteps`，从 TrainingTemplate 默认值复制到 Project，启动 TrainingRun 时允许覆盖并固化；LoRA 训练执行器按该间隔保存中间模型，并始终保存最后一步。应用实时登记、展示和管理全部 checkpoint，并持续更新 staging/准备与实际训练阶段耗时 |
| `TRN-TRAIN-010` | TrainingRun 状态机 | 当前使用 queued/running/done/failed，取消也写 failed | 现用/缺陷 | worker polling、runner process | TrainingRun.status | 简化为 `pending`（记录已创建、等待 training worker 启动 runner）、`running`、`completed`、`failed`、`cancelled`。当前 worker lease 后直接启动 runner，没有独立外部提交队列，因此不使用 unsubmitted/submitted；暂不加入 paused，checkpoint 与同一任务故障重试按 LTD-14～LTD-16 执行 |
| `TRN-TRAIN-005` | Training cancel | 写 cancelRequestedAt 并立即标 failed | 现用/不完整 | 不终止真实外部 runner | cancel route/worker | 保留并修复：取消必须由 LoRA 训练执行器真正终止受管训练进程，确认停止后写 `cancelled`，不得伪装成 failed；已经生成的 checkpoint 保留在 TrainingRun checkpoint 输出目录，归档前可管理或复制到 ComfyUI LoRA 模型目录 |
| `TRN-TRAIN-006` | Training completion 与 checkpoint | 当前只记录 final LoRA 与日志 Artifact | 现用/信任外部 | 不验证文件存在/大小/hash | completion.ts | 保留并重构：最后一步仍必须保存 checkpoint 并标记 Run completed，但不建立 `finalCheckpointId`、项目唯一最终 LoRA 或“采用版本”关系。所有 checkpoint 都是可独立操作的训练结果，用户可将任意多个复制到 ComfyUI LoRA 模型目录 |
| `TRN-TRAIN-007` | Training poll | POST 实际只是读取 GET 语义 | 占位/兼容 | 可删除或改真正轮询 | poll route | 移除：LoRA 训练执行器通过结构化事件主动更新进度与 checkpoint，读取统一走 TrainingRun GET/查询接口，不保留伪 poll POST |
| `TRN-TRAIN-008` | Training cleanup | 当前永远 `cleaned:false` | 占位 | 没有临时产物清理 | cleanup route | 重构为真实清理能力：运行中不得删除 checkpoint；训练结束后默认保留全部，允许用户手工清理。项目归档删除项目 Training checkpoint 输出目录中的全部模型文件及临时文件，但保留 Section、Caption、参考/生成图片、TrainingRun 输入和参数记录；彻底清理其他资源属于项目删除 |
| `TRN-TRAIN-009` | checkpoint 复制到模型库 | 当前“从完成训练创建预制”实际创建 TrainingSceneDescriptionPreset | 部分/命名不实 | 训练输出/ComfyUI 模型路径隔离、文件复制、模型索引 | run-preset-service | 移除“最终 LoRA/创建预制”语义，重构为显式“复制到模型库”：用户可以把任意 Run 的任意 checkpoint 从 TrainingRun checkpoint 输出目录单向复制到 ComfyUI LoRA 模型目录，并按模型模块规则选择名称/目录和填写模型元数据。复制后双方完全解绑；不保留来源项目/Run 外键、不反向同步，源文件删除/项目归档也不影响目标模型 |
| `TRN-TRAIN-011` | TrainingRun checkpoint 与恢复 | 当前没有中间模型实体或恢复协议 | 新版缺失 | sd-scripts checkpoint、失败重试、延伸训练 | 无完整实现 | 按 LTD-14～LTD-16 新增轻量 TrainingRunAttempt 与 TrainingCheckpoint；模型 checkpoint 使用 sd-scripts 原生 save_every_n_steps，需要完整续训时使用 save_state/resume。执行进程意外退出后把 Run 标为 failed并结束当前 Attempt，用户从最近可用状态显式重试同一 Run并创建新 Attempt；不实现自动进程接管、事件 outbox 或复杂恢复控制面 |
| `TRN-TRAIN-012` | Training 参数合同 | 当前表单字段大量未接线，真实历史 TOML 参数由脚本手工维护 | 新版领域约束 | Template/Project/Run 参数继承、sd-scripts config | 历史 TOML、training form | 保留并明确：Base checkpoint 从共享模型管理模块选择；Template → Project → TrainingRun 继承并允许逐层覆盖。普通参数为最大步数（默认 4000）、checkpoint 间隔（500）、LoRA rank/alpha（32/16）、分辨率（1024×1024）、batch（1）、optimizer（AdamW8bit）和主学习率（1e-4）；高级参数为 bucket（启用、256–1280、step 64）、U-Net only/Text Encoder LR、cosine scheduler/warmup 200、keep tokens 2 和 caption dropout 0。混合精度按 LE-08 使用机器级 `bf16/fp16` 设置，gradient checkpointing、SDPA、缓存和单进程由执行器固定启用；路径、输出名、日志和 tokenizer cache 由执行器生成，用户不得填写绝对路径 |

### C6. Training 预制与模板

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-PRESET-001` | Training Prompt Preset CRUD | 当前 `/training/presets` 管理场景描述预制 | 现用 | TrainingPromptPreset | preset-service/UI | 保留为可持续绑定的复用单元：每项保存名称、分类、generationPromptText、可选 trainingCaptionText 和分类内顺序，可表达场景、姿势、机位等内容；TemplateSection/Section 通过 Binding 引用并参与确定性解析 |
| `TRN-PRESET-002` | Preset 分类与排序 | 当前 sort-rules 分散管理 categoryOrder/presetOrder/folder sortOrder | 现用/部分 | Category/Preset/Folder | sort rules route/UI | 简化保留：支持分类顺序、分类内 Preset 拖拽排序；删除独立 sort-rules 配置对象，排序直接写 Category/Preset.sortOrder |
| `TRN-PRESET-003` | Preset 分类 | 当前分类与嵌套文件夹 API，无完整 UI | 隐藏 | Category/Folder | preset routes | 保留一层用户自定义分类 CRUD，用于场景、姿势、机位等浏览；移除嵌套 Folder 实体和相关 API |
| `TRN-PRESET-004` | Preset 物理删除 | 当前 DELETE/cascade 主要设 isActive=false | 现用/软删 | Binding 需要安全退役 | preset-service | 不软删除。删除事务先查出所有 TemplateSection/Section Binding，把每个 Binding 按当前解析内容 detach 成 CustomText/Caption baseline，再物理删除 Preset；现有 Section 最终文本不得丢失 |
| `TRN-PRESET-005` | Usage 查询 | 当前返回硬编码或固定空 usage | 部分/伪语义 | 删除前需要真实 Binding 范围 | usage route | 保留并实现真实查询：展示绑定的 Template/Project/Section 数量和对象，用于删除确认与 detach 结果说明；不得返回硬编码 usage |
| `TRN-PRESET-006` | GET 自动写默认 Preset | 当前每次列表读取会确保并覆盖四个默认预制 | 隐藏副作用 | GET 写数据库 | `ensureDefaultTrainingPresets` | 移除：读取接口绝不创建或覆盖 Preset；初始示例若需要只通过显式 seed/初始化提供 |
| `TRN-PRESET-007` | 旧兼容路由 | `/scene-description/presets/**` 代理 `/presets/**` | 兼容 | 外部调用者可能依赖 | route re-export | 移除：新版只提供 `/api/training/prompt-presets/**`，不保留旧 scene-description/presets 代理 |
| `TRN-TPL-001` | Training 模板列表/CRUD | `/training/templates`、new、edit | 现用 | TrainingTemplate | template service/UI | 保留：Template 是一组可复制的 Section 初始参数并保存项目级 Base model/训练默认参数；TemplateSection 与项目 Section 共同使用持续 Preset Binding + CustomText Segment 模型和 resolved preview，不另建 Prompt 编译体系 |
| `TRN-TPL-002` | 模板 sections | CRUD、排序、详情 | 现用 | TrainingTemplateSection | section routes/UI | 保留并重构：字段为 id、name、模板内 sortOrder、PromptSegment/Binding 列表、权威 trainingCaption、图片 size/quality/background 等 Provider 参数和候选数量；移除 code/enabled 和独立整段 generationPrompt 双重真相 |
| `TRN-TPL-003` | TemplateSection Prompt Binding | 当前持久化 TemplateSectionSceneBlock 子树 | 现用 | PromptSegment/Binding | block routes/service | 保留并重构：TemplateSection 与项目 Section 采用同一有序 Segment 协议。创建项目时深复制 Segment 行；PresetBinding 继续引用同一 Preset，CustomText 复制值。项目需要固定某段时可 detach，不存在 Template 运行时 fallback |
| `TRN-TPL-004` | 从模板建项目 | 复制模板结构为 TrainingProject | 现用 | Template -> Project | template projects route | 保留并重构为深复制参数：TemplateSection 与 TrainingSection 使用同一参数合同；创建项目只复制当时值，不保留运行时 fallback，也不随模板后续修改自动变化 |
| `TRN-TPL-005` | 项目另存模板 | 将当前项目结构写 TrainingTemplate | 现用 | Project -> Template | save-as-template | 保留：复制 Section 名称/顺序、PromptSegment/Binding、Caption、Provider 参数、候选数量及项目训练默认参数；排除角色文本、参考图、Section 输入图片、结果、任务和 checkpoint |
| `TRN-TPL-006` | 模板更新 | 当前先删全部 sections 再整树重建 | 现用/高风险 | ID/关系不稳定 | template-service | 改为普通 Template/TemplateSection CRUD，按稳定 ID 新增、更新、物理删除和排序；不再整树删除重建 |
| `TRN-TPL-007` | 模板删除 | 当前设 inactive 并物理删 sections/blocks | 现用/高风险 | 已创建项目使用深复制 | template delete | 不提供归档或软删除；用户确认后直接物理删除 Template 及其 TemplateSection 数据库记录。已创建项目因使用深复制而完全不受影响 |
| `TRN-TPL-008` | 模板排序 | 当前 `listTrainingTemplateOrderIds()` 固定空数组 | 占位/遗留 | Template.sortOrder | template-order-service | 正式保留 Template 列表拖放排序并持久化 `Template.sortOrder`，删除固定返回空数组的占位/兼容实现；TemplateSection 继续维护各 Template 内独立 `sortOrder` |

### C7. Scheduler、外部 Worker 与文件资产

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `TRN-WORK-001` | Worker 状态（内部） | 当前三类队列 queued/running 汇总 | 隐藏/运维 | 任务是唯一用户可见执行抽象 | worker status | 不提供用户可见状态页/API。内部只保留任务领取、心跳和日志所需诊断；所有异常通过 Task/TrainingRun 的等待原因或错误呈现 |
| `TRN-WORK-002` | Scheduler tick | image -> dataset -> training 顺序把 queued 改 running | 现用/高风险 | tick 只占用，不执行 | scheduler.ts | 移除：Worker 直接以数据库条件更新原子领取 pending Task/Run，领取成功并实际开始执行时才写 running |
| `TRN-WORK-003` | Task 领取 | 当前 `/tasks/next` 可能重复返回已有 running target | 现用/不完整 | 单 GPU/两个轻量 worker | leasing.ts | 简化修复：不建立独立复杂 Lease 实体；在 Task/Run 保存内部 workerOwner、heartbeatAt，使用条件更新保证唯一领取。字段不向用户展示 |
| `TRN-WORK-004` | Heartbeat | 当前 image/training/dataset 写入语义不一致 | 现用 | Task/Run 内部执行状态 | heartbeat.ts | 保留为内部机制：两个 worker 定时更新 Task/Run heartbeatAt 和必要进度。心跳超时只把任务标记为执行环境失联/等待用户处理，不自动重领或释放 GPU 锁，避免旧进程仍运行时并发启动 |
| `TRN-WORK-005` | Complete/fail 回调 | generic callback 与 Generation/Training 专用别名重复 | 现用+兼容 | 两类任务 payload 不同 | completion/failure | 删除 generic/domain alias 重复；训练素材 Task 与 TrainingRun 各自保留明确 heartbeat/progress/checkpoint/complete/fail/cancel 接口，不建设通用事件总线 |
| `TRN-WORK-006` | Worker supervisor | `npm run training:workers` 启动/重启三个子进程 | 现用/外部服务 | 独立于 Next.js | worker-queue runtime | 简化保留：移除 dataset-freeze worker，只启动现有训练素材生成 worker 与 LoRA training worker；不引入新的集群调度器、Agent 平台或独立 MLOps 服务 |
| `TRN-WORK-007` | Worker HTTP 认证 | `TRAINING_MANAGER_TOKEN` 或 `AUTH_TOKEN`，`x-api-token` | 现用 | 跨网络内部调用 | worker-common | 保留并统一到 API-02：LoRA 训练执行器只读取 AUTH_TOKEN 并使用标准 Authorization Bearer；删除 TRAINING_MANAGER_TOKEN、x-api-token 和 worker 专属鉴权语义。Token 不进入任务数据、日志或 UI |
| `TRN-WORK-008` | GPT-Image-2 图片 worker | Python/Codex provider 生成训练图片并写 outputs/prompt/metadata | 现用/外部依赖 | auth JSON、Python、网络、DB | image-worker-runtime | 保留为训练素材生成的轻量内部执行器，生产固定使用 openai-codex/gpt-image-2 adapter；用户只看到生成 Task，不看到 worker/provider 进程 |
| `TRN-WORK-009` | 默认图片 provider | supervisor 默认 `task-request`，真实 image worker 会判未配置失败 | 缺陷 | 生产需显式 openai-codex | worker queue/provider policy | 修复：生产默认/唯一 Provider 为 openai-codex/gpt-image-2，worker 启动时验证配置，缺失则不启动并由 pending 任务显示执行环境不可用；不等领取任务后失败 |
| `TRN-WORK-010` | Dataset-freeze worker | 只把 draft 改 freezing/ready，不写 manifest/items | 部分/移除候选 | 与同步 freeze 不等价 | dataset-freeze-worker | 移除：新版没有独立 DatasetRevision/Freeze 流程；TrainingRun 输入样本在启动训练事务中直接生成，不需要 dataset worker |
| `TRN-WORK-011` | LoRA 训练执行器 | 当前 `training-worker.ts` 通过 shell command 调用 sd-scripts | 现用/外部依赖 | `TRAINING_RUNNER_COMMAND` | training-worker-runtime | 保留现有轻量 worker 并更名为“LoRA 训练执行器” / `lora-training-executor`：它只负责轮询领取全应用唯一 TrainingRun、生成 TOML/manifest、启动并终止 `accelerate launch ... sdxl_train_network.py` 子进程、转发日志/进度、发现 checkpoint 并报告完成/失败。执行器启动时若发现数据库仍为 running 但本机/远程已不存在受管训练进程，则把 Run 标为因中断失败，保留已生成 checkpoint，由用户显式重试。训练能力全部复用开源 sd-scripts + Accelerate，不新建 Python 服务、ClearML 类 Agent、容器平台或复杂控制面 |
| `TRN-WORK-012` | LoRA 训练执行协议 | 当前最后一行 stdout JSON 只返回 finalSafetensorsArtifact；mock 虽含 checkpoints 数组，真实解析会丢弃 | 现用/不完整 | 未验证实际文件、不能登记中间模型 | training worker | 轻量扩展现有 HTTP 合同：worker 领取后写 running，运行期间定时 heartbeat/progress 并在发现新 `.safetensors` 时调用 checkpoint 登记接口，退出后调用 complete/fail/cancel。无需通用 typed event bus、sequence/outbox、自动 reattach 或新的入站服务；接口保持幂等即可 |
| `TRN-WORK-013` | Mock/dry-run worker | 可 mock 图片、训练完成 | 隐藏/运维 | 不能进入真实 UI | package scripts/workers | 仅保留测试脚本/夹具，不允许生产 UI/API 创建 mock 图片或伪造训练完成 |
| `TRN-WORK-014` | Scheduler/Worker 聚合状态 | 当前 `/scheduler/status` 同时返回项目/run/worker 汇总 | 隐藏/运维 | 用户只感知任务 | scheduler status route | 移除产品 API 和 UI；任务查询自身返回状态、等待原因、进度与错误，内部执行器健康只写日志/诊断，不建设聚合面板 |
| `TRN-COMPAT-SECTIONRUN-001` | 旧 SectionRun 查询/取消 | `/section-runs/:runId` 是 GenerationTask/TrainingRun 外的兼容入口 | 兼容/隐藏 | TrainingSectionRun 已合并删除 | section-runs routes | 移除旧查询/取消路由与兼容映射，不保留 SectionRun 领域概念 |
| `TRN-FILE-001` | 项目参考图文件区 | 当前 `data/images/training/{project}/references/**` | 后台核心 | Profile/CharacterImage/Artifact | runtime paths | 保留为应用管理的项目媒体区：每个字节只存一个 Artifact，项目参考图库、SectionInput、Task 和 TrainingRunSample 只建立引用。设置与详情页向认证用户展示并允许复制本机/远程绝对路径 |
| `TRN-FILE-002` | Section 输入图片文件 | 当前另有 Generation task supplemental 目录 | 后台核心 | SectionInput/Artifact | runtime paths | 删除 supplemental 独立目录语义；Section 手动上传、项目参考图选择和历史结果引用统一由 Artifact/SectionInput 管理，界面显示实际本机/远程路径 |
| `TRN-FILE-003` | 训练素材生成输出 | 当前 output image、prompt、metadata 分散 | 后台核心 | TrainingImageResult/Artifact | image worker | 保留并统一到项目媒体区：生成图片只落盘一次并直接成为所属 Section 的 TrainingImage；Prompt/参数保存在 Task 快照，必要 provider metadata 存 Artifact/Task；向用户显示绝对路径 |
| `TRN-FILE-004` | Section 手动上传结果 | 当前另有 manual results 目录 | 后台核心 | TrainingImageResult/Artifact | upload service | 合并到与生成结果相同的项目媒体/Artifact 体系，不保留单独业务目录或 sourceType；手动上传与生成结果使用同一候选展示和路径展示 |
| `TRN-FILE-005` | TrainingRun 输入 manifest 与远程 staging | 当前每个 revision 的 manifest.jsonl | 后台核心 | TrainingRunSample、compute target | training executor | 启动 TrainingRun 时根据 Sample 生成 manifest，并把图片/Caption 准备到 GPU 机器临时训练工作区；Run 结束后可删除 staging，重试时重新准备。UI/API 显示并允许复制 manifest 与 staging 的本机/远程绝对路径 |
| `TRN-FILE-006` | Training checkpoint 输出与 ComfyUI LoRA 模型目录 | 当前训练 artifacts 与模型路径关系未形成明确合同 | 后台核心 | TrainingArtifact、模型文件管理、本机/远程路径 | training runner/model manager | 重构为强隔离：TrainingRun checkpoint 输出目录由训练模块拥有；ComfyUI LoRA 模型目录由模型模块拥有。唯一跨边界动作是用户触发单向文件复制，允许同一项目复制多个 checkpoint。归档删除训练输出目录中的全部模型文件，ComfyUI LoRA 模型目录永不联动删除；文档/UI/API 不使用 A/B 临时简称 |
| `TRN-FILE-007` | Artifact 生命周期 | 记录 role/path/hash/尺寸/lifecycle，但删除常不删文件 | 现用/不完整 | 大量孤儿风险 | TrainingArtifact/services | 保留并全面重构：只在同一个 TrainingProject 内让相同图片字节使用单份 Artifact/Blob，角色参考图、Section 输入、生成 Task 快照、生成结果和 TrainingRun 输入样本建立轻量引用；禁止覆盖已引用字节，引用归零后才能清理。按 SI-07 不做跨 TrainingProject 或跨模块的全局图片库、复用或 Hash 去重 |

---
