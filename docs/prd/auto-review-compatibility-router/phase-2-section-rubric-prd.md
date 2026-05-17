# Phase 2 PRD：Section Rubric 与风险分类

## 1. 目的

为每个 canonical section 生成稳定、结构化、可复用的审图规则，让自动审图器针对不同姿势检查不同硬性条件。

## 2. 用户问题

手部、足部、第一人称、背面、接触类小节失败原因不同。一套通用审图 prompt 会导致误判：某些图姿势错但画面好看，某些图姿势对但局部手脚崩坏。Phase 2 要让审图规则进入 section 粒度。

## 3. 范围

### In scope

- 为当前生产模板的每个 section 生成 rubric。
- 为历史参考项目中的同名 section 绑定同一 rubric。
- 生成 riskTags、hardRequirements、trashConditions、uncertainConditions。
- 支持人工抽查并记录 rubric approval。

### Out of scope

- 不直接执行图片评估。
- 不自动修改 prompt 或模板。
- 不替代 Phase 1 的 reviewer 指标验收。

## 4. Rubric 数据结构

```json
{
  "canonicalSectionName": "第三人称 · 反向足交-正面",
  "poseKey": "third_person_reverse_footjob_front",
  "riskTags": ["foot", "contact", "third_person"],
  "hardRequirements": ["目标足部动作必须成立", "主体视角必须符合第三人称"],
  "trashConditions": ["目标姿势未生成", "脚部数量/结构明显错误", "关键接触关系缺失"],
  "uncertainConditions": ["局部遮挡导致无法判断脚趾"],
  "reviewPrompt": "...",
  "version": "..."
}
```

## 5. Risk tag 规则

必须支持首批标签：

- `hand`
- `foot`
- `pov`
- `third_person`
- `standing`
- `lying`
- `back_view`
- `contact`
- `penetration`
- `solo`
- `high_crop_risk`

## 6. 程序化验收

建议命令：

```bash
npm run quality:generate-rubrics
npm run quality:verify -- --phase 2
```

硬性通过条件：

- 当前生产模板所有 section 都有 rubric。
- 同名 canonical section 重复生成 hash 一致。
- 每个 rubric 必须包含：riskTags、hardRequirements、trashConditions、uncertainConditions、reviewPrompt、version。
- bs16 section 必须命中至少一个高风险标签：hand、foot、contact、pov、back_view、penetration。
- manual_excluded section 可以生成 rubric，但默认不参与 Phase 1 主指标。
- 人工抽查 20 个 canonical section，至少 18 个标记为 approved。

## 7. 人工抽查流程

抽查 UI/文件应展示：

- section name
- riskTags
- hard requirements
- trash conditions
- uncertain conditions
- 审图 prompt
- approve / reject / edit notes

人工结果必须保存，供 verifier 读取。

## 8. 失败条件

- 同名 section 每次生成不同 rubric。
- bs16 高风险小节未打高风险标签。
- rubric 只有自然语言描述，没有结构化字段。
- 人工抽查通过率低于 90%。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
