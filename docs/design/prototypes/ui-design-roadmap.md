---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: new-frontend-ui-design-roadmap
    kind: reference
  readWhen:
    - 选择或新增前端设计任务之前
    - 判断继续下一个具体指哪项以及能否开始制作时
  sources:
    - docs/design/prototypes/design-delivery-guide.md
    - docs/design/prototypes/design-foundations.md
    - docs/design/prototypes/ui-design-coverage.md
    - docs/design/prototypes/ui-design-shared-plan.md
    - docs/design/prototypes/ui-design-production-plan.md
    - docs/design/prototypes/ui-design-training-plan.md
    - docs/design/prototypes/reviews/R01.md
    - docs/design/prototypes/reviews/R01-02.md
    - docs/design/prototypes/reviews/R02-01.md
  verifiedBy:
    - npm run docs:check
---

# 新版前端 UI 设计路线

## 当前状态：R02-01 全局导航外壳待审核

用户于2026-09-09指出 `R01-02` 的存在及通用交互定位有偏差，并要求先拆清文档，不能从模糊意图开始开发。任务分册登记后，用户核对了 `R01` 台账，并要求“先继续设计计划的下一项”。**本轮仅选定已有的 R02-01 全局导航外壳，先记录[具体范围](reviews/R02-01.md)再制作；设计结果待用户审核。** 这不是批准全部79项，也不是恢复 `R01-02`。已确认的基础规则及 `R01-01` 保留，既有代码与本机快照不删除。

除本轮明确选定的 `R02-01` 外，其余任务拆解仍为供审核的草案，登记不等于批准。尤其不把“项目卡片”“小节内联层级”等此前的替代建议当成用户确认的布局。业务意图、页面形态、组件实现和设计确认分开记录。

## 文档分工与阅读顺序

| 文档 | 负责回答的问题 | 不能作为的依据 |
| --- | --- | --- |
| [设计交付指导](design-delivery-guide.md) | 如何选组件、设计完整交互并验证，如何避免R02-01式反复返工 | 不是新业务需求或新增任务授权 |
| 本文 | 批次如何组织、已有子项是什么状态、开始制作需要什么 | 不用批次标题直接派生实现 |
| [共享工具任务](ui-design-shared-plan.md) | 导航、登录、生产任务、模型、设置、监控及跨页验收的逐项范围 | 不把本分册当所有业务页的统一模板 |
| [生产任务](ui-design-production-plan.md) | 生产项目、小节、审核、打码、导出、预制、模板各任务的入口和动作 | 不提前强制目录树、卡片或排序弹窗 |
| [训练任务](ui-design-training-plan.md) | 训练项目、构图、素材、任务、运行、预制及模板的独立任务 | 不移植生产的层级或状态机 |
| [业务覆盖与状态](ui-design-coverage.md) | 原64个覆盖编号和各类状态有没有遗漏 | 能力名称不是具体设计任务，组件名不是采用决定 |
| `reviews/` 中对应记录 | 某一任务的实际产物、检查、意见和批准版本 | 历史产物不构成新任务授权，也不能事后补出任务来证明开工合理 |

## 已有具体任务台账

这些子项单独列出，不再藏在批次的状态栏中。新任务必须在下面分册中先登记完整条目，不能在开始制作时临时取号。

| 独立任务编号 | 当时制作了什么 | 适用与排除边界 | 确认／处置状态 |
| --- | --- | --- | --- |
| R01-01 | 列表工具栏、筛选、表格／手机卡片、当前页选择与分页 | 已确认这个可操作样本；实际业务页面的字段和交互仍各自设计，不表示全部页面采用相同列表形态 | 用户于2026-09-09确认 `30fd53db`；[完整记录](reviews/R01.md) |
| R01-02 | 目录树＋内容多选＋独立排序对话框＋移动到；后来读本机模型目录作模拟 | 当时代理在“继续下一个”后临时拆出，未先登记并确认独立任务；用户指出除模型管理外不适合其通用定位。模型文件手动排序也不是已确认业务能力 | **定位偏差，暂停，不作为通用前置条件**；[历史记录与后续意见](reviews/R01-02.md)。是否局部参考由R04具体任务重新判断，不自动转成模型管理方案 |

`R01` 只保留上述记录，不继续按 `Tree`、`OrderList` 等组件库目录顺序补“通用业务组件”。后续确实出现一致的重复交互时，先列真实消费页面、相同与不同的业务语义，再登记复用任务；不能仅因为几处都能选择、移动或排序就认定共用。

## 批次与逐项任务入口

三个分册事前登记79项任务（共享26、生产30、训练23），其中 `R02-01` 已选定制作，其余78项仍待确认；另保留上方2项历史台账。任务数量不代表页面数量或制作完成。

批次是阅读分组，**不是开工单位，也不是整批前置依赖**。旧版“完成R01才能开始所有页面”“训练依赖整个生产编辑批次”等推断已撤下；每个任务只列明具体需要的导航、字段、状态、身份或已确认设计，以及需要它的原因。

| 批次 | 业务范围 | 独立任务登记位置 | 当前状态 |
| --- | --- | --- | --- |
| R00 | 基础规则 F-01～F-14 | [基础规范](design-foundations.md)、[已确认范围](foundations/README.md) | 既有规则及批准历史保留；不新增未声明子项 |
| R01 | 已有通用样本记录 | 上方R01-01／R01-02独立台账 | 一项已确认、一项暂停；不再作为全部页面的门禁 |
| R02（R02-01～R02-03，3项） | 导航与登录 | [共享分册](ui-design-shared-plan.md#r02-导航与登录) | R02-01首稿待审核；R02-02/03仍为草案 |
| R03（R03-01～R03-03，3项） | 生产任务工作台 | [共享分册](ui-design-shared-plan.md#r03-生产任务工作台) | 拆解草案，待确认任务说明 |
| R04（R04-01～R04-05，5项） | 模型管理 | [共享分册](ui-design-shared-plan.md#r04-模型管理) | 拆解草案；不自动接收R01-02 |
| R05（R05-01～R05-06，6项） | 生产项目与小节组织 | [生产分册](ui-design-production-plan.md) | 拆解草案，待确认任务说明 |
| R06（R06-01～R06-04，4项） | 生产图片编辑与历史 | [生产分册](ui-design-production-plan.md) | 拆解草案，待确认任务说明 |
| R07（R07-01～R07-04，4项） | 图片审核与回收站 | [生产分册](ui-design-production-plan.md) | 拆解草案，待确认任务说明 |
| R08（R08-01～R08-06，6项） | 打码、导出与项目生命周期 | [生产分册](ui-design-production-plan.md) | 拆解草案，待确认任务说明 |
| R09（R09-01～R09-10，10项） | 生产预制与模板 | [生产分册](ui-design-production-plan.md) | 拆解草案，待确认任务说明 |
| R10（R10-01～R10-06，6项） | 训练项目与内容 | [训练分册](ui-design-training-plan.md) | 拆解草案，待确认任务说明 |
| R11（R11-01～R11-04，4项） | 构图编辑与训练素材 | [训练分册](ui-design-training-plan.md) | 拆解草案，待确认任务说明 |
| R12（R12-01～R12-08，8项） | 训练任务与运行 | [训练分册](ui-design-training-plan.md) | 拆解草案，终态素材任务删除单列待决 |
| R13（R13-01～R13-05，5项） | 训练预制与模板 | [训练分册](ui-design-training-plan.md) | 拆解草案，待确认任务说明 |
| R14（R14-01～R14-08，8项） | 设置 | [共享分册](ui-design-shared-plan.md#r14-设置) | 拆解草案，待确认任务说明 |
| R15（R15-01～R15-03，3项） | 监控、日志与审计 | [共享分册](ui-design-shared-plan.md#r15-监控日志与审计) | 拆解草案，待确认任务说明 |
| R16（R16-01～R16-04，4项） | 跨页验收 | [共享分册](ui-design-shared-plan.md#r16-跨页验收任务) | 只验收已经逐项确认的设计，不创建新功能 |

图片预览、模型选择、提示词编辑、修改历史、删除影响等能力均在真实使用页面中先完成具体设计。原 `C01`～`C12` 保留为查漏索引，不能因为它们在覆盖表上就独立创建新的万能组件任务。

## 开始前必须已有的任务说明

| 必填项 | 应写清的内容 |
| --- | --- |
| 编号与定位 | 唯一任务编号、名称、所属批次、覆盖编号及文档位置；开始后才添加编号不算事前登记 |
| 用户目的与入口 | 用户从哪里进入、操作什么业务对象、要完成什么；不能只写“做树／做排序／补组件” |
| 本轮范围 | 具体动作、数据范围、成功／失败及手机适用状态；每个附带浮层明确属于哪个动作 |
| 排除范围 | 哪些相似业务、状态或能力本轮不做，不能借复用扩张到其他页面 |
| 已定与待定交互 | 已确认约束、仍要讨论的选择、本轮是否允许探索多个方案；不能以库组件可用性替代业务判断 |
| 验收 | 能让用户逐项判断的具体结果，不用“组件完整”“体验完善”等无法核对的概括 |
| 依赖理由 | 所需的具体信息或设计结果及用途；代码库组件存在、整个批次完成都不能代替理由 |
| 确认状态 | 任务说明由谁、何时、以什么指令确认；原型制作和设计结果批准分别记录 |

上述内容可以直接在分册的任务条目中确认，不要求每项先生成另一份空模板。现在各分册的“待确认”栏只是待讨论问题；未解决也未明确授权本轮探索的事项，不能由代理默选后制作。

## “开始”和“继续下一个”的执行规则

1. 开始前，引用已有独立任务的编号、文档位置及本轮范围。用户明确要求开始这个已说明任务后，按该范围制作；不再重复询问已经确定的基础色彩、字号等。
2. “继续下一个”只能对应**已登记、范围明确、并在已确认顺序中唯一确定**的下一项。本轮用户在核对R01台账后明确继续计划下一项，执行队列仅为既有R02-01，其事前范围见对应记录；不顺带启动R02-02/03或批准其他批次顺序。如果出现多个候选或未解决的业务范围，先澄清，不能临时取号。
3. 如果只有批次、覆盖编号或模糊意图，先补任务说明并交用户确认。不得先创建原型，再补一个编号和审核文档当作已授权依据。
4. 需要追加、拆分或扩大任务时，先在分册登记新编号、范围、验收及原任务的拆分去向，取得相应确认后再制作。不能复用旧编号掩盖新范围，不能把“发现可复用”当作直接开工理由。
5. 用户对某项结果确认，只关闭该项列明范围。后续页面、不同业务语境及整批确认不能推导获得。
6. 明确的局部修正仍归已有任务及反馈记录，不为每个像素调整创造新任务；只有实质增加目的、对象、流程或交付范围才需要新增／变更任务说明。

## 制作、检查与状态记录

| 阶段 | 文档中必须能查到的内容 |
| --- | --- |
| 拆解草案 | 独立条目、范围、排除、验收、待确认事项；不能开始制作 |
| 范围已确认 | 对已明确任务的用户确认、允许探索范围及具体下一项；可以在授权范围设计 |
| 制作／调整中 | 对应任务和反馈，记录本轮真实范围，不夹带未登记子项 |
| 待用户审核 | 原型、检查和限制可核对；不能自标已确认 |
| 已确认 | 日期、用户意见、对应版本、范围和未覆盖事项 |
| 暂停／定位偏差 | 原因、保留产物、撤销的使用假设和恢复条件；不作为后续前置 |

每项仍须同轮完成桌面、窄屏和手机的适用状态；采用[共用状态矩阵](ui-design-coverage.md#共用状态矩阵)，不机械要求登录页也有批量／分页。不把无水平溢出当作完整移动验收；交互、焦点、长内容、反馈和数据范围分别检查。

现有原型和审核文件保留为相应版本的证据。当前R01-02页面里仍展示的交互只表示历史实验内容，不代表文档整理后已重新确认或转为正式模型管理页；本轮不修改该历史原型。

## 尚未确定的问题

| 问题 | 归属与边界 | 对开工的影响 |
| --- | --- | --- |
| Q-01 素材生成任务终态删除 | L02的候选被代表图、参考图、输入或运行样本引用时的处置 | 仅相关删除子任务等待业务决策，不阻止其他任务，也不自定解绑／删除语义 |
| Q-02 拖放、缩放的库能力 | 第一次实际使用该交互的任务，先核对所用v10公开能力 | 不把技术试验变成所有页面的通用前置；明确触控／键盘替代和验证限制 |
| Q-03 各业务页面形态及精确路由 | 在已确认命名空间、业务入口和返回规则内选择 | 在具体任务中确认或明确授权探索，不用旧API地址或既有原型地址冒充已批准路由 |
| Q-04 R01-02产物如何处理 | 模型管理任务是否参考其中某一部分，及移除不适用的通用假设 | 当前仅暂停保留；不自动搬迁、删除、改名或认可新交互 |

## 输入来源与更新边界

业务输入已于 2026-09-08 重新读取独立重构检出 `comfyui-manager-refactor` 的 `codex/rebuild-decisions-figma` 分支，固定基线为 [d127cd31][source-root]（完整提交 `d127cd31a5582430c98af2ff2c9efed05b9398ed`）。下表链接固定该提交，便于日后判断新增决策；本文只记录 UI 覆盖与顺序，不复制整套领域和 API 规范。

| 来源编号 | 已核对的输入 | 本文用途 |
| --- | --- | --- |
| D0 | [最终口径][d0]、[应用设计][design-source] | 当前业务优先级、待细化边界 |
| D1 | [设置][d1] | 可编辑字段、只读状态、机器与模块设置归属 |
| D2 | [领域模型][d2] | 项目／小节／图片关系、生命周期与修改历史 |
| D3 | [HTTP API][d3] | 操作范围、冲突和逐项结果；不是前端路由清单 |
| D4 | [信息架构与组件][d4] | 导航、主题、组件库、响应式与浏览器行为 |
| D6 | [平台功能][d6] | 登录、模型、任务展示、监控、日志与审计 |
| D7 | [图像生产功能][d7] | 生产项目、图片编辑、任务、审核、打码和交付 |
| D8 | [LoRA 训练功能][d8] | 训练项目、构图、素材、训练与复用资源 |
| D9 | [前向兼容边界][d9]及[收口证据][closure] | `FC-01`～`FC-17` 的命名、身份与执行职责 |
| `F` | [原覆盖编号说明][figma-source]、[任务页说明][task-brief] | 沿用 `C01`～`C12`、`I01`～`I23`、`L01`～`L20`、`S01`～`S09`，保留首页工作台输入 |

原本地 `scope-matrix.json` 的 `updatedAt` 已是 2026-09-07，包含至 `FC-16` 的更新；此次核对的最新 `FC-17` 收口执行职责，没有增加页面。原清单位置由 `F` 的“本地续作产物”记录；后续 HTML 设计进度统一在本文与对应审核记录维护，不继续用旧 `Figma` 快照表示实时完成状态。

| 编号 | 当前应采用的规则 | 对设计路线的影响 |
| --- | --- | --- |
| U-01 | 用户已将审核载体改为 HTML，并确认现有基础方案 | 源文档残留的 `Figma` 审核措辞及早期色彩描述由本次确认覆盖；“先设计、用户审核、再正式实现”仍有效。源检出的载体称呼尚待同步，不阻塞本路线，也不作为界面文案 |
| U-02 | 一级模块显示“生产 / 训练”；页面空间为 `/production/**` 与 `/training/**` | “图像生产 / `LoRA` 训练”用于具体功能。基础原型中的 `data-module="image"` 是既有样式上下文，不代表新版路由名，不为命名调整重命名颜色变量 |
| U-03 | 公共 `ProductionSection` 与图片配置一对一，模板同理；用户始终操作一个小节 | 列表、文件夹、排序、面包屑基于公共小节；新增仍一次完成。“生成全部图片小节”明确本版运行范围，不增加配置身份表单或视频类型选择器 |
| U-04 | 图片生成、批量打码、训练素材生成、训练运行保留各自任务语义 | 可共用任务展示组件及项目范围视图；不得合并成万能任务状态机。训练优先、单 `GPU`、唯一执行目标；空闲 ComfyUI 进程本身不阻止训练 |
| U-05 | 历史、业务日志／审计及跳转使用完整 `module + resourceType + resourceId` | 界面显示自然名称，图片配置返回所属公共小节；无业务目标的系统事件不伪造目标。历史还覆盖构图输入关系、`Provider` 参数、代表图，不能缩成文本历史 |
| U-06 | 导出为 `<EXPORT_ROOT>/<项目名>/<slug>.zip`；内部图片目录按稳定项目 ID 组织 | 导出显示项目名文件夹、`slug` 文件名和覆盖说明，不加 `images` 层；内部路径只在需要定位时展示，不增加可编辑路径模板 |
| U-07 | 正式训练类型为 `Training*`，角色生图字段为 `imageProductionPrompt`，构图代表图为 `selectedImageId` | D8 少量旧 `selectedResultId` 描述按 D2／D3 对齐；训练项目没有 `slug`，代表图更换不改 `Caption` |
| U-08 | `FC-17` 将 ComfyUI 通信／队列／文件／进程技术服务与图片 `Workflow` 适配分开；`GPU` 协调归共享层 | 任务等待与设置错误准确解释原因；不新增执行平台、`worker` 仪表盘、多 `GPU` 或视频占位 |


## 导航与交付载体

| 编号 | 已确认的信息架构 | 页面设计时补齐的内容 |
| --- | --- | --- |
| N-01 | `/` 恢复有效的上次导航；首次或失效时进入 `/production/tasks` | 恢复／失效回退样本，不新增概览仪表盘作为首页 |
| N-02 | 两模块都按任务、项目、预制、模板显示四入口；模型、监控与日志、设置为全局工具 | 桌面稳定收放的侧栏及主题快捷切换；手机底部单排四入口与更多，模块切换及主题位于更多中，顶部留页面操作。2026-09-10用户指令覆盖原 `IA-06` 顶部模块布局；按最新用户要求移除退出登录，详见[R02-01修订](reviews/R02-01.md#2026-09-10-用户反馈与修订规则) |
| N-03 | 生产项目页签为概览、小节、图片、任务 | 项目编辑、导出、归档作为当前项目操作；全局与项目任务复用并保留范围 |
| N-04 | 训练项目页签为概览、角色档案、参考图、构图、训练素材、任务 | 构图编辑围绕 `Prompt`、输入图、候选、代表图和 `Caption`，自有布局 |
| N-05 | 当前明确路径还包括 `/login`、`/training/projects/:id/sections` | 其余具体后缀随页面提出并审核；旧实现地址、API 地址、原型预览地址都不能冒充获批业务路由。已知旧地址 `/assets/loras` 直接回退新版共享模型页，按 [D6][d6] `COMPAT-001` 保留该导航规则 |
| N-06 | 稳定深链、浏览器前进／后退、刷新恢复、每模块最后位置、查询／展开／页签／滚动恢复 | 抽屉保留来源列表；可分享筛选进入 URL；图片多选只属于当前 UI 会话，不变成持久业务状态 |


## 当前不纳入的界面

| 分组 | 已排除的能力，后续不得因通用组件或占位需要画回 |
| --- | --- |
| 通用 | 视频及占位入口／空接口、多目标／多 `GPU`／角色权限管理、通用媒体库、大 `KPI` 首页、趋势图／实时日志流、原始 `console` 独立页、全局历史中心、`worker` 面板、模型上传／物理文件删除 |
| 生产 | 缓冲队列、旧三页签状态、手工任务刷新、部署暂停批次、清空队列独立模型、部分成功图片任务、仅删记录保留输出、复制项目新建、批量创建小节、`enabled`、清空全部小节、单节 `Workflow`、预制手工同步、复杂分阶段 `Dry Run`／`Apply`、全部或仅保留图批量打码、导出历史版本、反归档、`Workflow` 上传／在线编辑 |
| 训练 | 角色分析／`Prompt`／`Caption` 任务、`DatasetVersion`／`Freeze`／`Preview` 实体、`SectionRun`、候选 `keep/reject`／`Caption`、原始参考图直接进入训练结果池、跨项目媒体复用、独立从模板创建、训练暂停、多活动 `Run`、唯一最终 `LoRA`、归档恢复、从 `checkpoint` 直接创建预制 |
| 设置 | `Token` 原文查看／修改、在线修改数据根、SSH 私钥上传／密码、隧道开关、主动健康／环境测试、自动启停策略、刷新频率／超时／并发等内部协议配置、`Provider` 或图片模型选择器 |

未来视频输入、播放、音轨、模型兼容与 `GPU` 行为不作为本轮前置问题；当前版本的图片和训练设计可以独立完成。



## 当前交付与下一步

本轮制作 [R02-01 全局导航外壳](reviews/R02-01.md)：两模块四入口、全局工具、桌面收放、手机导航与首次生产任务入口，仅用占位内容验证导航。项目页签及完整恢复、登录流程和业务页面均不在本轮。完成后交用户审核，不自动进入下一项；`R01-02` 保持暂停。

## 上级路由

- [设计文档](../README.md)
- [HTML原型说明](README.md)

[source-root]: https://github.com/AcuLY/comfyui-remote/tree/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application
[d0]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/00-final-decisions.md
[design-source]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/design.md
[d1]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/01-settings.md
[d2]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/02-domain-models.md
[d3]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/03-http-api.md
[d4]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/04-design-and-components.md
[d6]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/06-platform-features.md
[d7]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/07-image-production-features.md
[d8]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/08-lora-training-features.md
[d9]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/decisions/09-forward-compatibility.md
[closure]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/evidence/2026-09-07-forward-compatibility-closure.md
[figma-source]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/figma/README.md
[task-brief]: https://github.com/AcuLY/comfyui-remote/blob/d127cd31a5582430c98af2ff2c9efed05b9398ed/openspec/changes/rebuild-application/figma/task-workbench-brief.md
