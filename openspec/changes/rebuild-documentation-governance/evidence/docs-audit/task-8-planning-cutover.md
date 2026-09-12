# 任务 8 平行规划切换独立审计记录

审计日期：2026-07-12

## 调用

- 调用方：已批准的 OpenSpec 任务 `8.2`；由主任务调度独立审计者 `/root/audit_current_plans` 执行。
- 范围：显式 `paths docs/superpowers docs/plans`，共 5 个现存 Markdown 文件；未使用 merge base，也未升级为 `full` 语义范围。
- 操作：`record`。
- 对照基线：分支 `codex/harness-doc-governance-handoff-20260710`，`HEAD` 为 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`；语义判断使用当前工作树源码、schema、聚焦测试和活动 OpenSpec 工件。
- 精确调用：

```text
$docs-audit paths docs/superpowers docs/plans record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md
```

## 写入边界

本次调用只允许写入：

`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md`

被审计规划文件、当前责任方、源码、schema、测试和先前的任务 6 证据均为只读。输出路径是仓库相对路径，位于活动变更 `rebuild-documentation-governance` 的 `evidence/docs-audit/` 下，不含绝对路径、路径穿越或仓库外链接。

### 写入前完整工作树基线摘要

- 上游：`origin/codex/harness-doc-governance-handoff-20260710`，领先 `0`、落后 `0`。
- 暂存区：干净，暂存项 `0`。
- 工作树：共 `162` 个状态项；已跟踪修改 `83`、已跟踪删除 `14`、未跟踪 `65`。
- `git status --short --untracked-files=all` 规范化输出的 SHA-256：`1cfda22280495fe4771c1f4c2d0e1de4e3fc923e1e736f9f85ed94315393e594`。
- 顶层状态项计数：`.codex` 3、`agent-rules` 13、`AGENTS.md` 1、`ARCHITECTURE.md` 1、`CLAUDE.md` 1、`config` 1、`DESIGN.md` 1、`docs` 56、`openspec` 24、`position_presets.md` 1、`PRODUCT.md` 1、`README.md` 1、`reports` 1、`scripts` 14、`src` 3、`tests` 40。
- 相比任务 6 调用前基线，唯一新增状态路径是已授权的 `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge.md`。
- 五个无关未跟踪个人脚本仍全部在允许写入集合外并保持不变。

## 确定性检查

| 命令 | 退出分类 | 结果摘要 | 工具故障 |
| --- | --- | --- | --- |
| `npm run docs:check` | `exit 1`，仓库规则违规 | 第二次调用独立重跑得到 `errors=9731`、`warnings=3`。遗留规划、归档/当前使用方、语言违规和原子迁移前索引状态仍未清零。 | 无；明确不是 `exit 2`。 |
| `node --import tsx --test tests/test-clear-active-runs-responsiveness.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-auto-censor-service-source.test.ts tests/test-auto-censor-runner.test.ts tests/test-latent-cleanup-source.test.ts tests/test-preset-section-replacement-core.test.ts tests/test-preset-section-replacement-ui.test.ts tests/test-preset-section-replacement-dialog-source.test.ts tests/test-quality-script-governance.test.ts tests/test-quality-phase0-baseline.test.ts` | `exit 0` | `56/56` 通过；覆盖队列远程确认、进度流、自动打码/潜空间产物清理、批量预制替换与质量数据归属。 | 无。 |
| `npx openspec validate rebuild-documentation-governance --strict` | `exit 0` | 活动变更严格校验通过，任务 `8.2` 的范围与输出位置有效。 | 无。 |

完整确定性门禁仍为 `exit 1`，所以本记录只签署删除前语义处置，不声称平行规划切换已完成最终验收。

## 已审查证据

### 当前实现

- 队列暂停/恢复：`src/lib/actions/run-lifecycle.ts`、`src/app/api/queue/pause-active/route.ts`、`src/app/api/queue/resume-paused/route.ts`、`src/server/services/comfy-queue-cancellation.ts`、`docs/architecture/system/execution/queue-worker.md`、`docs/runbooks/deployment/queue-safety.md` 及聚焦测试。
- 自动打码：`src/server/services/censoring-service.ts`、`src/server/services/auto-censor-runner.ts`、`src/server/services/censoring-executor.ts`、`scripts/auto-censor-mosaic.py`、两份 Prisma schema、`docs/architecture/system/context.md`、`docs/architecture/system/execution/queue-worker.md` 及聚焦测试。
- 批量预制小节替换：`src/server/services/preset-section-replacement-core.ts`、`src/server/services/preset-section-replacement-service.ts`、`src/components/preset-section-replacement-dialog.tsx`、项目/模板 API 路由与聚焦测试。
- 质量数据：`tests/fixtures/quality/auto-review-analysis/**`、`reports/quality/auto-review-analysis/**`、`src/server/quality/**`、`scripts/quality/**`、`docs/testing/quality-analysis.md` 及聚焦测试。

### 已批准目标

- `openspec/changes/rebuild-documentation-governance/specs/documentation-governance/spec.md` 要求 OpenSpec 成为重要变更的唯一生命周期，并删除 `docs/plans/**` 与旧规划/规范权威。
- 任务 `8.1` 至 `8.6` 要求只提取已验证当前知识、迁出非规划数据、删除平行规划，并由本记录在删除前独立审查处置。
- 任务 `8.4` 已标记完成；当前工作树的质量测试夹具、报告、脚本与责任方文档证明实际迁移已发生。

### 历史意图

`docs/superpowers/**` 中的设计与实施说明解释了功能形成过程，但不能覆盖当前源码。`docs/plans/auto-review-analysis/README.md` 记录的是迁移前的数据路径，不能覆盖当前质量责任方。

### 运行时来源

本次没有执行队列修改、自动打码任务、数据库写入、模型加载、浏览器交互或部署。源码与聚焦测试足以区分所审查规划声明；任何生产部署状态均未被本记录提升为已验证事实。

## 删除前逐项处置

| 路径 | 证据类别 | 已验证当前事实及其责任方 | 规划冲突或仅存历史价值 | 操作 | 解决状态 |
| --- | --- | --- | --- | --- | --- |
| `docs/plans/auto-review-analysis/README.md` | `history` | 基准测试夹具已迁到 `tests/fixtures/quality/auto-review-analysis/**`，生成报告已迁到 `reports/quality/auto-review-analysis/**`，`docs/testing/quality-analysis.md` 维护分类、重生成和验证契约。 | 表中仍列出已经不存在的 `docs/plans/**` 数据路径；没有剩余当前数据。 | `delete` | `historical-only` |
| `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md` | `history` | 当前暂停/恢复的批次标记、远程取消确认、有范围恢复、进度流和部署安全由队列源码、执行架构、队列安全运行手册与测试维护。 | “完全实现并部署”、单项逐个尽力而为暂停、100% 相同输出等声明不能由当前证据支持；其中允许远端取消失败后仍本地暂停的步骤与当前严格顺序直接冲突。 | `delete` | `historical-only` |
| `docs/superpowers/specs/2026-05-21-queue-pause-resume-design.md` | `history` | 当前运行记录的 `paused` 状态、精确批次恢复和失败边界已进入当前责任方。 | 是实施前设计；明确接受远端取消失败后仍本地暂停，已被当前源码和测试否定。 | `delete` | `historical-only` |
| `docs/superpowers/specs/2026-06-02-auto-censor-mosaic-design.md` | `history` | Python/YOLO 批处理适配器、固定类别/马赛克参数、`CensoringTask` 生命周期、无潜空间产物路径与失败处理均由当前源码/schema/测试证明；跨进程与队列边界已进入执行/上下文责任方。 | 目标设计已实施后继续保留会形成第二套规范；精确 CLI 和配置值应由当前源码/测试维护，而不是复制到规划文件。 | `delete` | `historical-only` |
| `docs/superpowers/specs/2026-06-11-bulk-preset-section-replacement-design.md` | `history` | 项目/模板范围、同分类验证、默认/显式目标变体、无匹配 no-op、重复规则阻断项、预演/应用/后验验证由当前服务、API、UI 与测试证明。 | 是已实现功能的前置设计；详细实现清单与未来修改规则不应继续充当平行产品规范。 | `delete` | `historical-only` |

逐项审查没有发现必须继续保留在这五个文件中的未提取当前知识。精确实现细节若只属于代码契约，由当前源码/测试责任方维护；跨责任方的稳定边界已经进入架构、运行手册、产品/API 或测试责任方。

## 仍需清理的实时引用

删除处置已接受，但同一切换批次仍必须处理下列当前或待重生成使用方，不能只删五个文件：

- `docs/index.md` 与 `docs/documentation-map.md` 仍把旧规划或 `docs/plans/**` 当作当前导航；它们本身属于任务 5/6 的待删除遗留路由。
- `docs/repo-inventory.md` 仍列出这五个路径；删除后必须由新生成器原地重生成。
- `scripts/docs/generate-repo-inventory.ts` 仍含 `docs/plans`/`docs/superpowers` 旧分类分支；最终零实时引用前必须移除或改为已批准策略驱动实现。
- `docs/script-maintenance.md` 仍指向旧质量目录；任务 6 审计已把该文件标记为需先提取再删除。
- `docs/archive/**` 中的引用属于后续任务 9 的历史输入，不能反向阻止本处置，但最终归档删除前必须按冻结组审计。
- `docs/_meta/policy.yaml` 对 `docs/plans/**` 与 `docs/superpowers/**` 的禁止模式是预防性策略，不是实时规划使用方；删除路径后应继续保留该禁止语义。
- 活动 OpenSpec 变更与本证据对这些路径的引用是迁移证据，不是平行生命周期权威。

## 审计发现

### `T8-QUALITY-001`

- `path`：`docs/plans/auto-review-analysis/README.md`
- `location`：`## Data Files` 与 `## Regeneration`
- `claim`：质量输入和生成报告仍归 `docs/plans/**` 所有。
- `claimCategory`：`history`
- `owner`：`quality-pipeline`
- `evidence`：`docs/testing/quality-analysis.md`（当前）、`tests/fixtures/quality/auto-review-analysis/**`（当前）、`reports/quality/auto-review-analysis/**`（当前）、任务 `8.4`（目标）。
- `conflict`：规划说明文件中列出的数据路径已迁走。
- `confidence`：`high`；文件系统、源码与 `56/56` 聚焦测试一致。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行质量聚焦测试、重生成清单，并确认 `rg -n "docs/plans/auto-review-analysis"` 只剩活动迁移证据或待删除归档输入。

### `T8-QUEUE-002`

- `path`：`docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`
- `location`：完整实施说明及同目录 `2026-05-21` 设计
- `claim`：旧规划文档仍是当前队列暂停/恢复权威。
- `claimCategory`：`history`
- `owner`：`queue-runtime`
- `evidence`：`src/lib/actions/run-lifecycle.ts`、`src/server/services/comfy-queue-cancellation.ts`、`docs/architecture/system/execution/queue-worker.md`、`docs/runbooks/deployment/queue-safety.md`、队列聚焦测试（当前）。
- `conflict`：旧尽力而为本地暂停与当前“远端确认后才更新本地”契约冲突。
- `confidence`：`high`；源码顺序和聚焦测试直接证明。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：`node --import tsx --test tests/test-clear-active-runs-responsiveness.test.ts tests/test-queue-control-progress-stream.test.ts`，以及运行手册契约测试脚本 `tests/runbook-contract-harness.ps1`。

### `T8-CENSOR-003`

- `path`：`docs/superpowers/specs/2026-06-02-auto-censor-mosaic-design.md`
- `location`：完整设计
- `claim`：自动打码目标仍需依赖该旧设计才能表达当前行为。
- `claimCategory`：`history`
- `owner`：`queue-runtime`
- `evidence`：自动打码服务、运行器、执行器、Python CLI、schema、执行/上下文责任方与聚焦测试（当前）。
- `conflict`：`none`；经验证的目标已经成为当前实现，剩余文档只是实施历史。
- `confidence`：`high`；`56/56` 测试覆盖固定参数、批处理、失败、环境、潜空间产物清理与状态写入。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：本记录列出的自动打码、潜空间产物与架构责任方测试。

### `T8-PRESET-004`

- `path`：`docs/superpowers/specs/2026-06-11-bulk-preset-section-replacement-design.md`
- `location`：完整设计
- `claim`：批量预制替换仍是未实现目标或必须由旧规范维护。
- `claimCategory`：`history`
- `owner`：`product-generation`
- `evidence`：预制替换核心/服务、项目/模板 API、对话框与聚焦测试（当前）。
- `conflict`：`none`；当前实现和测试覆盖该设计的稳定行为，详细清单不再是当前规范。
- `confidence`：`high`；服务、UI 与测试交叉证明。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：`node --import tsx --test tests/test-preset-section-replacement-core.test.ts tests/test-preset-section-replacement-ui.test.ts tests/test-preset-section-replacement-dialog-source.test.ts`

### `T8-LIVE-CONSUMERS-005`

- `path`：`docs/index.md`
- `location`：当前/待删除路由、清单、生成器与脚本矩阵中的 `docs/plans`/`docs/superpowers` 引用
- `claim`：删除五个规划文件后不会留下把 Agent 或维护流程继续路由到旧路径的实时引用。
- `claimCategory`：`unresolved`
- `owner`：`documentation-governance`
- `evidence`：`git grep -n -I -E "docs/(superpowers|plans)"`（当前）、任务 `8.5` 与 `12.1` 至 `12.4`（目标）。
- `conflict`：旧路由、清单、生成器和 `docs/script-maintenance.md` 仍含当前引用；归档/证据引用则属于明确后续历史输入。
- `confidence`：`high`；非写入搜索结果确定。
- `action`：`rewrite`
- `resolution`：`open`
- `verification`：完成同批使用方更新/删除与清单重生成后，搜索必须只剩禁止策略、活动 OpenSpec/证据或尚待任务 9 删除的归档历史引用。

### `T8-DETERMINISTIC-GATE-006`

- `path`：`docs/superpowers/**`
- `location`：第二次调用的完整确定性门禁
- `claim`：平行规划切换已达到零确定性错误。
- `claimCategory`：`unresolved`
- `owner`：`documentation-governance`
- `evidence`：`npm run docs:check` 返回 `exit 1`、`errors=9731`、`warnings=3`（当前），任务 `12.4`（目标）。
- `conflict`：规划文件、使用方、遗留路径、语言和索引状态尚未清理。
- `confidence`：`high`；命令结果确定。
- `action`：`delete`
- `resolution`：`open`
- `verification`：完成删除与全部 consumer 更新后，`npm run docs:check` 必须返回 `exit 0`。

## 写入

本次调用只创建：

`openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md`

没有修改或删除任何被审计规划、当前责任方、源码、测试或其他证据；没有暂存、提交、推送、构建、部署、队列或数据库操作。

## 验证

- 责任方检查：规划相关聚焦测试 `56/56` 通过；OpenSpec 严格校验通过。
- 同范围结论：`record` 不改变审计范围；五个规划路径的删除处置不变。
- 路径约束：本审计者的写入集合只有本文件。写入后复核时，总状态项从基线 `162` 变为 `166`；其中本调用新增本文件，另有并行审计者创建 `task-9-design-system-demos.md`、`task-9-historical.md` 与 `task-9-plans-prd.md`。这三个任务 9 证据不属于本调用写入，已原样保留；本审计者没有修改它们或其他路径。
- 最终状态：删除处置已独立接受；平行规划切换仍须完成使用方清理和零违规门禁，因此总体为部分完成，不是最终通过。

## 独立审查

- 审查者：`/root/audit_current_plans`。
- 独立性：审查者不是队列、自动打码、预制替换或质量责任方的实现/文档作者，只执行只读证据核对与受路径约束的 `record`。
- 状态：5 个文件的 `delete` 处置均通过删除前独立审查；没有发现需要保留的未提取当前知识。
- 最终解决状态：各文件为 `historical-only`；`T8-LIVE-CONSUMERS-005` 和 `T8-DETERMINISTIC-GATE-006` 保持 `open`，直到删除批次完成并由另一名独立审查者复核结果。

## 待决策项

没有产品方向、部分实现或权威分配问题需要用户决策。实施者必须按已批准 OpenSpec 目标删除平行规划并清理使用方；如果希望保留任一 `docs/plans/**` 或 `docs/superpowers/**` 作为命名例外，则必须升级为 `user-decision-required`，因为这会改变已批准的信息架构。
