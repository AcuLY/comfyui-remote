# 新版最终口径

基础决策确认日期：2026-09-05；生产/训练命名与小节扩展边界于 2026-09-07 逐组更新，详见 [已确认补充](09-forward-compatibility.md)。新应用尚未实施，页面设计待用户逐页审核；本版不开发视频生成，也不确定视频实体、接口或组件名称。

## 已确认的新版本全局架构约束

- 2026-09-05 用户明确：系统当前没有投入使用。新版采用全新代码工程和一次性数据迁移；旧版仅数据与业务文件需要保留，旧代码、依赖、构建产物、兼容层和部署体系不作为新版基底。本文“现用/当前入口”等列是 2026-08-26 扫描时的实现证据，不代表目前有在线业务需要维持；实施边界以 MIG-01～MIG-08 为准。
- 新版本保留生产与训练两个完全对等的业务模块，技术标识为 `production` 与 `training`。本版生产功能只实现图片生成，训练功能只实现 LoRA 训练。
- 2026-09-05 技术选型确认：前端使用 React 19 + Vite + React Router，唯一主组件库为 PrimeReact v10 Styled（primereact 10.9.9，MIT，无需注册、license key 或续期）；后端使用 Fastify 5 + TypeScript + TypeBox，数据库使用 Drizzle ORM + better-sqlite3 + SQLite。具体约束见 CA-01～CA-14 和 TS-01～TS-08；这些是新版设计结论，不表示已完成依赖安装或运行时迁移。
- 页面路由使用 `/production/**` 与 `/training/**`，API 使用 `/api/production/**` 与 `/api/training/**`，模块目录使用 `modules/production/**` 与 `modules/training/**`。默认任务入口为 `/production/tasks`，有效导航记录仍按 IA-01 恢复。
- `ProductionProject` 与 `ProductionTemplate` 属于生产公共层；公共 `ProductionSection` 与 `ProductionTemplateSection` 保存小节身份、所属容器、文件夹、名称、类型和排序，允许未来容纳不同类型。本版分别一对一关联 `ProductionImageSection` 和 `ProductionTemplateImageSection` 保存图片配置；名称和排序不在图片配置层重复保存。前端仍操作一个逻辑小节，公共列表使用公共身份，参数编辑、任务和结果保持图片类型归属。
- 图片任务及执行尝试为 `ProductionImageTask`/`ProductionImageAttempt`，结果及文件资产为 `ProductionImageResult`/`ProductionImageArtifact`。项目任务入口统一查看并明确区分任务类型、状态和计数；不因共同项目或入口合并业务模型。
- 训练侧所有既有正式 `LoraTraining*` 实体统一简化为 `Training*`；这不扩大训练范围，也不改变训练数据与执行生命周期。
- 训练角色资料的 `productionPrompt` 已确认改名为 `imageProductionPrompt`，明确表示后续生图使用的角色 tag 提示词；领域定义、GET/PATCH、设计输入和迁移映射同步使用新名，内容与可空规则保持。
- 两个模块在产品信息架构、导航层级、前端组件能力、页面外壳、路由命名空间、后端领域模块、API 边界、数据访问层、测试和运维责任上都不得存在主次关系。
- 禁止让训练继续作为生产、Design Demo 或其他模块的 adapter、re-export、子路由或特殊兼容分支。
- 共享模型、设置、认证、媒体投递和全局反馈属于独立 shared 平台层，不归属任何一个业务模块。
- 生产与训练两个模块存在项目、运行、预制、模板、产物等共同概念，但已按 SI-01～SI-10 明确区分“真正共享资源”与“名称相同但生命周期不同的模块聚合”：不建立跨生产/训练的 shared Project、万能 Task、跨模块 Preset/Template 或全局图片库。生产模块内部的公共 Project/Template 不改变这一模块间边界；同一生产项目下的图片结果、文件资产与未来其他类型素材仍有明确身份和生命周期。
- 模型资源、认证、媒体投递、设置、通知和其他共同依赖必须由 shared 平台提供稳定接口；两个业务模块以对等消费者身份依赖它们。
- LoRA Training checkpoint 输出目录与模型模块管理的 ComfyUI LoRA 模型目录必须在文件路径和领域身份上彻底隔离。TrainingProject 只拥有训练输出目录中的 checkpoint；用户可将任意 checkpoint 单向复制到 ComfyUI LoRA 模型目录。复制后的模型是独立资源，不与 TrainingProject、TrainingRun、Checkpoint 或源文件建立外键、共享 Artifact 身份或反向同步。文档、API 和 UI 只使用实际领域名称，不采用 A/B 等临时简称。
- 新版明确假设整个应用只使用一个物理 GPU。shared 平台只维护一个可配置为本机或远程机器的 compute target 及全应用 GPU 占用事实；图像生产的 ComfyUI adapter 与 LoRA 训练 runner adapter 都使用该目标，而不是把训练从属于 ComfyUI。
- 当唯一 compute target 位于远程机器时，ComfyUI 与 LoRA 训练 runner 都在该远程目标执行；连接、文件路径和进程控制仍通过各自 adapter 处理，但不设计多 target、多 GPU 或并行 TrainingRun 调度。
- GPU 互斥以任务状态而不是进程状态判断：ComfyUI 空闲运行不占用调度权，也不要求在训练前停止；只有已提交到 ComfyUI 或正在运行的图像生产任务会阻止训练启动，未提交和已暂停任务不阻止训练。
- GPU 可用性在实际 compute target 上独立于 ComfyUI HTTP 状态检测。检测到 GPU 从可用变为不可用时停止新任务提交并持久化“ComfyUI 需要在 GPU 恢复后重启”；GPU 恢复后只执行一次受控 ComfyUI restart，健康检查通过才恢复调度，失败后停止自动尝试并提供手工重试。
- 图像生产任务必须使用统一状态机，至少区分“未提交到 ComfyUI”“已提交到 ComfyUI”“运行中”“已暂停”“已完成”“失败”和“已取消”。不得再用同一个 `queued` 同时表达应用内等待与 ComfyUI 队列等待；新版队列 UI、筛选、计数、恢复和调度全部以该状态机为准。
- 本版项目批量运行明确为“生成全部图片小节”。项目归档/删除及小节复制/删除由公共层协调对应类型的配置、结果与文件逻辑，本版只实现图片逻辑；图片重试、审核、彻底删除规则和 JPEG/ZIP 图片交付保持不变。
- LoRA 训练模块只保留“训练素材生成任务”和“LoRA 训练运行”两类可执行用户任务。角色分析、整段生图 Prompt 和 Caption 是 Agent/用户直接维护的普通领域内容，不建模为排队执行的生文任务；训练输入预览及启动时生成输入快照也不得冒充独立用户任务。
- 优先通过统一领域状态、实体或交互模型消除特殊分支。后续核对中若发现与“缓冲队列其实是未提交状态”类似的可统一点，需主动提出优化及影响，再纳入设计决策。
- 设置采用“shared 设置与运维中心 + 两个对等模块各自设置”的所有权模型；shared 入口不能吞并模块业务配置，两个模块的设置入口和能力层级必须对称。
- 监控与日志属于 shared 平台的一等模块，但只服务当前状态确认和错误定位：统一收集应用、图像生产、LoRA 训练、任务、数据库、存储和外部依赖的结构化事件，并记录单次慢页面/慢请求与各类任务阶段耗时；不建设趋势、聚合性能指标、实时流或完整可观测性平台。
- 设置所有权及具体设置项已按 A1～A6 逐项核对，采用 SH、CT、IP、IC、EX、TG、LE 编号的最终结论；早期示例不自动授权新增设置。
- 监控只解决当前状态是否准确、任务是否积压、单次页面/请求/任务慢在哪里、错误能否定位和操作是否可恢复，不建设完整可观测性平台；p50/p95/p99、吞吐趋势、资源利用率趋势、恢复时间线、复杂指标和长期分析只有用户另行确认后才进入范围。
- 应建立中性的应用根外壳与共享组件协议；两个业务模块以同等能力的 module shell 组合这些协议，而不是一方复用另一方的具体实现。
- 当前散落的 Generation 路由与 `/training/**` catch-all 都需要在新路由设计中改为对称、可辨认的模块命名空间。
- 用户反馈当前讨论组时，未评论项按展示的建议确认，有评论项按用户修订处理；先同步相关文档和设计输入，再继续下一组，尚未逐组讨论的建议保持待定。当前文件目录已按 FC-13/14 确认；视频具体名称、文件交接方式和执行基础设施扩展仍待后续讨论。

## 最新决策优先表

| 范围 | 最终采用 | 已被替代 |
| --- | --- | --- |
| 建设路线 | 全新工程，仅迁移数据与业务文件 | 维持旧版在线、逐页替换、旧新双写与兼容层 |
| 技术栈 | React 19、Vite、React Router；Fastify 5、TypeScript、TypeBox；Drizzle、better-sqlite3、SQLite | Next.js、RSC、Server Action、Prisma、PostgreSQL |
| 组件 | PrimeReact 10.9.9 Styled 与 PrimeIcons 7.0.0，MIT 无 key | Mantine 主选、PrimeReact v11、收费/需注册/续期组件方案 |
| 样式 | 现成组件优先，主题和样式配置模块化集中复用；允许 CSS-in-JS | Tailwind、PrimeFlex、逐页 style 特例、同类基础组件重复开发 |
| 视觉 | 总体参考 Demo 气质，图像生产青绿、LoRA 训练品红/粉；标准语义状态色 | 逐像素复制 Demo、蓝紫模块色、将 Demo 交互当作强制规范 |
| 主题 | 默认实时跟随系统；手动覆盖与明确重置 | 默认深色/深色优先 |
| 认证 | 浏览器页面、API 和资源用 Cookie；Agent/执行器跨网络用 Bearer | 无鉴权 API、x-api-token/x-auth-token、模块专属 Token |
| 模块 | `production` 与 `training` 完全对等；本版分别实现图片生成与 LoRA 训练 | `image-production`/`lora-training` 技术前缀、MCP、专用 Agent 写接口、/api/shared 命名空间 |
| 生产组织 | 公共 ProductionProject/ProductionTemplate 与小节组织；图片小节拥有专属配置、任务和结果 | 为图片和未来视频分别建立生产项目体系、把所有小节参数混成一个业务模型 |
| 图像生产任务 | ProductionImageTask + ProductionImageAttempt；ComfyUI 自有队列可接收多个图片任务；全有或全无输出 | 单任务提交上限、缓冲队列实体、失败重试新建 Task |
| 训练素材任务 | Section 固定编辑；多次单图调用形成候选；成功候选保留，失败补缺 | 通用生文任务、SectionRun、reviewStatus、重试丢弃成功候选 |
| 训练输入 | Section 唯一代表图 + Section Caption；启动 Run 时保存 Sample | DatasetVersion/Revision、Freeze/冻结、Preview 领域实体 |
| 模型输出 | 训练 checkpoint 与 ComfyUI 模型文件分离，用户单向复制后独立 | 唯一最终 LoRA、源项目外键、归档级联删除已复制模型 |
| 归档 | 永久只读；训练保留足够输入/文本/记录，删除训练模型与临时文件 | 恢复为 active、归档清空 Section/Caption、额外归档 Prompt 快照 |
| 修改历史 | shared RevisionEntry 单快照，模块恢复，数量/时间不设上限 | 四套独立历史表、50 条上限、双份 before/after |
| 模型管理 | 扫描 ComfyUI models；移动、置顶、缺失记录清理/显式替换 | 浏览器模型上传、应用内模型文件删除、刷新算全量模型 Hash |
| 页面实施 | Figma 页面审核通过后进入该页面正式前端实施 | 先实现页面后补画设计、把未审核设计当已确认 |

## 使用这套文档

功能保留表示新版提供等价业务能力，不要求沿用旧函数、表名或旧 UI。全量功能矩阵仍保留“当前入口/依赖”以便对照数据，不作为新版技术依赖。既有根 DESIGN/ARCHITECTURE 描述旧实现，新版目标由本变更目录拥有。

## 仍需在具体设计时收口的细节

这些不重新打开已确认的功能去留，设计/实施时应先给出具体处理并记录：

- 训练素材 Task 删除与被 Section、参考图、其他输入或 RunSample 引用的候选之间的处置。必须遵守已确认引用保护，不能套用图像生产的全部字节删除规则。
- PrimeReact v10 的图片缩放、跨区域多选拖放、复杂列表能力按页面实际需要核对；确有缺口再组合或补充。
- 数据映射中的真实缺失/冲突项在只读数据盘点后列出，不能伪造快照或静默遗漏。
- 本轮前向兼容讨论的剩余事项与当前不实施范围见 [待确认清单](09-forward-compatibility.md#本版排除与尚未确认事项)；未确认建议不进入正式定义。
