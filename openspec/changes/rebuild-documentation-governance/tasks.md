## 1. `Apply` 门禁与只读基线

- [x] 1.1 将暂停会话交接协调进本修订版：显式 `$docs-audit`、类型化 `contract` 与 `review` 关系、`full` 与 `fast` 检查、稳定诊断、有限范围与解析器语义、脏工作树证明、CI 表面，以及归可观测性所有的 PreToolUse 证据。
- [x] 1.2 验证父变更已完成仓库固定的 OpenSpec 集成、原生生命周期指南和串行阶段顺序契约，且没有平行生命周期状态机。
- [x] 1.3 严格校验子变更提案、规范、设计和任务，并确认 OpenSpec 报告的 `apply` 工作流已就绪。
- [x] 1.4 将用户明确的阶段范围 `apply` 授权及 CLI 基线记录为简洁证据。
- [x] 1.5 使用 `git ls-files` 和非写入搜索，列出根文档、`docs/**`、`agent-rules/**`、OpenSpec 工件与证据、项目 Skill、源码相邻 Markdown、文档生成器、治理测试、存于文档目录下的运行时资产，以及所有入站实时引用。
- [x] 1.6 采集当前文档检查、聚焦治理测试、OpenSpec 校验和完整测试基线，区分既有失败与目标要求。
- [x] 1.7 将 `apply` 工作拆成按责任方划分的窄批次，明确验证与回滚命令；保留无关工作树修改，并提交完成批次，不积累无关脏文件。

## 2. 文档元数据控制面

- [x] 2.1 创建 `docs/_meta/README.md`、`documentation.schema.json`、`policy.yaml` 及已批准的 `document.md`、`directory-readme.md`、`runbook.md` 模板。
- [x] 2.2 定义通用路由、架构、产品、设计、API、测试、运行手册、占位文档、根文件和现有生成器元数据配置，不创建逐文件中央登记表。
- [x] 2.3 在 `policy.yaml` 编码有限范围矩阵、允许的文档根、强制 `README.md` 入口页、根目录与详情关系、禁止实时遗留路径、OpenSpec、Skill、证据与源码相邻规则，以及类型化 `contract` 与 `review` 来源关系。
- [x] 2.4 在 schema 中增加运行手册专用环境、风险、恢复和最后验证要求，以及延后占位文档要求。
- [x] 2.5 使用正反 fixture 增加元数据解析、配置选择、schema 校验和路径规范化测试。

## 3. 确定性文档检查

- [x] 3.1 先为 Git 支撑的范围枚举、诊断排序与 schema、退出码 `0/1/2`，以及对既有脏工作树的内容感知保持编写失败测试；再在 `scripts/docs/**` 实现共享非写入引擎。
- [x] 3.2 将 `full` 模式实现为默认与验收模式，并实现显式合并基准 `fast` 模式：计算完整影响闭包，任何不安全缩小条件均升级为 `full`；无基准的 `full` 模式运行全部确定性验证器，并把每个 `review` 关系作为缺少基准的警告，CI 与验收则必须提供显式基准。
- [x] 3.3 实现允许拓扑、必需入口页、有限范围、禁止实时路径、根目录与详情、OpenSpec、项目 Skill、证据和源码相邻策略检查。
- [x] 3.4 实现带精确源码位置的 GFM 相对链接与 GitHub 兼容重复锚点解析；代码、注释、负向 fixture 和非当前证据不参与实时引用语义。
- [x] 3.5 构建导航图；只对当前描述性文档强制 root-to-current 可达性与必要反向链接。
- [x] 3.6 基于合并基准实现 `contract` 关系阻断验证与非阻断、带责任方的 `review` 警告；不得降级确定性契约或自动运行 `$docs-audit`。
- [x] 3.7 重构现有文档生成器，提供独立写入模式和精确非写入检查模式，不把输出移动到新的生成文件目录。
- [x] 3.8 为现有仓库清单、Prisma 兼容文档、路由/API/MCP/配置契约及基线中发现的其他已验证生成器所有工件增加检查适配器。
- [x] 3.9 增加精确直接依赖 `js-yaml` `4.1.1`，实现仓库自有 `scripts/skills/validate.mjs`，公开 `npm run skills:check -- .codex/skills/docs-audit`，并把该离线验证器与仓库固定 OpenSpec 严格校验接入 `docs:check`。
- [x] 3.10 公开稳定的 `npm run docs:check` 命令，支持 `full`、`fast` 与人类可读/JSON 输出；外部可达性检查保持离线且非阻断。
- [x] 3.11 为元数据、范围、拓扑、链接、重复锚点、代码块假引用、可达性、反向链接、契约与审查映射、无基准的 `full` 行为、`fast` 升级、诊断与退出码、禁止实时路径、生成器漂移、畸形 OpenSpec 关系和 Skill 元数据与参考资料增加有效与无效 fixture。

## 4. 显式 `$docs-audit` Skill

- [x] 4.1 在没有 Skill 时，针对当前、目标与历史混淆、缺少运行时证明、重复权威、不安全操作、修复授权和自审创建代表性基线场景；编写 Skill 前记录观察到的失败。
- [x] 4.2 使用已批准 Agent Skill 工具初始化 `.codex/skills/docs-audit/**`；frontmatter 只在用户或已批准 OpenSpec 任务显式调用时触发；随后实现已变更范围、指定路径、OpenSpec 变更与完整范围，以及无写入 `report`、范围内仅证据的 `record` 和显式限定的 `fix` 操作。
- [x] 4.3 将证据优先级、问题项 schema、处置、升级、报告位置与路径限制规则、独立审查边界放入 Skill 及其单层参考资料；不创建审计运行手册、`AGENTS.md` 触发器、受控读取 CLI、MCP 网关、调度器或永久台账。
- [x] 4.4 使用 `npm run skills:check` 校验 Skill 包，独立测试报告、记录与修复写入，并反复运行相同基线场景，直到 Agent 能保留不确定性、执行授权与路径限制并拒绝自我签署。
- [x] 4.5 用全新 Agent 前向测试一个根路由、一个架构文档、一个 Training 文档和一条部署规则；独立审查修改并关闭发现的工作流缺口。
- [x] 4.6 从 `AGENTS.md` 经文档路由到责任方文档及验证入口执行代表性导航练习，记录死路和重复权威供后续批次处理，不把 `$docs-audit` 设为普通导航触发器。

## 5. 根入口与文档路由

- [x] 5.1 将根 `README.md` 重建为稳定的人类入口，删除易变的人工清单，并把详细事实路由到已验证责任方。
- [x] 5.2 用 `docs/README.md` 取代 `docs/index.md` 和 `docs/documentation-map.md` 的人类部分；把机器策略移到 `_meta/policy.yaml`，删除重复源。
- [x] 5.3 将根 `ARCHITECTURE.md` 重建为简洁当前架构地图，并指向 `docs/architecture/**`。
- [x] 5.4 创建根 `PRODUCT.md` 和已验证 `docs/product/**` 路由，覆盖 Generation、Training 与共享资源；保持 Training 是通过共享导航模式切换选择的平级工作模式。
- [x] 5.5 保留根 `DESIGN.md` 作为当前设计知识，仅创建有证据支持的 `docs/design/**` 详情文件，并推迟全部 `Impeccable` schema、Hook、检测器、旁车与 CI 变更。
- [x] 5.6 创建仅含元数据的延后 `docs/QUALITY_SCORE.md`、`docs/RELIABILITY.md` 和 `docs/SECURITY.md` 占位文档，不虚构指标、SLO、模型或待办权威。
- [x] 5.7 将 `CLAUDE.md` 保持为指向 `AGENTS.md` 的薄兼容指针，并测试它不能成为第二策略源。

## 6. 已验证的当前架构、产品、设计、API 与测试知识

- [x] 6.1 根据当前源码、schema、测试和必要运行时证据，审计并编写架构上下文、依赖模型、运行时拓扑、数据模型、Agent 接口和核心信念。
- [x] 6.2 审计并编写 Generation、Training 和共享资源架构领域路由，明确归属、依赖、失败与验证边界。
- [x] 6.3 将已验证的队列与 worker、Prisma provider、schema 兼容性和运行时边界提取到对应架构责任方，并删除被替代的分析来源。
- [x] 6.4 将当前 UI 与前端材料拆分为根视觉规则、详细 `docs/design/**` 模式、架构归属与运行手册和测试验证；每个责任方通过后删除重复源。
- [x] 6.5 把已验证的 `position_presets.md` 产品/prompt 知识迁移到 `docs/product/shared-resources/**`，更新全部当前链接。
- [x] 6.6 对照当前源码与测试审计 Agent API、MCP、route-template 和 workflow-contract 文档；`docs/api/**` 只保留不重复的当前契约知识。
- [x] 6.7 审计测试基础设施文档；`docs/testing/**` 只保留独立当前测试知识，可执行环境/验证序列移入 runbook。
- [x] 6.8 删除或拆分其余每个混合当前事实、目标设计、历史意图、操作步骤或重复清单的根目录与文档文件，并验证结果责任方链接。
- [x] 6.9 对任务 6.1 至 6.8 的每个责任方批次，显式调用 `$docs-audit paths <batch-owned paths> record`，且只写入 `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-<batch>.md`；任何已应用修正都必须经独立审查后才算该批次通过。

## 7. 运行手册与 Agent 策略原子切换

- [x] 7.1 建立并验证 Git 交付、开发服务、本地验证、部署编排、部署锁、队列安全、数据库同步、Next build、服务重启、部署验证和 `mypc` PowerShell runbook。
- [x] 7.2 重新核验本地与 `mypc` 执行、项目路径、端口、公开 URL、日志名、Prisma 同步策略、队列认证/恢复和进程定位；重大策略不确定时升级处理，不照抄旧值。
- [x] 7.3 将 `AGENTS.md` 重写为唯一简洁的普通开发硬策略与触发路由；除非另行修改，否则保留已批准提交、推送与部署语义，并排除 `$docs-audit` 规则和自动触发器。
- [x] 7.4 将 `CLAUDE.md`、`openspec/config.yaml`、根目录与文档路由、清单生成器和全部当前文档链接从 `agent-rules/**` 原子切换到新权威路径。
- [x] 7.5 重写治理测试，验证 `AGENTS.md` 硬边界、触发条件可达性、完整部署子运行手册、开发与生产隔离、token 安全和精确服务定位。
- [x] 7.6 删除全部 `agent-rules/**` 文件，证明不存在剩余跟踪文件或实时引用；不保留兼容桩或同步说明。
- [x] 7.7 显式调用 `$docs-audit paths AGENTS.md CLAUDE.md docs/runbooks openspec/config.yaml record`，只写入 `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-7-authority-cutover.md`，并在接受权威切换前要求独立审查。

## 8. 删除平行规划并迁移归属错误的数据

- [x] 8.1 审计遗留 `docs/superpowers/specs/**`、实施说明、计划文件、PRD、交接和进度记录；只把已验证当前知识提取到当前文档或现行规范。
- [x] 8.2 显式调用 `$docs-audit paths docs/superpowers docs/plans record`，只写入 `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md`；删除前独立审查每个 extract/relocation/deletion disposition。
- [x] 8.3 当前替代项通过后，删除全部 `Superpowers` 规划与规范权威、`PLANS.md`、ExecPlan 路由和非 OpenSpec 计划指令。
- [x] 8.4 将 `docs/plans/auto-review-analysis/**` 拆分为测试与配置所有的基准与配置输入，以及非计划工件位置所有的生成分析输出；更新质量代码、脚本、测试和文档。
- [x] 8.5 在证明不再有活动计划或归属错误的运行时与测试工件，且当前链接不再把 Agent 路由到此处后，删除 `docs/plans/**`。
- [x] 8.6 更新父 Harness 工件，用子 OpenSpec `tasks.md` 生命周期替代所有额外详细计划指令，并声明历史恢复使用 Git 与 OpenSpec 归档。

## 9. 提取并删除当前归档

- [x] 9.1 冻结完整 `git ls-files docs/archive` 输入清单用于核对，并按历史说明、设计系统与演示、计划、PRD 和遗留 `Superpowers` 计划分组。
- [x] 9.2 删除每个冻结 archive 分组前，显式调用 `$docs-audit paths <frozen archive group> record`，只写入 `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-<group>.md`，并独立审查 extraction/deletion disposition。
- [x] 9.3 审计历史交接、进度、待办与集成材料，提取任何已验证当前操作或测试事实，再删除源文件。
- [x] 9.4 审计已归档设计系统和静态演示材料，提取任何已验证当前视觉或实现边界，再删除源文件。
- [x] 9.5 审计已归档实施计划与 PRD，只提取已验证当前产品与架构行为，并删除已放弃、从未构建、重复或过时内容。
- [x] 9.6 将读取已归档全仓路线图或任何其他归档文件作为权威的测试和当前文档，改为使用当前代码、策略、架构或测试所有的契约。
- [x] 9.7 删除整个 `docs/archive/**` 树，证明每个基线路径均已处理、没有创建 `docs/history/**`，且已跟踪文件与引用搜索返回零实时归档或历史路径。

## 10. 丢弃 Training 原型

- [x] 10.1 通过源码扫描和测试证明生产代码不导入、加载或提供 `docs/prototypes/**` 中的资产。
- [x] 10.2 删除原型前，显式调用 `$docs-audit paths docs/prototypes record`，只写入 `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-10-prototypes.md`；独立验证任何当前事实都归生产文档责任方，而不是保留原型资产。
- [x] 10.3 删除原型路由映射、原型意图链接、清单分类和原型专用文档测试；只保留生产 Training 契约。
- [x] 10.4 删除 `docs/prototypes/**` 下全部已跟踪 Training 原型 HTML、CSS、JavaScript、图像、字体和 README，不创建历史副本。
- [x] 10.5 验证当前 Training 导航、共享导航模式切换、API、服务、仓库和前端测试保持绿色，且文档仍把 Training 表述为平级工作模式。

## 11. 将运行时与配置资产移出文档所有权

- [ ] 11.1 将 `docs/workflow.api.json` 移到已批准的配置所有路径，更新加载器和每个测试与引用，并验证工作流模板行为完全一致。
- [x] 11.2 审计 `docs/**` 下其余非文档文件，把运行时输入、fixture 或生成输出迁移到实际配置、测试、数据或工件责任方。
- [ ] 11.3 任何会改变运行时文件加载的迁移，都必须运行聚焦运行时、工作流生成、构建、队列和部署验证；不得把这些批次归类为仅文档。

## 12. 清单、治理测试与零违规切换

- [x] 12.1 重构仓库清单生成器，从已批准元数据与策略推导分类与归属，而不是使用路径启发式；本阶段输出仍位于 `docs/repo-inventory.md`。
- [x] 12.2 重新生成清单，证明其非写入检查能发现过时输出且不重写工作树。
- [x] 12.3 用 schema/policy 与公开命令契约测试取代硬编码文档治理测试；删除唯一作用是保留已删除路径或过期正文的断言。
- [x] 12.4 解决全部确定性 `docs:check` 错误，并为已批准范围内每个警告与 `$docs-audit` 问题项记录有证据的显式处置，不使用永久白名单或降级契约。
- [x] 12.5 对架构、Generation、Training、共享资源、设计、API、测试、本地开发、部署和故障排除运行完整 Agent 导航审计。
- [x] 12.6 实现并测试第一方维护文档语言门禁：正文和 frontmatter 人类可读字符串默认必须为简体中文；技术标识、命令、路径、协议字段、第三方 Skill、测试 fixture、数据载荷及 OpenSpec 解析器结构词必须按显式例外处理；增加正反 fixture，并让 `npm run docs:check` 阻止英文正文回归。

## 13. 文档专用 CI 与验收

- [x] 13.1 增加纳入仓库的文档专用 CI 作业：安装固定依赖，从干净状态开始，以受保护比较修订版运行精确非写入 `npm run docs:check` 的 `full` 模式，以干净状态结束，且没有仅文档路径过滤器。
- [x] 13.2 在已批准 Node/runtime 环境运行聚焦 documentation/OpenSpec 测试和完整仓库测试套件。
- [x] 13.3 对所有活动变更与现行 specs 运行严格非交互 OpenSpec 校验。
- [ ] 13.4 证明本地检查保持完整的既有已跟踪、已暂存与未跟踪状态，CI 以干净状态开始并以干净状态结束，且不存在禁止实时遗留路径、重复策略权威或非 OpenSpec 规划权威。
- [ ] 13.5 采集一次成功的 `full` 模式干净检出 CI、受控规则失败与工具失败场景，以及恢复后的成功运行。
- [ ] 13.6 将文档作业设为每条受保护合并路径的必需项；若权限不足，保持本任务未完成并报告精确外部操作。
- [ ] 13.7 使用已批准比较修订版显式调用 `$docs-audit full record`，只写入 `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`；独立审查结果，再提交最终目标树、迁移核对、审计处置、本地与 CI 证据、运行时资产验证和剩余风险供用户明确阶段验收。
- [ ] 13.8 归档前确认已脱敏 PreToolUse 实验仍是非规范性路径匹配尝试证据，并非直接安装的实现；确认另行授权的根级后继实验仍保持实时数据被忽略且在子变更验收外，并记录后续可观测性子变更必须重新验证两项输入。
- [ ] 13.9 用户验收后，按 OpenSpec 约定归档 `rebuild-documentation-governance`，更新父阶段状态，但不开始可观测性实施。
