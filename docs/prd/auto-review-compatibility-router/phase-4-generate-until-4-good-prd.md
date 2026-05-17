# Phase 4 PRD：Generate Until 4 Good 状态机

## 1. 目的

将 section 运行目标从“固定生成一批图”改为“自动生成到约 4 张可用候选图”，并在不可行时自动收口为 abandoned。

## 2. 用户问题

Luca 不缺系统运行时间，缺少人工介入时间。固定 batch 的问题是：低质量图多时 Luca 仍要审很多废图；好图不足时还要手动补跑。Phase 4 要让系统自动补跑和停止。

## 3. 范围

### In scope

- 为每个 section 维护 generation state。
- 根据 candidate 数量自动决定停止、补跑、进入 router、abandon。
- 记录每轮运行参数和失败原因。
- 服务重启后可恢复。

### Out of scope

- 不定义新的 reviewer 指标。
- 不实现复杂参数搜索，Phase 4 只调用 Phase 5 router。
- 不自动发布或导出。

## 4. 默认策略

```json
{
  "targetCandidates": 4,
  "maxRounds": 6,
  "maxGeneratedPerSection": 64,
  "enterRouterAfterConsecutiveZeroCandidateRounds": 2
}
```

## 5. 状态机

```text
pending
→ running
→ reviewing
→ enough_candidates → done
→ needs_retry → retrying → running
→ needs_router → routed_retry → running
→ abandoned
```

状态字段至少包含：

- projectId
- sectionId
- targetCandidates
- currentCandidateCount
- currentReviewCount
- currentAutoTrashCount
- roundsUsed
- generatedCount
- lastRunIds
- lastFailureSummary
- currentConfigId
- terminalState: done / abandoned / cancelled

## 6. 程序化验收

建议命令：

```bash
npm run quality:test-orchestrator
npm run quality:verify -- --phase 4 --project <testProjectId>
```

硬性通过条件：

- candidate >= 4 后不再自动提交新 run。
- maxRounds 或 maxGeneratedPerSection 达到后，必须 abandoned。
- 每个 retry 都记录：参数、原因、上一轮 candidate/review/auto-trash 统计。
- 队列中断或服务重启后可恢复，不重复提交同一轮。
- 一个测试项目中，至少 80% section 自动终结为 done 或 abandoned，无需人工改参数。

## 7. UI/API 需求

- Section 显示：目标 4 / 当前 candidate N。
- 显示 roundsUsed / maxRounds。
- 显示 abandoned 原因。
- 支持手动继续补跑 abandoned section，但必须记录为 manual override。

## 8. 失败条件

- 同一状态重复提交 run。
- 达到 4 张候选后仍继续补跑。
- 失败后既不 retry 也不 abandoned，卡在中间状态。
- 无法解释补跑原因。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
