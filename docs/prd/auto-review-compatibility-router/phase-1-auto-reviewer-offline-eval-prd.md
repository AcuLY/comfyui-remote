# Phase 1 PRD：Auto Reviewer 离线评测

## 1. 目的

在不影响生产数据的前提下，验证自动审图器是否能可靠识别 Luca 会删除的图，并量化上线 auto-trash 的风险。

## 2. 用户问题

Luca 缺的是审图时间，不缺生成时间。系统必须尽量自动处理废图，但只有在置信度可证明足够高时才允许自动 trash。Phase 1 的核心是验证“自动删图是否值得信任”。

## 3. 范围

### In scope

- 对 Phase 0 的历史 labeled dataset 做离线推理。
- 对每张图输出 `auto_trash | candidate | review`。
- 计算 holdout 指标：auto_trash precision、kept auto-trash rate、人工待审量减少率。
- 按高风险 canonical section 单独出指标。

### Out of scope

- 不写回 reviewStatus。
- 不在 UI 中展示在线结果。
- 不自动补跑。
- 不做 checkpoint/LoRA 参数调优。

## 4. Reviewer 输出规范

每张图的离线评估输出必须是结构化 JSON：

```json
{
  "imageId": "...",
  "prediction": "auto_trash",
  "confidence": 0.94,
  "reasons": ["bad_hand", "pose_failed"],
  "poseMatched": false,
  "anatomyOk": false,
  "detailOk": true,
  "rubricVersion": "...",
  "reviewerVersion": "..."
}
```

## 5. 数据切分

必须支持两种 holdout：

1. **Leave-one-project-out**：轮流将 7 个参考项目中的 1 个作为 holdout。
2. **Image hash split**：用 imageId hash 做稳定切分，作为辅助验证。

任何阈值只能在 calibration set 上调整，不能用 holdout 调参。

## 6. 指标定义

```text
auto_trash_precision = historical_trashed_and_predicted_auto_trash / predicted_auto_trash
kept_auto_trash_rate = historical_kept_and_predicted_auto_trash / historical_kept
review_reduction = 1 - predicted_review / total_images
```

## 7. 程序化验收

建议命令：

```bash
npm run quality:evaluate -- --phase 1 --split leave-one-project-out
npm run quality:verify -- --phase 1
```

硬性通过条件：

- holdout `auto_trash_precision >= 0.95`。
- holdout `kept_auto_trash_rate <= 0.05`。
- `review_reduction >= 0.50`。
- 每个 `auto_trash` 都必须有至少一个 readable reason。
- 参考高风险姿势单独 precision 不低于 0.90，否则该姿势只能 shadow，不能 auto-trash。
- manual_excluded section 不参与主指标，只能在附录中展示。

## 8. 参考高风险姿势

首批必须单独出指标：

- `第三人称 · 背后跪姿手交`
- `第三人称 · 翘腿素股`
- `第三人称 · 反向足交-正面`
- `第一人称 · 反向足交-背面`
- `第一人称 · 骑乘手交`

## 9. 失败条件

- 指标达标但没有原因解释。
- 指标只在随机 split 达标，leave-one-project-out 明显失败。
- 大量历史 kept 被判为 auto_trash。
- 把 manual_excluded section 混入主指标。

## 10. Go / No-Go

只有 Phase 1 达标，Phase 3 才允许开启真 auto-trash；否则 Phase 3 只能做 shadow mode。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
