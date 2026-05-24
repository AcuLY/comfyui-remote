# Character LoRA Training v2：外部 Agent 操作、训练边界收敛、前端重构需求

日期：2026-05-24
状态：需求修正版 / 给 Codex 或后续实现使用
关联旧文档：`docs/plans/2026-05-23-character-lora-project-template-section-run-requirements.md`

## 0. 这版修正解决什么问题

当前 Codex 改版把 `template / section / run` 概念加进了现有 `character-lora-training` 模块，但主体验仍然是“一个列表页里塞创建大表单 + 一个详情页里垂直堆完整 pipeline”。这与预期不符。

本需求把模块重新定义为：**由外部 Agent（例如 Hermes）通过浏览器 use 或 HTTP 接口操作 Manager，主导 LoRA 训练准备流程；Manager 本身提供稳定 UI、资源状态和可审计接口；用户只负责提供少量输入、查看图片与提示词、做轻量纠错和关键确认。**

关键变化：

- `/character-lora-training` 只做项目列表，不能放新建训练任务表单。
- 新建训练任务必须放到独立页面，例如 `/character-lora-training/new`。
- `/character-lora-training/:id` 不能继续是一个超长 workbench；要拆成中文语义的多页面流程。
- 普通 UI 不展示 checkpoint path/hash/family、caption 策略/模式选择器、训练超参、provider 参数、artifact root、worker/debug、测试矩阵、预设发布字段。
- 模块边界收敛：**LoRA 训练模块只负责产出 LoRA 文件和训练报告，不负责 LoRA 测试、推荐权重、预设创建或发布。**这些后续操作以后作为独立模块/流程处理。

## 1. 产品原则

1. 普通用户不填写系统能推断的字段。
2. 用户看的是：参考图、人设参考图、提示词、训练集图片、训练进度、LoRA 文件。
3. 外部 Agent 负责理解参考图、填写提示词卡、补 caption、组织重跑；Manager 负责保存 checkpoint 元数据、训练方案模板、每图 caption（训练图文本标签）草稿/修改记录、provider 参数、worker 任务、artifact、日志、hash、复现配置。
4. “固定”指默认从训练方案模板继承，避免每次新建训练项目都重新决策；不代表系统/外部 Agent/expert 永远不可修改。
5. 隐藏高级参数不等于删除高级参数；它们仍需记录用于复现、人工检查和重跑。
6. 每个页面只服务一个决策，不把完整 pipeline 垂直摊开。
7. 自然语言纠错是主交互入口，不让用户编辑 JSON / 内部枚举 / 训练超参。
8. 关键特征、caption 等信息默认由外部 Agent 根据参考图和生成图填写，并通过 Manager 暴露的 HTTP 接口或浏览器 UI 写回；系统侧只提供字段编辑、版本记录和人工覆盖入口，不做复杂“策略选择器”。
9. LoRA 训练模块的完成定义是：成功生成一个或多个 `.safetensors` LoRA 文件、对应 hash、训练配置、数据集版本和日志。测试 LoRA、选择推荐权重、创建 Manager 预设不属于本模块。

## 1.1 Agent 边界：外部操作者，不是 Manager 内置智能体

本文里的 Agent 指 Hermes 这类**外部自动化操作者**，不是要做到 Manager 系统里的内置 LLM Agent。Manager 不需要实现“Agent 任务队列”“Agent 自动推理”“Agent 自己决定下一步”这类内部智能流程。

Manager 应提供的是：

- 普通用户可点的 UI 页面。
- 外部 Agent 可调用的 HTTP 接口。
- 可读取的项目状态、图片、caption、提示词卡、训练集版本、训练任务状态。
- 可写入的结构化资源：提示词卡版本、候选图 review 状态、单图 caption、生成批次、训练集版本、训练任务。
- 可审计的操作记录：谁/什么客户端写入、写入前后 diff、关联的人设图/提示词卡/训练集版本。

Manager 内部仍然可以有普通 worker queue，但它只负责确定性/半确定性的长任务，例如图片生成请求、文件复制、hash、训练执行、日志采集；不要把“理解角色、决定怎么改、批量写 caption、判断该重跑哪个模块”做成 Manager 内置智能体。

接口设计上应优先暴露资源级/action endpoints，例如 `POST /prompt-card/versions`、`PATCH /candidate-images/:id/caption`、`POST /sections/:id/runs`，而不是 `POST /agent-tasks` 这种把智能流程塞进 Manager 的接口。外部 Agent 可以像现在帮忙创建预设、替换变体一样，通过 HTTP 或浏览器 use 编排这些接口。

## 2. 边界定义

### 2.1 本模块负责

- 创建 LoRA 训练项目。
- 接收初始参考图。
- 从模型管理模块选择训练基底 checkpoint。
- 生成/登记“人设参考图”。
- 维护“提示词卡”（Prompt Card）：角色核心特征、服装特征、负面约束、最终完整提示词。
- 按训练集模块生成候选训练图。
- 支持对人设参考图和训练集模块做自然语言重跑/修正。
- 审核候选训练图：保留、排除、必要的 caption 调整。
- 确认训练集版本：把本次训练实际使用的图片、caption、提示词卡和配置固定下来。
- 生成训练配置并执行训练。
- 展示训练进度。
- 产出 LoRA 文件、hash、训练配置、训练日志、数据集版本、简短训练报告。

### 2.2 本模块不负责

以下必须从普通 LoRA 训练流程删除或移出：

- LoRA 测试矩阵。
- benchmark 页面。
- 推荐权重计算。
- “是否建议发布”。
- 临时测试 project / preset。
- Manager 预设创建。
- final seven-variant preset promotion。
- 发布/推广决策。

如果历史代码里已有 `Benchmark / Promotion` 相关模型或服务，v2 主 UI 不使用它们；可以临时保留为 legacy/expert/debug，但不要放进训练项目的正常路径。

## 3. 术语替换

普通 UI 尽量使用中文产品词，不直接暴露英文内部词。

- `Training Job` → `训练项目`
- `LoRA Template / Recipe` → `训练方案` / `系统训练方案`
- `canonical` → `人设参考图`，简称 `人设图`
- `Prompt Card` → `提示词卡`
- `section` → `训练集模块`
- `generation run` / `run` → `生成批次` / `重跑记录`
- `candidate image` → `候选训练图`
- `dataset revision` → `训练集版本`
- `training run` → `训练任务` / `训练执行`
- `artifact` → 普通 UI 不展示；报告里可叫 `产物文件`
- `benchmark` → 从本模块移除；以后若需要，独立为 `LoRA 测试`
- `promotion` → 从本模块移除；以后若需要，独立为 `预设创建/发布`

## 4. 用户可见字段

### 4.1 新建训练项目页只保留

路径建议：`/character-lora-training/new`

必填：

- 项目名。
- 触发词。
- 初始参考图。
- 训练基底 checkpoint 文件：从模型管理模块选择，不手填路径。

不保留：

- 一句话备注目标。该字段删除。
- Base checkpoint 名称。
- Base checkpoint 路径。
- Base checkpoint hash。
- Base family。
- Caption 策略/模式选择器。
- training scope JSON。
- derived states JSON。
- advanced experiment。
- provider/model/tool 参数。
- trainer 参数。

说明：项目名、触发词、参考图、checkpoint 已足够让外部 Agent 接手后续编排。其他目标/约束应该在人设图、提示词卡或训练集模块的自然语言修正中逐步表达，而不是在创建页提前塞一个模糊备注。

### 4.2 项目过程中用户能看到/编辑

- 人设参考图候选与当前选中人设参考图。
- 提示词卡：
  - 角色核心特征。
  - 服装/形态特征。
  - 负面约束。
  - 最终完整提示词。
- 训练集生成提示词模板：按训练集模块展示，不让用户维护内部模板 JSON。
- 每个训练集模块生成的候选训练图。
- 每张候选训练图的 caption 草稿：外部 Agent 通过接口默认补齐，人类可单图编辑。
- 图片审核：保留/排除。
- 自然语言修正入口：
  - 针对人设参考图。
  - 针对提示词卡。
  - 针对某个训练集模块。
  - 针对某个生成批次。
- 开始训练按钮。
- 训练进度。
- 训练完成后的 LoRA 文件列表与文件 hash。

### 4.3 普通 UI 必须隐藏

- checkpoint 绝对路径、hash、base family。
- caption strategy / caption policy 选择器。
- provider 参数。
- image generation size / quality / host model 等。
- trainer 超参：rank、alpha、lr、batch size、precision、epochs、steps、save interval、seed、network args 等。
- artifact root、内部 ID、worker task、queue payload。
- debug mock 按钮。
- benchmark matrix、weight matrix、promotion decision。

这些可在 `/character-lora-training/:id/expert` 或自动报告里展示，但不是普通流程的一部分。

## 5. checkpoint 职责边界

### 5.1 结论

checkpoint 相关信息应该基于现有模型管理模块改，不应该由 LoRA 训练模块维护一套独立 checkpoint 表单。

当前代码里已经有模型资产相关能力：

- `src/server/services/model-asset-service.ts` 支持 `kind: "checkpoint"`。
- `browseModelDirectory(kind="checkpoint")` 可浏览 checkpoint 文件。
- `hashModelFile(kind="checkpoint")` 可计算文件 hash。
- Prisma 里 `LoraAsset` 实际已经通过 `modelType` 支持 `lora` / `checkpoint` 一类资产记录。
- 前端已有 `src/app/assets/models/model-file-manager.tsx`，可以管理 `LoRA` 和 `checkpoint` 文件。

因此 v2 应改为：LoRA 训练项目只引用“模型管理模块中的 checkpoint 资产/文件”，不让用户在训练模块里填 checkpoint 细节。

### 5.2 推荐实现

短期实现：

- 新建页使用模型管理模块的 checkpoint picker。
- 表单提交只传 `checkpointAssetId` 或 `checkpointRelativePath`。
- 服务端调用模型资产服务 resolve：
  - 文件名。
  - 相对路径。
  - 绝对路径。
  - sha256：必须自动计算或读取模型管理缓存，不让用户手填。
  - 文件大小。
  - `baseFamily`：从模型管理模块读取。
- LoRA 训练项目保存一份 checkpoint snapshot 用于复现。snapshot 只给 expert/report 看。

中期改造：

- 把 `LoraAsset` 泛化/重命名为 `ModelAsset`（如果成本可控）。
- 对 checkpoint 资产增加 metadata：
  - `baseFamily`：例如 `sdxl` / `illustrious` / `pony` / `sd15`，在模型管理里填一次即可复用。
  - `displayName`。
  - `source`。
  - `notes`。
- LoRA 训练项目引用 `checkpointAssetId`，同时保留 snapshot 字段，避免模型管理信息后续变化影响历史训练复现。

### 5.3 base family 怎么处理

普通用户不在 LoRA 训练模块里填 `baseFamily`。

- `baseFamily` 属于 checkpoint 资产元数据，应在模型管理模块里维护。
- 创建训练项目时，系统从模型管理读取并写入训练项目 snapshot。
- 如果某个 checkpoint 还没有 `baseFamily`，训练模块只提示“请先到模型管理补充模型类型”，不在训练页提供临时手填入口。
- 第一版不做 Manager 内置诊断/自动推断，避免把职责重新塞回训练模块；外部 Agent 如需判断，也是在 Manager 外部完成后通过接口写入结果。

不要在创建表单中暴露 `Base family`。

## 6. 训练方案模板与默认训练配置是什么

`trainingDefaults` 中文叫：**默认训练配置**，更准确地说应归属于一个**训练方案模板**。这里的“固定”不是“永远不可修改”，而是：新建训练项目时默认继承模板，避免用户每次都重新决策。

它不是普通用户的新建表单字段，而是系统用于自动生成 `training.toml` 和 per-image caption 草稿的参数/规则集合。例如：

- 分辨率：`1024`。
- LoRA rank / dim：如 `32`。
- alpha：如 `16`。
- UNet learning rate。
- Text Encoder 是否训练及 learning rate。
- batch size。
- gradient accumulation。
- 目标 step 数。
- save interval。
- precision：`bf16` / `fp16`。
- caption（训练图文本标签）默认填写规则/模板。
- repeats / epochs 计算规则。
- sd-scripts/kohya 的 network args。

第一版策略：

- 对普通用户默认使用一套训练方案模板，创建项目时自动选择。
- 模板可以在系统/外部 Agent/expert 层修改或新增；项目开始训练前会保存当时采用的模板快照，保证可复现。
- 如确实存在 SDXL/Illustrious/SD15 这种不可兼容差异，可按模型管理里的 `baseFamily` 自动选择系统内置模板，但仍不让普通用户每次创建项目时决策。
- 普通 UI 不做训练参数调参；完整 `training.toml`、超参和模板快照只放 expert/report。

用户能看到的只应该是简化后的摘要，例如：

- 训练方案：角色 LoRA 默认方案。
- 训练集：已确认 64 张图。
- 预计训练步数：约 2000 steps。
- 输出：LoRA 文件保存到模型目录。

## 7. 隐藏高级参数后的卡点处理

第一版不做失败诊断和下一步建议，只做**机械完整性检查**：缺少必需输入时禁用按钮并显示原因；不判断“质量是否好”、不推荐回到哪一步。

需要系统自动处理的卡点：

- checkpoint hash：由模型管理/模型资产服务自动计算或读取缓存。
- base family：在模型管理模块为 checkpoint 填一次，训练模块只读取。
- 人设参考图：作为用户确认的身份锚点；没有选中时不能继续生成训练集。
- caption（训练图文本标签）：外部 Agent 根据图片内容和模板规则填写/修改，并通过接口写回；系统保存每图字段；普通用户不选择策略，但可以在图片详情里手动编辑。
- 训练集版本：用户确认后固定本次训练实际使用的图片和文本标签，训练只读取这个版本。
- 训练参数：第一版默认继承训练方案模板；必要时按模型管理里的 `baseFamily` 选择内置模板，但不让普通用户每次调参。

### 7.1 “关键特征”是什么，是否由用户判断

关键特征指用户希望 LoRA 学住、且训练图/提示词里需要保持一致的角色识别点，例如：

- 发型、刘海、发色。
- 眼睛颜色/形状。
- 脸型、年龄感、体型比例。
- 主要服装、鞋袜、配饰。
- 角色特有标志物、纹样、发饰、角、尾巴等。
- 明确不要学进去的东西，例如背景、其他角色、截图边框、临时表情、错误服装。

第一版不做“关键特征策略”设置，也不做 Manager 内置覆盖诊断。外部 Agent 默认根据参考图和用户自然语言把这些字段填进提示词卡，并通过接口写回；系统只负责提供结构化字段、版本记录和编辑入口。人类可以手动改，最终以用户确认的提示词卡版本为准。

### 7.2 训练集模块是否由用户判断

可以。训练集模块第一版只提供结构化分组和图片墙，不做覆盖诊断。

- 系统提供固定模块，例如正面、侧面、背面、半身、表情、鞋袜细节、动作姿势。
- 用户查看每个模块生成的图，决定保留、排除或自然语言重跑。
- 系统只显示数量和状态，不判断“是否足够好”。
- 是否继续训练由用户决定；系统只拦截机械性缺失，例如没有任何保留图、没有确认训练集版本、没有 checkpoint。

### 7.3 caption 怎么处理

这里的 caption 不是视频字幕，而是每张训练图旁边的文本标签/描述，训练时模型会一起读取。第一版不要做复杂的“caption 策略”设置页，也不要让用户在创建项目时选择 caption policy。

处理方式：

- 外部 Agent 根据图片内容、触发词和训练方案模板，为每张候选训练图填写 caption 草稿，并通过批量接口写回。
- 每张图的 caption 默认以触发词开头。
- caption 应保留可控的可见信息，例如姿势、视角、表情、服装、鞋袜、背景。
- caption 应避免让背景、截图 UI、其他角色、错误服装绑定到触发词。
- 系统侧只做字段保存、版本记录、批量编辑和单图编辑，不做复杂策略选择器。
- 普通用户可以在图片详情里看到/必要时编辑单张图文本标签；如果用户不想填，由外部 Agent 通过 Manager 接口补齐。

### 7.4 “确认训练集版本”是什么

旧文档里的“冻结快照”改名为“确认训练集版本”。它的意思是：用户点确认后，系统记录本次训练实际使用的固定清单。

记录内容包括：

- 哪些候选训练图被保留。
- 每张图对应的 caption。
- 使用的是哪个人设参考图版本。
- 使用的是哪个提示词卡版本。
- 使用的是哪个 checkpoint snapshot。
- 使用的是哪个训练方案模板快照 / 默认训练配置快照。

这样做的目的：用户后续继续改图、改提示词或重跑模块时，不会悄悄改变已经开始/已经完成的训练任务。

## 8. 新页面结构

### 8.1 `/character-lora-training`

列表页，类似 `/projects`。

展示：

- 项目名。
- 触发词。
- 状态。
- 人设图缩略图。
- 已保留训练图数量。
- 最近训练状态。
- 更新时间。
- 新建按钮，跳转 `/character-lora-training/new`。

禁止：

- 不放创建表单。
- 不放 checkpoint/path/hash/family 表单。
- 不放训练超参。

### 8.2 `/character-lora-training/new`

独立新建页。

字段：

- 项目名。
- 触发词。
- 初始参考图。
- checkpoint 文件选择器。

提交后：

- 创建训练项目。
- 保存 checkpoint snapshot。
- 上传参考图。
- 自动选择默认训练方案。
- 跳转项目总览。

### 8.3 `/character-lora-training/:id`

项目总览页。

展示：

- 当前阶段。
- 当前状态。
- 机械缺失项，例如未选择人设参考图、未确认训练集版本、没有保留图。
- 人设参考图预览。
- 提示词卡状态。
- 训练集模块完成度。
- 已保留训练图数量。
- 最近训练任务状态。
- 当前阶段可执行按钮，例如进入人设参考图、进入训练集、开始训练。

不展示：

- 完整 pipeline 的所有操作。
- debug panels。
- worker payload。
- benchmark/promotion。

### 8.4 `/character-lora-training/:id/persona-reference`

人设参考图页面。

原 `canonical` 概念在普通 UI 中统一叫 `人设参考图`，代码内部可以暂时保留 canonical 命名。

功能：

- 上传/选择初始参考图。
- 生成人设参考图候选。
- 选择当前人设参考图。
- 用自然语言要求重跑，例如“脸更像第二张参考图，头发不要变短”。

### 8.5 `/character-lora-training/:id/prompt-card`

提示词卡页面。

功能：

- 外部 Agent 根据参考图和用户自然语言填写初版角色核心特征，并通过接口创建提示词卡草稿/版本。
- 查看/编辑角色核心特征。
- 查看/编辑服装/形态特征。
- 查看/编辑负面约束。
- 查看完整最终提示词。
- 从自然语言修正生成新版本。

### 8.6 `/character-lora-training/:id/sections`

训练集模块列表。

每个模块展示：

- 中文模块名，例如正面、侧面、背面、半身、表情、鞋袜细节、动作姿势。
- 目标数量。
- 已生成数量。
- 已保留数量。
- 用户标记/备注。
- 进入详情按钮。

### 8.7 `/character-lora-training/:id/sections/:sectionId`

单个训练集模块详情。

功能：

- 展示该模块的生成提示词模板。
- 展示生成批次历史。
- 展示所有候选训练图。
- 保留/排除图片。
- 展示每张图的 caption 草稿；外部 Agent 可通过批量接口补齐/修正，人类可单图手动编辑。
- 自然语言重跑，例如“背面裙摆不对，参考这张图重新生成”。
- 可上传局部参考图用于重跑。

### 8.8 `/character-lora-training/:id/dataset`

训练集确认页。

功能：

- 展示所有保留图片。
- 简要展示 caption 状态。
- 基础完整性检查：是否有保留图、是否有 caption、是否有人设参考图、是否有 checkpoint；不做质量诊断。
- “确认训练集版本”按钮。

### 8.9 `/character-lora-training/:id/training`

训练页。

功能：

- 展示当前训练集版本。
- 展示训练方案模板/默认配置摘要。
- 开始训练按钮。
- 训练进度。
- 日志摘要。
- 训练完成后的 LoRA 文件列表、hash、路径。

不展示：

- LoRA 测试。
- 推荐权重。
- benchmark。
- 是否发布。
- 预设创建。

### 8.10 `/character-lora-training/:id/expert`

专家/诊断页，不作为普通流程入口。

可展示：

- checkpoint path/hash/base family snapshot。
- 完整 training.toml。
- caption 默认填写规则/模板、批量编辑记录。
- provider params。
- worker tasks。
- artifacts。
- raw logs。
- report JSON。

## 9. 后端影响范围

### 9.1 保留

现有后端大部分 runtime 可保留：

- `CharacterLoraTrainingJob`。
- `CharacterLoraTrainingTemplate`。
- `CharacterLoraSectionTemplate`。
- `CharacterLoraJobSection`。
- `CharacterLoraGenerationRun`。
- `CharacterLoraCandidateImage`。
- `CharacterLoraDatasetRevision`。
- `CharacterLoraTrainingRun`。
- worker queue。
- artifact/report/training service。

### 9.2 需要改/新增

- 新建项目 facade：只接受普通字段，自动补 checkpoint snapshot、训练方案模板、artifact root。
- checkpoint resolver：复用模型管理模块。
- 页面级 view model：不要让前端或外部 Agent 直接吃完整 job/report。
- 外部 Agent 操作 API：提供读取项目状态、图片列表、提示词卡、模块、候选图、caption、训练集版本、训练任务的接口；提供写入提示词卡版本、候选图 review、caption、生成批次、训练集版本、训练任务的接口。
- workflow status：只返回当前阶段和机械缺失项，不返回下一步建议。
- 基础完整性检查：训练前检查人设图、提示词卡、保留图、caption、训练集版本、checkpoint；不做失败诊断或质量建议。
- training summary：普通页面只拿训练摘要和输出文件。

### 9.3 需要从主流程移除/下线

- Benchmark service/action/page 在 v2 普通流程中不使用。
- Promotion decision/preset creation 在 v2 普通流程中不使用。
- job detail 里的 DebugPanel 不进入普通页面。
- 当前 `job-workbench-client.tsx` 可以临时迁移为 expert/debug 页面，不能作为 `/character-lora-training/:id` 主页面。

## 10. 训练完成后展示什么

训练完成页只展示：

- LoRA 文件名。
- LoRA 文件路径或模型管理资产链接。
- sha256。
- 文件大小。
- 对应训练集版本。
- 对应训练配置。
- 训练日志摘要。
- 可选：导入/登记到模型管理模块。

不展示：

- 推荐权重。
- 是否建议发布。
- 测试结果。
- 预设创建。

原因：权重选择和发布判断来自 LoRA 测试/应用场景，不属于“训练出文件”这个模块边界。

## 11. 关于推荐权重和 benchmark 的解释（旧方案废弃）

旧方案里的 `推荐权重` 本质上来自 LoRA 测试：把训练出的 LoRA 以多个权重（例如 0.45、0.65、0.85、1.0）加载到多个测试 prompt / workflow / checkpoint 里，比较角色相似度、服装稳定性、画面破坏程度，然后选一个默认权重。

旧方案里的 `benchmark` 是这种测试矩阵：

- 多个 LoRA checkpoint/训练步数。
- 多个 LoRA 权重。
- 多个测试提示词或 Manager section。
- 输出对比图和诊断。

旧方案里的 `是否建议发布` 是基于测试结果判断这个 LoRA 是否值得进入 Manager 预设/角色配置。

v2 决定：这些全部不放在 LoRA 训练模块。未来如果需要，应单独做：

- `/lora-evaluation` 或模型管理中的 `测试 LoRA`。
- `/preset-creation` 或原角色预设模块。

LoRA 训练模块只产出可测试的 `.safetensors` 文件和复现报告。

## 12. 实施优先级

### P0：入口和边界止损

- `/character-lora-training` 改成纯列表页。
- 新增 `/character-lora-training/new`。
- 创建页删掉一句话备注目标和所有高级字段。
- checkpoint 选择改用模型管理模块。
- `/character-lora-training/:id` 不再渲染旧 mega-workbench；旧页面迁移到 expert/debug。
- 从主导航/主页面移除 benchmark/promotion/test/preset 创建入口。

### P1：外部 Agent 可操作的项目总览

- 新建项目总览 view model。
- 增加 workflow status / 机械缺失项；不要内置 Agent next-action 推理。
- 中文化阶段和按钮。
- 显示人设图、提示词卡、训练集、训练状态摘要。

### P2：拆分人设图、提示词卡、训练集模块

- 人设参考图页面。
- 提示词卡页面。
- 训练集模块列表页。
- 单个训练集模块详情页。
- 自然语言重跑入口。

### P3：训练集确认和训练页

- 训练集确认页。
- 基础完整性检查：缺人设参考图、缺保留图、缺 caption、缺 checkpoint 时阻止训练；不做质量诊断或下一步建议。
- 训练方案模板/默认配置摘要。
- 开始训练。
- 训练进度。
- LoRA 文件输出。

### P4：专家页和报告

- expert/debug 页保留内部字段。
- 生成训练报告。
- 确保训练可复现。

## 13. Codex 实现提示

不要继续在当前 `/character-lora-training` 表单上加字段，也不要继续扩展 `job-workbench-client.tsx` 的普通体验。

正确方向：

1. 先拆路由和页面职责。
2. 再增加用户友好的 facade/view model。
3. 再逐步把旧 workbench 的功能搬到对应中文页面。
4. benchmark/promotion/preset 相关 UI 从训练模块主路径删除。
5. 所有内部字段只进 expert/report。
6. 不要实现 Manager 内置 Agent 或 `/agent-tasks` 式接口；应暴露资源级 HTTP/action 接口，让 Hermes 这类外部 Agent 通过浏览器 use 或 HTTP 调用来编排。
