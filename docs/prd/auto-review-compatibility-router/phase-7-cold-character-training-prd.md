# Phase 7 PRD：冷门角色官方图训练兜底

## 1. 目的

当 Civitai 没有合适 LoRA 或候选兼容性不达标时，使用官方图启动训练流程，产出必须通过同一套兼容性 benchmark 后才能进入正式系统。

## 2. 用户问题

冷门角色可能没有合适 LoRA。单纯“一张图训练 LoRA”可能过拟合，且不一定适配当前项目模板。Phase 7 的目标不是训练最像原案的 LoRA，而是训练能与 Luca checkpoint/风格/姿势模板共存的 LoRA。

## 3. 范围

### In scope

- 收集官方图 / 设定图 / 立绘来源。
- 裁切、去重、caption。
- 必要时用 reference 方式扩充训练集。
- 训练多个候选 LoRA 版本。
- 跑 Phase 6 compatibility benchmark。
- 通过后创建正式角色 preset。

### Out of scope

- 不承诺单张图一定训练成功。
- 不允许未 benchmark 的训练 LoRA 直接进入正式项目。
- 不自动使用来源不明或版权风险高的图片作为训练来源，除非 Luca 明确允许。

## 4. 输入要求

每个训练任务必须保存：

- source image URL / 本地文件路径。
- source type：official art / character sheet / screenshot / fan art / unknown。
- crop 文件。
- caption 文件。
- 去重结果。
- 训练配置。
- 输出 LoRA 文件 hash。

少于 3 张官方/可靠图时，必须标记 `overfitRisk = high`。

## 5. 训练版本策略

可训练多个版本：

- identity strong：角色特征强，但可能不稳定。
- compatibility balanced：降低过拟合，优先模板兼容。
- outfit/detail：强化服装/头饰细节。

每个版本都必须跑 Phase 6 benchmark。

## 6. 程序化验收

建议命令：

```bash
npm run quality:training-audit -- --trainingRun <id>
npm run quality:verify -- --phase 7 --trainingRun <id>
```

硬性通过条件：

- source images、crops、captions、training config、model hash 全部存在。
- 少于 3 张可靠图时有 high overfit risk 标记。
- 每个输出 LoRA 都有 Phase 6 benchmark report。
- 未通过 benchmark 的版本不得创建正式 preset。
- 通过版本创建正式 preset 时，preset metadata 必须包含训练来源和 benchmark report。

## 7. UI/API 需求

- 显示训练素材清单和风险提示。
- 显示训练版本列表和 benchmark 结果。
- 只允许通过版本进入“创建正式 preset”流程。
- 支持 Luca 手动 override，但必须强提示风险并记录。

## 8. 失败条件

- 无来源记录。
- 无 captions 或训练参数。
- LoRA 文件无 hash。
- 未跑 benchmark 就进入正式库。
- 单图高风险训练未标记。

## 全局背景与约束

- 目标不是让模型审美，而是减少 Luca 对废图的人工判断：每个正式 section 默认获得约 4 张可用候选图。
- 历史校准只使用 Luca 确认有参考价值的 7 个项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
- 当前已知无参考性 canonical section：`单人 · 拎鞋`、`第一人称 · 胸压`；后续可继续追加 manual exclusion。
- 跨项目聚合必须用 canonical section name / pose key，不能用 `sortOrder`。同一姿势在不同项目中的序号可能不同。
- 自动 trash 必须可追溯、可恢复；禁止直接写 DB 改 review 状态，必须通过 review API。
- 训练/验收只使用 `kept` / `trashed` 标签；未审图只统计，不参与指标。
