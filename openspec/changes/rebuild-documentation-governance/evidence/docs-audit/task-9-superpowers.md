# 任务 9：归档 `Superpowers` 计划独立审计记录

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `9.2`，由独立审计者 `/root/audit_archive_prototypes` 执行。
- 范围：`$docs-audit paths docs/archive/superpowers`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-superpowers.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，提交 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`。
- 冻结输入：5 个已跟踪文件；`git ls-files -s -- docs/archive/superpowers` 清单摘要 `faed7f41d821f50d7ff8e402c7c107d899f7acd030f75d25f25afdb5b19cee40`。
- 范围明确；确定性门禁按完整模式执行。

## 写入边界

- 唯一允许写入：本文件。
- 写入前完整工作树基线：83 个已修改、14 个已删除、65 个未跟踪条目，共 162 条；规范化状态摘要 `cdc72f7d6ce9147f0b6ece0c9c0d614c86f2aeb8a84c99cf0463e50a7e5f70b9`。
- 未修改被审计计划、当前源码、现行 owner 文档、个人脚本或其他 evidence。

## 确定性检查

- 命令：`npm run docs:check`。
- 退出分类：`exit 1`，9702 个错误、3 个警告；不是检查器或配置故障。
- 与本组相关的失败包括 `tests/test-asset-page-boundaries.test.ts` 仍读取全仓路线图、旧索引与清单仍引用归档，以及历史英文正文。
- 该结果允许语义分析，但禁止把本范围报告为通过。

## 已审查证据

### 当前实现

- 队列：`src/lib/actions/run-lifecycle.ts`、`src/app/api/queue/pause-active/route.ts`、`src/app/api/queue/resume-paused/route.ts`、`docs/architecture/system/execution/queue-worker.md`、`docs/runbooks/deployment/queue-safety.md`。
- 项目归档与输出清理：`src/server/services/project-archive-service.ts`、`src/server/services/comfy-output-cleanup.ts`、`src/server/services/section-cleanup-service.ts`、`src/app/api/projects/[projectId]/archive/route.ts`。
- 内容审查：`src/server/services/censoring-service.ts`、`src/server/services/censoring-executor.ts`、`src/server/services/auto-censor-runner.ts`、`scripts/auto-censor-mosaic.py`、`docs/architecture/system/execution/queue-worker.md`、`docs/design/review-workbench.md`。
- 批量预制替换：`src/server/services/preset-section-replacement-core.ts`、`src/server/services/preset-section-replacement-service.ts`、`src/components/preset-section-replacement-dialog.tsx` 与相关测试。
- 聚焦测试批次共 60 项：58 项通过；2 项失败仅因为测试硬编码调用不可执行的 Windows 应用商店 `python3.exe` 别名。等价的本机 `Python 3.11.9` 命令验证 `--help` 为 `exit 0`，非法 `--mosaic-size 0` 为 `exit 1` 且先返回预期校验信息。
- 队列、项目归档、ComfyUI 输出清理、内容审查源码边界、LoRA 分离持久化和批量预制替换的其余聚焦断言均通过。
- 文档缺口扫描：在 `ARCHITECTURE.md`、`PRODUCT.md`、`DESIGN.md`、`docs/architecture/**`、`docs/product/**`、`docs/design/**`、`docs/runbooks/**` 中搜索项目归档/`comfyOutputSubfolder`/批量预制替换，返回零命中。

### 已批准目标

- 任务 `9.2`、`9.3`、`9.5`、`9.6`、`9.7`。
- 删除前基线明确要求：只有当前源码与测试证明时，才迁移队列安全、项目归档/输出清理、内容审查与预制替换事实；全仓路线图永远不是当前架构权威。

### 历史意图

- 本范围 5 个冻结实施计划。
- 计划中的勾选步骤、旧提交命令、旧部署命令、旧恢复载荷、旧文件行号和路线图完成标记不作为当前行为证明。

### 运行时证据

- 未修改队列、数据库、文件产物或服务。
- 仅执行本机 Python CLI 的只读帮助与参数校验；未加载模型、未处理图片、未读取秘密。

## 文件核对

| 冻结文件 | 处置 | 发现 |
| --- | --- | --- |
| `docs/archive/superpowers/plans/2026-05-21-queue-pause-resume.md` | 删除；当前事实已提取 | `SP-001` |
| `docs/archive/superpowers/plans/2026-05-25-project-archive-comfy-cleanup.md` | 先从当前源码提取，再删除 | `SP-002` |
| `docs/archive/superpowers/plans/2026-06-02-auto-censor-mosaic.md` | 删除；当前架构/设计 owner 已覆盖耐久边界 | `SP-003` |
| `docs/archive/superpowers/plans/2026-06-11-bulk-preset-section-replacement.md` | 先从当前源码提取，再删除 | `SP-004` |
| `docs/archive/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md` | 删除；先改写唯一测试 consumer | `SP-005` |

## 审计发现

### `SP-001`

- `id`：`SP-001`
- `path`：`docs/archive/superpowers/plans/2026-05-21-queue-pause-resume.md`
- `location`：全部实施任务、数据库迁移与手工冒烟测试
- `claim`：旧暂停/恢复计划及其宽泛批量操作、提交步骤和手工验收是当前队列安全权威。
- `claimCategory`：`history`
- `owner`：`queue-runtime`
- `evidence`：
  - `current`：`docs/architecture/system/execution/queue-worker.md` 记录远程取消确认、批次/来源标记与禁止宽泛恢复。
  - `current`：`docs/runbooks/deployment/queue-safety.md` 要求精确 `batchId` 与 `runIds`、部分失败停止、双队列门禁和只恢复本部署批次。
  - `current`：队列源码及进度流/取消顺序聚焦测试通过。
- `conflict`：旧计划缺少当前部署批次归属、部分暂停与精确集合验证，并包含过时的宽泛恢复操作。
- `confidence`：`high`；当前 source/runbook/test 一致。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行队列进度、远程取消、恢复路由和 runbook contract 测试。

### `SP-002`

- `id`：`SP-002`
- `path`：`docs/archive/superpowers/plans/2026-05-25-project-archive-comfy-cleanup.md`
- `location`：`Design Decisions`、归档服务、API 与 `Summary of Changes`
- `claim`：当前项目归档/ComfyUI 输出清理的耐久行为已经进入新的现行产品或架构 owner 文档。
- `claimCategory`：`unresolved`
- `owner`：`generation`
- `evidence`：
  - `current`：`src/server/services/project-archive-service.ts` 当前要求项目已导出、状态为 `done`/`partial_done` 且导出目录存在；它取消相关任务、清理回收站/受管图片/ComfyUI 输出/导出目录，最后写入 `archivedAt`。
  - `current`：`src/server/services/comfy-output-cleanup.ts` 对本地与 SSH 目标使用受限顶层目录清理。
  - `current`：项目归档 UI 源码契约与本地/SSH 输出清理测试通过。
  - `current`：新的 `docs/product/**`、`docs/architecture/**` 与 `docs/runbooks/**` 对上述主题搜索为零命中。
- `conflict`：旧计划本身已与当前实现部分漂移，不能原样保留；但当前破坏性生命周期事实尚未由新责任方文档承接，直接删除会丢失唯一的人类可读上下文。
- `confidence`：`high`；当前实现和文档缺口均可静态证明。
- `action`：`extract-delete`
- `resolution`：`open`
- `verification`：由 `generation` owner 从当前 source/test 重写项目归档前置条件、副作用、失败边界和本地/SSH 路径约束；新增或更新 owner 测试后，由另一独立审查者复核，再删除本计划。

### `SP-003`

- `id`：`SP-003`
- `path`：`docs/archive/superpowers/plans/2026-06-02-auto-censor-mosaic.md`
- `location`：任务 1 至任务 7、部署步骤与自审
- `claim`：旧实现步骤和旧部署命令是当前内容审查操作权威。
- `claimCategory`：`history`
- `owner`：`queue-runtime`
- `evidence`：
  - `current`：`docs/architecture/system/execution/queue-worker.md` 把 `CensoringTask`、Python 批处理、状态转换与启动恢复归入独立进程内内容审查循环。
  - `current`：`docs/design/review-workbench.md` 记录打码视图与快速打码交互边界。
  - `current`：当前源码与测试证明批处理、取消隔离、原子持久化前状态复核以及潜空间产物移除。
  - `current`：本机 `python` 直接验证轻量帮助和参数校验；硬编码 `python3` 的两项测试失败属于环境命令解析，不是脚本行为失败。
- `conflict`：旧计划包含过时的部署用 `curl` 命令、宽泛恢复示例和逐步实现说明；当前行为已演进。
- `confidence`：`high`；当前架构 owner 与源码测试覆盖耐久边界。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行内容审查源码、运行器与潜空间产物清理聚焦测试；另行修复 Windows 测试命令可移植性，不保留旧计划作为临时绕过。

### `SP-004`

- `id`：`SP-004`
- `path`：`docs/archive/superpowers/plans/2026-06-11-bulk-preset-section-replacement.md`
- `location`：替换核心、服务/API、对话框和入口任务
- `claim`：当前批量预制替换与 LoRA 分离不变量已经进入新的现行产品或架构 owner 文档。
- `claimCategory`：`unresolved`
- `owner`：`generation`
- `evidence`：
  - `current`：替换核心与服务当前实现预演、同分类约束、目标变体选择、无操作规则和阻断项。
  - `current`：UI、入口、核心和 LoRA 分离持久化聚焦测试通过。
  - `current`：新的产品、架构、设计和 runbook owner 对 `preset-section-replacement` 与“批量替换预制”搜索为零命中。
- `conflict`：当前 source/test 拥有行为，但新的现行文档树没有记录该跨项目/模板的替换边界和持久化不变量；直接删除会留下仅代码可发现的耐久知识。
- `confidence`：`high`；实现、测试与缺失文档均可确定性核对。
- `action`：`extract-delete`
- `resolution`：`open`
- `verification`：由 `generation` owner 从当前 source/test 提取高层替换流程、dry-run/blocker、同分类与 LoRA 分离边界；运行现有聚焦测试并取得独立复核后再删除。

### `SP-005`

- `id`：`SP-005`
- `path`：`docs/archive/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md`
- `location`：全文件，尤其当前 inventory 快照、各阶段完成标记与最终收口
- `claim`：全仓路线图仍是当前架构与测试权威，且现在没有实时使用方。
- `claimCategory`：`history`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：`ARCHITECTURE.md` 与 `docs/architecture/**` 已按源码重建当前边界。
  - `current`：`tests/test-asset-page-boundaries.test.ts` 仍直接读取该路线图。
  - `target`：任务 `9.6` 明确要求把读取归档路线图的测试改到当前代码、策略、架构或测试所有的契约。
- `conflict`：路线图内容是时间点快照且自带大量已完成标记；唯一测试 consumer 尚未切换。
- `confidence`：`high`；live consumer 精确可定位。
- `action`：`delete`
- `resolution`：`open`
- `verification`：先让 `tests/test-asset-page-boundaries.test.ts` 读取当前资源边界 owner，再确认非 OpenSpec 引用归零、相关测试通过及完整门禁为 `exit 0`。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-superpowers.md`
- 被审计源修改：`none`

## 验证

- 聚焦测试：60 项中 58 项通过；2 项因不可执行的 Windows 应用商店 `python3.exe` 别名失败。
- 等价 CLI 验证：系统 `python` 为 `Python 3.11.9`；`--help` 为 `exit 0`，非法马赛克大小为 `exit 1` 且输出预期校验信息。
- 完整门禁复跑：`npx tsx scripts/docs/check.ts --format json` 为 `exit 1`，9714 个错误、3 个警告；本文件新增诊断为 0。
- 同范围重新审计：5 个冻结文件均已映射。
- 删除就绪状态：未就绪；`SP-002`、`SP-004`、`SP-005` 和完整文档门禁仍开放。

## 独立审查

- 审查者：`/root/audit_archive_prototypes`，不是新 owner 文档作者，也不是这些历史计划作者。
- 状态：独立 disposition 审查完成；删除批准未给出。
- 最终结论：队列与内容审查计划可在使用方清理后删除；项目归档/输出清理和批量预制替换仍需从当前源码与测试提取到 `generation` 责任方；路线图测试使用方必须改写。上述开放项完成并再次独立复核前，保留全部源且不得报告本范围通过。

## 待决策项

- `none`。缺口的 owner 与当前行为均明确，不需要选择新产品方向；只需按当前实现完成提取和验证。
