# Phase 5 PRD：Compatibility Router 参数回退树

## 1. 目的

自动为角色 LoRA × checkpoint × 风格 LoRA × 姿势 LoRA 选择兼容参数，减少 Luca 手动反复试 checkpoint 和权重。

## 2. 用户问题

低质量 LoRA 的问题常常不是角色不像，而是与当前模板不兼容：模糊、缺细节、姿势 LoRA 失效、手脚结构崩。Luca 当前需要人工反复调 checkpoint/LoRA 权重。Phase 5 要把这个过程自动化并可解释。

## 3. 范围

### In scope

- 定义参数回退树。
- 对高风险 section 失败后自动尝试兼容配置。
- 产出 per-character/preset compatibility profile。
- 记录每次参数变更原因。

### Out of scope

- 不训练新 LoRA。
- 不做全量暴力网格搜索。
- 不绕过 Auto Reviewer。

## 4. 回退树

默认顺序：

1. 默认配置。
2. 降低角色 LoRA 权重。
3. 降低风格 LoRA 权重。
4. stage1 高姿势低角色 / stage2 高角色低姿势。
5. 换 checkpoint。
6. 降低姿势 LoRA 权重。
7. 保守 workflow。
8. abandoned。

每一步都必须记录：

- 当前配置
- 前一步失败统计
- 选择该配置的原因
- 本轮结果

## 5. Compatibility Profile

每个角色 LoRA / preset 最终应保存：

```json
{
  "presetId": "...",
  "loraPath": "character/xxx.safetensors",
  "recommendedCheckpoint": "oneObsession_v19Atypical.safetensors",
  "characterWeightStage1": 0.7,
  "characterWeightStage2": 1.0,
  "poseWeightStage1": 1.0,
  "poseWeightStage2": 0.5,
  "stylePolicy": "reduced",
  "badPoseGroups": ["foot", "hand"],
  "evidence": ["...run ids..."]
}
```

## 6. 程序化验收

建议命令：

```bash
npm run quality:test-router -- --project <testProjectId>
npm run quality:verify -- --phase 5
```

硬性通过条件：

- 对 bs16 / high-risk section，abandoned 前至少尝试 2 种兼容配置，除非用户取消或系统错误。
- 每次参数选择都有解释和上一轮失败统计。
- 每个测试角色 LoRA 产出 compatibility profile。
- 在 3 个历史困难角色/项目回放中，人工手动调 checkpoint/权重次数为 0。
- 与固定模板 baseline 相比，高风险 section candidate 产出率提升 `>= 30%`，或人工待审量下降 `>= 50%`。

## 7. UI/API 需求

- Section/run 详情显示当前 router config。
- 展示“为什么切换参数”。
- 展示 compatibility profile。
- 支持 Luca 手动 override，但必须标记为 manual override，不混入自动指标。

## 8. 失败条件

- 参数切换不可解释。
- 配置无限枚举导致无法收口。
- router 成功率计算把 manual override 混入自动指标。
- 换 checkpoint 后 workflow 实际仍使用旧 checkpoint。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
