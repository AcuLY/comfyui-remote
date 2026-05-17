# Phase 6 PRD：LoRA 候选兼容性 Benchmark

## 1. 目的

将 LoRA 测试从“角色像不像”升级为“是否适配 Luca 当前项目模板”，提前淘汰和 checkpoint/风格/姿势 LoRA 不兼容的候选。

## 2. 用户问题

Civitai 上即使有角色 LoRA，也可能与当前 checkpoint + 风格 LoRA + 姿势 LoRA 组合不兼容，表现为模糊、细节缺失、手足姿势失败。Phase 6 要在转正前用标准 benchmark 量化兼容性。

## 3. 范围

### In scope

- 对每个候选 LoRA 跑固定测试 section 集。
- 输出 easy / hand / foot / contact 分项分数。
- 保存 benchmark report。
- 给出推荐：保留、淘汰、仅适合低风险姿势、需要训练兜底。

### Out of scope

- 不负责 Civitai 搜索策略本身，但要求保存搜索证据。
- 不创建最终 preset，除非 benchmark 通过并进入后续流程。
- 不训练新 LoRA。

## 4. Benchmark 覆盖要求

每个候选至少覆盖：

- 低风险 section：2 个。
- hand section：2 个。
- foot section：2 个。
- contact / penetration section：2 个。

优先包含历史高风险但有参考价值的 canonical section：

- `第三人称 · 背后跪姿手交`
- `第三人称 · 翘腿素股`
- `第三人称 · 反向足交-正面`
- `第一人称 · 反向足交-背面`
- `第一人称 · 骑乘手交`

## 5. Report 数据结构

```json
{
  "character": "...",
  "loraPath": "character/xxx.safetensors",
  "candidateSource": "civitai",
  "overallCompatibility": 0.72,
  "easySectionRate": 0.9,
  "handSectionRate": 0.48,
  "footSectionRate": 0.35,
  "contactSectionRate": 0.31,
  "hardSectionCandidateRate": 0.38,
  "recommendedConfig": { "checkpoint": "..." },
  "recommendation": "keep_with_router",
  "reasons": ["identity OK", "foot sections unstable"],
  "runIds": ["..."]
}
```

## 6. 程序化验收

建议命令：

```bash
npm run quality:lora-benchmark -- --manifest <candidateManifest>
npm run quality:verify -- --phase 6 --report <reportPath>
```

硬性通过条件：

- 每个候选覆盖要求满足。
- 每个候选保存 report。
- 没有第二个候选时，必须保存搜索证据和排除原因。
- 转正 LoRA 必须有 compatibility report，且 report 路径写入 preset metadata 或项目记录。
- `hardSectionCandidateRate < 0.25` 时默认不建议转正，除非 Luca manual override。

## 7. 失败条件

- 只测简单姿势就推荐转正。
- 未保存候选搜索证据。
- benchmark 结果无法复查对应 run/image。
- manual override 未记录。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
