# Phase 0 PRD：历史数据基线与风险图谱

## 1. 目的

建立可复现的历史数据基线，确认哪些项目、section、姿势类型、checkpoint/LoRA 组合具有参考价值，为后续 Auto Reviewer 和 Compatibility Router 提供数据基础。

## 2. 用户问题

Luca 当前缺少一个可信的“历史失败分布”：哪些姿势真实更容易出废图、哪些小节样本不足、哪些项目审核结果可参考、同一姿势在不同项目中的序号如何对应。没有这层基线，后续自动审图很容易用错数据或把无参考性小节当作训练目标。

## 3. 范围

### In scope

- 从 SQLite / API 只读抽取 7 个有效参考项目的项目、section、run、image、reviewStatus、checkpoint、loraConfig。
- 按 canonical section name / pose key 聚合，而不是按 sortOrder。
- 生成 section-level trash rate、project-level keep rate、position mapping、manual exclusion 标记。
- 输出 CSV / JSON / Markdown 报告。

### Out of scope

- 不做任何图片视觉判断。
- 不修改 reviewStatus。
- 不决定 auto-trash 逻辑。
- 不引入训练 LoRA。

## 4. 输入数据

- 参考项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 有效标签：`ImageResult.reviewStatus in ('kept', 'trashed')`。
- manual exclusions：`docs/plans/auto-review-analysis/reference-section-exclusions.json`。
- 当前已知 manual exclusions：`单人 · 拎鞋`、`第一人称 · 胸压`。

## 5. 产品需求

### P0-1：生成可复现数据集

系统必须导出 labeled image dataset，每行至少包含：

- projectId / projectTitle
- sectionId / sectionName / canonicalSectionName / sortOrder
- runId
- imageId / filePath / thumbPath
- reviewStatus
- checkpointName
- loraConfig摘要
- source flags：manual_excluded、low_sample、low_project_coverage、has_unreviewed

### P0-2：生成风险图谱

系统必须按 canonical section name 聚合输出：

- projectCoverage
- labeled / kept / trashed / other
- trashRate / keepRate
- 每个项目里的实际 sortOrder 映射
- flags

### P0-3：识别低参考性数据

系统必须标出：

- 样本数 `< 20` 的 section。
- 覆盖项目数 `< 5` 的 section。
- 有未审图混入的 section。
- Luca 手动标记的无参考性 section。

## 6. 程序化验收

验收命令建议：

```bash
npm run quality:baseline
npm run quality:verify -- --phase 0
```

验收 JSON 示例：

```json
{
  "phase": 0,
  "pass": true,
  "validProjects": 7,
  "labeledImages": 3668,
  "canonicalSections": 68,
  "manualExclusionsLoaded": ["单人 · 拎鞋", "第一人称 · 胸压"],
  "sortOrderVarianceVerified": true,
  "dbMutated": false,
  "reproducible": true
}
```

硬性通过条件：

- 只使用指定 7 个项目；其它项目默认排除。
- labeled 图数 `>= 1000`。
- 能证明参考姿势在不同项目中的 sortOrder 可不同，但 canonical name 合并正确。
- 生成报告重复运行核心统计误差为 0。
- DB 前后无写入差异。

## 7. 失败条件

- 使用了未确认项目的标签。
- 用 sortOrder 作为跨项目主键。
- manual exclusion 未生效。
- 报告不可复现。
- 有任何生产数据被修改。

## 8. 依赖

- SQLite DB 可读。
- `ImageResult` / `Run` / `ProjectSection` / `Project` 表结构稳定。
- reviewStatus 历史标签可信。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
