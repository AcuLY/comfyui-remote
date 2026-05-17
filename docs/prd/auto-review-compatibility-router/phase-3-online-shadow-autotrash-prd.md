# Phase 3 PRD：在线自动分层与可恢复 Auto-trash

## 1. 目的

将离线验证达标的 Auto Reviewer 接入在线生成流程，让新图自动分为 `auto_trash`、`candidate`、`review`，并在达标后允许高置信坏图自动 trash。

## 2. 用户问题

Luca 不希望看大量明显坏图，也不希望被系统不可逆误删。Phase 3 要在减少人工待审图和可恢复之间取得平衡。

## 3. 范围

### In scope

- 新图完成后自动 evaluation。
- Shadow mode：只写 evaluation，不改 reviewStatus。
- Auto-trash mode：满足条件时通过 review API 自动 trash。
- UI/API 展示三组：auto_trash / candidate / review。
- 支持按 section/run 批量恢复 auto-trash。

### Out of scope

- 不自动 keep candidate。
- 不自动补跑。
- 不做参数路由。

## 4. 用户流程

### Shadow mode

1. 项目正常生成。
2. 每张新图生成 evaluation。
3. UI 显示预测分组，但 reviewStatus 不变。
4. verifier 统计 shadow 指标。

### Auto-trash mode

1. evaluation 判定 `auto_trash` 且满足阈值。
2. 系统调用现有 review trash API。
3. 写入 audit log。
4. UI 默认隐藏 auto-trash，但可展开查看。
5. Luca 可批量恢复。

## 5. Evaluation / Audit 数据

每次 evaluation 必须保存：

- imageId / runId / sectionId / projectId
- prediction
- confidence
- reasons
- reviewerVersion
- rubricVersion
- mode: shadow / auto_trash
- actionTaken
- createdAt

每次 auto-trash audit 必须保存：

- imageId
- previousReviewStatus
- newReviewStatus
- API request id / actor
- restore eligibility

## 6. 程序化验收

建议命令：

```bash
npm run quality:verify -- --phase 3 --mode shadow
npm run quality:verify -- --phase 3 --mode auto-trash
```

Shadow mode 通过条件：

- 覆盖至少 3 个正式项目或 500 张新图。
- reviewStatus 无变化。
- Phase 1 指标仍达标。
- 所有 evaluation 都有 reasons/version/rubric。

Auto-trash mode 通过条件：

- 所有 auto-trash 都通过 review API。
- audit log coverage = 100%。
- restore test passed：随机选择一个 run/section，可批量恢复并验证状态。
- 人工默认待审图数量相对原始生成图下降 `>= 60%`。

## 7. UI/API 需求

- Section 图片区显示：candidate count / review count / auto-trash count。
- auto-trash 默认折叠，可展开查看原因。
- 每张图展示主要 reason。
- 支持“恢复本 section auto-trash 图”。
- 支持“只看 candidate”。

## 8. 失败条件

- 任何自动 trash 无 audit log。
- restore 不可用。
- reviewStatus 被 shadow mode 修改。
- UI 只隐藏图片但无法解释原因。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
