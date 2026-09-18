# 任务 13：文档治理最终完整语义审计记录

审计日期：2026-08-26

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `13.7`，以及用户于 2026-08-26 对文档治理收口的明确授权。
- 精确调用：`$docs-audit full record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`。
- 兼容执行：本会话没有把项目内 `docs-audit` 注册为可调用 Skill；审计者完整读取已跟踪的 `SKILL.md` 与 `references/evidence-contract.md`，按相同的显式 `full record` 范围、唯一路径和拒绝自签署合同执行，没有伪称工具注册状态。
- 范围：`full`；没有从更窄范围升级。审计覆盖策略分配的全部受治理路径、文档治理最终目标树、3 份待关闭 runbook 修正、2 份对应合同测试、既有 CI 与生产迁移证据，以及区分当前、目标和历史所需的 Git 与 OpenSpec 状态。
- 操作：`record`；本次语义审计只写本文件，不授权借审计修改被审查文档、源码、测试、外部交付表面或运行时状态。任务清单和父 OpenSpec 工件的后续编辑来自同一用户任务的独立明确授权，不属于本次 `record` 写入。
- 分支：`codex/harness-doc-governance-handoff-20260710`。
- 审计时 `HEAD`：`25b95f10df21e440d43d92b2e9d7cba8b9310d64`；与现有上游同名分支一致。
- 已批准比较基准：`origin/main`，解析为 `74080ce352881bbecce9b7e6b16badeabd6a12d1`。
- 最终处置：文档治理确定性门禁和范围内语义审计通过。3 处过期 runbook 演练状态已由当前证据支持的限定修正关闭，并由未参与修正编写的独立 Agent 复核。任务 `13.7` 可以完成；用户验收与归档任务 `13.9` 仍保持未完成。

## 写入边界

- `record` 唯一允许写入：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`。
- 写入前，3 份 runbook、2 份合同测试、父 Harness 缩减、仓库 OpenSpec 路由和只读处置清单已经由提交 `25b95f10` 限定提交并推送；对应拉取请求 CI 已成功。
- 写入前只有本记录自身存在已跟踪未提交修订；本次在同一路径上收敛为最终记录。
- 写入前存在 5 个个人未跟踪脚本；本次不读取其正文、不修改、不暂存：
  - `scripts/agent-run-sunshangxiang-full-20260703.ts`；
  - `scripts/force-resume-all-paused-runs-after-reboot-20260625.ts`；
  - `scripts/repair-paused-runs-after-force-resume-20260625.ts`；
  - `scripts/test-import-resume-run.ts`；
  - `scripts/test-prisma-count-paused.ts`。
- 写入前暂存区为空。拉取请求正文更新是用户授权的 Git 交付步骤，已在本次 `record` 前通过精确 REST 路径完成并回读；它不属于 `record` 写入。
- 本次 `record` 没有暂存、提交、推送、构建、队列控制、数据库写入、服务重启、运行时文件修改或其他外部设置修改。

## 确定性检查

| 命令或证据 | 退出分类 | 结果摘要 | 工具故障 |
| --- | --- | --- | --- |
| `npm run docs:check -- --mode full --base origin/main` | 退出码 `0` | `requested=full`、`effective=full`、`errors=0`、`warnings=0`。 | 无。 |
| `node --import tsx --test tests/test-agent-policy-runbooks.test.ts tests/test-script-maintenance-doc.test.ts` | 退出码 `0` | 16/16 通过；覆盖 runbook 严格 profile、已演练清单和未演练分支声明。 | 无。 |
| 文档治理与 Skill 聚焦测试 | 退出码 `0` | 20/20 通过；覆盖当前文档路由、审计包、显式调用、证据合同与 Skill 校验器。 | 无。 |
| `npm run openspec:validate` | 退出码 `0` | 缩减后的 `establish-agent-harness` 与 `rebuild-documentation-governance` 共 2/2 通过。 | 无。 |
| `npm run skills:check -- .codex/skills/docs-audit` | 退出码 `0` | `errors=0`、`warnings=0`。 | 无。 |
| `npx tsc --noEmit --pretty false` | 退出码 `0` | TypeScript 检查通过。 | 无。 |
| `npm test` | 退出码 `1` | 单次串行运行 1,382 项，1,379 通过、3 个既有失败；类别仍为 design-demo CSS 所有权和两个自动打码 Python CLI 进程断言。 | 无；失败不在本次文档范围内。 |
| 拉取请求自动化运行 `32940122710` | 成功 | 提交 `25b95f10` 与受保护目标的合并关系上，文档聚焦测试、`full` 0/0 和干净结束证明成功。 | 无。 |
| 仓库清单生成器 `--check` | 退出码 `0` | 新处置证据已进入生成清单，后验检查无漂移。 | 无。 |

确定性门禁证明元数据、结构、导航、链接、关系、生成工件和受控适配器；下方独立审查负责 runbook 演练状态是否忠实反映已有证据。

## 已审查证据

### 当前实现

- `docs/_meta/policy.yaml` 的有限范围、根入口、责任方路由、禁止路径、`contract`/`review` 关系、中文门禁和受控适配器。
- 根入口、`AGENTS.md`、当前架构、产品、设计、API、测试与 runbook 树，以及对应文档检查与合同测试。
- 已跟踪的 `agent-rules/**`、`docs/archive/**`、`docs/history/**`、`docs/prototypes/**`、`docs/plans/**` 和 `docs/superpowers/**` 已清除；历史只由 Git 与 OpenSpec 恢复。
- 标准工作流位于 `config/workflows/standard-workflow.api.json`，当前服务端源码不再读取旧 `docs/workflow.api.json`。
- 3 份 runbook 当前修订只更新 `verificationState`、`lastVerified` 和验证状态说明；对应测试精确保护已演练与未演练边界，没有扩大操作步骤或生产授权。
- 提交 `25b95f10` 已加入脱敏处置清单，并把父 Harness 限定为已落地基础和仍需用户验收的完成门；未实施阶段没有被勾选或提升为当前能力。

### 已批准目标

- `rebuild-documentation-governance` 的 proposal、design、spec 与 tasks 定义文档控制面、当前知识迁移、权威切换、运行时资产迁移、阻断式文档 CI 和最终语义验收。
- 审计前子变更为 86/88；只有 `13.7` 和用户验收后的 `13.9` 未完成。本记录关闭 `13.7` 后为 87/88，但不代表用户已经完成 `13.9` 验收，也不授权归档。
- 用户于 2026-08-26 另行决定缩减父 Harness，取消尚未实施的可观测性、工程规范和统一 CI 阶段。该决定由父变更工件承载，不会把取消项描述为本子变更已实现能力。

### 历史意图

- `2026-07-12-apply-baseline.md`、`2026-07-10-session-handoff.md`、早期分批审计和 Git 历史只解释迁移动机、旧失败与删除处置。
- 本记录旧修订中的 82/88、84/88、86/88、旧 PID、旧证书和旧拉取请求摘要都是对应时点快照，不再充当当前状态权威。
- 已删除策略、归档、原型和平行计划不得从历史恢复为实时权威。

### 运行时与外部来源

- `evidence/2026-07-13-workflow-production-migration.md` 记录隔离构建、两次 Generation/Training 零活动门、同端口重启、本地与公开认证验证、工作进程状态、ComfyUI 可达性、旧兼容副本删除和锁释放。
- Git 当前证据确认提交 `25b95f10` 已推送到同名上游，且 5 个个人脚本仍保持未跟踪；这支持 Git runbook 的成功路径演练，不证明任何失败恢复分支。
- 提交 `25b95f10` 及自动化运行 `32940122710` 证明本次 runbook 修正、父范围缩减和处置清单已通过受保护比较基准；它不证明任何运行时部署。
- 拉取请求 `#1` 正文已通过精确 REST 更新并回读，不再声称生产配置未迁移或进度仍为 84/88。
- 本次没有重新调用具有 SSH 隧道副作用的工作进程状态端点，也没有用旧运行时快照声称 2026-08-26 的服务健康状态。

## 问题项

以下问题项按路径、位置和 ID 排序；每项都有已关闭处置。

### `FULL-GOVERNANCE-CORE-001`

- `id`：`FULL-GOVERNANCE-CORE-001`
- `path`：`docs/_meta/policy.yaml`
- `location`：有限范围、根入口、关系、适配器与中文门禁
- `claim`：文档治理控制面和确定性检查已经实施。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：`current`：同基准 `full` 为 0 错误/0 警告；聚焦 runbook 测试 16/16；运行 `32940122710` 在已提交目标树上成功。
- `conflict`：`none`。
- `confidence`：`high`；策略、检查器、测试和已提交自动化一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：继续在最终提交上运行带受保护比较基准的 `full` 和文档聚焦测试。

### `FULL-RUNBOOK-LOCAL-STATE-002`

- `id`：`FULL-RUNBOOK-LOCAL-STATE-002`
- `path`：`docs/runbooks/development/local-verification.md`
- `location`：frontmatter 的 `verificationState`、`lastVerified` 与“验证状态”章节
- `claim`：2026-07-13 的真实生产验证演练了本地登录、Cookie 会话、Generation/Training 状态和 ComfyUI 可达性，但没有演练需要创建 SSH 隧道的目标及其恢复。
- `claimCategory`：`current`
- `owner`：`development-operations`
- `evidence`：`current`：`evidence/2026-07-13-workflow-production-migration.md` 的验证结果；当前 runbook 精确写为 `exercised`、`2026-07-13`，并逐项保留 SSH 变体为未演练；合同测试直接断言该边界。
- `conflict`：`none`；原 `not-exercised` 冲突已由限定修正消除。
- `confidence`：`high`；脱敏生产证据、runbook 与测试一致。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：本次独立审查及 16/16 聚焦测试通过；未来 SSH 变体只有取得真实演练证据后才能提升状态。

### `FULL-RUNBOOK-GIT-STATE-003`

- `id`：`FULL-RUNBOOK-GIT-STATE-003`
- `path`：`docs/runbooks/git-delivery.md`
- `location`：frontmatter 的 `verificationState`、`lastVerified` 与“验证状态”章节
- `claim`：2026-07-14 已真实演练有边界检查、限定暂存、暂存差异复核、提交、推送和上游一致性确认；失败恢复分支未演练。
- `claimCategory`：`current`
- `owner`：`repository-delivery`
- `evidence`：`current`：Git 历史与同名上游均指向 `25b95f10`；5 个无关个人脚本仍未跟踪；当前 runbook 明确保留范围歧义、误暂存、提交失败和推送失败为未演练。
- `conflict`：`none`；原 `not-exercised` 冲突已由限定修正消除。
- `confidence`：`high`；当前 Git、工作树边界、runbook 与测试一致。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：本次独立审查及 16/16 聚焦测试通过；不从成功路径推导失败恢复已验证。

### `FULL-RUNBOOK-MAINT-STATE-004`

- `id`：`FULL-RUNBOOK-MAINT-STATE-004`
- `path`：`docs/runbooks/script-maintenance.md`
- `location`：frontmatter 的 `verificationState`、`lastVerified` 与“验证状态”章节
- `claim`：只有仓库清单生成分支在 2026-07-14 对真实受跟踪目标完成预检、授权写入、限定差异审查和后验验证；其他维护与数据库写入分支未演练。
- `claimCategory`：`current`
- `owner`：`repository-maintenance`
- `evidence`：`current`：提交 `67d8d823` 的仓库清单生成演练、提交 `25b95f10` 的限定生成结果、当前 runbook 的限定表述，以及对应测试对真实数据库未演练声明的直接断言。
- `conflict`：`none`；原整体 `not-exercised` 冲突已拆分为已演练的单一分支与明确未演练的其余分支。
- `confidence`：`high`；提交、runbook、生成器合同和测试一致。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：本次独立审查及 16/16 聚焦测试通过；不得用仓库清单演练替代任何真实数据库或删除脚本证明。

### `FULL-HOOK-BOUNDARY-005`

- `id`：`FULL-HOOK-BOUNDARY-005`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/2026-07-12-hook-experiment-handoff.md`
- `location`：隔离尝试、根级后继实验与责任方边界
- `claim`：PreToolUse 路径计数是非生产、被忽略输出的本地实验，不是文档治理能力，也不证明文件已读取或模型已理解。
- `claimCategory`：`current`
- `owner`：`repository-maintainers`
- `evidence`：`current`：交接证据、Hook 配置、记录器、忽略规则和聚焦测试；`target`：父 Harness 缩减决定取消把该实验推进为既定后续阶段。
- `conflict`：`none`；是否将来重新研究必须由新的独立 OpenSpec 决定。
- `confidence`：`high`；当前边界与用户缩减决定一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：不得把实验计数写成生产可观测性能力；本任务不修改 `.codex/hooks.json`。

### `FULL-REPO-TESTS-006`

- `id`：`FULL-REPO-TESTS-006`
- `path`：`package.json`
- `location`：`npm test` 的最后完整仓库结果
- `claim`：文档治理验收可以把完整仓库套件写成全绿。
- `claimCategory`：`current`
- `owner`：`repository-maintainers`
- `evidence`：`current`：2026-08-26 单次串行运行 1,379/1,382；3 项失败与实施前和 2026-07-14 基线类别相同。本次曾误并发两份完整测试并产生测试数据库锁争用，该工具失误结果已排除，没有作为产品证据。
- `conflict`：没有当前全绿证据。
- `confidence`：`high`；当前允许的唯一诚实结论是“不声称全绿”。
- `action`：`keep`
- `resolution`：`deferred-to-openspec`
- `verification`：由对应产品界面与自动打码责任方在后续独立变更中重新基线和修复；文档治理交付继续明确披露该风险。

### `FULL-HARNESS-SCOPE-007`

- `id`：`FULL-HARNESS-SCOPE-007`
- `path`：`openspec/changes/establish-agent-harness/`
- `location`：父变更提案、设计、规范、任务与仓库 OpenSpec 路由
- `claim`：父 Harness 已按用户 2026-08-26 决定取消未实施的可观测性、工程规范与统一 CI 范围，同时保留已落地基础和用户验收门。
- `claimCategory`：`target`
- `owner`：`repository-maintainers`
- `evidence`：`target`：用户明确选择先执行治理收口与只读清单；`current`：提交 `25b95f10` 的父工件不再要求实施取消项，仓库 OpenSpec 路由同步更新，严格校验 2/2 通过。
- `conflict`：`none`；取消项没有被勾选为完成或写成当前能力。
- `confidence`：`high`；用户决定、活动工件、任务状态和验证一致。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：严格 OpenSpec、文档门禁和独立审查确认未来能力必须另立并重新批准。

### `FULL-RESET-INVENTORY-008`

- `id`：`FULL-RESET-INVENTORY-008`
- `path`：`openspec/changes/establish-agent-harness/evidence/2026-08-26-project-reset-inventory.md`
- `location`：Git 工作树、Git 暂存快照、个人脚本、运行资产与路径漂移
- `claim`：处置清单只记录脱敏事实和后续建议，没有授权或执行清理。
- `claimCategory`：`current`
- `owner`：`repository-maintainers`
- `evidence`：`current`：清单区分 `keep`、`review`、`remove-later`、`protect`，明确记录本次无删除、移动、清理或运行时修改；Git 状态证明 5 个个人脚本仍未跟踪。
- `conflict`：`none`；运行状态是日期快照，所有实际处置仍需重新核对和授权。
- `confidence`：`high`；清单边界、Git 状态和用户授权范围一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：后续处置前重新核对精确对象；本次只运行文档与 Git 非写入检查。

### `FULL-FINAL-HANDOFF-009`

- `id`：`FULL-FINAL-HANDOFF-009`
- `path`：`openspec/changes/rebuild-documentation-governance/tasks.md`
- `location`：任务 `13.7` 的拉取请求交付摘要
- `claim`：草稿拉取请求 `#1` 准确披露生产迁移、Harness 缩减、当前验证、既有失败和剩余用户验收门。
- `claimCategory`：`current`
- `owner`：`repository-delivery`
- `evidence`：`current`：精确 REST 更新于 2026-08-26 成功并回读；旧 84/88 和“未迁移应用运行时配置”摘要已移除，正文引用提交 `25b95f10` 与运行 `32940122710`。
- `conflict`：`none`。
- `confidence`：`high`；外部回读、当前 Git 和 OpenSpec 任务一致。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：最终证据提交后再次读取拉取请求头提交、正文和检查状态；用户验收仍独立保留。

## 写入

- `record` 更新：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`。
- `record` 其他写入：`none`。
- 3 份 runbook 与 2 份合同测试是审计前已有修正；本次独立审查没有编辑它们。
- 任务 `13.7` 的勾选和父 Harness 缩减是用户另行明确授权的 OpenSpec 工件编辑，不属于本次 `record` 操作。

## 验证

- 写入前：同基准 `full` 为 0 错误/0 警告；runbook 16/16、治理与 Skill 20/20、严格 OpenSpec 2/2、Skill 0/0 和 TypeScript 均通过。
- 写入前：提交 `25b95f10` 的 CI 运行 `32940122710` 成功；完整套件单次串行结果为 1,379/1,382，3 个失败如实保留。
- 写入后及独立复核：同基准 `full` 为 0 错误/0 警告，runbook 16/16、严格 OpenSpec 2/2、Skill 0/0、生成器 `--check` 与 `git diff --check` 均通过；未重复运行完整 `npm test`，继续采用本次已有的单次串行结果。
- 工作树边界：5 个个人脚本保持未跟踪、未修改、未暂存；暂存区保持为空。

## 独立审查

- 审查者：独立子代理 `/root/frontend_audit`；未参与 3 份 runbook、2 份测试、父 Harness 缩减、处置清单或本记录的编写。
- 审查范围：3 项演练状态声明、父范围缩减、处置清单、拉取请求交接、对应原始证据、未演练变体、测试合同、写入边界、任务 `13.7` 完成条件和全部剩余风险。
- 审查方法：逐项比较既有生产迁移证据、Git 与上游状态、提交内容、runbook 限定措辞和测试断言；重跑同基准 `full`、生成器 `--check` 与 Git 差异检查，并复用已完成的聚焦测试结果。初次复核发现 2 个中文门禁错误，由记录作者限定修正后，审查者重跑 `full` 并关闭。
- 当前状态：`passed`。
- 最终处置：范围内确定性错误为零，每个 finding 均有关闭处置，3 个修正没有夸大演练覆盖，审计者没有修改被审查 runbook 或测试。任务 `13.7` 可以勾选。

## 待决策项与剩余风险

1. 任务 `13.9` 仍要求用户审查本记录、最终树与验证结果后明确验收；本次不得勾选或归档。
2. 完整仓库测试当前仍有 3 个既有失败；本阶段不顺带修复，也不写成全绿。
3. 本记录只把 2026-07-13/14 生产证据用于证明对应历史演练，不声称 2026-08-26 的运行服务、ComfyUI 或队列当前健康；任何部署前仍必须重新执行当前 runbook。
4. 父 Harness 缩减取消未实施阶段，不会删除已经落地的文档治理、OpenSpec 或部署安全基础，也不会把取消项提升为当前能力。
