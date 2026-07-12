# 文档审计证据合同

对每次 `$docs-audit` 的 `report`、`record`、`fix` 和独立审查应用本合同。

## 证据优先级

按以下顺序使用证据；冲突必须保留，不得静默覆盖：

1. **当前实现：** 当前源码、schema、聚焦测试、生成契约和必要 runtime evidence。测试若编码遗留结构或与实现矛盾，只能作为证据，不能作为权威。
2. **已批准目标：** 当前阶段已授权的活动 OpenSpec proposal、spec、design 和 tasks。在实施与验证证明其成为当前行为前，只能描述为目标行为。
3. **历史意图：** Git 历史及已归档 OpenSpec 或历史文档。历史只用于解释意图或定位待重新验证事实，绝不能直接提升为当前事实。
4. **未解决：** 证据冲突、缺少必要运行时证明，或仍有多个合理解释时，将声明分类为未解决。

不得在 `finding` 中暴露秘密或复制敏感运行时值。改为引用责任方路径、命令或已脱敏结果。

## Finding schema（字段结构）

为每个 finding 提供以下字段：

- `id`：稳定、scope 内唯一的标识。
- `path` 与 `location`：仓库相对文档路径和精确标题、行号或声明定位符。
- `claim`：正在评估的简洁声明。
- `claimCategory`：`current`、`target`、`history` 或 `unresolved`。
- `owner`：当前责任方 ID；归属本身有争议时使用 `user-decision-required`。
- `evidence`：按顺序排列的仓库相对引用或已脱敏运行时命令与结果，每项标记 `current`、`target` 或 `history`。
- `conflict`：矛盾或缺失的证据；没有时为 `none`。
- `confidence`：`high`、`medium` 或 `low`，并说明理由。
- `action`：`keep`、`rewrite`、`move`、`split`、`merge`、`extract-delete`、`delete` 或 `user-decision-required` 之一。
- `resolution`：`open`、`fixed`、`accepted-current`、`historical-only`、`duplicate-removed`、`deferred-to-openspec`、`user-decision-required` 或 `review-required` 之一。
- `verification`：关闭该 `finding` 所需的非写入命令、测试、运行时检查或审查者。

只有当前证据支持唯一修正时才使用 `high`。Confidence 不授予写入权限。

## 升级边界

`Finding` 涉及以下行为时，使用 `user-decision-required` 并保留来源：

- 选择或改变产品方向；
- 分配有争议的权威或归属；
- 把部分实现描述为有意完成；
- 删除可能含尚未提取当前知识的材料；
- 在多个合理解释中做选择；
- 依赖不可用的必要 runtime evidence；
- 在没有已验证恢复证据时修改安全关键型操作规则。

期望的未来行为若不是已批准当前目标，使用 `deferred-to-openspec`。任何 `fix` 后都使用 `review-required`，直到独立 Agent 或人工审查者重新运行相同范围。修复者绝不能自行把该结果改成通过的语义决定。

<!-- 测试契约锚点：Fixer 绝不能自行把该结果改成通过的语义决定。 -->

## 报告结构

按以下顺序返回或记录各部分：

1. **调用：** 显式调用方、范围、操作、比较基准及任何向 `full` 的升级。
2. **写入边界：** 允许写入和已采集既有工作树状态。
3. **确定性检查：** 命令、退出类别、诊断摘要和工具失败。
4. **已审查证据：** `current`、`target`、`history` 和运行时来源。
5. **`Finding`：** 按路径、位置、ID 确定性排序。
6. **写入：** 精确变更路径；`report` 与 `record` 除命名记录外使用 `none`。
7. **验证：** 责任方检查与同范围重跑结果。
8. **独立审查：** 审查者身份与状态以及最终处置；不可用时使用 `review-required`。
9. **待决策项：** 需要用户处理的未解决问题。

只有确定性错误为零、每个 `finding` 都有已关闭的 `resolution`、所有写入均受路径限制约束、`fix` 验证通过且任何 `fix` 已获独立审查时，范围才能通过。
