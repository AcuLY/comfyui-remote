# ComfyUI Remote Harness 设计决策日志

日期：2026-07-10

状态：会话决策底稿；保留原始讨论状态，不作为 current truth 或 apply 授权

原位置：`.tmp/harness-design-decisions-2026-07-10.md`；现归档为 OpenSpec 非规范性 evidence

## 0. 文档性质

- 本文件用于防止长对话中的已确认决策丢失。
- 本文件最初位于被 Git 忽略的 `.tmp/`；现为跨设备续作而归档，但仍不作为 current truth，也不替代正式 spec。
- 已通过固定版本 CLI 初始化仓库级 `openspec/`，并起草父变更 `establish-agent-harness`。
- 首个子变更 `rebuild-documentation-governance` 的完整 proposal、specs、design 和 tasks 必须在用户批准目标 docs 信息架构后再创建；此前不得进入 implementation plan。
- 本文件中的状态词：`已确认`、`待确认`、`被否决`。

## 1. 原始目标

为本仓库建立一套完善、agent-first 的 harness 体系，参考 OpenAI Harness Engineering，覆盖：

1. 文档与知识治理。
   - 以短小的 `AGENTS.md` 为入口。
   - 渐进式披露。
   - 全面的项目架构、设计、模块功能、约束、执行计划和历史记录。
   - 文档 linter、CI、交叉链接、结构、生成物和更新状态验证。
   - 彻底处理当前文档混乱、过时和层次不清问题。
2. agent 可读的可观测体系。
   - 完善结构化日志、性能指标和 traces。
   - 能定位页面加载慢等性能问题。
3. 仓库级工程规范。
   - 覆盖 TypeScript、React、Next.js、Node、Prisma、脚本及其他语言。
   - 不限于语言或文件级，还必须覆盖模块、依赖和架构边界。
   - 同时具备自动化检查与人工审查流程。

事实输入：

- `.tmp/repo-understanding-deep-2026-07-08.md` 是主要临时事实底稿。
- `.tmp/repo-understanding-2026-07-08.md` 是较早短版。
- 两者都不是正式 source of truth；迁移时必须以当前源码、测试、schema、Git 历史和必要运行验证复核。
- Training 在目标架构中是与生图平级的工作模式，通过导航 mode toggle 切换；models/settings 为共享资源。

### 1.1 文档结构新增参考

状态：已确认

- 目标 docs 信息架构优先参考 OpenAI Harness Engineering 文章的做法：短 `AGENTS.md` 作为地图、根级长期入口、结构化 `docs/design-docs`、一等计划、generated、product specs 和 references。
- 不机械复制示例树；本仓库使用 OpenSpec，因此文章中的 active/completed exec plans 必须与 `openspec/changes/**`、living specs 和 archive 形成单一权威，不能再建平行计划系统。
- 后续考虑引入 `pbakaus/impeccable`，当前只为兼容性确定知识边界，不安装或启用。
- Impeccable 兼容目标包括根级 `PRODUCT.md`、`DESIGN.md`，项目级 skill/hook，以及 `.impeccable/**` 的 tracked/ephemeral 边界；具体安装、hook、detector 和 CI 集成需要未来独立 OpenSpec change。

## 2. 总体拆分与顺序

状态：已确认

采用一份 harness 总纲加三份独立子系统 spec/计划：

1. Documentation Governance
2. Observability
3. Engineering Standards

实施顺序：

1. 先做文档治理、历史验证与迁移。
2. 再做可观测体系。
3. 再做工程规范。
4. 最后根据真实实现补齐架构文档、runbook、living specs，并统一完成 CI 收口。

中间阶段仍要维护最小必要的 spec delta 和操作说明，不能以“最后再补文档”为由制造新漂移。

## 3. OpenSpec 采用策略

状态：已确认

- 使用 Fission-AI/OpenSpec。
- 以本次 harness 建设作为首个完整试点。
- 此后仓库中的重大功能、架构、性能和规范变更统一走 OpenSpec 生命周期。
- 不只借用 Markdown 格式；需要实际 CLI、validate、change、apply、verify、archive 生命周期。
- 新 spec 不再写入旧的 `docs/superpowers/specs/**` 模式。
- `docs/**` 继续承担知识库、架构说明、runbook、reference 和 generated 文档。
- `openspec/**` 承担可验证能力规格、变更提案、技术设计、任务与变更历史。

### 3.1 OpenSpec schema

状态：已确认

使用两类 schema：

1. `spec-driven`
   - 用于未来重大变更。
   - 保持 proposal → specs → design → tasks → apply → verify → archive 语义。
2. 仓库级 `historical-migration`
   - 用于迁移既有 specs、plans、PRD 和 prototype。
   - 记录原始意图、代码证据、实际状态、偏差结论和可选的 current-spec 影响。
   - 不把未完成历史伪装成新的实施任务。

### 3.2 Living specs

状态：已确认

目标 capability：

- `agent-harness`
- `documentation-governance`
- `observability`
- `engineering-standards`

### 3.3 Active changes

状态：已确认

- `establish-agent-harness`
- `rebuild-documentation-governance`
- `build-agent-observability`
- `enforce-engineering-standards`

三个子 change 分别维护 proposal、spec delta、design 和 tasks。总纲 change 最后 archive，确保 living `agent-harness` 只描述已经完整落地的能力。

## 4. 历史资料全量迁移

状态：已确认

- 所有既有 specs、plans、PRD、prototype 都要进入可追踪的 OpenSpec historical migration/archive。
- “全量迁移”不等于把历史内容全部认定为有效。
- 每份材料必须先根据当前仓库验证。
- 不确定项必须向用户确认。

每份材料分类为：

1. 已实现且仍有效。
2. 已实现但当前行为已漂移。
3. 部分实现。
4. 从未实现。
5. 已放弃或被替代。
6. 证据冲突或无法确认。

迁移规则：

- 只有已验证的当前行为能进入 living specs。
- 漂移项同时保存原始设计和当前实现。
- 部分实现必须明确已实现与未实现边界。
- 从未实现或已放弃内容只保留历史状态，不自动变成待办。
- 原文件完成迁移后不得继续成为第二份 current authority。
- prototype 的保留附件和最终位置由阶段 1 的 docs 信息架构共同决定。

## 5. 证据与验证深度

状态：已确认

采用分层证据策略：

- 基础证据：源码、测试、schema、Git 历史。
- UI、性能、运行与部署语义在静态证据不足时升级到浏览器或运行态验证。
- DB 队列状态不等于真实 worker 进程状态。
- 当前实现和目标设计必须分开记录。
- 证据不足不得提升为 current truth。

事实类型的优先级：

- 当前行为：源码、schema、测试、运行验证优先。
- 目标设计：用户批准的 OpenSpec change 优先。
- 历史事实：Git 历史和原始设计材料优先。

## 6. CI 与存量违规策略

状态：已确认

- 采用一次性硬切换，不采用长期 ratchet、legacy allowlist 或仅告警模式。
- 每个阶段先清除其范围内全部存量违规，再启用对应阻断门禁。
- 文档专属阻断 CI 在阶段 1 结束时启用。
- 全仓统一门禁在最终文档收口阶段启用。

## 7. 总体阶段架构

状态：已确认

### 阶段 1：知识基线、文档治理与历史迁移

核心结果：

- 与用户共同批准仓库专属 docs 信息架构。
- 初始化 OpenSpec。
- 建立文档元数据、自动化验证和 agent 语义审计流程。
- 全量验证并迁移历史资料。
- 重建 current truth。
- 清零文档问题并启用文档阻断 CI。

### 阶段 2：可观测体系

技术方案需在阶段开始前重新基于最新基线提出并取得用户批准。

已确认的不变量：

- 本地优先、自托管。
- 本地和 `mypc` 生产使用相同实现、遥测协议、字段和查询接口。
- 本地与生产的数据、凭据、服务标识和保留策略隔离。
- 每个本地 worktree 的应用、collector、日志、指标、trace、端口、存储和销毁生命周期完全隔离。
- 本地必须能完整验证生产实现。

### 阶段 3：工程规范

具体方案需在阶段开始前重新基于最新基线提出并取得用户批准。

总体要求：

- 覆盖语言、框架、文件、模块和架构级规则。
- 自动化规则与人工审查规则分开定义。
- 清除全仓存量违规后才能启用阻断门禁。

### 阶段 4：文档收口与统一 CI

具体方案需在阶段开始前取得用户批准。

- 根据阶段 2、3 的真实实现更新架构、模块、runbook、规范和 living specs。
- 执行 OpenSpec verify/archive。
- 统一开启完整阻断 CI。

## 8. 阶段批准机制

状态：已确认

总纲获批不代表后续阶段自动获得实施授权。

阶段 2、3、4 均需要：

1. 实施前方案批准。
2. 完成后验收批准。

实施前必须提交：

- 2–3 个方案及取舍。
- OpenSpec proposal、spec、design、tasks。
- 影响范围、风险、数据与安全边界。
- 验收指标、验证环境、回滚和文档影响。

审批记录要求：

- 记录获批 artifact 的摘要或内容哈希、范围、时间和约束。
- proposal、spec、design 或 tasks 实质变化后审批自动失效。
- 无有效审批时，仓库脚本和 CI 拒绝 apply。
- agent 不得自行生成用户批准。
- 关键假设失效时必须停止、更新方案并重新申请批准。

### 8.1 OpenSpec 官方生命周期边界

状态：已确认

- 通用 change 状态、artifact 依赖、apply、verify、archive 和失败处理直接遵循届时安装的 OpenSpec 官方规范与生成指引。
- 不为这些通用机制另造一套平行状态机，也不要求用户逐项确认其内部细节。
- 阶段 2、3、4 开始前的具体方案批准仍然有效；这是本仓库的业务授权边界，不是对 OpenSpec 生命周期的重复实现。
- 仓库只在当前领域约束确有需要时增加校验，例如队列安全、部署锁、遥测数据隔离和审批 artifact 有效性。
- OpenSpec 上游规范升级时，通过单独 change 更新仓库集成和相关文档，不静默改变现有流程。

## 9. 阶段 1 的协作设计门

状态：已确认

阶段 1 在任何批量迁移前必须先完成：

1. 与用户共同制定并批准目标 docs 结构。
2. 制定 agent 可执行的语义审计流程。
3. 建立自动化文档验证能力。
4. 才能执行全量审计、确认、迁移和重写。

共同制定的 docs 蓝图至少要决定：

- 目录层级和文档类别。
- 命名规则和 owner。
- current、generated、prototype、reference、runbook、archive 和 OpenSpec 的边界。
- authority 和替代关系。
- `AGENTS.md` 到深层文档的渐进式导航。
- 更新触发条件和验证方式。

## 10. 文档自动化门禁

状态：已确认

阶段 1 交付统一 `docs:check`，至少覆盖：

- Markdown 相对链接和 anchors。
- `AGENTS.md` / docs index 可达性和孤儿 current docs。
- 文档分类、元数据、owner、状态和更新触发条件。
- current、generated、prototype、archive、OpenSpec living/change/archive 边界。
- archive 的原始状态、实现状态、证据和替代来源。
- 生成物 check mode 和 committed artifact 漂移。
- OpenSpec schema、requirements、scenarios、change 和 archive 一致性。
- 可由源码生成的 API、route、schema 等契约。
- 代码模块变化对应的文档影响规则。

无法机械判断的语义问题交给 agent 审计，不让 linter 假装理解语义。

## 11. Agent 文档语义审计

状态：已确认

数据流：

`文档/代码采集 → 机器清单 → 自动门禁 → agent 语义审计 → 自动修复或人工决策 → OpenSpec 迁移 → 独立复核`

每份审计记录包含：

- 文档身份。
- 主要事实声明。
- 证据路径。
- 实现状态。
- 重复或冲突 authority。
- 缺失内容。
- 置信度。
- 建议动作。
- 需要用户确认的问题。

审计 agent 可自动修复高置信度问题：

- 有唯一目标的断链或旧路径。
- 可由生成器确定的过期内容。
- 明确缺失的元数据、archive banner 和反向链接。
- 被源码、测试或 schema 唯一否定的事实表述。
- 可由明确 Git rename/move 证明的替代来源。

以下情况必须询问用户：

- 多份文档竞争 current authority。
- 当前实现与目标设计冲突且无法判断应保留哪一方。
- 部分实现是否继续推进。
- 删除、产品方向或模块归属调整。
- 证据冲突或存在多种合理解释。

错误状态：

- `evidence-conflict`
- `runtime-verification-required`
- `user-decision-required`
- `blocked-by-invalid-structure`

修复 agent 不能为自己的修改直接签署语义通过，必须由独立复核 agent 检查。

## 12. 文档审计与迁移验证

状态：已确认

- 自动检查失败时停止迁移，修复后重跑。
- 代码与测试冲突时不得自动修改语义。
- 缺少运行环境时不得提升为 current truth。
- 高置信度修复保留前后证据。
- 需要判断的问题进入用户确认队列。
- 正常与反例 fixtures 覆盖断链、孤儿、错误分类、生成物漂移、重复权威、代码契约漂移、未实现设计误入 living spec、过期审批和缺失审计报告。
- `docs:check` 在本地与 CI 中必须产生一致结果。

## 13. 当前明确禁止

状态：已确认

- 不把 `.tmp` 底稿提升为正式 current truth。
- 不机械照搬旧设计进入 living specs。
- 不把未实现历史自动转为新待办。
- 不使用一个巨型 `AGENTS.md` 代替分层知识库。
- 不用手写易漂移计数代替生成契约。
- 不让 agent 自行批准阶段或绕过用户批准。
- 不让本地、不同 worktree 和生产遥测数据混写。
- 不在后续阶段开始前跳过方案确认。

## 14. 待确认设计内容

1. 文档审计与迁移数据流：已于本轮确认。
2. 阶段 1 的最终目标 docs 目录结构：阶段 1 开始时与用户共同制定。
3. 阶段 2 的具体可观测技术栈、采样、保留、性能预算和部署方案。
4. 阶段 3 的具体规则矩阵、工具链和人工审查制度。
5. 阶段 4 的最终文档收口和统一 CI 切换方案。
6. 跨阶段验收与失败恢复：已确认遵循 OpenSpec 官方规范，不再单独设计或逐项确认。

## 15. 下一步

- 继续完成 harness 总纲剩余设计段并逐段获得用户批准。
- 总纲完整批准后，初始化 OpenSpec 并写入正式 artifacts。
- 对正式 artifacts 做占位符、一致性、范围、证据和歧义自检。
- 提交后请用户审阅，获批后再进入详细实施计划。
