# 智能体 Harness 设计交接 — 2026-07-10

## 状态与续接方式

工作按用户要求在文档治理实施前暂停。本交接保留决策、证据、待解决问题和隔离 Hook 实验，使设计能在另一台设备继续，而不依赖会话上下文。

- 分支：`codex/harness-doc-governance-handoff-20260710`
- 基础提交：`74080ce3`（`docs: specify documentation governance rebuild`）
- 首个交接提交：`d5ff645c`（`docs: preserve harness design handoff`），已推送
- Runtime/deployment：未触碰
- 正式子变更实施：未开始
- 交接证据：纳入活动 OpenSpec 工件前不具规范性
- 目标信息架构：已批准
- 精确子工件 digest 批准：未记录；父任务 2.6 与 2.7 仍未完成
- 父 OpenSpec 固定、approval-record 和 stage-order 前置项：未实施

恢复时按以下顺序阅读：

1. `openspec/changes/establish-agent-harness/{proposal.md,specs/agent-harness/spec.md,design.md,tasks.md}`
2. `openspec/changes/rebuild-documentation-governance/{proposal.md,specs/documentation-governance/spec.md,design.md,tasks.md}`
3. 本交接
4. [`session-materials/README.md`](session-materials/README.md)，再阅读其中的决策与 information-architecture 草稿
5. [`pretooluse-file-access-poc/README.md`](pretooluse-file-access-poc/README.md)

## 计划目标与边界

仓库正围绕受 OpenAI Harness 工程文章启发、适合人工智能智能体的 Harness 重建。计划包含三个主要能力轨道，之后进行收口：

1. 文档治理与已验证历史迁移；
2. 适合智能体的可观测性，包括性能诊断；
3. 面向 TypeScript、React、其他语言和模块级架构的全仓工程规范；
4. 最终文档同步与统一 CI 收口。

阶段顺序为强制要求。每个后续阶段实施前都要进行新的设计审查。可观测性在本地与 `mypc` 必须使用相同版本化实现，同时隔离本地、生产、CI 和每个工作树的读写、端口、存储、身份与清理生命周期。

OpenSpec 是唯一重要变更生命周期。不存在平行 `PLANS.md`、ExecPlan、`Superpowers` 计划或人工维护的实施计划系统。本文件是交接与证据记录，不是另一份计划权威。

## 决策状态矩阵

| 主题 | 状态 | 续接规则 |
| --- | --- | --- |
| Harness 计划顺序与仅 OpenSpec 的重要变更生命周期 | 已确认 | 保持文档治理、可观测性、工程规范、最终收口的顺序。 |
| 文档信息架构、权威拆分、archive/prototype 删除和延后目录 | 已确认目标 | 实施前仍需对精确书面子工件进行 digest-bound 审查。 |
| Fast/full 文档检查、诊断级别、`contract`/`review` 与详细解析器语义 | 审计提案，尚未正式化 | 寻求工件批准前，与当前子 spec/design/tasks 协调。 |
| 显式 `$docs-audit` Skill；`AGENTS.md` 不含审计规则；没有受控 `docs:read` 或文档 MCP 网关 | 已确认交互选择 | 实施前解决剩余 Skill 与运行手册工件冲突。 |
| 粗粒度离线 PreToolUse path-match 实验与数据隔离 | 已确认实验边界 | 只视为 attempted-access 证据；生产设计和阶段归属仍待决定。 |
| `Impeccable` 安装及 schema/tool 耦合 | 延后的独立变更 | 本子变更不安装，也不重塑根 `DESIGN.md`。 |
| 可观测性、工程规范与最终收口的实施细节 | 尚未设计 | 每阶段编写工件/实施前，向用户提交基于当时仓库重新验证的设计。 |

## 已确认的文档架构决策

完整已批准目录树记录在子变更 `design.md` 中。以下重要决策不得丢失：

- 根入口为 `README.md`、`AGENTS.md`、`ARCHITECTURE.md`、`PRODUCT.md` 和 `DESIGN.md`；`CLAUDE.md` 保持为薄兼容指针。
- `docs/README.md` 与各目录 `README.md` 提供渐进披露。
- 详细当前产品知识位于 `docs/product/**`。
- 详细当前设计知识位于 `docs/design/**`；根 `DESIGN.md` 保持为设计地图/上下文文件，未来可适配 `Impeccable`。
- 详细架构使用 `docs/architecture/**`。为避免与根 `DESIGN.md` 冲突，已拒绝此前 `design-docs` 命名。
- 不设根或文档级 `FRONTEND.md`；未来 `Impeccable` 集成拥有其所需的任何额外 frontend/design 上下文。
- 不设 `PLANS.md` 或 ExecPlan 系统。OpenSpec proposal/spec/design/tasks/apply/verify/archive 是唯一重要变更工作流。
- 验证后由 `docs/runbooks/**` 拥有可执行操作步骤。
- 将 `agent-rules/**` 拆分为 `AGENTS.md` 中简洁硬策略与运行手册中详细步骤，再与所有 consumer 更新一起原子删除。
- 审查 `docs/archive/**`，提取有价值当前事实，再删除整个目录。不引入 `docs/history/**` 替代项。
- 证明生产不依赖原型资产后，丢弃全部当前 Training 原型。Training 本身仍是与 Generation 平级、通过共享导航模式切换选择的生产工作模式。
- 有意延后 `docs/generated/**` 与 `docs/references/**` 的区分，直到 Harness 产生运维证据。
- `docs/QUALITY_SCORE.md`、`docs/RELIABILITY.md` 和 `docs/SECURITY.md` 初始只是诚实的 deferred 占位。
- 现有治理测试若编码过时结构而非当前事实，可以重写或删除。
- `Impeccable` 安装、生成文件、Hook、检测器和根 `DESIGN.md` schema 转换保持为未来独立 OpenSpec 变更。

原先被忽略的草稿现已保存在已跟踪、非规范证据下，使另一台设备能获得完整事实与决策输入：

- [`session-materials/harness-design-decisions-2026-07-10.md`](session-materials/harness-design-decisions-2026-07-10.md)
- [`session-materials/harness-docs-ia-draft-2026-07-10.md`](session-materials/harness-docs-ia-draft-2026-07-10.md)
- [`session-materials/repo-understanding-deep-2026-07-08.md`](session-materials/repo-understanding-deep-2026-07-08.md)
- [`session-materials/repo-understanding-2026-07-08.md`](session-materials/repo-understanding-2026-07-08.md)

从这些材料迁移的每条 claim 都必须对照代码、schema、测试、必要运行时证据和 Git 历史重新验证。当前行为或产品意图不确定时必须提交用户，不得静默解决。

## 文档质量门禁设计状态

现有子变更已经要求本地与 CI 使用确定性、非写入 `npm run docs:check`，并要求语义文档审计。后续审计发现以下有价值的改进点；它们当时尚未纳入正式子工件：

- 同一检查引擎提供 fast changed-scope 模式和 full 验收模式；
- 稳定 `error`、`warning` 和 semantic-audit 问题项类别；
- 将精确源码映射拆为机器可证明 `contract` 关系与语义 `review` 触发条件；
- 对 metadata/profile 有效性、允许 topology、必要目录入口页、内部 link/anchor、navigation 可达性、声明 authority conflict、禁止实时 path、generator 新鲜度、固定 OpenSpec validation 和 non-writing 行为提供确定性阻断项；
- 外部链接、时间启发式、疑似重复和正文质量不得成为易波动的确定性阻断项；
- 稳定 human/JSON 诊断，含 rule ID、严重性、repository-relative path、位置、证据、修复建议、owner、确定性排序，以及区分 rule 违规与工具失败的退出代码；
- 本地非写入证明比较前后工作树状态，不要求用户工作树初始干净；CI 还必须以干净开始并干净结束；
- 必需文档作业在每条受保护 merge path 运行，不使用 docs-only path 过滤器，因为源码变更可使文档 contract 失效。

正式协调仍需定义受治理范围与排除项（包括 OpenSpec、项目 Skill、`src/**.md` 和测试文档）、精确的快速模式到完整模式升级规则、`contract` 与 `review` 处置载体、GFM 锚点与代码块语义、遗留实时引用解析、外部链接行为、诊断退出代码 `0/1/2`，以及本地前后非写入证明与干净 CI 绝对整洁性的差异。警告只能覆盖无法确定性证明的启发式事实，不得降级现有必需契约。阶段验收前，每个警告和语义问题项都必须有显式处置。

仓库当时没有 `docs:check` 脚本，也没有纳入仓库的 GitHub 操作工作流。当前仓库清单测试已过时，因为生成输出未包含新 OpenSpec 文件。现有生成器直接写入，需要纯渲染与检查路径后才能安全参与 CI。

## 已确认的语义审计交互决策

用户明确拒绝把 semantic-audit trigger 或 rule 放进 `AGENTS.md`，因为这会给普通开发增加噪声。

选定交互为选项 `B`：显式调用的仓库 Skill，例如 `$docs-audit`。普通开发不自动要求运行。Skill 可以调用确定性范围选择与证据脚本，但语义判断留在 Skill 工作流。定时执行可以稍后设计，而不把普通任务变为强制审计会话。

当时 proposal/spec/design/tasks 仍把 `docs/runbooks/documentation-audit.md` 描述为可执行工作流。这与已确认 Skill 交互冲突，必须在工件批准前协调。只有当 Skill 明确是唯一调用表面时，支持运行手册才可保留为参考资料材料。虽然普通开发不自动调用审计，文档迁移批次、archive/prototype 删除、authority 切换和最终阶段验收都必须显式运行已批准语义审计。

不得实现自定义受控 `docs:read` CLI 或文档 MCP 网关。用户已拒绝该方案。

## 文件访问可观测性决策

请求的指标已不再是“文档读取频率”。可辩护 PoC 语义是 `file_access_attempt_total` 或 `pretooluse_path_match_total`：粗粒度 Codex `PreToolUse` Hook 观察受支持工具调用，记录其结构化参数或命令行命令中含解析到当前仓库内路径的调用。它不能证明工具成功，也不能证明文件实际打开或理解。

会话确认的要求：

- 广泛记录仓库本地 file-related 调用，而非只记录 Markdown 读取；
- 避免使用 `AGENTS.md` 指令和受控读取网关；
- 完全离线，不依赖运行中的应用、指标 server、收集器或仪表盘服务；
- 将原始事件与派生统计写入被忽略的本地目录，例如 `logs/**` 和 `stats/**`；
- 后续本地/`mypc` 和工作树布局必须实现一致且数据隔离。

精确生产目录名、保留、轮转、逐工作树身份、并发策略，以及它属于文档治理还是后续可观测性子变更，当时仍待决定。当前子变更明确排除可观测性实施。先决定归属；若属于可观测性，只把本 PoC 保留为未来子变更输入，不扩大当前子变更规范范围。

## PreToolUse 实验结果

目前保存在 [`pretooluse-file-access-poc/`](pretooluse-file-access-poc/README.md) 的实验，以 test-first 方式在被忽略的嵌套 Git 仓库开发，随后使用已安装 `codex-cli 0.142.5` 运行。已跟踪目录是脱敏副本，故意排除嵌套 `.git`、真实 log/session 哈希、Python 缓存、被修改 runtime 文件和原机器信任条目。

单元验证：

```text
python3 -m unittest -v test_file_access_hook.py
Ran 7 tests
OK
```

覆盖行为：

- `sed ... docs/guide.md` 变成 `docs/guide.md` 的 `read` 事件；
- `rg ... docs` 变成目录 scope `docs` 的 `search` 事件；
- `apply_patch` 更新变成现有文件的 `write` 事件；
- `apply_patch` 添加能识别尚不存在的 `planned-file` path；
- 结构化 MCP `read_file` 参数变成 `read` 事件；
- 原始事件无服务追加到 `NDJSON`；
- `NDJSON` 聚合为离线 JSON 统计。

第一次真实 Codex 运行执行了全部请求工具，却没有生成日志。根因是使用 `--ignore-user-config`，它也移除了保存的 project-trust 决策；单独 Hook 脚本信任之前，project-local Hook 已被门禁。`--dangerously-bypass-hook-trust` 绕过 Hook 哈希审查，但不会独立启用不受信任项目配置层。

第二次诊断运行加载了用户配置，但继承用户配置的 `gpt-5.6-sol`；该 CLI 报告它需要更新 Codex 版本。因此成功测试显式使用本地列出的 `gpt-5.4-mini`。该模型不匹配是偶发环境证据，不是 Harness 设计决策。

成功的隔离运行：

```text
codex --dangerously-bypass-hook-trust \
  -C . -s workspace-write -a never \
  exec --ephemeral -m gpt-5.4-mini --json \
  "run pwd; read docs/guide.md with sed; search docs with rg; edit notes.txt with apply_patch"
```

观察结果：

- `pwd` 按预期没有 file-access 事件；
- `sed` 生成一条 `Bash/read/docs/guide.md` 事件；
- `rg` 生成一条 `Bash/search/docs` 事件；
- `apply_patch` 生成一条 `apply_patch/write/notes.txt` 事件；
- 3 条事件追加到 `logs/file-access.ndjson`；
- 聚合生成 `stats/file-access.json`，包含 3 个 path，每个访问 1 次；
- 两条 Hook 路径都没有存储原始命令、prompt、工具输出、文件内容、绝对路径、用户名、环境变量或原始 Codex 会话 ID。

成功运行还证明，自动加载 `AGENTS.md` 不会被该 Hook path 表示：只观察到受支持工具调用。

已跟踪证据包含脱敏初始 fixture 文件和精确 source/config 形态，足以运行 7 个 Python 测试和离线聚合。新设备仍需自行引导项目信任，并使用账户可用模型进行手动 Codex E2E。当时未测试 Windows，POSIX Hook 没有 `commandWindows`，确定性的单命令跨平台断言留待后续。

## 解释与限制

PoC 只证明可行性，不表示生产就绪。

- `PreToolUse` 事件表示请求了一次访问尝试，不表示执行成功。若产品指标命名为 `file_access_frequency`，其文档必须保留 attempted-access 限定，除非后续接入成功信号。
- 外壳 Hook 收到命令字符串，而非进程实际打开的文件集合。`rg docs` 可以诚实记录目录 scope `docs`，但不能记录进程扫描的每个文件。
- 外壳变量、命令替换、脚本、复杂流水线、通配模式、符号链接和特殊引用都可能造成漏报或误报。
- 结构化 MCP path 参数更易分类，但用户不希望自定义文档 MCP 网关。
- 只保留仓库内部 path，仓库外 path 被有意丢弃。
- `NDJSON` 原型每条事件使用一次小型 `O_APPEND` 写入。没有测试 Windows 跨进程行为、崩溃容错、轮转、格式错误行恢复和高容量开销。
- 匹配器 `"*"` 表示所有 Hook 支持的工具调用，不是每个可能 Codex 操作。
- Hook 配置同时要求可信项目层与可信 hook 定义（或显式 test-only 绕过）。
- 本地测试使 Codex 在原设备 `~/.codex/config.toml` 中持久化了被忽略 PoC path 的信任条目。它不属于本分支，可在丢弃实验目录后删除。

使用 `file_access_attempt_total`、`file_access_scope_total` 或 `pretooluse_path_match_total` 等名称；不得声称覆盖完整文件系统的读取或人类/模型理解。

## 当前工件与权威

已经提交并推送的正式工件：

- 父变更：`openspec/changes/establish-agent-harness/**`
- 文档治理子变更：`openspec/changes/rebuild-documentation-governance/**`
- 基础提交：`74080ce3`
- 首个交接提交：`d5ff645c`

新的交接分支工件：

- 本交接；
- `session-materials/**` 下完整决策日志、information-architecture 草稿和两份 repository-understanding 草稿；
- 非规范 Hook 源码和测试；
- 实验使用的精确 Hook 配置形态；
- 实验使用的脱敏 fixture 文件；
- 脱敏事件与聚合示例。

## 交接时验证基线

- 聚焦治理命令：`node --import tsx --test tests/test-documentation-governance.test.ts tests/test-repo-inventory.test.ts tests/test-prisma-schema-compatibility-doc.test.ts`。它当时报告 16 个通过、1 个预期的 pre-apply 失败，因为 `docs/repo-inventory.md` 不包含新 OpenSpec/evidence path。
- 本次仅证据交接未运行完整 `npm test` 套件。
- 当时仓库固定 OpenSpec 尚不存在；父任务 1.1 仍未完成。引导严格校验只把显式 `npx @fission-ai/openspec@1.5.0` 用作临时证据，不是最终可复现集成。完整性通过运行 `npx --yes @fission-ai/openspec@1.5.0 validate --all --strict --no-interactive`，两个活动变更均通过。
- 保留 PoC 成功运行全部 7 个 Python 测试，并重新生成与脱敏预期文件字节一致的离线聚合。
- `npm run docs:check` 和纳入仓库的文档 CI 工作流当时不存在。
- 未执行迁移、生成器重写、清单重新生成、运行时检查、部署、数据库操作或 `mypc` 修改。

## 批准前需要解决的已知工件冲突

1. 让显式调用 `$docs-audit` Skill 成为唯一执行表面，并把审计运行手册降级为支持参考资料或删除。
2. 将审计提议的警告与 `review` 触发条件和当前规范的必需变更源码契约协调；不得把确定性阻断项改成警告。
3. 修改任何规范工件前，决定 PreToolUse PoC 的阶段归属。
4. 一致使用 attempted-access/path-match 命名；绝不报告真实读取或理解。
5. 文档治理子变更归档前，定义 PoC 最终归档或移交处置。

本会话没有修改根目录文档、`agent-rules/**`、当前 `docs/**`、产品代码、runtime 服务、数据库、部署状态或 `mypc` 状态。

## 恢复后的建议后续操作

1. 审查本交接与实验；不得把样例代码视为已批准生产代码。
2. 决定 PreToolUse path-match 日志记录属于当前文档治理子变更，还是只作为后续 `build-agent-observability` 子变更输入；保持阶段顺序。
3. 决定精确 `$docs-audit` Skill contract：调用语法、受支持 scope、证据优先级、报告位置、user-escalation 边界和调度 owner。
4. 在跨平台并发与开销测试后，决定离线 log/store 机制和保留。
5. 只有解决上述冲突后才修改活动 OpenSpec 工件。若遥测工作属于可观测性，不得加入当前子变更 scope。
6. 运行 strict OpenSpec validation，并在实施前提交精确修订工件供用户审查。

不得仅因本交接存在，就开始文档 migration、可观测性实施、工程规范、`Impeccable` 集成、部署或生产 instrumentation。

## 恢复后设计结论 — 2026-07-10

续接分支已在 Windows 拉取并审查。正式父子工件已为精确修订审查修订；本节记录交接问题的结论，但不把证据文件变成规范权威。

- PreToolUse 路径匹配实验属于未来 `build-agent-observability` 设计。文档治理子变更只把脱敏文件保留为非规范的匹配尝试证据，不安装任何内容，也不转移验收归功。未来子变更必须重新验证平台支持、并发、崩溃恢复、保留、隐私、开销、身份、隔离和清理。
- `.codex/skills/docs-audit/**` 是拟议的唯一显式 semantic-audit 表面。`AGENTS.md` 没有审计 rule 或 auto-trigger；没有审计运行手册、受控 `docs:read` CLI、文档 MCP 网关、调度器或永久审计台账。
- 拟议 Skill 接受 changed、显式路径、活动 OpenSpec 变更和 full scope；`report` 不写入，`record` 只写显式命名的 active-change 证据，`fix` 授权限定文档修改。Changed scope 通过前要求独立审查。
- 确定性检查保持为单个 `npm run docs:check` 引擎。Full 是安全默认和必需 CI/acceptance 模式；显式快速模式在影响闭包不安全时升级 full。Human/JSON 诊断共享稳定字段和退出代码 `0/1/2`，分别表示成功、rule 违规与 tool/configuration 失败。
- 无比较 base 的完整模式运行全部确定性 verifier，并将所有语义 `review` 关系作为 missing-base 警告；CI 与验收提供显式 base。Project-Skill validation 使用仓库自有离线命令，而非开发者全局 Skill 创建工具安装。
- 来源关系类型化为阻断式机器可证明 `contract` 映射或非阻断、带责任方的 `review` 警告。普通开发不自动运行 Skill。阶段验收前，每个警告和语义问题项仍需显式处置；确定性契约不得降级。
- 本地非写入证明比较完整前后仓库状态，因此允许已有脏或未跟踪工作。CI 以干净开始并干净结束，在每条受保护合并路径运行完整模式，且无仅文档路径过滤器。
- 父基础提案现在精确固定 OpenSpec，用规范 Git 二进制对象字节计算批准哈希，在只规范化复选框进度时保留原始任务快照，并使用狭窄的阶段清单与门禁而不复制生命周期状态。一个显式受限引导批准只授权父基础任务 1.1 至 1.4；之后每个子项使用正常门禁。

这些是拟议目标决策，仍待不可变提交和用户对精确父/子工件修订的明确批准。子项实施、文档 migration、Hook 安装、runtime 工作和部署仍被阻断。

提交前的恢复后验证：

- 使用 `@fission-ai/openspec` 1.5.0 的临时 strict OpenSpec validation 通过两个活动变更；
- 聚焦文档套件报告 15 个通过和两个现有基线失败：重写 README 契约中根 `/` 路由断言，以及故意过时、尚未包含新 OpenSpec 证据路径的仓库清单；
- 保留 PoC 的全部 7 个单元测试在 Windows Python 下通过；这不能补足缺失的 `commandWindows`、PowerShell 解析、并发、保留、隔离或真实 Codex E2E 证据。

## Windows PreToolUse 续接 — 2026-07-11

在任何父基础或文档 migration 开始前，恢复任务已纠正回被中断的 Hook 实验。早期证据已证明一次真实 macOS Codex 运行；缺失的平台结果是一次真实 Windows Codex Hook 调用。

新本地证据使用 Windows 11、Python 3.11.9 和已安装 `codex-cli 0.142.2`。本地 CLI 报告 Hook 为稳定，接受 `commandWindows`，并在 Windows 向外壳 Hook 发送规范 `tool_name: "Bash"` 与 `tool_input.command`。实验在已信任仓库中使用两个临时、只读 Codex 任务。临时项目 `.codex/hooks.json` 在测试后立即删除；原始 `NDJSON` 留在系统临时目录而非仓库，并在断言后删除。

观察结果：

- POSIX 处理器被故意设为 `exit 91`，只有 `commandWindows` 调用 Python 记录器；因此生成的日志证明选择了 Windows 覆盖；
- `cat <fixture guide path>` 成功完成，为精确仓库相对文件生成一条 `Bash/read` 事件；
- 原生 `Get-Content -LiteralPath <fixture guide path>` 也成功完成并为该文件生成第二条事件，但原型将其分类为通用 `access`，暴露缺失的 PowerShell read-command 分类；
- 两条事件只包含时间戳、截断会话哈希、工具名称、操作、仓库相对路径与匹配类型、schema 版本和覆盖类别；不含原始命令、prompt、输出、绝对路径、原始会话 ID 或文件内容；
- 临时 Hook 配置已删除，5 个无关 untracked `scripts/*.ts` 文件保持不变。

这关闭了狭窄可行性问题：Codex `PreToolUse` Hook 能检测命名仓库文件的 Windows 工具调用尝试。它不能证明工具成功、实际文件系统读取或模型理解。PowerShell 语义分类、Windows 并发、保留、崩溃恢复、隔离、隐私 policy、开销和稳定单命令跨平台断言仍是未来 `build-agent-observability` 工作。

## 简化本地 Hook 授权 — 2026-07-11

审查 Windows 结果后，用户明确缩小并授权下一实验：停止分类读取、搜索、写入或 PowerShell 命令；把每个匹配仓库 path 计为一次粗粒度访问尝试；无需运行中应用或遥测服务，直接写入被忽略的仓库本地 `logs/**` 和 `metrics/**`。

授权后继限定为 `.codex/hooks.json`、仅使用标准库的记录器、聚焦测试、被忽略运行时输出，以及治理这些已跟踪文件所需的仓库维护文档。它不存储原始命令、prompt、输出、文件内容、绝对路径或原始会话 ID。这是另行授权的本地实验，不是文档治理验收，不开始完整可观测性子项，也不能证明工具调用成功或智能体读取或理解文件。仅追加 `NDJSON` 是规范粗略记录；重叠 Hook 进程下的聚合新鲜度明确排除在本实验外，避免重新引入已延后的并发工作。

已安装后继随后通过使用 `codex-cli 0.142.2` 的真实 Windows Codex E2E：一个新的临时只读任务加载已跟踪项目清单，选择 `commandWindows`，并对 fixture guide 执行一次原生 `Get-Content -LiteralPath`。命令退出 0，`NDJSON` 事件只含 `occurred_at`、`paths`、`schema_version`、`session_hash` 和 `signal`，聚合对该仓库相对 path 记录 1 次。两个生成文件均保持已忽略且 untracked。只为该自动 E2E 绕过 Hook 信任；普通任务仍要求逐机器显式审查。
