# 图像生产功能清单

本文件记录本轮对话已确认的新版目标，尚不代表运行代码已实现。编号保留原清单 ID；冲突时采用最新用户决策及 [最终口径](00-final-decisions.md)，旧实现列仅供数据转换核对。生产公共层与图片专属能力的最新边界见 [向前兼容补充决策](09-forward-compatibility.md)。

新版模块为 `production`；Project、Template、小节文件夹、列表与排序属于生产公共层，项目与模板允许未来组织不同类型小节。本文件中的图片参数、运行、审核、打码、回收站和导出规则只适用于本版图片能力，不作为其他小节类型的共同要求。正式实体名按领域模型使用 ProductionProject、ProductionTemplate、ProductionImageSection、ProductionImageTask、ProductionImageAttempt、ProductionImageResult 等；后文在图片上下文中保留 Project、Section、Task、Attempt、Preset 等简称。前端保留统一项目页面与小节列表，图片编辑器及图片结果视图按类型接入；本版只呈现图片小节，不开发视频功能，也不确定视频模型名称。

## B. Generation 生图模式

### B1. 运行、队列与审核

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-RUN-001` | 运行总览 | `/queue` 汇总待审核、运行中、打码、失败、回收站五个 Tab | 现用 | Run、ImageResult、CensoringTask、TrashRecord | queue page/client | 保留统一的生产任务入口，任务、状态和计数按类型区分，本版只接入图片生成与已有图片后处理任务。图片任务主视图按统一状态机分类，清晰区分未提交、已提交、运行中、已暂停、已完成、失败和已取消；活动任务显示当前已用时间，终态任务显示总耗时，并可展开查看应用内等待、ComfyUI 队列、实际生成、暂停和各 Attempt 耗时。同时改善最近成功/失败浏览、上下文跳转和重试流程，审核与打码作为后处理维度而非混入执行状态 |
| `GEN-RUN-002` | 队列分页与自动刷新 | 分页读取，运行状态下每 5 秒刷新 | 现用 | `/api/queue-data`；GET 会触发 stale recovery | queue client、queue-data route | 移除为产品功能：前端不提供手工刷新或固定轮询；任务子系统在存在 submitted/running 任务时每 1 秒执行一次 HTTP queue/history 权威对账，WebSocket 只补充即时进度事件，页面消费本应用最新状态。读取接口不得顺带执行恢复等写操作 |
| `GEN-RUN-003` | 失败运行查看与重试 | 展示错误、重新提交失败运行 | 现用 | Run 已保存的 prompt/config snapshot | queue failed UI、run lifecycle | 保留并重做：失败重试直接复用同一任务及其不可变输入快照，保留旧 Attempt，清除任务当前执行字段并回到 `unsubmitted`；下一次实际提交时再创建新 Attempt。原 `comfyPromptId`、错误和时间保留在旧 Attempt 中，不使用 `retryOfTaskId` / `resolvedByTaskId`。失败列表只显示当前状态仍为 `failed` 的任务，因此重试后立即退出失败列表，不堆积重复任务历史。失败和已取消任务支持按选择、项目或时间范围物理清理 |
| `GEN-RUN-004` | 单运行取消 | 取消 queued/running/paused run，并尝试取消 ComfyUI prompt | 现用/高副作用 | DB + ComfyUI 队列 | cancel route、run-lifecycle | 保留并重构：未提交任务在本应用内取消；已提交任务精确删除对应 prompt；运行中任务经确认后中断。只有外部执行器确认停止后才转为 `cancelled`，取消失败时保留权威原状态并展示原因 |
| `GEN-RUN-005` | 单运行暂停/恢复 | 暂停时取消 Comfy prompt；恢复时重提交并轮询 | 现用/高副作用 | DB + ComfyUI | run-lifecycle | 保留并重构：`paused` 纳入状态机。未提交任务可直接暂停；已提交/运行中任务必须先从 ComfyUI 精确撤销或中断，确认释放 GPU 后暂停。ComfyUI 不支持从生成中间进度续跑，因此恢复统一回到 `unsubmitted` 并从头执行；暂停任务不阻止 LoRA 训练 |
| `GEN-RUN-006` | 活动运行批量暂停/部署批次恢复 | 暂停全部活动项；恢复只处理由 `pause-active` 标记的暂停批次，并可限定 batchId/runIds，不恢复普通手工暂停项 | 现用/运维 | 部署流程依赖精确来源标记 | queue pause/resume routes | 不进入新版产品功能或正式领域 API；以后整理部署流程时基于新版任务状态重新设计必要的内部维护动作，不保留当前 batchId/pause-active 实现 |
| `GEN-RUN-007` | 清空活动队列 | 流式报告取消进度，取消 Manager 与 ComfyUI 活动任务 | 现用/高副作用 | queue-control stream | 保留能力但取消“清空队列”模型：每个状态可独立查询、选择和执行适用的批量操作；任务工作台支持按时间排序、按项目分组及在这些视图中多选。相关交互由新版任务工作台重新设计，不依赖或保留 Design Demo 实现 |
| `GEN-RUN-008` | 清除终态运行及输出 | 先删除每个 Run 的受管输出目录，再删除 Run 并级联 ImageResult 等关联记录 | 现用/破坏性 | DB + 受管文件目录 | clear route、run-lifecycle | 保留并简化：终态任务默认永久保留、不自动过期，用户可按状态、项目、Section 和时间筛选后手动批量删除。删除任务只有一种语义：物理删除任务、全部 Attempt、全部 ProductionImageResult、缩略图和受管图片字节，不提供“仅删记录并保留输出”。领域模型不支持“部分成功”；一次执行只有全部完成或失败，失败过程中产生的临时文件由执行器清理，不作为可管理结果保留 |
| `GEN-RUN-009` | 简化队列读取 API | `/api/queue` 返回简化队列；页面主要不用 | 隐藏/兼容 | 外部客户端可能依赖 | queue route | 新版移除 `/api/queue`；前端和跨网络 Agent 统一使用 `/api/production/tasks` |
| `GEN-REV-001` | Run 审核组 | `/queue/[runId]` 展示一次 run 的全部图片 | 现用 | Run、ImageResult、受管图片 | queue run page | 保留并重做：作为某次图像生产任务结果的筛选视图，图片仍归属项目和 Section；任务、项目和 Section 入口复用生产模块自己的审核能力，不与 LoRA 训练的候选选择流程合并 |
| `GEN-REV-002` | 图片灯箱 | 大图预览、上一/下一张、键盘导航 | 现用 | 图片 route | review lightbox components | 保留并按模块分别设计：图像生产灯箱支持前后切换、键盘导航、保留、丢弃、P站、预览和封面操作；LoRA 训练灯箱围绕代表训练素材选择与参考图使用设计，不出现生产模块的发布动作。两者只复用图片展示、缩放和导航等中性基础组件 |
| `GEN-REV-003` | 选择与批量审核 | 单选、全选、批量 keep/trash | 现用 | ImageResult.reviewStatus | review mutations | 保留并简化：活动图片只有“未审核、已保留”两种审核状态；丢弃由 ProductionImageTrashEntry 生命周期表达，不再同时保存 `trashed` 审核状态。多选状态只属于当前 UI 会话，不持久化；批量操作支持当前任务、当前 Section 和当前筛选结果范围 |
| `GEN-REV-004` | 删除剩余图片 | 保留已选后批量删除其他待审图片 | 现用 | DB + 文件移动到 trash | review UI/actions | 保留，操作名称为“删除剩余”：保留当前已选图片，将当前任务其余未审核图片移入回收站；执行前显示保留数和删除数 |
| `GEN-REV-005` | 撤销删除 | 将 TrashRecord 对应文件移回原路径 | 现用 | TrashRecord、文件移动 | restore actions | 保留即时撤销；即时入口消失后仍可从当前 Section、当前项目或全局回收站恢复 |
| `GEN-REV-006` | 审核组连续导航 | 上一/下一审核组、完成后自动跳转、快捷键 | 现用 | Review group repository | queue detail client | 保留上一组、下一组和快捷键；完成当前任务审核后自动进入下一个仍有未审核图片的图像生产任务 |
| `GEN-REV-007` | 从审核页重跑 | 按当前小节配置重新运行，只从旧 executionMeta 取默认 batch | 现用 | 当前 Section 配置，不是旧 Run 不可变快照 | review actions | 保留并澄清：失败任务按原不可变快照重试时复用同一任务并回到 `unsubmitted`，实际再次提交时创建新 Attempt；从审核页按当前 Section 输入和参数再次生成时创建新任务。UI 分别命名为“重试本任务”和“按当前小节再次生成”，避免混淆 |
| `GEN-IMG-001` | “P站”标记 | 设置/取消 `featured`，并自动 keep | 现用 | ImageResult.featured | featured route | 保留名称和功能：与“预览”“封面”同为图像生产项目一次打包发布所使用的图片用途；可多选，设置后自动将图片标为已保留。新版所有用户界面和文档统一写作“P站” |
| `GEN-IMG-002` | “预览”标记 | 设置/取消 `featured2`，并自动 keep | 现用 | ImageResult.featured2 | featured2 route | 保留名称和功能：与“P站”“封面”同为图像生产项目一次打包发布所使用的图片用途；可多选，设置后自动将图片标为已保留 |
| `GEN-IMG-003` | 项目封面 | 设置项目唯一封面并自动 keep | 现用 | Project.coverImageId | cover route | 保留并重新定位：不是普通项目装饰，而是与“P站”“预览”并列的打包发布用途；每个项目只能选择一张封面，设置后自动保留。封面图片移入回收站时清空引用，恢复图片后不自动重新设为封面 |
| `GEN-TRASH-001` | 全局回收站列表 | `/queue` 回收站 Tab 分页显示已删除图片 | 现用 | TrashRecord | queue trash tab | 保留并重做：既有全局回收站之外，项目和 Section 内也提供各自范围的回收站入口、筛选、批量恢复和永久删除；ProductionImageTrashEntry 保留 `projectId`、`sectionId`、来源任务和结果上下文，支持按时间排序及按项目/Section 分组 |
| `GEN-TRASH-002` | 回收站恢复 | 标记 TrashRecord 已恢复，将既有 ImageResult 重置为 pending 并恢复原路径；文件移动失败不阻断 DB 更新，可能留下 DB/文件不一致 | 现用/尽力而为 | DB + 文件系统 | image-review actions | 保留并重做：单项或批量恢复都回到原项目和原 Section；文件恢复与数据库状态更新必须作为同一个受控操作，文件恢复失败时不得把数据库标成已恢复，并明确报告失败项 |
| `GEN-TRASH-003` | 永久清空回收站 | 重置引用图片的项目封面，删除 TrashRecord 与 ImageResult，再尽力删除 trash、原图和缩略图文件 | 现用/破坏性 | DB + `data/images/.trash/**` | clearTrash | 保留并重做：支持全局、项目和 Section 范围永久清空；删除 ProductionImageTrashEntry、ProductionImageResult、原图/缩略图并清理项目封面等引用。任何失败都报告具体未清理项，不再静默尽力而为；任务历史删除与图片回收站始终是两个独立概念 |

### B2. 项目、文件夹与小节

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-PROJ-001` | 项目列表 | `/projects` 展示活跃项目、状态、最近结果 | 现用 | Project、Run、ImageResult | projects page/repository | 保留并重做：展示项目名称、文件夹、最近结果、活动任务数和待审核图片数，不暴露 worker 等实现状态；项目不再复制任务运行状态，只展示由任务和结果即时汇总的活动信息 |
| `GEN-PROJ-002` | 项目 UI 范围筛选 | 页面处理文件夹浏览与“显示归档”；没有标题/status/pending 搜索控件 | 现用 | Project query | projects page/repository | 保留并补齐普通 UI：支持名称搜索、文件夹范围、正常/归档、是否有活动任务和是否有待审核图片；页面与正式 HTTP API 使用同一查询语义 |
| `GEN-PROJ-003` | 项目文件夹 | 新建、重命名、删除、排序、进入文件夹 | 现用 | ProjectFolder | project-folder service | 保留多级文件夹、新建、改名、排序和导航。删除非空文件夹必须弹出模态框并列明包含的子文件夹和项目数量，只允许“删除整个文件夹及其中全部项目”或取消；不提供删除时移动/保留内容的功能 |
| `GEN-PROJ-004` | 项目移动与批量移动 | 单项目或多选移动到文件夹/根 | 现用 | Project.folderId | project folder actions/API | 保留并重做交互：项目元素可直接拖入目标文件夹，拖动时显示有效落点；多选后拖动可一次移动全部已选项目。为键盘、触屏和精确选择保留“移动到”菜单作为同一能力的备用入口 |
| `GEN-PROJ-005` | 统一项目创建入口 | 当前 `/projects/new` 主要按空白参数/项目级预制创建 | 现用 | Project、ProjectTemplate、bindings | project form/service | 保留并重做：图像生产也只提供一个新建项目入口；表单内可选 ProductionTemplate，选择后预填可编辑元信息/默认参数，提交时深复制模板 Sections、Bindings、CustomText 和参数。未选模板则创建空白项目，与 LoRA 训练采用相同创建心智。创建表单正式提供必填“英文标识（slug）”，与可含中文的项目名称分离；只允许小写英文字母、数字和连字符并校验全局唯一，模板不得复制另一个项目的 slug |
| `GEN-PROJ-006` | 从已有项目创建 | `/projects/new/from-existing` 复制结构并重新选择 checkpoint/预制 | 现用 | 源项目及所有 sections | createProjectFromExisting | 新版移除：暂不保留“从已有项目创建”，删除独立页面、表单分支、服务写路径和相关兼容入口；统一新建项目只支持空白项目或可选 ProductionTemplate |
| `GEN-PROJ-007` | 直接复制项目 API | 复制完整项目；当前项目卡片无复制按钮，仅 action/API 可达 | 隐藏/API-only | Project/Section/bindings | copyProject | 新版移除：删除原样复制项目的 action、HTTP API、服务/仓储写路径和相关兼容入口；若以后出现明确的一键副本需求，再按新版领域模型重新设计，不保留当前隐藏实现 |
| `GEN-PROJ-008` | 项目编辑 | `/projects/[id]/edit` 修改标题、默认尺寸、批次、checkpoint 等 | 现用 | Project | project edit form | 保留：项目中的图片默认参数只作为新 ProductionImageSection 的默认值；修改默认值不暗中覆盖既有图片小节，也不改变历史任务快照，不把图片参数作为未来其他小节类型的公共配置。编辑页允许修改“英文标识（slug）”并执行格式/唯一性校验；它用于 ZIP 和包内普通图片文件名。导出外层文件夹使用项目名称，不由 slug 替代 |
| `GEN-PROJ-009` | 参数应用到全部小节 | 将单个项目参数批量写入全部 sections | 现用 | ProjectSection | apply-param route | 保留为显式批量操作：用户选择要覆盖的图片字段后应用到全部图片小节，不使用“保存项目时顺带同步”的隐式行为，也不跨类型覆盖参数 |
| `GEN-PROJ-010` | 项目详情 | `/projects/[id]` 汇总 sections、运行、结果和项目动作 | 现用 | Project detail view | project detail page | 保留统一 ProductionProject 页面、小节列表和项目操作；小节与任务按类型识别，编辑器和结果界面由对应类型负责。本版汇总图片小节、近期图片任务和图片结果，具体布局在前端设计阶段单独确定 |
| `GEN-SEC-001` | 小节新增 | 在项目内创建普通 section | 现用 | ProjectSection | addSection/API | 本版新增一个图片小节时，在同一领域操作中创建图片类型的 ProductionSection 和一对一 ProductionImageSection；公共记录保存组织字段，专属配置从项目当前图片默认参数初始化，创建后独立编辑。前端仍是一次新增小节操作，不提供尚未实现的类型入口 |
| `GEN-SEC-002` | 小节复制 | 复制 section 参数、bindings、blocks、LoRA，并插入源后 | 现用 | Section 子表 | copySection | 公共组织层复制 ProductionSection 并将副本插入来源小节之后，对应类型复制一对一专属配置。本版同时复制 ProductionImageSection 的参数、Prompt Segment、Preset Binding 和 LoRA，保持新逻辑小节的完整关联；不复制任务、结果、回收站或变更历史 |
| `GEN-SEC-003` | 小节删除 | 删除单个 section 及关联运行/资源 | 现用/破坏性 | DB + 可能的运行/图片 | deleteSection | 公共层协调 ProductionSection 与一对一专属配置的整体删除，各类型负责自己的结果和文件。本版保留图片删除语义：单个与批量删除使用同一领域操作；存在非终态任务时阻止删除并要求先取消。确认删除后物理清理公共小节、ProductionImageSection、终态图片任务、图片结果和受管文件 |
| `GEN-SEC-004` | 小节批量删除 | 多选删除、服务端阻塞检查 | 现用/破坏性 | 多 section 及关联资源 | batch-delete route | 保留并并入统一 Section 删除能力：多选后一次确认，服务端按同一规则检查非终态任务并返回无法删除的具体 Section，不维护另一套删除语义 |
| `GEN-SEC-005` | 清空全部小节 | 预览后删除项目所有 sections | 现用/高风险 | 项目全部 section 数据 | clearAllSections | 新版移除：“全选后批量删除”已经覆盖相同需求，删除独立按钮、action/API 和专用写路径 |
| `GEN-SEC-006` | 小节排序 | 拖拽持久化 section 顺序 | 现用 | sortOrder | reorderSections | 保留：以拖放为主要交互，项目及文件夹内的小节顺序只保存于 ProductionSection，ProductionImageSection 不保存另一份排序。模板顺序同理由 ProductionTemplateSection 负责；本版列表只包含图片类型 |
| `GEN-SEC-007` | 小节文件夹 | 新建、改名、删除、排序、移动 sections | 现用 | ProjectSectionFolder | section-folder actions | 保留公共 ProductionSectionFolder 多级文件夹并重做交互：支持直接将小节或多选小节拖入文件夹，组织结构允许未来包含不同类型。删除非空文件夹时弹出模态框，只允许连同全部子文件夹和小节删除或取消；公共层按类型协调清理，本版只执行图片小节逻辑，不提供删除时移动/保留内容的功能 |
| `GEN-SEC-008` | 紧凑/展开视图 | 项目详情切换卡片密度与展开状态 | 现用/UI | 浏览器状态 | section cards | 保留为纯界面偏好，不进入领域模型；项目和页面之间切换后恢复用户最后使用的视图 |
| `GEN-SEC-009` | 批量创建小节 | `/batch-create` 搜索预制/组，构建导入队列并连续创建 | 现用 | Preset/Group/Section | batch-create client | 新版移除：该功能实际没有被使用，删除独立页面、客户端状态、专用 action/API 和兼容入口；普通新增、复制和模板导入覆盖新版需要的创建方式 |
| `GEN-SEC-010` | 批量创建覆盖同分类 | 导入时替换已有同分类绑定 | 现用 | Category/bindings | batch create logic | 新版移除：它只是旧批量创建页中的“覆盖添加”按钮——选择一个 Preset/Group 时先从临时导入列表删除同分类项，再保留当前选择；不是独立领域能力，也没有单独持久化。随 `GEN-SEC-009` 一并删除 |
| `GEN-SEC-011` | 从模板创建小节 | 选择模板 section 复制进项目 | 清单误判/无真实功能 | 实际未读取 ProjectTemplateSection | 名为 create-from-template 的 route/action | 纠正清单并移除误导实现：当前没有“选择一个模板 Section 复制进项目”的产品入口。`createSectionFromTemplate` 只是旧批量创建页的普通建节助手，不读取 Template；`create-from-template` API 的 `sectionId` 参数也未使用。随批量创建功能删除该误命名函数和无效路由，不把它迁移到新版 |
| `GEN-SEC-012` | 导入整套模板 | 将模板的 sections/folders/bindings 导入项目 | 现用 | ProjectTemplate 全树 | template import | 保留：允许向已有项目追加模板中的全部文件夹和 Section，不覆盖已有内容；导入后项目数据与模板独立，Preset Binding 继续保持绑定 |
| `GEN-SEC-013` | 整项目运行 | 对所有 enabled sections 入队 | 现用 | Run、ComfyUI | runProject | 保留并明确为“生成全部图片小节”，移除 `enabled` 语义：新版图片小节不再有“启用/停用”字段；选择项目内全部未删除且类型为图片的 ProductionSection，读取一对一 ProductionImageSection 配置，分别创建 `unsubmitted` ProductionImageTask。ComfyUI 不可达或 LoRA 训练占用 GPU 时由图片任务状态机等待，未来其他类型是否参加项目批量运行另行设计 |
| `GEN-SEC-014` | 指定小节运行 | 运行单个或选择的一组 sections | 现用 | Run、ComfyUI | runSection/runSections | 本版保留单个和多选图片小节运行；按当前 ProductionImageSection 参数分别创建 ProductionImageTask 不可变快照并进入 `unsubmitted`，不依赖小节启用状态，不向其他类型隐式应用图片运行规则 |
| `GEN-PROJ-015` | 外部项目搜索与状态筛选 | Service/Agent/MCP 支持 title、status、hasPending；普通项目页无对应控件 | 隐藏/外部自动化 | Project query | listProjects、Agent/MCP | 保留查询能力并统一到正式项目列表 HTTP API 和普通 UI；删除随 MCP 模块存在的重复入口，不再维护仅外部可用的另一套筛选语义 |
| `GEN-PROJ-016` | 参考项目同步角色变体 | 项目详情可选择来源项目/文件夹，Dry Run、抽查后 Apply，同步 role preset variants | 现用/深层入口 | 两个项目的 section role bindings | SyncPresetVariantFlowDialog、agent flow API | 保留但大幅简化为一次“同步变体分配”：在目标项目选择来源项目和 Preset 分类，系统按 Section 名称精确匹配，在同一个模态框列出将要改变的 Section→Variant 及未匹配数量，用户确认后直接应用。删除来源文件夹筛选、独立 Dry Run、抽查步骤、分阶段 Apply 和专用 Agent flow；持续 Preset Binding 仍只负责内容更新，不能替代该分配复制能力 |

### B3. 小节编辑、提示词、预制绑定与 LoRA

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-EDIT-001` | 小节名称与相邻导航 | 改名、上一/下一 section、快捷键 | 现用 | ProjectSection | section page | 保留改名、上一/下一 Section 和快捷键 |
| `GEN-EDIT-002` | 图像尺寸与批次 | aspect ratios、短边、batchSize、upscale | 现用 | ProjectSection params | section params form | 保留画幅、多个输出比例、短边尺寸、一次生成数量和放大倍数；具体字段布局在前端设计阶段逐项确定 |
| `GEN-EDIT-003` | Checkpoint 与 workflow | section 或项目默认 checkpoint、workflow 参数 | 现用 | 模型文件、workflow config | section editor | 保留 Checkpoint 的项目默认值和 Section 覆盖，并从 shared 模型管理模块选择。Workflow 不作为每个 Section 的选择字段，由图像生产模块设置当前 Workflow；Section 保存参与解析的业务参数。同时保留下载当前 Section 解析后 Workflow 和历史任务实际提交 Workflow 的能力 |
| `GEN-EDIT-004` | 两阶段 KSampler | KSampler1/2 参数、是否启用第二阶段 | 现用 | resolved config snapshot | section params | 保留两阶段能力和“是否使用第二阶段”；详细采样参数放入高级区域但允许完整编辑 |
| `GEN-EDIT-005` | Seed 策略 | random/fixed/increment 等两阶段策略 | 现用 | run payload | section params | 保留随机、固定和递增策略，用于复现结果或批量生成不同结果 |
| `GEN-EDIT-006` | 最近结果预览 | 编辑页显示近期运行与结果 | 现用 | Run/ImageResult | section edit page service | 保留：编辑 Section 时直接查看近期任务和图片，并可进入完整结果页 |
| `GEN-EDIT-007` | 小节变更历史 | 展示参数、提示词、LoRA 等维度的变更记录 | 现用/深层入口 | SectionChangeLog | section-change-history UI/service | 保留并迁移到 RV-01～RV-10：Section 的 Prompt、LoRA 和生成参数分别作为明确 scope 接入 shared 修改历史协议，由 production adapter 校验和恢复；删除专属 SectionChangeLog 模型和服务 |
| `GEN-PROMPT-001` | 自定义提示词块 CRUD | 正/负文本、label、新增/编辑/删除 | 现用 | SectionPromptBlock | prompt-block service | 保留并迁移为 `CustomText` Segment：包含普通正向文本、负向文本和可选名称；名称只用于界面识别，不参与 Prompt 编译 |
| `GEN-PROMPT-002` | 提示词块排序 | 拖拽顺序并影响最终 prompt | 现用 | sortOrder | reorder blocks | 保留拖放排序；最终正向和负向 Prompt 严格按当前 Segment 顺序解析 |
| `GEN-PROMPT-003` | 导入预制 | 把 preset variant 作为绑定导入 section | 现用 | SectionPresetBinding | importPresetToSection | 保留并迁移为持续 `PresetBinding` Segment，不复制预制文本；Preset 更新影响仍绑定的 Section，任务保存当时的解析快照 |
| `GEN-PROMPT-004` | 导入预制组 | 一个 group binding 解析为多个成员块 | 现用/复杂 | PresetGroup、成员/category order | importPresetGroup | 保留并明确 Group 为多个 Preset 的有序组合：绑定 Group 后，Section 中仍生成并展示多个彼此独立的 PresetBinding Segment，每个成员保留自己的 Preset、Variant、顺序和解析结果；Group Binding 只保存组合来源、成员关系与整组操作身份，不融合成员内容。Group 成员变化继续同步到仍绑定的 Section |
| `GEN-PROMPT-005` | 切换绑定变体 | 保持绑定身份，仅切换 variant | 现用 | PresetVariant | switchBindingVariant | 保留：在同一 Binding 上切换 Variant，不改变 Segment 身份和排序 |
| `GEN-PROMPT-006` | 独立编辑预制内容 | 编辑绑定来源内容时自动 detach，避免后续同步覆盖 | 现用/复杂 | binding provenance | prompt-block service | 保留明确的“转为自定义文本”操作：把当前解析结果转换为 `CustomText`，此后不再跟随 Preset 更新；普通编辑不得暗中 detach |
| `GEN-PROMPT-007` | 独立/级联移除 | 移除单个导入或整个 group binding | 现用/复杂 | 绑定键与组成员 | removeImportedPreset | 保留两种明确操作：可只从当前 Section 移除 Group 中某个 PresetBinding 成员，也可移除该 Group Binding 带来的全部成员；两者都不删除预制库中的 Preset 或 Group。单独移除的成员在当前 Section 记录为该 Group 的排除项，后续 Group 同步不得自动加回；若要保留某成员当前解析文字，应先“转为自定义文本”再解除 Binding |
| `GEN-LORA-001` | LoRA1 / LoRA2 分区 | 两阶段 LoRA 列表与权重 | 现用 | SectionManualLoraEntry、Preset Lora | section LoRA editor | 保留两个阶段的独立 LoRA 列表并与两阶段 KSampler 对应；界面使用“第一阶段 LoRA、第二阶段 LoRA”。关闭第二阶段时隐藏第二阶段列表但不删除配置 |
| `GEN-LORA-002` | 手动添加 LoRA | 从模型选择器加入路径、权重、启用状态 | 现用 | 模型文件与 LoraAsset | section-lora service | 保留：从 shared 模型管理模块选择已登记 LoRA，显示其本机或远程真实路径，并设置权重和是否启用；不允许手工填写任意路径 |
| `GEN-LORA-003` | LoRA 排序 | 拖拽决定应用顺序 | 现用 | sortOrder | LoRA editor | 保留各阶段内拖放排序，解析和注入 Workflow 时使用该顺序 |
| `GEN-LORA-004` | Trigger words 查看 | 从 LoraAsset 元数据展示触发词 | 现用 | LoraAsset.triggerWords | LoRA editor | 保留查看和复制；内容来自 shared 模型元数据，不在 Section 内维护另一份 |
| `GEN-LORA-005` | 继承、分离与抑制 | 区分 preset LoRA、manual LoRA、detached tombstone | 现用/高复杂 | bindingKey、detachedFromBinding | resolvers/services | 保留必要能力并简化界面：Preset 提供的 LoRA 显示来源，可选择“仅在本小节停用”或“转为手动项后编辑”；手动 LoRA 可直接编辑、排序和删除。内部保存 Section 级停用关系，但 UI 不暴露 tombstone 等实现术语 |

### B4. 结果、打码、导出与生命周期

项目导出在本版明确指图片交付包，继续使用既有 JPEG、ZIP、P站、预览与封面规则。归档和删除由生产公共层协调，各类小节负责配置、结果和文件的处理；下表仅规定本版图片能力的具体行为，不预先定义未来其他类型的生命周期。

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-RESULT-001` | 小节结果页 | `/projects/[id]/sections/[id]/results` 按 Run 展示 | 现用 | Run/ImageResult | section results | 保留：按任务分组展示当前 Section 的全部结果，任务默认按时间倒序；可展开查看任务参数、Attempt 和图片 |
| `GEN-RESULT-002` | 跨小节连续审核 | 完成当前 section 后导航下一 pending section | 现用 | Section pending counts | results client | 保留：完成当前 Section 后进入下一个仍有未审核图片的 Section；与已确认的生产审核导航共用同一实现 |
| `GEN-RESULT-003` | 临时批次重跑 | 从结果页以临时 batch 覆盖重新运行 | 现用 | enqueue overrideBatchSize | results actions | 保留为本次任务覆盖：从结果页“按当前小节再次生成”时允许临时修改本次生成数量，不修改 Section 默认值；新任务保存实际数量快照 |
| `GEN-RESULT-004` | 项目结果汇总 | `/projects/[id]/results` 汇总全部 sections | 现用 | Project/Run/ImageResult | project results | 保留为项目图片结果汇总：只汇总项目全部 ProductionImageSection 的 ProductionImageResult，支持按图片小节分组或按时间浏览，并可跳回来源图片小节和任务；不把未来其他类型的素材或结果混入图片结果集合 |
| `GEN-RESULT-005` | 结果筛选 | 全部、P站、预览、封面筛选 | 现用 | featured flags | project results client | 保留“全部、P站、预览、封面”四类筛选；不扩展成通用标签系统 |
| `GEN-RESULT-006` | 删除项目全部图片 | 项目结果页批量移入回收站 | 现用/破坏性 | 全部 ImageResult 与文件 | trashProjectImages | 保留并重做：项目或 Section 范围批量丢弃结果时统一进入图片回收站，并保留原项目、Section、任务和结果上下文；不与任务历史清理合并 |
| `GEN-CENSOR-001` | 手工快速打码 | 单图画布手工绘制并持久化打码图片 | 现用 | 原图/censored 文件 | quick-censor canvas | 保留：用户在单图画布绘制打码区域并保存独立打码版本，原图不被覆盖 |
| `GEN-CENSOR-002` | Python 自动打码 | YOLO + OpenCV mosaic 自动处理 | 现用/外部依赖 | Python、模型文件、图片 | auto-censor runner | 保留 YOLO 与 OpenCV 自动打码，但只提供单图自动打码和 `GEN-CENSOR-003` 的精选图片批量打码；Python、Ultralytics、OpenCV、Pillow 作为应用随附依赖，不要求用户配置解释器。仅在任务实际无法执行时报告缺失运行时/模型等错误，不提供主动验证入口；固定 CPU 推理和类别 `[2,4]` |
| `GEN-CENSOR-003` | 项目批量打码 | all/kept/marked 范围建立任务 | 现用 | CensoringTask | censoring actions | 保留并收敛为唯一批量范围“P站＋预览＋封面”：合并三类已选图片并去重，自动跳过已有打码版本的图片；移除“全部”和“仅已保留”批量入口。任意单图仍可单独执行自动打码或手工打码 |
| `GEN-CENSOR-004` | 打码任务队列 | 进程内批处理、状态/进度/历史 | 后台核心 | CensoringTask、启动 instrumentation | censoring executor | 保留并重构为一次精选图片批量操作对应一个用户可见任务，内部记录各图片处理项；用户查看总数、已完成、失败、当前状态，以及等待、实际处理、暂停和总耗时，不在任务中心堆积大量单图任务 |
| `GEN-CENSOR-005` | 项目范围打码暂停/恢复/取消 | actions 以 projectId 批量控制项目下任务，没有单 CensoringTask 控制入口 | 现用/运维 | CensoringTask 与外部进程 | censoring actions | 保留并改为控制具体批量任务：暂停后不再领取下一张，当前图片处理完即暂停；恢复后继续剩余图片；取消后停止领取新图片。项目范围可多选任务批量控制，但不再只能一次控制项目下全部任务 |
| `GEN-EXPORT-001` | 图片整合导出 | 生成 ZIP、封面、P站、预览目录 | 现用/写文件 | `data/images`、`data/export`、Archiver | project-export service | 保留并重做为单一完整 ZIP：全部已保留原图、封面、P站打码图和预览打码图一次打包。交付包路径固定为 `<EXPORT_ROOT>/<项目名>/<slug>.zip`：外层文件夹使用项目名称，不使用 slug，也不额外套 images 层。ZIP 和包内普通图片文件名继续使用项目“英文标识（slug）”，例如 `<slug>.zip`、`<slug>_01.jpg`；保留英文结构与文件名 `pixiv/`、`preview/`、`cover.jpg`、`cover_censored.jpg`，用户界面仍显示“P站、预览、封面”。同时支持浏览器下载 ZIP，并向认证用户显示/复制服务器导出绝对路径 |
| `GEN-EXPORT-002` | 导出前置检查 | 要求唯一封面和 kept 图片；成功写 `publishedAt` | 现用 | Project/ImageResult | export route | 保留并重构检查：要求有效且唯一的 slug、恰好一张封面及至少一张已保留图片；P站和预览允许为空。所有被标记为封面/P站/预览的图片都必须已有打码版本，否则阻止导出并列出缺失项。每次导出覆盖该项目上一份结果，不保留历史版本；记录 `lastExportedAt`，移除把本地打包等同外部发布的 `publishedAt` 语义 |
| `GEN-LIFE-001` | 项目归档 | 要求完成/导出，取消任务并尽力清理图片、trash、Comfy output、export，写 archivedAt | 现用/高风险 | DB + 本地/SSH 文件系统 | archive service | 公共层协调永久只读项目归档，各类小节负责自己的资源处理；不要求先导出，只要求没有非终态任务。本版保留 Project、文件夹、图片小节、图片参数、Prompt/LoRA 配置、图片任务/Attempt、数据库中的任务 Workflow JSON 快照、全部正常图片及打码版本和最新图片导出文件；删除执行临时文件、磁盘上的 Workflow 下载/缓存文件及回收站中的图片。归档后仍通过原图片 Preset/Group Binding 正常解析最新内容，不保存额外 resolved config/Prompt/LoRA 归档快照；未来其他类型的资源规则另行设计 |
| `GEN-LIFE-002` | 项目反归档 | 当前没有反归档 | 缺失 | 归档会已删除多类文件，难以恢复 | 无 | 新版不增加：归档项目永久只读且不可恢复为 active；只允许浏览、下载保留文件和彻底删除项目 |
| `GEN-LIFE-003` | 项目彻底删除 | 清理任务/文件后级联删除项目 DB | 现用/高风险 | Project 全树、文件、Comfy output | deletion service | 公共层协调真正彻底删除，各类小节负责自己的配置、结果和文件；要求先取消全部非终态任务。本版随后删除 Project 全部数据库记录、图片小节、图片任务/Attempt、数据库中的 Workflow JSON 快照、磁盘 Workflow 文件、图片、打码版本、图片回收站和临时文件，并清理已成功持久化后的已知 ComfyUI 输出副本。`<EXPORT_ROOT>/<项目名>/` 中的图片交付文件完全保留，不随项目删除；文件清理失败时不得把项目错误标记为已删除，不预设未来其他类型的文件处理规则 |

### B5. Generation 预制与模板

本组 Preset、分类、文件夹、Variant 与 Group 均为图片专属，正式名称统一使用 ProductionImagePreset 前缀。ProductionTemplate 与 ProductionProject 同级；模板的公共列表、ProductionTemplateSectionFolder 与排序允许未来扩展其他类型小节，本版只有 ProductionTemplateImageSection。模板图片小节与项目 ProductionImageSection 复用配置协议、独立拥有配置记录，导入和另存仍深复制。

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-PRESET-001` | 预制分类 CRUD | 分类新增、编辑、删除、排序 | 现用 | PresetCategory | preset-category actions | 保留分类新增、编辑、删除和排序；分类继续用于资源组织、Group 组合及跨项目 Variant 分配同步 |
| `GEN-PRESET-002` | 分类槽位模板 | 为预制组定义固定 slot 结构 | 现用/复杂 | PresetCategorySlot | slot-template route | 保留：分类可为 Group 定义固定 Slot，每个 Slot 约束允许放入的 Preset 分类和显示顺序 |
| `GEN-PRESET-003` | 分类导入排序规则 | 分别编辑分类在正向、负向、LoRA1、LoRA2 四个维度的导入顺序；预制自身 sortOrder 是另一拖拽功能 | 现用 | category sort orders | sort-rules page | 保留并与旧版一致：继续分别维护分类在正向 Prompt、负向 Prompt、第一阶段 LoRA、第二阶段 LoRA 四个维度的编译顺序；资源库展示排序和 Preset 自身排序仍是独立概念 |
| `GEN-PRESET-004` | 预制文件夹 | CRUD、排序、移动、多选移动 | 现用 | PresetFolder | preset-folder actions | 保留多级文件夹、排序和拖放移动。删除非空文件夹时模态框只提供“连同其中全部子文件夹和 Preset 删除”或取消，不提供把 Preset 移到其他位置的保留方案 |
| `GEN-PRESET-005` | 预制 CRUD/复制 | 新建、编辑、复制、删除、排序 | 现用 | Preset | preset-variant-crud | 保留创建、编辑、复制、删除和拖放排序；删除时如何处理现有 Binding 在 Preset 生命周期组单独确认 |
| `GEN-PRESET-006` | 预制变体 CRUD | 多变体新建、编辑、删除、排序 | 现用 | PresetVariant | variant actions | 保留一个 Preset 下的多个 Variant，以及新增、改名、复制、删除和排序；每个 Preset 明确一个默认 Variant |
| `GEN-PRESET-007` | 变体提示词与 LoRA | positive/negative、LoRA path/weight 属于 PresetVariant；Civitai links 属于 Preset 主记录 | 现用 | Preset + PresetVariant | preset form | 保留 Variant 的正向文本、负向文本、第一阶段 LoRA 和第二阶段 LoRA，LoRA 必须从 shared 模型管理模块选择。Civitai 等普通参考链接归 Preset；若链接指向具体 LoRA 模型，则由模型模块维护，Preset 只引用该模型 |
| `GEN-PRESET-008` | 关联变体 | 一个变体递归引用其他变体并防循环 | 现用/复杂 | PresetVariantLink | preset resolver | 保留旧版设计：Variant 可递归关联其他 Variant，解析时按原规则展开，并继续执行循环引用检测和拒绝写入 |
| `GEN-PRESET-009` | 跨变体批量文本替换 | 对选中变体预览并替换 prompt 文本 | 现用 | 多个 PresetVariant | bulk text utilities | 保留：选择若干 Variant，预览正向/负向文本替换结果后一次应用 |
| `GEN-PRESET-010` | 预制变更历史 | 记录和展示 preset/group 变更 | 现用 | PresetChangeLog/GroupChangeLog | change history service/UI | 保留并迁移到 RV-01～RV-10：Preset、Variant、Group 及 Template 的可编辑配置接入 shared 修改历史协议，由 production adapter 负责快照和恢复；删除 PresetChangeLog/GroupChangeLog 专属模型和服务 |
| `GEN-PRESET-011` | 使用情况查询 | 查找预制在项目/模板中的使用 | 现用+API | bindings | usage route | 保留为领域查询和正式 HTTP API，不新增独立“使用情况”页面。当前生产 UI 在删除 Preset 前调用该查询并列出受影响的项目/模板 Section；新版继续复用同一查询完成删除确认和外部调用 |
| `GEN-PRESET-012` | 级联清理并停用预制 | 清理 links、bindings、prompt blocks、manual LoRA 后设 `Preset.isActive=false`；Preset/Variant 主记录保留 | 现用/高风险 | 多域 bindings | cascade route | 改为物理删除而非停用/软删除：删除前把各 Section/Template Binding 的当前 Prompt 转为 `CustomText`、Preset LoRA 转为手动 LoRA，并从 Group 中移除成员；随后物理删除 Preset 和 Variant。归档项目也执行这项系统级转换 |
| `GEN-PRESET-013` | 绑定惰性解析最新预制 | Section/Template 绑定读取时解析最新源内容；手工 detach 不重新附着 | 现用/核心 | bindings/provenance/resolvers | preset resolvers | 保留惰性解析：未 detach 的 Binding 始终读取最新 Preset/Variant，不向使用方批量写入缓存 |
| `GEN-PRESET-014` | 旧 sync endpoint | `syncPresetToSections()` 只校验、revalidate 并返回 `skipped:true`，不主动重写使用方缓存 | 兼容/no-op | 外部调用者可能存在 | preset-sync、sync route | 新版移除：当前只返回 `skipped:true`，惰性解析不需要手工同步 Preset；删除旧 endpoint 和兼容调用 |
| `GEN-GROUP-001` | 预制组 CRUD/复制/排序 | 管理组合预制 | 现用 | PresetGroup | preset-group actions | 保留创建、编辑、复制、物理删除和拖放排序 |
| `GEN-GROUP-002` | 组成员与嵌套组 | 添加、替换、移除、排序普通预制或子组 | 现用/复杂 | PresetGroupMember | group member routes | 保留普通 Preset、子 Group 的添加、替换、移除和排序，并保留嵌套循环检测；解析到 Section 后每个具体 Preset 仍是独立 Binding，不融合内容 |
| `GEN-GROUP-003` | 固定槽位 | 按 category slot 安排组成员并支持 overflow | 现用/复杂 | slot template | group detail UI | 保留旧版行为：按分类 Slot 安排成员，未进入固定 Slot 的成员进入 overflow 区域并按明确顺序解析 |
| `GEN-GROUP-004` | 组扁平化 API | 递归解析嵌套组；只有隐藏 `/flatten` route 调用，当前 UI/导入链无调用者 | 隐藏/API-only | group resolver | flatten route | 保留内部递归解析能力，删除无 UI 调用的公开 `/flatten` HTTP 接口；Section Binding 和任务快照直接调用内部解析器 |
| `GEN-REPLACE-001` | 项目批量替换预制 | Dry Run、同分类约束、阻塞项、Apply、后验复查 | 现用 | Project bindings | replacement dialog/service | 保留并简化为单个模态框：选择原 Preset 和目标 Preset，展示受影响 Binding 数量及不能替换的项目，确认后一次应用；删除独立 Dry Run、分阶段 Apply 和后验复查流程 |
| `GEN-REPLACE-002` | 模板批量替换预制 | 同一流程作用于 template sections | 现用 | Template bindings | template replacement route | 保留并与项目共用同一简化替换操作，作用范围限定为当前 Template |
| `GEN-TPL-001` | 模板列表与 CRUD | `/assets/templates` 创建、编辑、删除 | 现用 | ProjectTemplate | template actions | 保留创建、编辑和物理删除，不增加归档或软删除；删除 Template 不影响已经创建或导入过它的项目 |
| `GEN-TPL-002` | 模板小节 CRUD/排序/复制 | 管理模板 sections | 现用 | ProjectTemplateSection | template actions/API | 保留新增、编辑、复制、删除和拖放排序；移除 `enabled` |
| `GEN-TPL-003` | 模板小节文件夹 | CRUD、排序、移动 template sections | 现用 | ProjectTemplateSectionFolder | section-folder actions | 保留多级文件夹和拖放移动。删除空文件夹可直接执行；删除非空文件夹时只允许“连同全部子文件夹和 Template Section 删除”或取消，不提供保留 Section 并移动到其他位置的功能 |
| `GEN-TPL-004` | 模板小节参数编辑 | KSampler、尺寸、批次、workflow | 现用 | TemplateSection params | template section page | ProductionTemplateImageSection 与 ProductionImageSection 使用同一图片参数协议、独立配置记录：尺寸、生成数量、两阶段 KSampler、Seed、Checkpoint 覆盖和 LoRA；Workflow 仍按已确认的本版图片设置统一选择，不作为模板图片小节字段，不把图片 Workflow 规则推广为其他类型的公共要求 |
| `GEN-TPL-005` | 模板提示词/预制/LoRA | 与项目 section 类似的 bindings、blocks、manual LoRA | 现用/复杂 | Template section 子表 | template prompt editor | 与项目 Section 使用同一 Segment、Binding、Group 和 LoRA 协议；Group 仍展开为多个独立 Preset Binding |
| `GEN-TPL-006` | 项目另存模板 | 将项目结构固化为 template | 现用 | Project -> Template clone | saveProjectAsTemplate | 保留：复制项目的完整文件夹层级、Section 归属/名称/顺序、参数、Segment、Binding 和手动 LoRA；不复制任务、结果、图片、项目 slug 或导出文件 |
| `GEN-TPL-007` | 模板导入项目 | 复制 template sections/folders/bindings | 现用 | Template -> Project clone | importTemplateToProject | 保留并完整迁移结构：向当前项目深复制 Template 的全部文件夹层级、父子关系、同级顺序以及每个 Section 的文件夹归属和顺序，不扁平化、不覆盖已有项目内容；导入后项目与 Template 独立，Preset Binding 继续保持绑定 |

### B6. Workflow 与 Generation 后台执行

| ID | 功能点 | 当前入口与行为 | 状态 | 主要依赖 / 移除影响 | 代码证据 | 决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `GEN-WF-001` | 标准 workflow 配置 | 从版本化 JSON 加载 ComfyUI graph | 后台核心 | `config/workflows/standard-workflow.api.json` | workflow-prompt-builder | 保留版本化基础 Workflow；图像生产模块配置当前使用版本，不允许 Section 各自选择文件 |
| `GEN-WF-002` | 参数/提示词/LoRA 注入 | 将 resolved section 配置写入 graph | 后台核心 | Preset resolvers、Section snapshot | workflow builder | 保留确定性注入：将任务快照中的 Prompt、LoRA、尺寸、KSampler 和 Seed 写入 Workflow；目标节点缺失或类型不符时在提交前明确失败 |
| `GEN-WF-003` | 运行不可变快照 | 每个 Run 保存 resolvedConfigSnapshot/submittedPrompt | 后台核心 | Run JSON | enqueue/repository | 保留不可变快照但不把持久文件作为权威数据：创建任务时在数据库保存 resolved config 和最终 Workflow JSON；同一任务重试继续使用该快照，不受 Section、Preset 或基础 Workflow 后续修改影响，Attempt 只保存本次 promptId、时间和错误。下载时从数据库快照即时生成响应；若实现产生临时/缓存 Workflow 文件，必须放入项目受管目录，归档时删除这些磁盘文件但保留数据库快照，彻底删除项目时连数据库快照和文件一起删除 |
| `GEN-WF-004` | 当前小节 workflow 下载 | 下载生成前 workflow | 现用/诊断 | section-workflow route | section workflow service | 保留并补全两种下载：基于当前 Section 参数、resolved Prompt、LoRA 和模块当前 Workflow 生成“原始工作流”；也可从同一入口生成“调试工作流”。下载能力不代表 Section 可以选择另一套基础 Workflow |
| `GEN-WF-005` | 历史 Run workflow 下载 | 下载已提交 run 的 original workflow | 现用/诊断 | Run.submittedPrompt | run workflow route | 保留并补全两种下载：历史任务可下载当时实际提交给 ComfyUI 的不可变“原始工作流”，也可基于该快照转换并下载“调试工作流”；两者都不使用 Section 当前参数重新生成 |
| `GEN-WF-006` | Debug workflow 变体 | 把保存节点改预览、增加中间预览与尺寸切换 | 现用/诊断 | workflow debug transformer | 保留：继续从当前或历史原始 Workflow 派生 ComfyUI 前端可打开的调试版本，包括把保存节点改为预览、增加第一阶段中间预览和横竖尺寸切换；不得覆盖原始 Workflow 快照。当前产品术语为“原始工作流/调试工作流” |
| `GEN-EXEC-001` | 事务入队 | 按 enabled section / aspect ratio 创建 queued Run | 后台核心 | Project/Section/Run | enqueue.ts | 保留并重做：创建任务时先持久化为 `unsubmitted`；不得因 ComfyUI 未连接或训练占用 GPU 而丢失或直接失败，不再另建“缓冲队列”领域概念 |
| `GEN-EXEC-002` | ComfyUI 提交 | 验证 graph、提交 prompt、保存 promptId | 后台核心 | ComfyUI HTTP | run-executor/comfyui-service | 保留并重做：调度器只提交 `unsubmitted` 任务；每次提交先创建内部 Attempt，ComfyUI 可达且没有活动训练任务时幂等、有序提交，接收 promptId 后写入该 Attempt 并原子地把任务转为 `submitted`；不可达时任务保持 `unsubmitted`，不提示启动 ComfyUI；训练结束后自动恢复调度 |
| `GEN-EXEC-003` | 队列位置与历史轮询 | 等待开始、轮询完成/失败、有限并发 | 后台核心 | ComfyUI queue/history | run-executor | 保留并重构：WebSocket 按 promptId 接收即时 execution/progress/completion/error 事件；只要存在 submitted/running 任务，后台同时固定每 1 秒查询一次 queue/history 并以其校正权威状态，WebSocket 断线也不改变频率。Attempt 保存 submittedAt、startedAt、finishedAt、ComfyUI 排队耗时、实际生成耗时和错误，Task 按 `ARCH-010` 累计各阶段。一次 Attempt 不建模部分成功，全部结果持久化后才 completed |
| `GEN-EXEC-004` | 输出下载与持久化 | 下载图片、写 ImageResult 和受管文件 | 后台核心 | ComfyUI output、`data/images` | image-result-service | 保留并改为全有或全无：全部预期图片下载、校验和落盘成功后才创建正式 ProductionImageResult；任一失败则任务失败并清理本次临时文件，不产生“部分成功” |
| `GEN-EXEC-005` | 延迟提交与恢复 | ComfyUI 不可达时保留 queued；后台恢复 stale runs | 后台核心 | Run 状态、恢复上限 | run-executor | 保留并重构：延迟提交就是任务保持 `unsubmitted`，等待原因包括 ComfyUI 不可达、GPU unavailable、GPU 恢复后等待 ComfyUI restart、restart 失败或 LoRA 训练占用；不另建缓冲队列。条件恢复后自动、幂等、有序转为 `submitted`；前端显示等待原因，不在任务创建流程提示启停 ComfyUI |
| `GEN-EXEC-006` | 启动孤儿清理 | server 启动把超过 30 分钟 running 标记 failed | 后台 | instrumentation + DB | instrumentation.node.ts | 移除固定“超过 30 分钟即失败”的孤儿清理；超时不能替代 ComfyUI 权威状态查询 |
| `GEN-EXEC-007` | 启动恢复 | server 启动恢复有 promptId 的活动运行；可选恢复 paused | 后台 | Run/ComfyUI | instrumentation.node.ts | 保留并按共同中断场景重做：应用启动后按 Attempt promptId 查询 ComfyUI queue/history，仍存在则恢复监控，已经完成则下载结果；ComfyUI 不可达时等待后续检查，确认可达但旧 prompt 不存在时把 Attempt 记为 interrupted，并将同一任务自动退回 `unsubmitted` 重新排队。paused 任务保持暂停，不自动恢复 |
| `GEN-EXEC-008` | 优雅关机暂停 | SIGTERM/SIGINT 尝试取消 Comfy prompt 并把活动 Run 改 paused | 后台/运维 | 进程信号、DB、ComfyUI | instrumentation.node.ts | 新版移除：应用关机不自动取消、暂停或中断 ComfyUI 任务；重启后由 `GEN-EXEC-007` 恢复状态 |
| `GEN-EXEC-009` | ComfyUI 队列缓存 | 短时缓存 queue snapshot，减少轮询压力 | 后台 | 内存缓存 | comfyui-service | 新版移除独立队列快照缓存：由唯一后台同步循环每 1 秒读取一次 queue/history 并分发结果，避免多个调用方重复查询；权威状态仍落在 Task/Attempt |
| `GEN-EXEC-010` | ComfyUI 精确取消 | 批量删除 pending prompt、按需 interrupt running | 后台/高风险 | ComfyUI queue | comfy-queue-cancellation | 保留并重构：作为取消和暂停已提交/运行中任务的共同底层能力；必须按稳定 prompt 身份操作并确认实际停止，避免错误中断其他任务 |

---
