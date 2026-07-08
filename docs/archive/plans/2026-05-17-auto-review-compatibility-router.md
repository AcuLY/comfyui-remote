# ComfyUI Manager 自动审图与兼容路由方案

> **For Hermes:** 后续实现应按 `subagent-driven-development` 拆任务执行；本文先冻结目标、阶段和硬验收标准。

**Goal:** 让每个正式项目 section 自动获得约 4 张可用图，尽量自动删除坏图，自动尝试兼容参数，失败时可放弃，减少 Luca 人工审图和反复调参时间。

**Architecture:** 以历史 kept/trashed 数据校准 Auto Reviewer；在线阶段由 Review Pipeline 给图分层，Run Orchestrator 按“生成到 4 张好图”状态机补跑，Compatibility Router 为角色 LoRA × checkpoint × 风格 LoRA × 姿势 LoRA 选择参数。

**Primary metric:** 人工需要看的图片数量显著下降，同时自动删除必须可恢复、可追踪、可复盘。

---

## 全局硬约束

1. 所有自动 trash 必须通过现有 review API 写入，禁止直接改 `ImageResult.reviewStatus`。
2. 自动 trash 必须保存机器判断结果：版本、置信度、原因、section rubric、使用的模型/规则、时间。
3. 自动 trash 必须可恢复；UI/API 至少能按 run/section 批量查看和恢复。
4. 每个 section 默认目标保留图数为 4，可按项目或模板覆盖。
5. 多次失败可标记 abandoned，不要求无限生成。
6. checkpoint/LoRA 权重/风格权重选择应由系统屏蔽，Luca 不再需要为每个角色手动反复试。
7. 历史 kept/trashed 校准数据只使用 Luca 确认有参考价值的项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`。
8. 姿势/小节身份必须以 canonical section name / pose key 匹配，不能用 `sortOrder` 当跨项目身份；同一姿势在不同项目里可能有不同序号。

## Phase 0：历史数据基线与风险图谱

**目标:** 量化现有项目真实保留率、困难小节、角色/姿势/参数失败模式。

**产物:**
- 历史 labeled image dataset：project、section、canonicalSectionName/poseKey、run、file、reviewStatus、checkpoint、loraConfig、template/default batchSize。
- Section risk map：按 canonical section name / pose key / 姿势类别统计 keep/trash/未审数量，不按跨项目 `sortOrder` 聚合。
- Baseline report：列出最难 20 个 canonical section、每个有效参考项目保留率、bs4/bs8/bs16 的真实失败率。

**硬验收:**
- 只覆盖 7 个有效参考项目：`叶瞬光`、`大乔`、`安魂曲`、`洛茜`、`花火`、`西格莉卡`、`零`；其它项目默认排除，除非 Luca 重新确认可用。
- 至少收集 1000 张历史 kept/trashed 标签图；当前 DB 初查这 7 个项目约有 3668 张 labeled 图。
- `害羞笑` 模板中重点小节 11/23/29/41 只能作为“参考姿势名”来源，风险报告必须按其 section name 追踪：`第三人称 · 背后跪姿手交`、`第三人称 · 反向足交-正面`、`第三人称 · 翘腿素股`、`第三人称 · 站姿靠墙后入`。
- 程序化验证必须证明这些参考姿势在 7 个项目中的实际 `sortOrder` 可不同，但能被 canonical name 正确合并。
- 报告必须能复现：同一脚本重复运行，核心统计误差为 0。
- 不修改任何生产数据。

## Phase 1：Auto Reviewer 离线评测

**目标:** 在不影响生产状态的情况下，验证机器能否可靠识别应删图。

**Reviewer 输出:** `auto_trash | candidate | review`，并包含 `confidence`、`reasons[]`、`poseMatched`、`anatomyOk`、`detailOk`。

**审核维度:** 模糊/低细节、手指脚趾错误、肢体变形/融合、多肢体、脸/身体崩坏、目标姿势失败、视角错误、关键接触关系缺失。

**硬验收:**
- 使用历史标签做 train/calibration 与 holdout 切分；holdout 不能用于调阈值。
- 在 holdout 上，`auto_trash_precision >= 0.95`，即被系统判为 auto_trash 的图，至少 95% 是历史 trashed。
- 在 holdout 上，历史 kept 被判 auto_trash 的比例 `<= 0.05`。
- 人工待审量减少率 `>= 50%`：`auto_trash + candidate` 至少覆盖一半图，不全塞进 review。
- 对参考高风险姿势单独出指标：`第三人称 · 背后跪姿手交`、`第三人称 · 反向足交-正面`、`第三人称 · 翘腿素股`、`第三人称 · 站姿靠墙后入`；任一姿势 auto_trash precision 低于 0.90 时，该姿势不得上线自动删除，只能 shadow。
- 每个 auto_trash 必须有至少一个可读原因，不能只有分数。

## Phase 2：Section Rubric 与风险分类

**目标:** 不同姿势用不同审图规则，避免一套通用 prompt 误判。

**Section 分类:** hand、foot、pov、third_person、standing、lying、back_view、penetration/contact、solo、high_crop_risk。

**硬验收:**
- 当前生产模板（包括但不限于 `害羞笑`）所有 section 都能生成 rubric；历史验证阶段只用 7 个有效参考项目的同名 section 标签数据。
- bs16 section 必须至少命中一个高风险标签：hand、foot、contact、pov、back_view、penetration 之一。
- 每个 rubric 必须包含：硬性姿势要求、硬性删除条件、允许不确定条件。
- 对同名 section，rubric 生成结果稳定；重复运行 hash 一致。
- 人工抽查 20 个 canonical section / rubric，至少 18 个被认为“可用于审图”。

## Phase 3：在线自动分层与可恢复 auto-trash

**目标:** 新生成图片自动分层，Luca 默认只看 candidate 和少量 review。

**在线流程:** 新图完成后自动评估；高置信坏图调用 trash API；候选图排序；不确定图留在 review。

**硬验收:**
- 默认先支持 shadow mode：只写 evaluation，不改 reviewStatus。
- shadow mode 连续跑满 3 个正式项目或至少 500 张图后，指标仍满足 Phase 1 才允许开启 auto-trash。
- 开启 auto-trash 后，所有操作都有 audit log，可按 project/section/run/image 追溯。
- UI/API 可显示 auto_trash、candidate、review 三组数量和原因。
- 可批量恢复一个 section 或 run 的 auto-trash 图。
- 自动 trash 后人工默认待审图数量相对原始生成数下降 `>= 60%`。

## Phase 4：Generate Until 4 Good 状态机

**目标:** 每个 section 自动补跑，直到约 4 张候选图或达到放弃条件。

**状态:** pending → running → reviewing → enough_candidates | needs_retry → retrying → abandoned | done。

**默认策略:** targetCandidates=4；maxRounds=6；maxGeneratedPerSection=64；如果高风险 section 连续两轮 0 candidate，进入 Compatibility Router。

**硬验收:**
- 任一 section 达到 candidate ≥ 4 后不再自动补跑。
- 达到 maxRounds 或 maxGeneratedPerSection 后必须停止并标记 abandoned，不允许无限循环。
- 每个 retry 都记录使用的参数、原因、上一轮失败统计。
- 队列中断/服务重启后可从状态恢复，不重复无限提交同一轮。
- 在一个测试项目上，至少 80% section 能自动结束为 done 或 abandoned，无需人工改参数。

## Phase 5：Compatibility Router 参数回退树

**目标:** 自动屏蔽 checkpoint 和 LoRA 权重选择。

**回退顺序:** 默认配置 → 降角色 LoRA → 降风格 LoRA → stage1 高姿势低角色/stage2 高角色低姿势 → 换 checkpoint → 降姿势 LoRA → 保守 workflow → abandoned。

**硬验收:**
- 每次参数选择必须可解释：为什么进入下一层、上一层失败原因是什么。
- 对 bs16 section，至少尝试 2 种兼容配置后才能 abandoned，除非出现系统错误或用户取消。
- 对同一角色 LoRA，系统产出 compatibility profile：推荐 checkpoint、角色权重、姿势权重、风格策略、失败姿势组。
- 在 3 个历史困难角色/项目回放中，人工手动调 checkpoint/权重次数降为 0。
- 与固定模板 baseline 相比，高风险 section candidate 产出率提升 `>= 30%`，或人工待审量下降 `>= 50%`。

## Phase 6：LoRA 候选兼容性 Benchmark

**目标:** LoRA 测试从“像不像”升级为“是否适配当前项目模板”。

**输出:** 每个候选 LoRA 的 overallCompatibility、easy/hand/foot/contact section 分数、推荐参数、失败原因、是否建议转正。

**硬验收:**
- 每个角色至少测试所有可找到的合理候选；没有第二个候选时必须记录搜索证据。
- 每个候选至少覆盖：低风险 2 节、hand 2 节、foot 2 节、contact/penetration 2 节。
- 转正 LoRA 必须有 compatibility report，且报告保存到项目或 preset metadata。
- 如果 hard-section candidate rate < 25%，默认不建议转正，除非 Luca 明确覆盖。
- 测试完成后能自动推荐：保留/淘汰/仅适合低风险姿势/需要训练兜底。

## Phase 7：冷门角色官方图训练兜底

**目标:** Civitai 没有合适 LoRA 时，用官方图启动训练流程，但最终仍以兼容 benchmark 通过为准。

**流程:** 收集官方图 → 裁切/去重/打标 → 必要时 reference 扩充训练集 → 训练多个版本 → 跑 Phase 6 benchmark → 通过才导入。

**硬验收:**
- 至少保存原始图来源、裁切图、训练 captions、训练参数、模型文件 hash。
- 少于 3 张官方图时必须标记为高过拟合风险。
- 训练 LoRA 必须跑同一套兼容 benchmark，不能因为是自训就跳过。
- 只有 benchmark 达到转正阈值才创建正式角色 preset。
- 未通过版本必须保留报告，不自动进入正式项目。

## 首批建议实施范围

1. 先做 Phase 0–1：不改生产，验证 auto reviewer 是否可靠。
2. 通过后做 Phase 2–3：自动分层和可恢复 auto-trash。
3. 再做 Phase 4–5：生成到 4 张好图和自动调参。
4. 最后做 Phase 6–7：LoRA 兼容评测和冷门角色训练兜底。

## 第一阶段 Go / No-Go 标准

只有同时满足以下条件，才进入在线 auto-trash：
- holdout auto_trash_precision ≥ 0.95；
- 历史 kept 被 auto_trash ≤ 0.05；
- 人工待审量减少 ≥ 50%；
- 参考高风险姿势（按 canonical section name，不按固定序号）没有明显低于 0.90 的 auto_trash precision；
- 每张 auto_trash 图都有可读原因；
- 所有操作可恢复、可审计。
