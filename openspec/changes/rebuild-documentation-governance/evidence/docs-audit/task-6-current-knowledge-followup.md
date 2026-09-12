# 任务 6：当前知识提取关闭记录

## 调用

- 显式调用方：已批准的 OpenSpec 任务 `6.8` 与 `6.9`。
- 范围：`$docs-audit paths docs/runbooks/script-maintenance.md docs/product/generation/project-archive.md docs/product/generation/preset-section-replacement.md docs/script-maintenance.md`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge-followup.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，`HEAD` 为 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`。

## 写入边界

- 唯一允许写入：本文件。
- 写入前暂存区为零；工作树有 179 个状态项，其中 101 个已跟踪修改或删除、78 个未跟踪项。
- 写入前状态摘要为 `65d5a1a71d9815699ab1285f43ccce7de725179e3ececf3e3fdee0a80cc8cb8a`。
- 被审计文档、源码、测试、运行时文件及五个个人脚本在本次 `record` 调用中均为只读。

## 确定性检查

- `npm run docs:check -- --format json` 的外层进程退出 `1`，检查器 `exitCode` 为 `2`。
- `repo-inventory` 适配器首先遇到待删除的旧 `docs/runbooks/config-runtime-assets.md`，其旧格式没有当前元数据。
- 该工具阻塞必须通过原子删除旧版内容、暂存新文件并重生成清单关闭；不得为待删除旧文档补建新权威。本记录只关闭语义提取项，不报告完整确定性范围通过。

## 已审查证据

### 当前实现

- 维护脚本参数、写入和退出语义来自对应脚本源码与聚焦测试。
- 项目归档行为来自 `project-archive-service.ts`、`project.ts`、归档按钮、列表卡片和本地/远端清理器。
- 预制批量替换行为来自核心逻辑、服务、入口、对话框与 LoRA 分离持久化测试。
- 清单生成器现从 `git ls-files -z`、已校验文档元数据及 `policy.scope.kind` 派生分类，不再按路径子串猜测 owner。

### 已批准目标

- 当前操作知识必须进入任务型运行手册；Generation 破坏性产品生命周期必须进入产品 owner。
- 旧矩阵和实施计划在当前事实完成提取并获独立复核后删除。

### 历史意图

- `docs/script-maintenance.md` 与两份归档旧规划只作为迁移输入；旧命令、勾选步骤和未经验证保证不保留为当前权威。

### 运行时证据

未修改真实数据库、文件、服务或队列。脚本 CLI 只在负向、无写入场景中验证；其余声明由源码与测试关闭。

## 问题项

### `T6-FOLLOWUP-001`

- `path`：`docs/runbooks/script-maintenance.md`。
- `location`：当前入口契约与 `collapsePresetGroupBindings()` 补充说明。
- `claim`：高风险脚本的输入、预演、写入与退出边界已经从旧矩阵提取并按当前实现纠正。
- `claimCategory`：`current`。
- `owner`：`repository-maintenance`。
- `evidence`：`current`：新运行手册、脚本源码与 `tests/test-script-maintenance-doc.test.ts`；实际负向测试只设置 `DATABASE_URL` 且不传 `--database-url`，确认退出 `1` 并返回 `DATABASE_URL is required`。
- `conflict`：旧矩阵对 generator `--check` 和 Hook 范围已有漂移；新文档明确 CLI 的 `null` 参数不会触发环境默认值。
- `confidence`：`high`；源码、真实 CLI 负例与文档一致。
- `action`：`extract-delete`。
- `resolution`：`fixed`。
- `verification`：删除 `docs/script-maintenance.md` 后运行维护脚本聚焦测试与文档门禁。

### `T6-FOLLOWUP-002`

- `path`：`docs/product/generation/project-archive.md`。
- `location`：受管图片、失败语义与列表表现。
- `claim`：当前归档前置、副作用、路径边界与非原子失败已被准确记录，没有把缺口写成保证。
- `claimCategory`：`current`。
- `owner`：`product-generation`。
- `evidence`：`current`：归档服务、服务端操作、按钮与列表源码；当前责任方明确披露受管图片删除没有再次进行路径包含关系校验、服务端操作丢弃计数、按钮只显示成功提示、列表固定显示“已归档 · 文件已清理”。
- `conflict`：界面文案比尽力清理语义更乐观；该真实性缺口被保留为当前事实，没有在本阶段修改运行时代码。
- `confidence`：`high`；源码片段与聚焦静态合同一致。
- `action`：`extract-delete`。
- `resolution`：`fixed`。
- `verification`：运行项目归档 UI、列表、本地/远端输出清理与产品文档聚焦测试。

### `T6-FOLLOWUP-003`

- `path`：`docs/product/generation/preset-section-replacement.md`。
- `location`：预演、阻塞、后验复查与 LoRA 分离不变量。
- `claim`：批量替换的当前产品边界已从旧计划提取。
- `claimCategory`：`current`。
- `owner`：`product-generation`。
- `evidence`：`current`：核心逻辑、服务、界面、入口与 LoRA 测试；文档 `verifiedBy` 已包含入口测试。
- `conflict`：`none`。
- `confidence`：`high`；独立审查与聚焦测试一致。
- `action`：`extract-delete`。
- `resolution`：`fixed`。
- `verification`：运行预制替换、入口、UI、LoRA 与 API 聚焦测试。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-current-knowledge-followup.md`
- 其他写入：`none`

## 验证

- 最终独立复核聚焦测试：30/30 通过。
- 前一轮设计、产品、脚本与清单组合验证：53/53 通过。
- 完整确定性门禁仍等待旧版内容原子删除与清单重生成，因此本记录不把全范围写成已通过。

## 独立审查

- 审查者：`/root/review_current_extraction`，不是三份当前 owner 文档的作者。
- 状态：四个原始事实问题全部关闭；删除 disposition 已通过。
- 结论：`docs/script-maintenance.md` 以及对应项目归档、批量预制替换旧计划均可删除，不建立历史副本。

## 待决策项

- `none`。归档运行时安全和 UI 真实性缺口已诚实记录；是否修复它们属于后续独立运行时变更，不由本次文档迁移决定。
