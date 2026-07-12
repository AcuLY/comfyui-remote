## ADDED Requirements

### Requirement: 已批准的文档架构
仓库 `SHALL` 实施用户批准的文档架构：以根 `README.md`、`AGENTS.md`、`ARCHITECTURE.md`、`PRODUCT.md` 和 `DESIGN.md` 为入口；在 `docs/**` 下建立当前产品、架构、详细设计和运行手册层；建立最小 `docs/_meta/**` 治理控制面；在 `.codex/skills/docs-audit/**` 提供必须显式调用的仓库 Skill；并提供诚实的 `QUALITY_SCORE.md`、`RELIABILITY.md` 和 `SECURITY.md` 占位文档。

每个保留的文档目录都必须以 `README.md` 作为入口页。目标结构不得包含平行 `FRONTEND.md`、`PLANS.md`、`docs/exec-plans/**`、`docs/history/**`、`docs/archive/**` 或 `docs/prototypes/**` 表面。

#### Scenario: Agent 进入仓库
- **WHEN** Agent 打开根文档入口
- **THEN** 必须在已批准根路径找到项目、智能体策略、架构、产品与设计地图
- **AND** 详细当前知识必须可从 `docs/README.md` 到达

#### Scenario: 检查保留的文档目录
- **WHEN** 一个目录包含维护中的文档
- **THEN** 必须提供 `README.md` 入口页，声明目录目的、权威、读取触发条件和子路由

#### Scenario: 引入禁止的平行层
- **WHEN** 已跟踪变更新增或恢复禁止的文档或规划表面
- **THEN** 文档校验必须失败，并报告冲突路径与已批准 owner

### Requirement: 证据类别与权威保持显式
受治理知识 `SHALL` 区分已验证当前实现、活动 OpenSpec 变更中的已批准目标行为，以及可从 Git 或已归档 OpenSpec 变更恢复的历史意图。任何类别都不得静默取代另一类别。

当前描述性文档必须解释已验证实现行为，不得把已批准但未实施的目标声明为当前事实。OpenSpec 必须继续作为拟议行为、变更设计、实施任务、验证和变更归档的权威。

#### Scenario: 旧设计意图与实现冲突
- **WHEN** 历史材料与当前源码、schema、测试或必要 runtime evidence 不同
- **THEN** 维护文档必须描述已验证当前行为
- **AND** 历史意图必须可通过 Git 恢复，不得复制进 current-history 目录

#### Scenario: 已批准目标尚未实施
- **WHEN** 活动 OpenSpec 变更描述了尚未 `apply` 和验证的行为
- **THEN** 当前描述性文档不得把该行为表述为已实施
- **AND** 必须把读者路由到对应活动变更查看拟议目标

### Requirement: 渐进披露与可导航知识图
`AGENTS.md` `SHALL` 保持为简洁的策略与路由入口。`docs/README.md` 和各目录 `README.md` 必须渐进地把 Agent 路由到任务所需的最小当前来源，不重复下游完整内容。

每个维护中的当前文档都必须能从已批准入口到达；每个详情文档都必须反向链接到其责任方入口页或治理根契约。

#### Scenario: Agent 开始限定范围的任务
- **WHEN** 任务匹配声明的读取触发条件
- **THEN** `AGENTS.md` 或 `docs/README.md` 必须指出下一份必要责任方文档或运行手册
- **AND** 不得强制读取无关文档

#### Scenario: 当前文档成为孤立项
- **WHEN** 没有已批准根入口或目录入口能到达维护文档
- **THEN** 文档校验必须失败并报告缺失路由边

#### Scenario: 详情文档重复根契约
- **WHEN** 详情文档尝试重新定义根产品、架构、设计或策略权威，而不是链接到根契约
- **THEN** 语义审计必须报告重复权威供处理

### Requirement: 最小机器治理控制面
`docs/_meta/**` `SHALL` 只包含文档治理 README、机器可读文档 schema、结构与链接策略和当前文档编写模板。不得包含产品或架构事实、人工同步的逐文件登记表、生成式审计报告、OpenSpec 工件模板或第二规划生命周期。

逐文档元数据在文档实例处拥有权威。`_meta` schema 与策略定义有效配置和约束，但不重复每个文档的实例值。精确的源码到文档关系必须类型化为确定性 `contract` 或语义 `review`，不能共享含糊的更新触发含义。

#### Scenario: 新增或修改受治理文档
- **WHEN** 文档校验读取该文档
- **THEN** 其适用配置、责任方、权威、状态、读取触发条件、类型化来源关系、证据和验证契约必须无需猜测路径即可解析

#### Scenario: 校验 runbook
- **WHEN** 文档使用 runbook profile
- **THEN** 元数据还必须标明适用环境、风险边界、最后验证状态和恢复路径

#### Scenario: 已存在生成工件
- **WHEN** 现有文档由 generator 所有
- **THEN** 元数据必须标明生成器、源码输入、重新生成命令和非写入检查
- **AND** 不得因此要求把文档移入 generated 目录

#### Scenario: 声明来源关系
- **WHEN** 策略将源码路径映射到维护文档
- **THEN** 映射必须声明带确定性非写入验证器的 `contract`，或带理由与责任方的 `review`
- **AND** 必要确定性契约不得降级为警告或语义审查

### Requirement: OpenSpec 是唯一重要变更生命周期
仓库 `SHALL` 以 OpenSpec 提案、行为规范、变更设计、任务、`apply`、验证和归档约定作为重要变更的唯一生命周期。遗留 `Superpowers` 规范、实施说明、执行计划、充当计划的 PRD 和 `docs/plans/**` 规划权威必须按归属提取或迁移，然后删除。

本子变更 `tasks.md` 必须是本阶段完整实施任务计划；不得创建独立 ExecPlan、`PLANS.md` 或详细实施计划工件。

#### Scenario: 提出重要工作
- **WHEN** 工作修改能力、架构、性能契约或全仓策略
- **THEN** 实施前必须以 OpenSpec 变更表示
- **AND** 不得让平行 plan 或 spec 文档成为权威

#### Scenario: 遗留规划内容包含当前事实
- **WHEN** 语义审计验证某事实仍描述已实施行为
- **THEN** 必须把该事实重写进其当前 owner 文档或现行 spec
- **AND** 随后删除遗留规划工件

#### Scenario: 非 plan 数据集存于 docs/plans
- **WHEN** 审计证明文件是运行时输入、基准 fixture 或生成式分析输出，而不是计划
- **THEN** 必须把它们迁移到代码、测试 fixture、配置或工件责任方
- **AND** 不得保留 `docs/plans/**` 作为命名例外

### Requirement: Agent 策略与 runbook 权威分离
`AGENTS.md` `SHALL` 是普通开发强制 Agent 工作流策略的唯一权威，包括触发条件、默认行为、禁止项和安全边界。`docs/runbooks/**` 必须是可执行操作步骤、命令、预期结果、失败处理和恢复的唯一权威。显式调用的 `$docs-audit` Skill 必须拥有自身语义审计工作流，且不得复制进 `AGENTS.md` 或暴露为第二运行手册入口。

新责任方中的策略与步骤验证通过后，必须将 `agent-rules/**` 与所有引用它的文档、OpenSpec 配置、生成器和测试原子删除。不得保留兼容桩或人工同步投影。

#### Scenario: 任务没有操作 trigger
- **WHEN** Agent 为不涉及 Git 交付、本地服务、部署、认证或其他已声明操作的任务读取 `AGENTS.md`
- **THEN** Agent 必须获得适用硬边界，而无需加载无关运行手册命令

#### Scenario: 触发部署操作
- **WHEN** 任务需要生产构建、同步、队列中断、服务重启或公开验证
- **THEN** `AGENTS.md` 必须要求读取适用部署运行手册
- **AND** 运行手册必须包含可执行序列和恢复行为

#### Scenario: Agent 规则迁移完成
- **WHEN** 新策略与运行手册通过契约和导航测试
- **THEN** 已跟踪仓库中必须不存在 `agent-rules/**` 及其任何 live reference

#### Scenario: 普通开发修改文档或源码
- **WHEN** 用户请求或已批准 OpenSpec 任务均未显式调用 `$docs-audit`
- **THEN** `AGENTS.md`、来源映射与文档路由不得自动运行 Skill
- **AND** `docs:check` 仍可运行确定性契约检查与非阻断审查诊断

### Requirement: 用于文档语义审计的显式仓库 Skill
仓库 `SHALL` 提供 `.codex/skills/docs-audit/**` 作为必须显式调用的唯一 `$docs-audit` 执行表面，处理确定性工具无法证明的语义缺陷，包括过时声明、覆盖缺失、重复权威、部分实现、无效运行手册步骤和当前与目标混淆。不得增加受控 `docs:read` CLI、文档 MCP 网关、普通开发自动触发器或定时审计作业。

调用必须接受 `changed`、显式仓库相对 `paths`、活动 OpenSpec `change <id>` 或 `full` 范围。`report` 是默认操作且不写入。显式 `record` 只能写已批准 OpenSpec 任务在该变更的 `evidence/docs-audit/**` 下命名的限定审计证据，不得编辑被审计文档。高置信度文档修改必须使用显式 `fix` 操作，并在同一范围通过前接受独立语义审查。审计必须检查源码、schema、测试、Git 历史与必要运行时证据；把声明分类为当前实现、已批准目标或历史意图；并对审计范围生成 `keep`、`rewrite`、`move`、`split`、`merge`、`extract-delete`、`delete` 或 `user-decision-required` 处置。

临时审计在调用任务中返回报告，不写永久台账。需要持久证据的已批准 OpenSpec 任务必须显式调用 `record` 或 `fix` 并命名限定证据路径。调度留给未来另行批准的决策。

#### Scenario: 静态证据证明唯一当前修正
- **WHEN** 源码、schema、测试或无歧义 Git 历史只支持一个当前行为修正
- **THEN** 只读审计必须提出该修正并引用证据
- **AND** 显式 `fix` 模式可以应用修正、运行责任方验证并要求独立审查

#### Scenario: 证据冲突或不完整
- **WHEN** 仍有多个合理解释、必要运行时证据不可用，或决策改变产品方向或权威
- **THEN** Agent 必须保留不确定性
- **AND** 重写当前事实前请求用户判断

#### Scenario: 结构检查通过但语义过时
- **WHEN** 文档 metadata 与 link 有效，但和已验证行为矛盾或包含不安全操作序列
- **THEN** 语义审计必须让该范围失败，并指出冲突声明与证据

#### Scenario: 请求语义审计但未给 scope
- **WHEN** 用户显式调用 `$docs-audit` 但没有更窄 scope
- **THEN** 存在安全 merge base 时 Skill 必须使用 changed scope
- **AND** 无法安全建立变更影响闭包时必须使用完整范围

#### Scenario: 修复高置信度 finding
- **WHEN** 显式授权的审计应用一个有证据支持唯一答案的修正
- **THEN** 独立 Agent 或审查者必须按相同证据合同验证变更范围
- **AND** 修复者不得签署自己的语义通过

#### Scenario: OpenSpec 任务请求审计记录
- **WHEN** 已批准任务显式调用 `$docs-audit ... record` 并命名证据输出
- **THEN** Skill 只能写该限定审计证据
- **AND** 必须保持被审计文档及其他所有 path 不变

#### Scenario: 未授权写操作
- **WHEN** 调用 `$docs-audit` 时没有 `record` 或 `fix`
- **THEN** Skill 不得写任何仓库文件

#### Scenario: 无法进行独立审查
- **WHEN** 审计已应用修改，但没有独立审查者可运行
- **THEN** 结果必须保持 `review-required`
- **AND** 不得记录为通过的语义审计

### Requirement: 根据证据重建当前文档
每个保留的当前文档 `SHALL` 逐节对照责任方实现、schema、测试与必要运行时行为审查。内容按知识归属移动，而非机械目录改名；必须消除重复当前权威。

匹配确定性 `contract` 关系的代码或配置变更，必须在同一变更中更新并重新验证责任方文档，或满足其精确非写入无内容变化验证器。匹配语义 `review` 关系必须生成非阻断审查诊断，不得自动运行 `$docs-audit`；但阶段验收前每条诊断都必须有显式处置。

#### Scenario: 迁移混合遗留文档
- **WHEN** 一个文件同时包含产品意图、架构、操作命令和过时实施说明
- **THEN** 每个已验证章节必须移到对应产品、架构或运行手册责任方
- **AND** 过时或未验证章节不得复制为当前事实

#### Scenario: 责任方源码变化
- **WHEN** 变更路径匹配文档的确定性 `contract` 关系
- **THEN** 本地与 CI 校验必须要求责任方文档更新或精确的无内容变化证明
- **AND** 必要契约缺失或过时时必须失败

#### Scenario: 匹配语义审查关系
- **WHEN** 变更路径匹配 `review` 关系
- **THEN** 确定性校验必须生成带责任方与关系证据的警告
- **AND** 普通开发不得自动调用 `$docs-audit`

### Requirement: 提取 archive 知识并删除 archive
迁移基线中 `docs/archive/**` 下每个已跟踪项 `SHALL` 接受是否仍含有效当前知识的审查。已验证持久知识必须在源删除前纳入当前责任方；没有当前价值的内容直接删除，不创建替代文档。

完成后的仓库不得包含 `docs/archive/**`、`docs/history/**`、指向任一路径的实时链接，也不得有代码或测试把已删除历史材料视为当前权威。Git 与 OpenSpec 归档提供历史恢复。

#### Scenario: 测试把归档路线图当作权威
- **WHEN** 迁移发现测试、脚本或当前文档读取归档文件
- **THEN** 仍有效契约必须先移到当前代码、测试、策略或描述性文档
- **AND** archive 删除前必须更新 consumer

#### Scenario: Archive 内容没有当前价值
- **WHEN** 证据表明内容已过时、放弃、重复或从未实施
- **THEN** 必须删除，不创建历史替代项

#### Scenario: 宣布 archive 删除完成
- **WHEN** 最后 archive 批次被删除
- **THEN** tracked-file 与 reference check 必须证明 archive/history 文件和 live reference 均为零

### Requirement: 丢弃 Training 原型
本变更 `SHALL` 删除 `docs/prototypes/**` 下全部已跟踪文件，包括 Training HTML、CSS、JavaScript、图像、字体和原型元数据。还必须删除原型专用路由映射、清单分类、文档链接与治理测试，或改写为当前生产契约。

文档必须继续把 Training 作为与 Generation 平级、通过共享导航模式切换选择的生产工作模式；生产源码不得依赖已删除原型资产。

#### Scenario: 开始删除 prototype
- **WHEN** 删除 prototype 表面
- **THEN** 校验必须先证明生产源码不导入或加载原型专用资产
- **AND** 当前 Training 行为必须继续由生产源码与测试覆盖

#### Scenario: 仍有原型专用治理测试
- **WHEN** 测试要求已删除原型文件或映射存在
- **THEN** 必须删除该测试，或重写为验证当前生产边界

#### Scenario: Prototype 清理完成
- **WHEN** 宣布清理完成
- **THEN** 不得保留已跟踪原型文件、原型专用实时链接或历史副本
- **AND** 生产验证必须保留 Generation 与 Training 之间的共享导航模式切换

### Requirement: 延后 generated 与 reference 目录分类
本变更 `SHALL NOT` 创建 `docs/generated/**` 或 `docs/references/**`，也不得只为强制该区分而机械移动文档。除非有其他已批准迁移理由，现有生成式与参考资料类材料必须留在已验证当前责任方。

文档策略必须保留足够来源信息，以便在不决定永久目录分类的情况下验证现有生成器和人工维护证据。后续 OpenSpec 变更必须依据观察到的维护证据再引入任一目录。

#### Scenario: 校验现有生成式清单
- **WHEN** 其源码或生成器变化
- **THEN** 必须在当前已批准位置重新生成或检查现有工件
- **AND** 本阶段不得仅为它创建 generated 目录

#### Scenario: 文档可称为 reference
- **WHEN** 文档已有明确当前产品、架构、API、测试或运行手册责任方
- **THEN** 本阶段必须留在该责任方下

### Requirement: 有限治理 scope 与 Markdown 语义
文档策略 `SHALL` 列出有限范围矩阵。根入口与已批准 `docs/**` 当前知识接受文档元数据、拓扑、导航、关系和语义审计治理。OpenSpec 工件接受固定 OpenSpec 校验和内部链接检查，但不接受当前文档 frontmatter 或导航权威。项目 Skill 接受 Agent Skill 校验与内部链接检查，但不加文档 frontmatter。`src/**.md`、`tests/**.md` 等源码相邻 Markdown 必须显式注册、迁移或删除，不能由无限制通配规则接纳。

Markdown 校验必须使用 GitHub 风格 Markdown 解析和 GitHub 兼容标题 slug，包括重复标题后缀。围栏或缩进代码、行内代码、HTML 注释和非当前 OpenSpec 证据不得创建实时路径引用或导航边。内部相对链接与锚点必须确定；外部链接可达性、文档年龄、疑似正文重复与正文质量不得成为依赖网络的阻断项。

#### Scenario: 检查 OpenSpec artifact
- **WHEN** 提案、规范、设计、任务或证据文件位于范围内
- **THEN** 必须运行固定 OpenSpec 和适用 internal-link validation
- **AND** 不得把工件视为当前描述性文档，也不得要求加入当前导航图

#### Scenario: 检查项目 Skill
- **WHEN** 已跟踪项目 Skill 位于范围内
- **THEN** 仓库固定离线 `npm run skills:check` 必须校验 Agent Skill 元数据、随包参考资料可达性和仓库路径安全
- **AND** Skill 不得获得 current-document frontmatter

#### Scenario: 禁止遗留路径只作为证据出现
- **WHEN** 禁止路径被引用在代码示例、负向 fixture 或非当前 OpenSpec 证据中
- **THEN** 不得计为 live reference
- **AND** 指向该路径的链接、策略字段、源码或配置使用方或当前文档路由仍必须失败

### Requirement: 确定性非写入文档门禁
仓库 `SHALL` 公开一个稳定 `npm run docs:check` 引擎供本地与 CI 使用。`full` 模式必须是安全默认和必要验收与 CI 模式。显式 `fast` 模式可以从有效合并基准计算变更范围影响闭包；但基准不可用、策略、schema、OpenSpec、Skill 或生成器代码变化、文档移动或删除、根目录或导航权威变化，或无法安全限定影响时，必须升级到 `full`。`full` 模式始终运行所有当前状态结构、契约、生成器、OpenSpec 与 Skill 检查。无比较基准时，必须保守地把每个语义 `review` 关系作为警告发出，而非跳过审查覆盖；CI 和阶段验收调用必须提供显式比较修订版。引擎必须无网络运行、结果确定，并保留完整既有工作树状态。

门禁必须校验适用元数据配置、有限范围矩阵、允许结构、必需入口页、GFM 相对链接与锚点、根目录到责任方可达性、必需反向链接、禁止实时遗留路径、OpenSpec 结构、`contract` 与 `review` 关系、源码派生契约同步，以及现有生成器所有工件的新鲜度。

人类可读与 JSON 诊断必须共享稳定 schema，包括规则标识、`error`/`warning` 严重性、仓库相对路径、位置、证据、修复建议和责任方，并确定性排序。退出 `0` 表示没有确定性错误，`1` 表示规则违规，`2` 表示工具或配置失败。警告只能表示启发式审查事实，不得降级必要确定性契约。

#### Scenario: 文档有效
- **WHEN** 本地文档检查在合规检出中运行
- **THEN** 必须成功退出
- **AND** 即使检出已经很脏，前后快照也必须证明没有改变已跟踪、已暂存或原有未跟踪内容

#### Scenario: 文档违反确定性规则
- **WHEN** 元数据、结构、导航、链接、锚点、关系覆盖、OpenSpec 有效性或生成文件新鲜度无效
- **THEN** 命令必须以 `1` 退出，并提供稳定文件、位置、规则标识、证据、责任方与修复建议字段

#### Scenario: Fast scope 不安全
- **WHEN** `fast` 模式无法建立完整受影响文档与契约闭包
- **THEN** 同一引擎必须运行 `full` 模式，不得静默跳过检查

#### Scenario: `Full` 模式没有比较修订版
- **WHEN** `full` 模式无法解析合并基准且未提供显式基准
- **THEN** 必须运行所有确定性当前状态验证器
- **AND** 将每个语义 `review` 关系作为带责任方与缺少基准证据的警告发出

#### Scenario: 检查器自身失败
- **WHEN** 配置无法解析、Git 状态无法检查或必要适配器崩溃
- **THEN** 命令必须以 `2` 退出
- **AND** 必须将工具失败与仓库规则违规区分

#### Scenario: Generator 输出过时
- **WHEN** 现有源码输入不再匹配已提交生成器所有的文档
- **THEN** check mode 必须失败且不得重写文档
- **AND** 必须指出独立重新生成命令

#### Scenario: 易变 contract 漂移
- **WHEN** 已记录路由、方法、请求与响应、schema、MCP 或配置清单与责任方源码不同
- **THEN** source-contract check 必须失败并指出不匹配 contract 与 owner
- **AND** 手写解释不得成为未经验证的第二 inventory

### Requirement: 治理测试证明目标契约而非保留遗留结构
文档治理测试 `SHALL` 从已批准 schema 与策略派生。当现有测试硬编码过时路径、过时内容、重复权威、历史文档或不属于目标契约的实施细节时，必须重写或删除。

每个关键确定性规则族都必须包含有效 fixture 和证明失败的反例。

#### Scenario: 旧测试要求 agent-rules 或 archive 文件
- **WHEN** 已批准目标删除这些 path
- **THEN** 旧断言不得阻断迁移
- **AND** 替代覆盖必须验证新 `AGENTS.md`、运行手册或当前权威契约

#### Scenario: 静态检查器回退后不再发现违规
- **WHEN** 元数据、断链、孤立项、禁止路径、关系或生成文件漂移校验被削弱
- **THEN** 对应负向 fixture 必须使测试套件失败

### Requirement: 文档专用 CI 硬切换
清除全部范围内遗留违规后，纳入仓库的文档 CI 作业 `SHALL` 从干净检出运行与本地完全一致的非写入 `full` 模式门禁，证明干净结束状态，并在每条受保护合并路径成为必需项，且没有仅文档路径过滤器。阶段不得保留永久遗留白名单，也不得把仅警告作业视为完成。验收范围中每个警告与语义审计问题项都必须有显式、有证据的处置；每个确定性错误都必须解决。

该文档专用门禁不得预先选择后续统一仓库 CI 设计。

#### Scenario: 清理未完成
- **WHEN** 仍有确定性违规、必要语义决策、禁止路径或迁移引用
- **THEN** 文档阶段不得验收或归档

#### Scenario: 启用阻断式 CI
- **WHEN** 文档门禁提交验收
- **THEN** 证据必须包含使用受保护比较修订版的成功干净开始与干净结束完整运行、受控反例失败、恢复后的成功运行、无仅文档路径过滤器以及必需检查配置

#### Scenario: 验收时仍有警告
- **WHEN** 清理后仍有启发式审查警告或语义审计问题项
- **THEN** 验收证据必须记录其责任方、证据与显式处置
- **AND** 不得把确定性契约失败改称警告

#### Scenario: 没有 required-check 配置权限
- **WHEN** 可用权限无法修改仓库设置
- **THEN** 必须报告缺少的外部操作
- **AND** 阻断门禁任务必须保持未完成

### Requirement: 延后占位文档与未来集成保持诚实
`docs/QUALITY_SCORE.md`、`docs/RELIABILITY.md` 和 `docs/SECURITY.md` 初始 `SHALL` 只包含目的、延后状态、责任方、激活阶段与权威边界。不得声称未经验证的分数、SLO、安全模型或待办权威。

`Impeccable` 安装、根 `DESIGN.md` schema 转换、旁车生成、`Impeccable` Hook、检测器、评议报告与 CI 集成必须保持在本变更范围外，并需要独立批准 OpenSpec 变更。可观测性和工程规范内容同样延后到已批准阶段；父变更另行记录的本地路径匹配实验除外。

本变更证据目录下已脱敏 PreToolUse 路径匹配实验必须保持非规范且未安装，并排除为文档治理实现、插桩、CI 输入或验收证据。归档前卫生检查任务可以确认边界，但不得采用实验。它只能解释为尝试匹配仓库路径，不能解释为成功文件访问或理解。子变更归档后证据随归档可恢复；后续可观测性子变更只有在重新设计和验证后，才可引用或复制绑定摘要的快照。

用户另行授权的根级 Hook 后继实验必须保持在本子变更外。其已跟踪 Hook 与记录器只能生成被忽略的仓库本地 `logs/**` 与 `metrics/**`；这些文件的存在不得计为文档治理实现、插桩或验收证据。

#### Scenario: 激活前读取占位文档
- **WHEN** Agent 打开延后占位文档
- **THEN** 必须明确说明没有断言当前指标、SLO 或安全契约
- **AND** 将拟议工作路由到 OpenSpec

#### Scenario: 规划 Impeccable-compatible 文件
- **WHEN** 本变更建立根产品与设计位置和详细设计路由
- **THEN** 必须保留可行的未来集成边界
- **BUT** 不得安装、执行或强制 `Impeccable` 工件

#### Scenario: 后续阶段尚未批准
- **WHEN** 文档治理遇到期望的可观测性或工程策略内容
- **THEN** 只能记录当前已验证边界或占位文档
- **AND** 实现选择必须延后到后续用户批准的变更

#### Scenario: 子变更期间遇到 PreToolUse 实验
- **WHEN** Agent 审查保留的 Hook 源码、样例事件或名为 `access_total` 的聚合字段
- **THEN** 必须将其视为路径匹配尝试的非生产可行性证据
- **AND** 不得安装、扩展或接受为 documentation-governance instrumentation

#### Scenario: 遇到另行授权的后继 Hook
- **WHEN** Agent 遇到 `.codex/hooks.json`、`scripts/observability/agent_file_access_hook.py` 或被忽略的本地访问尝试数据
- **THEN** 必须将其视为用户授权、无服务、位于本子变更外的受限实验
- **AND** 不得推断成功读取、理解、生产可观测性验收或扩展实验的权限

### Requirement: 第一方文档默认使用简体中文
最终保留的第一方维护文档 `SHALL` 以简体中文书写 Markdown 正文、标题、表格说明，以及 frontmatter 中面向人的字符串。稳定技术形式是明确例外，包括技术标识、命令、路径、代码符号、路由、API/MCP/协议字段、第三方 Skill 原文、测试 fixture、数据载荷，以及 OpenSpec 解析器所需结构词。例外不得成为保留整段英文解释正文的借口。

`npm run docs:check` 必须包含确定性、非写入、结构感知的语言门禁。它必须只在受治理第一方文档的正文节点与面向人 frontmatter 字段中检查语言；围栏或行内代码、链接目标、机器字段和已声明技术 token 必须按类别排除。英文解释正文回归必须以错误阻断本地 `full` 检查与 CI，并提供稳定路径、位置、证据、修复建议和责任方。实现不得依赖宽泛逐文件白名单。

#### Scenario: 第一方当前文档包含英文解释正文
- **WHEN** 受治理文档的正文或面向人 frontmatter 字段新增非例外英文句子
- **THEN** 文档门禁必须失败，并定位该句子与 owner
- **AND** 该违规解决前文档阶段不得验收

#### Scenario: 文档包含合法技术英文
- **WHEN** 英文只出现在技术标识、命令、路径、协议字段、代码、路由、第三方 Skill、测试 fixture、数据载荷或 OpenSpec 结构 token 中
- **THEN** 语言门禁不得要求翻译或改写该内容
- **AND** 同一文档中的人类解释正文仍必须为简体中文

#### Scenario: 语言门禁提交验收
- **WHEN** 任务 `12.6` 提交完成
- **THEN** 证据必须包含中文正文有效 fixture、英文解释无效 fixture 和技术例外 fixture
- **AND** 必须证明本地与 CI 使用同一非写入检查器阻止英文正文回归
