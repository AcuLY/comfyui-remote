# 任务 9：归档旧规划开放项关闭记录

## 调用

- 显式调用方：已批准的 OpenSpec 任务 `9.2`、`9.3`、`9.5` 与 `9.6`。
- 范围：`$docs-audit paths docs/archive/superpowers/plans/2026-05-25-project-archive-comfy-cleanup.md docs/archive/superpowers/plans/2026-06-11-bulk-preset-section-replacement.md docs/archive/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md docs/product/generation tests/test-asset-page-boundaries.test.ts`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-superpowers-followup.md`。
- 本记录关闭 `task-9-superpowers.md` 中的 `SP-002`、`SP-004` 与 `SP-005`。

## 写入边界

- 唯一允许写入：本文件。
- 写入前暂存区为零；工作树有 180 个状态项，其中 101 个已跟踪修改或删除、79 个未跟踪项。
- 写入前状态摘要为 `97cd8aeb04fdb8d8881eee5ebd2e24ed64e4b41506716234aa70195534278a2e`。
- 归档源、当前 owner、测试、运行时路径与五个个人脚本均未在本次 `record` 调用中修改。

## 确定性检查

- `npm run docs:check -- --format json` 的外层进程退出 `1`，检查器 `exitCode` 为 `2`。
- 原因仍是待删除的旧 `docs/runbooks/config-runtime-assets.md` 没有当前元数据，导致新清单适配器停止。
- 本记录不把原子删除前状态称为完整通过。删除全部已审计旧版内容、暂存新文件并重生成清单后必须重跑。

## 已审查证据

### 当前实现

- `docs/product/generation/project-archive.md` 由当前归档、清理、UI 与列表源码支持。
- `docs/product/generation/preset-section-replacement.md` 由替换核心逻辑、服务、界面、入口与 LoRA 持久化测试支持。
- `tests/test-asset-page-boundaries.test.ts` 已改为读取 `src/lib/work-mode-resources.ts` 导出的 `WORK_MODE_RESOURCE_TARGETS`，不再读取归档全仓路线图。
- 本次聚焦复跑 25/25 通过；独立当前知识复核另有 30/30 通过。

### 已批准目标

- 只有从当前源码与测试重新证明的归档和批量替换行为可以迁入产品 owner。
- 读取归档路线图的测试必须切换到当前代码、策略、架构或测试所有的契约。
- 关闭上述条件后，旧实施计划和路线图必须删除，不建立历史副本。

### 历史意图

- 三份归档计划中的勾选步骤、提交/部署命令、旧行号、旧恢复载荷和路线图完成状态只属于历史。

### 运行时证据

没有执行归档、文件删除、数据库写入或队列操作。破坏性行为仅通过当前源码、文档披露与聚焦测试审查。

## 问题项

### `SP-002-CLOSE`

- `path`：`docs/archive/superpowers/plans/2026-05-25-project-archive-comfy-cleanup.md`。
- `location`：原开放项 `SP-002`。
- `claim`：当前项目归档、输出清理、路径边界、非原子失败和列表表现已进入 Generation 产品 owner。
- `claimCategory`：`current`。
- `owner`：`product-generation`。
- `evidence`：`current`：`docs/product/generation/project-archive.md` 与其 `verifiedBy`；`current`：服务与 API 返回计数但服务端操作与主界面丢弃计数，卡片使用乐观“文件已清理”文案；`current`：受管图片递归删除没有二次路径包含关系检查，文档未把缺口写成保证。
- `conflict`：旧计划中的原子性、导出保留和按钮门槛声明与当前行为冲突，均未迁移。
- `confidence`：`high`；当前源码、测试和独立复核一致。
- `action`：`extract-delete`。
- `resolution`：`fixed`。
- `verification`：删除源后运行项目归档、列表、本地/远端清理与产品文档测试。

### `SP-004-CLOSE`

- `path`：`docs/archive/superpowers/plans/2026-06-11-bulk-preset-section-replacement.md`。
- `location`：原开放项 `SP-004`。
- `claim`：普通预制批量替换的预演、阻塞、应用复查、预制组排除和 LoRA 分离边界已有当前 owner。
- `claimCategory`：`current`。
- `owner`：`product-generation`。
- `evidence`：`current`：`docs/product/generation/preset-section-replacement.md`、核心逻辑、服务、界面、入口与 LoRA 测试。
- `conflict`：`none`；旧逐步实施命令与完成清单不再具有当前价值。
- `confidence`：`high`；独立复核明确放行。
- `action`：`extract-delete`。
- `resolution`：`fixed`。
- `verification`：删除源后运行预制替换组合测试。

### `SP-005-CLOSE`

- `path`：`docs/archive/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md`。
- `location`：原开放项 `SP-005` 与唯一测试 consumer。
- `claim`：测试不再把归档路线图当作当前资源边界权威。
- `claimCategory`：`current`。
- `owner`：`documentation-governance`。
- `evidence`：`current`：`tests/test-asset-page-boundaries.test.ts` 读取 `WORK_MODE_RESOURCE_TARGETS`；`current`：该测试与产品/维护组合 25/25 通过。
- `conflict`：待重生成 `docs/repo-inventory.md` 和 OpenSpec evidence 仍会出现历史路径，但没有当前测试 consumer。
- `confidence`：`high`；测试输入路径和导出契约可直接核对。
- `action`：`delete`。
- `resolution`：`fixed`。
- `verification`：删除路线图后搜索非 OpenSpec 当前 consumer，并重跑资源边界测试。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-superpowers-followup.md`
- 其他写入：`none`

## 验证

- 当前批次聚焦测试：25/25 通过。
- 独立 owner 修正复核：30/30 通过。
- 三个原开放项的语义 disposition 已关闭；完整确定性门禁仍等待原子删除与清单重生成。

## 独立审查

- `SP-002` 与 `SP-004`：`/root/review_current_extraction` 独立复核并明确放行删除。
- `SP-005`：变更由 `/root/extract_legacy_current` 实施，主 Agent 以当前源码合同与聚焦测试独立复核。
- 最终结论：三份旧源均可删除，不保留当前或历史副本。

## 待决策项

- `none`。旧路线图中的未来阶段若要恢复，必须重新走 OpenSpec，不从归档清单自动恢复。
