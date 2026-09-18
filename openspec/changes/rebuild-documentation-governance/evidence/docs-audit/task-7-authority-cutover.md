# 任务 7：智能体策略与运行手册权威切换独立审计记录

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `7.7`。
- 独立审查者：`/root/audit_authority_cutover`；不是本批 `AGENTS.md`、`CLAUDE.md` 或运行手册的作者。
- 范围：`$docs-audit paths AGENTS.md CLAUDE.md docs/runbooks openspec/config.yaml`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-7-authority-cutover.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，提交 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`。本次是显式路径范围，不需要合并基准，也没有升级为 `full` 语义范围。
- 冻结输入：19 个文件，包括 3 个显式文件与 `docs/runbooks/**` 下 16 个 Markdown 文件；按“仓库相对路径 + 文件 SHA-256”排序后的清单摘要为 `a7d02a8848cab96a81f16476f803eb18d7abb4c64493be770faa30cdebad15b9`。

## 写入边界

- 唯一允许写入：本文件。
- 写入前完整工作树基线：87 个已修改、14 个已删除、76 个未跟踪条目，共 177 条；`git status --short --untracked-files=all` 规范化摘要为 `41b15b57f4c92ee4b4c8335b4e760495786e35aa5c5f6bceaaf5fed7160c7a67`。
- 写入前未暂存差异 101 条，规范化摘要为 `838c1be6e5e313bc5be205b18575aa07c8e39656dde0eca4364ee67c80dfe0d7`；已暂存差异 0 条，摘要为 SHA-256 空值 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。
- 基线包含 13 个 `agent-rules/**` 工作树删除项、15 个新运行手册/路由、既有 OpenSpec 与治理实施改动，以及 5 个无关未跟踪个人脚本。审计没有修改、删除、暂存或提交这些路径。

## 确定性检查

- 命令：`npm run docs:check`。
- 请求模式与有效模式：`full` / `full`。
- 外层进程退出：`exit 1`；人类输出为 1 个错误、0 个警告。
- JSON 诊断内部退出分类：`exitCode 2`，`tool/configuration`，不是普通仓库规则违规。`repo-inventory` 生成器适配器在读取 `docs/runbooks/config-runtime-assets.md` 时因缺少现行文档元数据崩溃，定位为 `docs/_meta/policy.yaml:1:1`。
- 该失败来自尚未删除的旧版文件，不证明新 `AGENTS.md`、薄 `CLAUDE.md` 或新运行手册语义错误；但 `$docs-audit` 规定检查器或配置失败时必须停止签署语义通过，因此本范围当前不能接受。
- 聚焦命令：`node --import tsx --test tests/test-agent-policy-runbooks.test.ts tests/test-docs-audit-skill.test.ts tests/test-documentation-governance.test.ts tests/test-script-maintenance-doc.test.ts`，28/28 通过。其中 PowerShell 合同 harness 实际执行了锁、队列、数据库、进程和认证清理的受控模拟。

## 已审查证据

### 当前实现

- `AGENTS.md` 的 metadata 将 `agent-workflow` 标为 `canonical`，正文把它声明为普通开发硬策略的唯一权威，并将 Git、维护脚本、开发服务、本地验证、生产部署和 `mypc` PowerShell 路由到最小运行手册。
- `CLAUDE.md` 只保留 `@AGENTS.md` 和中文兼容说明，权威类型为 `compatibility`；没有复制部署锁、队列、Prisma 或进程规则。
- `openspec/config.yaml` 只把普通工作流路由到 `AGENTS.md` 与 `docs/runbooks/**`。
- `docs/runbooks/**` 共 16 个文件；其中 15 个新表面带现行 metadata，覆盖 Git 交付、维护脚本、开发服务、本地验证、部署编排、锁、Generation/Training 队列门、数据库同步、Next.js 构建、生产重启、部署验证和 `mypc` 命令传输。10 个操作型 runbook 全部声明 `verificationState: not-exercised` 与 `lastVerified: null`。
- 新运行手册明确区分静态审查、局部只读探测与完整演练；没有把 2026-07-12 的检查描述为已成功部署。公开验证仍如实记录 `SEC_E_CERT_EXPIRED`。
- 显式范围内搜索 `agent-rules/` 为 0；在 `AGENTS.md`、`CLAUDE.md`、`docs/runbooks/**` 和 `openspec/config.yaml` 中搜索 `$docs-audit` 为 0。
- 仓库级 `$docs-audit` 搜索只发现已批准 OpenSpec 调用、Skill、Skill 校验、测试、CI 中的 Skill 测试以及“不会自动调用”的检查器说明；没有普通开发自动触发器或第二审计运行手册。
- 工作树中 `agent-rules` 目录已不存在，但 Git 索引仍列出 13 个路径，状态均为未暂存删除。

### 已批准目标

- `openspec/changes/rebuild-documentation-governance/specs/documentation-governance/spec.md:97` 至 `:118` 要求 `AGENTS.md` 成为唯一强制策略权威、`docs/runbooks/**` 成为唯一操作步骤权威、`$docs-audit` 保持显式 Skill，并从已跟踪仓库删除全部 `agent-rules/**` 与实时引用。
- `openspec/changes/rebuild-documentation-governance/design.md:264` 至 `:268` 要求先验证新运行手册，再原子切换所有 consumer，最后删除旧规则；重大环境事实必须重新核验，不能盲目照抄。
- `openspec/changes/rebuild-documentation-governance/tasks.md:66` 至 `:72` 明确列出运行手册覆盖、权威切换、治理测试、旧目录删除和本次独立审计。
- 用户要求最终第一方文档使用中文；`docs/runbooks/config-runtime-assets.md` 的英文正文不满足该目标。

### 历史意图

- `HEAD:AGENTS.md` 把 `agent-rules/git.md` 与 `agent-rules/deploy/index.md` 设为每次任务必读，并要求 `AGENTS.md` 与 `agent-rules/**` 手工同步，是待删除的双源模型。
- `HEAD:CLAUDE.md` 仍要求读取 `agent-rules/**`，`HEAD:openspec/config.yaml` 也把旧规则目录作为工作流入口。
- 这类历史内容只用于证明迁移动机；不会被提升为当前策略。

### 运行时证据

- 本次没有启动、停止、构建、部署、写数据库、控制队列、获取锁或访问秘密。
- 新 runbook 的高风险控制流由聚焦测试和受控 PowerShell harness 验证；真实环境操作仍保持 `not-exercised`。该诚实状态足以审查文档声明，不足以宣称真实部署演练成功。

## 问题项

### `CUTOVER-001`

- `id`：`CUTOVER-001`
- `path`：`AGENTS.md`
- `location`：frontmatter `document.authority`、`# 智能体规则入口`、`## 始终遵守的硬策略` 与 `## 触发路由`
- `claim`：`AGENTS.md` 是普通开发工作流硬策略的唯一权威，并只把命中的操作路由到运行手册。
- `claimCategory`：`current`
- `owner`：`agent-policy`
- `evidence`：
  - `current`：`AGENTS.md` 将 `agent-workflow` 标为 `canonical`，并包含 Git、部署判断、开发隔离、Next.js 指南、token、进程和子代理边界。
  - `current`：显式范围内 `agent-rules/` 与 `$docs-audit` 搜索均为 0。
  - `current`：聚焦治理与 runbook 测试 28/28 通过。
  - `target`：`specs/documentation-governance/spec.md:97-118`。
- `conflict`：`none`
- `confidence`：`high`；正文、metadata、路由文件、搜索与正向测试相互一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：重跑 `tests/test-agent-policy-runbooks.test.ts`，并对显式范围搜索 `agent-rules/` 与 `$docs-audit`。

### `CUTOVER-002`

- `id`：`CUTOVER-002`
- `path`：`CLAUDE.md`
- `location`：frontmatter authority 与 `@AGENTS.md` 后的兼容说明
- `claim`：`CLAUDE.md` 只是客户端兼容指针，不拥有第二份策略。
- `claimCategory`：`current`
- `owner`：`agent-policy`
- `evidence`：
  - `current`：权威类型为 `compatibility`，来源只有 `AGENTS.md`。
  - `current`：正文没有部署锁、队列暂停、Prisma 同步、token 或进程操作规则。
  - `current`：聚焦测试验证薄指针边界。
  - `target`：`openspec/changes/rebuild-documentation-governance/design.md:143`。
- `conflict`：`none`
- `confidence`：`high`；文件短小且可完整静态核对。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：重跑 `tests/test-agent-policy-runbooks.test.ts`，并确认 `CLAUDE.md` 仍只引用 `AGENTS.md`。

### `CUTOVER-003`

- `id`：`CUTOVER-003`
- `path`：`docs/runbooks/config-runtime-assets.md`
- `location`：第 1 至 6 行的英文 runbook/owner 声明，以及第 55 至 59 行的 Hook 实施说明
- `claim`：该文件仍可在当前运行手册命名空间中拥有配置、运行时资产与 Hook 数据路径的现行权威。
- `claimCategory`：`unresolved`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：文件仍存在、全文主要为英文、没有现行 metadata，并自称拥有非代码资产策略。
  - `current`：`docs/runbooks/README.md` 不路由到该文件，聚焦测试也明确把它视为已取代页面。
  - `current`：`npm run docs:check` 的生成器适配器因该文件元数据无效而以内部 `exitCode 2` 停止。
  - `target`：本阶段不把 Hook PoC 生产化，第一方维护文档最终使用中文，运行手册必须由 metadata 和现行路由治理。
- `conflict`：文件仍占用当前目录并声明 owner，但新路由把它排除；其配置事实是否已由现行 owner 完整吸收尚未在本次记录中逐项证明。
- `confidence`：`high`；文件、路由与确定性崩溃均可重复观察。
- `action`：`extract-delete`
- `resolution`：`open`
- `verification`：先证明仍有效配置/运行时事实已进入现行 owner，并把 Hook PoC 保持为非规范性 OpenSpec evidence；随后删除本文件，重跑 `npm run docs:check` 与同范围 `$docs-audit`。

### `CUTOVER-004`

- `id`：`CUTOVER-004`
- `path`：`docs/runbooks/README.md`
- `location`：`## 导航`、`## 验证来源` 及其 14 个带 metadata 的后代
- `claim`：新运行手册完整覆盖已批准的 Git、开发、本地验证、部署锁、队列、数据库、构建、重启、验证、`mypc`、token 和精确进程边界，并如实标记未演练状态。
- `claimCategory`：`current`
- `owner`：`operations`
- `evidence`：
  - `current`：15 个新运行手册/路由均有严格 metadata；10 个操作型 runbook 均为 `not-exercised` 且日期为 `null`。
  - `current`：`tests/test-agent-policy-runbooks.test.ts` 验证路由、顺序、来源、令牌清理、提供方、缓存、进程与日志边界。
  - `current`：`tests/runbook-contract-harness.ps1` 的受控控制流模拟随聚焦测试通过。
  - `current`：`tests/test-script-maintenance-doc.test.ts` 验证高风险维护入口契约。
  - `target`：任务 `7.1`、`7.2` 与 `7.5`。
- `conflict`：`CUTOVER-003` 所述旧版文件仍在同一目录，且完整门禁尚未到达普通规则检查阶段。
- `confidence`：`high`；对新集合的静态结构、源码关系和受控测试证据完整，但没有真实部署演练。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：删除旧版阻塞项后重跑 28 项聚焦测试、完整 `npm run docs:check` 和同范围审计；真实部署成功前继续保持 `not-exercised`。

### `CUTOVER-005`

- `id`：`CUTOVER-005`
- `path`：`openspec/config.yaml`
- `location`：`context` 中的普通开发工作流入口与 Harness 阶段边界
- `claim`：OpenSpec 配置只把当前工作流路由到 `AGENTS.md` 和 `docs/runbooks/**`，并且不会把后续可观测性或工程规范提前授权。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：文件中没有 `agent-rules/` 或 `$docs-audit` 自动触发说明。
  - `current`：配置明确要求后续阶段重新批准。
  - `target`：任务 `7.4` 与本变更非目标。
- `conflict`：`none`
- `confidence`：`high`；配置文本与显式搜索一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：搜索 `openspec/config.yaml` 中不存在 `agent-rules/`，并运行固定 OpenSpec 校验与 `npm run docs:check`。

### `CUTOVER-006`

- `id`：`CUTOVER-006`
- `path`：`openspec/config.yaml`
- `location`：权威切换接受条件所依赖的已跟踪仓库状态
- `claim`：旧 `agent-rules/**` 已从已跟踪仓库原子删除，可以接受权威切换完成。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：`Test-Path agent-rules` 为 `False`，新的当前范围没有实时引用。
  - `current`：`git ls-files -- agent-rules/**` 仍返回 13 个索引路径；工作树状态是 13 个未暂存删除。
  - `target`：`specs/documentation-governance/spec.md:111-113` 要求已跟踪仓库不存在旧路径或实时引用。
- `conflict`：工作树物理删除已完成，但 Git 索引/已跟踪状态尚未闭合。
- `confidence`：`high`；工作树与索引命令结果明确。
- `action`：`delete`
- `resolution`：`open`
- `verification`：在有边界交付中暂存并提交这 13 个精确删除，确认 `git ls-files -- agent-rules/**` 为 0，再重跑 live-reference 搜索、聚焦测试和同范围审计。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-7-authority-cutover.md`
- 被审计文件修改：`none`
- 其他仓库路径写入：`none`

## 验证

- 聚焦治理、Skill、当前文档和维护脚本测试：28/28 通过。
- 显式审计范围内 `agent-rules/` 引用：0。
- 普通策略、运行手册与 OpenSpec 配置中的 `$docs-audit` 自动触发器：0。
- 工作树中旧目录：不存在；Git 索引中的旧路径：13。
- 完整门禁：未通过；`tool/configuration`、内部 `exitCode 2`，由 `docs/runbooks/config-runtime-assets.md` 触发。
- 同范围重跑状态：语义抽查已完成，但按 Skill 的确定性前置条件不能签署通过；关闭 `CUTOVER-003` 与 `CUTOVER-006` 后必须重跑。
- 写入后工作树共 178 条状态；排除唯一允许的新证据文件后仍为 177 条，规范化摘要仍为 `41b15b57f4c92ee4b4c8335b4e760495786e35aa5c5f6bceaaf5fed7160c7a67`。未暂存与已暂存摘要也与写入前完全一致，证明允许集合外没有审计写入。

## 独立审查

- 审查者：`/root/audit_authority_cutover`，与本批 owner 文档作者独立。
- 状态：`review-required`。
- 已接受部分：新 `AGENTS.md` 的单一策略权威、薄 `CLAUDE.md`、新运行手册覆盖与诚实验证状态、`openspec/config.yaml` 路由，以及没有 `$docs-audit` 自动触发器。
- 最终处置：暂不接受任务 7 权威切换完成。先关闭旧运行手册的提取删除与 Git 索引中的 13 个旧规则路径，再取得确定性门禁和同范围独立复核通过。

## 待决策项

- `none`。两个开放项都已有批准目标，不需要新增产品或策略决策；需要的是完成既定删除、验证与复核。

## 删除后复核 — 2026-07-12

### 调用与写入边界

- 显式调用方：已批准的 OpenSpec 任务 `7.7`。
- 范围：`$docs-audit paths AGENTS.md CLAUDE.md docs/runbooks openspec/config.yaml record`。
- 操作：继续写入本文件；没有第二个证据路径，也没有编辑被审计文件。
- 比较基线：`HEAD`，`8a13a7c464e28d5f10298f5225165be9b1dbdf46`。
- 写入前目标树有 292 个已暂存跟踪状态项、0 个未暂存跟踪项和 6 个既有未跟踪项。未跟踪项是部署切换前的工作流兼容副本和 5 个个人脚本，均不属于本次 `record` 写入。

### 确定性检查

- `npm run docs:check -- --mode full --base HEAD --format json`：`errors=0`、`warnings=0`、`exitCode=0`。
- `npm run skills:check -- .codex/skills/docs-audit`：`errors=0`、`warnings=0`。
- `node --import tsx --test tests/test-agent-policy-runbooks.test.ts`：11/11 通过，包括精确目标先于锁、双 worker 门禁、PowerShell 合同和本地数据库初始化边界。
- `git ls-files -- agent-rules`：无输出。
- 目标索引中的旧路径搜索只剩 `docs/_meta/policy.yaml` 禁止清单、OpenSpec 迁移工件和治理负例/测试数据；没有普通 Agent、运行时或配置使用方。
- `git diff --check` 与 `git diff --cached --check`：均通过。

### 开放项关闭

#### `CUTOVER-003-CLOSE`

- `path`：`docs/runbooks/config-runtime-assets.md`
- `location`：原 `CUTOVER-003`
- `claim`：已取代的英文运行手册不再占用当前命名空间，也不再阻塞生成器。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：该路径已从目标索引删除；当前运行手册路由和清单不再包含它；PowerShell 合同测试不再保留跳过分支；完整文档门禁通过。
- `conflict`：`none`
- `confidence`：`high`；目标索引、路由、测试与门禁一致。
- `action`：`delete`
- `resolution`：`fixed`
- `verification`：上述索引搜索、11 项运行手册测试和完整文档门禁。

#### `CUTOVER-006-CLOSE`

- `path`：`agent-rules/**`
- `location`：原 `CUTOVER-006`
- `claim`：旧规则目录和实时引用已从目标索引删除，普通开发策略与操作步骤已分别由 `AGENTS.md` 和 `docs/runbooks/**` 拥有。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：`git ls-files -- agent-rules` 无输出；`AGENTS.md` 直接路由 `docs/README.md` 和各操作 owner；`CLAUDE.md` 保持薄兼容指针；完整门禁与索引级遗留引用审查通过。
- `conflict`：`none`
- `confidence`：`high`；目标索引、导航、独立搜索和聚焦测试一致。
- `action`：`delete`
- `resolution`：`fixed`
- `verification`：上述索引搜索、导航审计、运行手册测试和完整文档门禁。

### 独立审查与最终处置

- `/root/legacy_reference_audit` 对目标索引执行独立旧路径与中文正文扫描；其 3 个实时维护残留均已由生成源、测试和源码注释修正，复跑门禁为 0/0。
- `/root/forward_docs_audit` 使用无历史上下文对根入口、架构、Training 和生产部署顺序执行前向测试；发现并复核了直接知识入口、API 权威去重、精确目标先于锁、本地数据库初始化责任方，以及历史探测叙述收口。
- 修复后独立同范围复核结论：四个场景全部通过，61 个当前 `authority.subject` 唯一，`FDA-001` 为 `fixed`，无开放问题项。
- 最终处置：任务 7 权威切换通过；本记录原有 `review-required` 状态由本节的删除后独立复核取代。

### 待决策项

- `none`。
