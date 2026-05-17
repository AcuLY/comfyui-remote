# 自动审图与兼容路由 PRD 总览

本目录按阶段保存 PRD。上层技术方案见：
`docs/plans/2026-05-17-auto-review-compatibility-router.md`

## 阶段列表

1. [Phase 0：历史数据基线与风险图谱](./phase-0-historical-baseline-prd.md)
2. [Phase 1：Auto Reviewer 离线评测](./phase-1-auto-reviewer-offline-eval-prd.md)
3. [Phase 2：Section Rubric 与风险分类](./phase-2-section-rubric-prd.md)
4. [Phase 3：在线自动分层与可恢复 Auto-trash](./phase-3-online-shadow-autotrash-prd.md)
5. [Phase 4：Generate Until 4 Good 状态机](./phase-4-generate-until-4-good-prd.md)
6. [Phase 5：Compatibility Router 参数回退树](./phase-5-compatibility-router-prd.md)
7. [Phase 6：LoRA 候选兼容性 Benchmark](./phase-6-lora-compatibility-benchmark-prd.md)
8. [Phase 7：冷门角色官方图训练兜底](./phase-7-cold-character-training-prd.md)

## 第一批默认决策

- 每节目标候选图：`targetCandidates = 4`。
- 生成补跑默认上限：`maxRounds = 6`，`maxGeneratedPerSection = 64`。
- Phase 1/2 只 shadow；Phase 3 才允许在指标达标后开启真 auto-trash。
- candidate 初期不自动 keep，只排序给 Luca；auto-trash 可自动执行，但必须可恢复。
- holdout 验证优先采用 leave-one-project-out，辅以 imageId hash split。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
