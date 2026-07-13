# 任务 13：文档治理最终完整语义审计记录

审计日期：2026-07-13

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `13.7`。
- 精确调用：`$docs-audit full record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`。
- 范围：`full`；没有从更窄范围升级。审计覆盖策略分配的全部受治理路径、当前任务变更、CI 与 Hook 证据，以及验证声明所需的源码、测试、Git、运行时和外部状态。
- 操作：`record`；只允许写本文件，不授权修复任何被审计文档。
- 分支：`codex/harness-doc-governance-handoff-20260710`。
- 审计时 `HEAD`：`e71dd0162e46c352be73b3be87164b7487c11868`。
- 已批准比较基准：`74080ce352881bbecce9b7e6b16badeabd6a12d1`，该提交存在且与当前提交共享历史。
- 写入前除本记录外的工作树内容摘要：`0a97dce0fdaa6c096e73a7e13eae7c93679d7c217fa2119b09d7b78ad474ff3f`。
- 最终处置：确定性门禁通过，原 5 个当前文档与 Skill 语义缺陷已修复并通过独立复核；但完整阶段范围仍**未通过**。受保护基准 CI、生产运行时切换、必需检查、完整仓库测试和用户验收仍未完成。

## 写入边界

- 唯一允许写入：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`。
- 输出路径位于活动变更 `rebuild-documentation-governance` 的 `evidence/docs-audit/` 下；不是绝对调用路径，不含路径穿越、仓库外链接或第二写入点。
- 写入前本记录摘要：`c355710d13e5f08c1d672fd63ed50422a0643deeb6e824767455dced48309935`；写入后只允许该摘要变化。
- 其余任务改动在本调用前已经存在；本调用不得编辑它们。3 个历史误提交 Python 缓存的删除已精确暂存，其他任务文件未暂存。
- 兼容配置副本与 5 个个人脚本保持只读，SHA-256 分别为 `44a1e08e...6184af`、`9800f1f5...f4c4`、`a41b1023...7440`、`a779a736...89df`、`6b132657...3c` 和 `c9b0f7f9...b0ea`。
- 本调用没有新增暂存、提交、推送、构建、控制队列、写数据库、重启服务或修改运行时文件。

## 确定性检查

| 命令 | 退出分类 | 结果摘要 | 工具故障 |
| --- | --- | --- | --- |
| `npm run docs:check -- --mode full --base origin/main` | 退出码 `0` | `requested=full`、`effective=full`、`errors=0`、`warnings=0`。 | 无。 |
| 文档、Skill、策略、运行手册、产品设计、配置与 CI 聚焦 Node 测试 | 退出码 `0` | 94/94 通过。 | 无。 |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/runbook-contract-harness.ps1` | 退出码 `0` | 9/9 通过；包括非默认端口 `4317` 与临时同卷工件切换。 | 无。 |
| `npm run openspec:validate` | `exit 0` | `establish-agent-harness` 与 `rebuild-documentation-governance` 共 2/2 通过。 | 无。 |
| `npm run skills:check -- .codex/skills/docs-audit .codex/skills/ui-ux-pro-max .codebuddy/skills/ui-ux-pro-max` | 退出码 `0` | `errors=0`、`warnings=0`。 | 无。 |
| `python -m unittest -v tests.test_agent_file_access_hook` | `exit 0` | 10/10 通过。 | 无。 |
| `npx tsc --noEmit --pretty false` | 退出码 `0` | TypeScript 检查通过。 | 无。 |
| `npm test` | 退出码 `1` | 1,382 项中 1,379 通过、3 失败；失败类别与实施前基线中的设计演示 CSS 归属和两个 Python CLI 进程断言一致。 | 无；这是仓库测试失败，不是文档检查器故障。 |

确定性门禁只能证明结构、语言、链接、关系、生成工件与受控适配器；运行手册和项目 Skill 的人类语义仍由下方独立审查负责。

## 已审查证据

### 当前实现

- `docs/_meta/policy.yaml` 的有限 scope、60 份当前文档、根入口、owner 路由、禁止路径、`contract`/`review` 关系和受控适配器。
- 根 `README.md`、`AGENTS.md`、`ARCHITECTURE.md`、`PRODUCT.md`、`DESIGN.md`、薄 `CLAUDE.md`，以及当前架构、产品、设计、API、测试和运行手册树。
- 当前源码、两套 Prisma schema、生成器、聚焦测试、Git 状态与安装的 Next.js 16.2.1 实现。
- `.github/workflows/documentation-governance.yml` 与成功 `GitHub Actions` 运行 `29196186623` 的已有证据。
- `.codex/hooks.json`、根级 Hook 记录器、忽略规则和 10 项聚焦测试。
- 当前生产进程树：仓库范围 `next start` 监听进程 PID `32348`，监听端口 `3000`，从当前检出的 `.next` 提供服务；这只是审计时只读快照，不是稳定 PID 契约。

### 已批准目标

- `openspec/changes/rebuild-documentation-governance/proposal.md`、`design.md`、`specs/documentation-governance/spec.md` 与 `tasks.md`。
- 这些工件只证明目标与任务授权；未完成的运行时、CI 设置或用户验收不能因此提升为当前事实。
- 审计时任务进度为 82/88；未完成项为 `11.1`、`11.3`、`13.5`、`13.6`、`13.7` 和 `13.9`。本次只更新 `13.7` 的记录草稿；外部与运行时证据未齐，因此不勾选任务。

### 历史意图

- `2026-07-12-apply-baseline.md`、`2026-07-10-session-handoff.md`、Git 历史和早期分批 `$docs-audit` 记录只解释迁移动机、旧失败与待删除门禁。
- 早期记录中仍写为 `open` 的问题项不回写；本记录使用当前证据追加关闭处置。
- 已删除的 `agent-rules/**`、archive、prototype、计划和旧文档表面只通过 Git 与 OpenSpec 历史恢复，不是当前权威。

### 运行时与外部来源

- 只读进程与监听检查确认本检出存在运行中的 `next start`；没有停止或修改该进程。
- 安装的 Next.js 源码确认默认 `cleanDistDir: true`，`next build` 会删除同一 `.next` 中除 `cache`、`dev`、`lock` 外的内容；运行中的服务器继续从该目录读取静态文件、清单和服务端文件。
- `GET /api/worker/status` 的源码调用链可在 SSH 目标且 `tunnelAutoStart=true` 时启动分离式 `ssh` 隧道；本审计没有调用该端点或启动隧道。
- 现有 CI 证据证明一次 `push` 运行成功，但无法替代分支保护与规则集查询，也不证明最终证据修订版或受保护主分支基准的拉取请求运行。

## 问题项

以下 finding 按 `path`、`location`、`id` 排序。

### `FULL-SKILL-EXECUTABLE-001`

- `id`：`FULL-SKILL-EXECUTABLE-001`
- `path`：`.codex/skills/ui-ux-pro-max/SKILL.md` 与 `.codebuddy/skills/ui-ux-pro-max/SKILL.md`
- `location`：`## 前置条件与命令约定`、全部搜索命令和两套 `scripts/search.py` 帮助
- `claim`：Skill 中给出的搜索命令可从仓库根执行，并在 Windows 上遵循其 Python 前置检查。
- `claimCategory`：`current`
- `owner`：`repository-maintainers`
- `evidence`：
  - `current`：Codex 与 CodeBuddy 文档分别固定到自己的 `.codex/.../search.py` 与 `.codebuddy/.../search.py`，POSIX 使用 `python3`，Windows 使用 `python`。
  - `current`：两套脚本存在；帮助、代表性 `icons` 查询、`astro` 与 `nuxt-ui` 栈查询均在禁止字节码缓存的环境中成功。
  - `current`：测试直接核对实际脚本路径、实现常量与 `--help`，不再只校验 Skill 包结构。
- `conflict`：`none`；原错误命令与解释器歧义已经移除。
- `confidence`：`high`；路径存在性、已跟踪文件与解释器调用均可确定性复现。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：`tests/test-skills-check.test.ts`、三套 `skills:check` 与禁止生成缓存的帮助/查询冒烟测试；独立审查确认无阻断项。

### `FULL-SKILL-STACK-COVERAGE-002`

- `id`：`FULL-SKILL-STACK-COVERAGE-002`
- `path`：`.codex/skills/ui-ux-pro-max/SKILL.md` 与 `.codebuddy/skills/ui-ux-pro-max/SKILL.md`
- `location`：`### 可用技术栈`、`### 可用搜索领域` 与持久化说明
- `claim`：Skill 展示了当前脚本支持的 13 个技术栈。
- `claimCategory`：`current`
- `owner`：`repository-maintainers`
- `evidence`：
  - `current`：两份 Skill 列出与两套 `core.py` 完全一致的 13 个技术栈和 10 个搜索领域，包含 `astro`、`nuxtjs`、`nuxt-ui` 与 `icons`，不再声明无效 `prompt` 领域。
  - `current`：项目级 `design-system/<project-slug>/MASTER.md` 与页面覆盖路径、顺序搜索语义和生成文档内相对链接均与实现一致。
  - `current`：测试解析实际 `STACK_CONFIG`、`CSV_CONFIG` 和 CLI 帮助，避免用测试常量自证。
- `conflict`：`none`；原数量、领域与持久化路径冲突已修复。
- `confidence`：`high`；脚本常量与数据文件集合一致。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：`tests/test-skills-check.test.ts`、`icons`/`astro`/`nuxt-ui` 冒烟测试与独立实现对照审查。

### `FULL-CI-EVIDENCE-003`

- `id`：`FULL-CI-EVIDENCE-003`
- `path`：`.github/workflows/documentation-governance.yml`
- `location`：`运行完整文档检查` 的比较基准选择与任务 13 验收证据
- `claim`：已有真实 `GitHub Actions` 成功运行已经证明使用受保护比较修订版的最终验收头提交从干净状态开始并干净结束。
- `claimCategory`：`unresolved`
- `owner`：`repository-maintainers`
- `evidence`：
  - `current`：工作流在 `pull_request` 事件使用 `pull_request.base.sha`，在 `push` 事件使用 `event.before`，且没有仅文档路径过滤器。
  - `current`：运行 `29196186623` 在提交 `e71dd016...` 成功，76/76 聚焦测试通过，结束工作树干净。
  - `current`：该运行的 `--base` 是 `push` 前提交 `3825e0f1...`，不是主分支 `74080ce...`。
  - `current`：公开 GitHub API 返回 `main.protected=false`；最终配置仍须由有权限身份认证核验。
  - `target`：`spec.md:319-321` 要求验收证据包含使用受保护比较修订版的成功干净 CI。
- `conflict`：主分支当前未受保护；受保护基准只在本地分离式预检执行。当前最终修复、证据、任务状态、README 索引和本记录也不在既有成功运行的修订版中。
- `confidence`：`high`；工作流事件逻辑与已记录命令行明确。
- `action`：`user-decision-required`
- `resolution`：`user-decision-required`
- `verification`：先保护 `main` 并配置必需检查，再在实际受保护合并路径触发包含最终目标树的拉取请求或等价运行，确认 `--base` 为受保护目标提交、聚焦测试与 `full` 均通过且前后 Git 状态为空。

### `FULL-GOVERNANCE-CORE-004`

- `id`：`FULL-GOVERNANCE-CORE-004`
- `path`：`docs/_meta/policy.yaml`
- `location`：有限 scope、根入口、导航、禁止路径、关系与适配器
- `claim`：当前治理控制面、根入口、owner 路由、中文门禁、生成器与确定性文档 CI 合同已经实施。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：受治理路径由有限 scope 唯一分配，当前描述性文档可从批准入口到达；3 个历史误提交 Python 缓存已从最终索引删除。
  - `current`：禁止路径已跟踪计数为 0；当前文档 live-reference 搜索无匹配。
  - `current`：同基准 `full` 为 0 个错误、0 个警告；94/94 聚焦测试、2/2 OpenSpec 严格校验和 Skill 校验通过。
  - `current`：既有 `GitHub Actions` 运行证明固定 Node 环境中的文档作业实现可成功运行；`FULL-CI-EVIDENCE-003` 保留其验收证据边界。
- `conflict`：`none`；本 finding 只接受控制面和确定性实现，不接受下方仍开放的语义声明。
- `confidence`：`high`；策略、生成结果、检查器、测试与 Git 路径一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：继续运行带批准基准的 `full`、聚焦测试、严格 OpenSpec 与生成器检查。

### `FULL-WORKFLOW-SOURCE-005`

- `id`：`FULL-WORKFLOW-SOURCE-005`
- `path`：`docs/api/README.md` 与 `docs/architecture/domains/generation/README.md`
- `location`：标准工作流配置归属与 Generation 回退路径
- `claim`：当前源码和已接受 Git 树从 `config/workflows/standard-workflow.api.json` 读取标准工作流。
- `claimCategory`：`current`
- `owner`：`workflow-configuration`
- `evidence`：
  - `current`：`src/server/services/comfyui-service.ts:453-470` 构造并读取新配置路径；当前源码不引用旧文档路径。
  - `current`：配置/文档聚焦测试通过。
  - `current`：新配置文件与未跟踪兼容副本 SHA-256 均为 `44a1e08e...6184af`，静态模板内容相同。
- `conflict`：`none`；该结论只覆盖当前源码与 Git 树，不覆盖正在运行的旧生产实例。
- `confidence`：`high`；源码、文件内容和测试一致。
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：`tests/test-config-runtime-governance.test.ts` 与工作流生成聚焦测试。

### `FULL-RUNBOOK-INPLACE-BUILD-006`

- `id`：`FULL-RUNBOOK-INPLACE-BUILD-006`
- `path`：`docs/runbooks/deployment/next-build.md`
- `location`：`## 适用场景`、`## 前置条件`、候选构建合同和故障恢复
- `claim`：生产构建必须在同卷独立工作树生成候选工件，构建期间不得接触活跃 `.next`。
- `claimCategory`：`current`
- `owner`：`deployment-operations`
- `evidence`：
  - `current`：运行手册明确禁止在活跃检出原地构建，固定当前提交后在同卷独立 Git 工作树执行 `npm ci`、两套 Prisma client 生成和 `next build`。
  - `current`：候选 `.next` 完整性验证通过后移出临时工作树；构建期间不读取、写入、移动或删除活跃 `.next`，也不共享生产 `node_modules`。
  - `current`：服务重启手册只在旧监听停止后执行受控同卷切换，并明确不承诺所有 Windows 故障条件下的目录移动原子性。
  - `current`：`node_modules/next/dist/server/config-shared.js:86` 默认 `cleanDistDir: true`。
  - `current`：`node_modules/next/dist/build/index.js:536-538` 在构建开始递归清理同一 `.next`，仅排除 `cache`、`dev`、`lock`。
  - `current`：Next server 的 filesystem/router 实现持续从该 `.next/static`、`.next/server` 与清单路径读取并提供请求。
  - `current runtime`：PID `32348` 正从本检出的 `.next` 在端口 3000 提供生产服务。
- `conflict`：`none`；原地清理风险已通过隔离候选构建和停服后切换消除。
- `confidence`：`high`；安装版本源码、当前进程归属与运行手册命令直接交叉证明。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：Node 运行手册合同、PowerShell 临时同卷夹具与独立语义审查通过；真实生产构建和切换仍保持 `verificationState: not-exercised`。

### `FULL-RUNBOOK-PORT-PRESERVATION-007`

- `id`：`FULL-RUNBOOK-PORT-PRESERVATION-007`
- `path`：`docs/runbooks/deployment/service-restart.md`
- `location`：生产进程发现、工件预检、服务启动与部署后端口复核
- `claim`：重启基于真实监听替换同一生产服务，并且不会假设端口。
- `claimCategory`：`current`
- `owner`：`deployment-operations`
- `evidence`：
  - `current`：从 `$oldListeners` 去重并要求唯一 `$servicePort`，候选路径也必须与 `$deploymentId` 推导路径精确相等。
  - `current`：本地与 SSH 启动命令均显式使用 `npx next start -p $servicePort`，并要求新监听端口等于旧值。
  - `current`：PowerShell 合同用非默认端口 `4317` 验证发现、启动参数和临时工件切换。
  - `current`：安装的 Next CLI 在没有 `-p`/进程 `PORT` 时默认使用 3000。
  - `current runtime`：当前 PID `32348` 恰好监听 3000；这只说明当前值与默认值偶然一致。
- `conflict`：`none`；默认端口假设已移除。
- `confidence`：`high`；变量数据流与 CLI 选项语义确定。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：PowerShell 合同 `4317` 场景、Node 文档合同和独立语义审查通过；真实重启仍保持未演练。

### `FULL-VERIFY-SIDE-EFFECT-008`

- `id`：`FULL-VERIFY-SIDE-EFFECT-008`
- `path`：`docs/runbooks/development/local-verification.md`，影响 `docs/runbooks/development/README.md` 与 `docs/runbooks/deployment/verification.md`
- `location`：frontmatter 风险、适用场景、worker 状态 GET、预期结果和故障处理
- `claim`：worker GET 对应用数据只读，但在 SSH 自动隧道场景可能创建分离式 `ssh` 进程，必须事前授权并披露恢复限制。
- `claimCategory`：`current`
- `owner`：`development-operations`
- `evidence`：
  - `current`：`GET /api/worker/status` 在 `route.ts:14-18` 调用 `checkComfyUIReachability()`。
  - `current`：`comfyui-service.ts:142-144` 调用 `ensureActiveComfySshTunnel()`。
  - `current`：`comfy-ssh.ts:164-181,202-206,229-237` 在 SSH 目标、自动启动开启且本地端口未监听时分离启动 `ssh`、登记进程并 `unref()`。
  - `current`：本地验证手册已披露该 GET 的操作系统进程副作用，并要求在请求前根据目标模式和自动启动配置取得授权。
  - `current`：手册说明成功隧道没有公开停止 API，服务重启后不能依赖内存归属表恢复；不得按进程名宽泛终止。
- `conflict`：`none`；应用数据只读与操作系统进程副作用已经明确分离。
- `confidence`：`high`；路由到进程启动的调用链和文档门禁没有歧义。
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：本地验证合同、源码调用链与独立语义审查通过；真实隧道创建和恢复仍保持 `verificationState: not-exercised`。

### `T6-DETERMINISTIC-GATE-007-CLOSE`

- `id`：`T6-DETERMINISTIC-GATE-007-CLOSE`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge.md`
- `location`：原 `T6-DETERMINISTIC-GATE-007`
- `claim`：任务 6 的旧版迁移错误、语言违规与索引状态已完成原子清理。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：当前 `full` 为 0/0；当前 owner 与生成器聚焦测试通过；禁止已跟踪路径为 0。
- `conflict`：`none`；原 9,702 个错误只属于历史迁移中间态。
- `confidence`：`high`
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：本次相同基准 `full` 与 94/94 聚焦测试。

### `T8-LIVE-CONSUMERS-005-CLOSE`

- `id`：`T8-LIVE-CONSUMERS-005-CLOSE`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md`
- `location`：原 `T8-LIVE-CONSUMERS-005`
- `claim`：当前文档与维护流程已不再把 Agent 路由到 `docs/plans/**` 或 `docs/superpowers/**`。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：禁止路径已跟踪计数 0；排除策略声明后当前文档 live-reference 搜索无匹配；清单生成检查与 `full` 通过。
- `conflict`：`none`
- `confidence`：`high`
- `action`：`rewrite`
- `resolution`：`fixed`
- `verification`：`git ls-files`、当前文档搜索与本次 `full`。

### `T8-DETERMINISTIC-GATE-006-CLOSE`

- `id`：`T8-DETERMINISTIC-GATE-006-CLOSE`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md`
- `location`：原 `T8-DETERMINISTIC-GATE-006`
- `claim`：平行规划切换已达到零确定性错误。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：当前 `full` 为 0 个错误、0 个警告；规划禁止路径计数为 0。
- `conflict`：`none`
- `confidence`：`high`
- `action`：`delete`
- `resolution`：`fixed`
- `verification`：本次同基准 `full`。

### `DD-001-CLOSE`

- `id`：`DD-001-CLOSE`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-design-system-demos.md`
- `location`：原 `DD-001`
- `claim`：旧设计演示/设计系统 archive 的 live consumer 已移除，当前生产与 design-demo owner 已接管。
- `claimCategory`：`current`
- `owner`：`product-design`
- `evidence`：`docs/archive/**` 已跟踪计数 0；当前设计 owner 测试通过；当前文档搜索与 `full` 无旧路径诊断。
- `conflict`：`none`
- `confidence`：`high`
- `action`：`delete`
- `resolution`：`fixed`
- `verification`：当前设计聚焦测试、Git 路径检查与本次 `full`。

### `HIST-005-CLOSE`

- `id`：`HIST-005-CLOSE`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-historical.md`
- `location`：原 `HIST-005`
- `claim`：历史交接、进度与测试计划组的 live consumer 已移除，可以保持历史删除 disposition。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：archive/history 跟踪路径为 0；当前文档 live-reference 搜索无匹配；生成清单和 `full` 通过。
- `conflict`：`none`
- `confidence`：`high`
- `action`：`delete`
- `resolution`：`fixed`
- `verification`：Git 路径/引用检查与本次 `full`。

### `PLAN-005-CLOSE`

- `id`：`PLAN-005-CLOSE`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-plans-prd.md`
- `location`：原 `PLAN-005`
- `claim`：旧 archive 计划与 PRD 的当前 consumer 已清除，当前 owner 与 OpenSpec 生命周期接管。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：archive/plans 跟踪路径为 0；当前 owner 路由、清单生成和 `full` 通过。
- `conflict`：`none`
- `confidence`：`high`
- `action`：`delete`
- `resolution`：`fixed`
- `verification`：Git 路径/引用检查与本次 `full`。

### `PROTO-004-CLOSE`

- `id`：`PROTO-004-CLOSE`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-10-prototypes.md`
- `location`：原 `PROTO-004`
- `claim`：Training prototype 的 live consumer、路由映射、清单分类和专用测试要求已移除。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：`docs/prototypes/**` 跟踪路径为 0；当前产品/设计 owner 聚焦测试与 `full` 通过。
- `conflict`：`none`
- `confidence`：`high`
- `action`：`delete`
- `resolution`：`fixed`
- `verification`：Git 路径检查、产品/设计聚焦测试与本次 `full`。

### `FULL-HOOK-BOUNDARY-016`

- `id`：`FULL-HOOK-BOUNDARY-016`
- `path`：`openspec/changes/rebuild-documentation-governance/evidence/2026-07-12-hook-experiment-handoff.md`
- `location`：隔离 PoC、根级后继实验与后续责任方
- `claim`：Hook 只粗略统计仓库路径访问尝试，直接写被忽略的本地 `logs/harness` 与 `metrics/harness`，不依赖应用服务，也不证明成功读写或理解。
- `claimCategory`：`current`
- `owner`：`agent-observability`
- `evidence`：当前 Hook 配置清单、记录器、`.gitignore`、`git ls-files -- logs metrics` 为 0，以及 10/10 测试。
- `conflict`：`none`；并发、保留、隐私、开销和生产接入明确延后。
- `confidence`：`high`
- `action`：`keep`
- `resolution`：`accepted-current`
- `verification`：Hook 聚焦测试、忽略规则与输出路径检查；后续可观测性 OpenSpec 重新验证两项输入。

### `FULL-WORKFLOW-RUNTIME-017`

- `id`：`FULL-WORKFLOW-RUNTIME-017`
- `path`：`openspec/changes/rebuild-documentation-governance/tasks.md`
- `location`：任务 `11.1` 与 `11.3`
- `claim`：正在运行的生产实例已经切换到新工作流配置，并完成构建、队列、部署和公开验证。
- `claimCategory`：`unresolved`
- `owner`：`workflow-configuration`
- `evidence`：
  - `current`：源码/Git 树迁移已由 `FULL-WORKFLOW-SOURCE-005` 接受。
  - `current`：未跟踪旧兼容副本仍存在且与新配置内容相同。
  - `target`：任务 `11.1`/`11.3` 要求运行时、工作流生成、构建、队列和部署验证。
  - `current`：CI 证据明确不声称生产切换；2026-07-13 公开 TLS 复核仍返回 `SEC_E_CERT_EXPIRED`。
- `conflict`：缺少必要生产运行时证据，且证书错误使部署事务无法按不绕过 TLS 的规则完成；运行手册语义修复不等于真实演练。
- `confidence`：`high`；对“尚未证明”状态有直接任务与证据支持。
- `action`：`user-decision-required`
- `resolution`：`user-decision-required`
- `verification`：TLS 恢复后，在部署事务中完成隔离构建、精确重启、真实本地/公开验证和有范围队列恢复；TLS 不得绕过。

### `FULL-REQUIRED-CHECK-018`

- `id`：`FULL-REQUIRED-CHECK-018`
- `path`：`openspec/changes/rebuild-documentation-governance/tasks.md`
- `location`：任务 `13.6`
- `claim`：文档治理作业已成为每条受保护合并路径的必需检查。
- `claimCategory`：`unresolved`
- `owner`：`repository-maintainers`
- `evidence`：`GitHub Actions` 作业成功是当前证据；`spec.md:310-331` 与任务 `13.6` 是目标；公开 API 返回 `main.protected=false`，有权限配置仍需认证核验。
- `conflict`：`main` 当前未受保护，因而不存在已满足目标的受保护合并路径必需检查。
- `confidence`：`high`；公开分支状态与未完成任务一致，但最终设置仍需有权限身份核验。
- `action`：`user-decision-required`
- `resolution`：`user-decision-required`
- `verification`：由有权限维护者保护 `main`，把真实作业 `文档治理门禁` 设为必需检查，并用拉取请求阻断行为验证。

### `FULL-USER-ACCEPTANCE-019`

- `id`：`FULL-USER-ACCEPTANCE-019`
- `path`：`openspec/changes/rebuild-documentation-governance/tasks.md`
- `location`：任务 `13.9` 与父变更任务 `2.5`、`2.8`、`2.9`
- `claim`：最终目标要求用户明确验收后才能归档，且归档不会自动开始可观测性阶段。
- `claimCategory`：`target`
- `owner`：`user-decision-required`
- `evidence`：子变更任务 `13.9` 明确要求用户验收后归档；父 Harness 仍保持文档阶段任务和可观测性前置门未完成。
- `conflict`：本记录的语义修复已独立复核，但 CI、生产运行时、分支保护、完整仓库测试和用户验收仍有开放问题；目标尚未满足，不存在归档或推进授权。
- `confidence`：`high`
- `action`：`user-decision-required`
- `resolution`：`user-decision-required`
- `verification`：受保护路径 CI、必需检查与生产切换证据关闭并完成最终重跑审计后，由用户明确验收；随后才可归档，且不得自动开始可观测性实施。

### `FULL-REPO-TESTS-020`

- `id`：`FULL-REPO-TESTS-020`
- `path`：`package.json`
- `location`：`npm test` 当前完整仓库结果
- `claim`：完整仓库测试套件已经全绿。
- `claimCategory`：`current`
- `owner`：`repository-maintainers`
- `evidence`：当前运行 1,382 项，1,379 通过、3 失败；失败为设计演示注册表 CSS 归属，以及自动打码 Python CLI 的帮助与非法 `mosaic-size` 两项进程断言。
- `conflict`：失败类别与 `2026-07-12-apply-baseline.md:37-43` 记录的一个设计 CSS 与两个 Python CLI 基线类别一致，但当前完整套件仍不是绿色。
- `confidence`：`high`
- `action`：`keep`
- `resolution`：`deferred-to-openspec`
- `verification`：由对应 UI 与自动打码责任方在独立变更中复现和修复；重新运行 `npm test` 达到明确全绿总数。

## 写入

- 更新：`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`。
- 其他写入：`none`。
- 被审计文档、源码、配置、任务清单、README、暂存区、运行时文件和其他未跟踪文件均未由本调用修改。

## 验证

- 写入前同基准 `full`：退出码 `0`，0 个错误、0 个警告。
- 写入后同基准 `full`：退出码 `0`，0 个错误、0 个警告。
- 本文件中文结构检查：0 个诊断；命令、路径、字段名与问题项 ID 只作为稳定技术标识保留。
- 工作树边界：除本记录外的摘要仍为 `0a97dce0fdaa6c096e73a7e13eae7c93679d7c217fa2119b09d7b78ad474ff3f`；唯一变化是本记录自身。
- 责任方验证状态：确定性控制面通过；原 5 个语义缺陷已修复并由独立审查者接受。CI 验收、运行时切换、必需检查、完整仓库测试和用户验收保持未关闭。

## 独立审查

- 证据与 OpenSpec 独立审查者：`/root/final_evidence_review`；确认任务 82/88、既有 7 个历史关闭问题项、CI 基准与最终修订版边界、运行时和必需检查未完成状态。
- 当前文档语义独立审查者：`/root/final_semantic_review`；确认原 5 个 Skill、构建、端口和 GET 隧道副作用问题项均可关闭为 `fixed`，未发现新阻断项。
- 两名审查者均未编写被审计文档或本记录。
- 对本记录精确内容的复核状态：已完成；`/root/final_evidence_review` 确认问题项 schema、处置、测试数量、任务状态和外部边界一致。
- 最终语义处置：当前文档语义修复通过独立复核，但阶段完整验收未通过；不得把本地 0/0 改写为 CI、生产或用户验收完成。

## 待决策项

1. 由有权限维护者保护 `main`，把 `文档治理门禁` 配置为必需检查，关闭 `13.6`。
2. 在受保护 `main` 上触发包含最终目标树的成功干净 CI，关闭 `13.5`。
3. TLS 恢复后完成任务 `11.1`/`11.3` 的真实生产切换、队列安全和不绕过证书的验证。
4. 由对应责任方处理完整仓库测试剩余 3 项既有失败；不得把它们写成全绿。
5. 上述外部与运行时证据齐全后再次执行本记录的最终重跑与独立复核，关闭 `13.7`。
6. 请用户明确决定是否验收并归档文档治理阶段；在此之前不得推进可观测性实施。
