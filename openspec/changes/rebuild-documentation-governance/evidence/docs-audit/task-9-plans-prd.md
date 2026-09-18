# 任务 9：归档实施计划与产品需求独立审计记录

## 调用

- 显式调用方：已批准的 `rebuild-documentation-governance` 任务 `9.2`，由独立审计者 `/root/audit_archive_prototypes` 执行。
- 范围：`$docs-audit paths docs/archive/plans docs/archive/prd`。
- 操作：`record openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-plans-prd.md`。
- 比较基线：分支 `codex/harness-doc-governance-handoff-20260710`，提交 `8a13a7c464e28d5f10298f5225165be9b1dbdf46`。
- 冻结输入：`docs/archive/plans` 8 个文件，清单摘要 `8a2c70b9da9fa745384be78a1020cae5efc51ef6174fdd38f40c7c1818aff508`；`docs/archive/prd` 9 个文件，清单摘要 `5822d561e3ed4ba79b7eb5d763dcc444a5538c48cb60786213f0632b8b7a2d26`。
- 范围明确；确定性门禁按完整模式执行。

## 写入边界

- 唯一允许写入：本文件。
- 写入前完整工作树基线：83 个已修改、14 个已删除、65 个未跟踪条目，共 162 条；规范化状态摘要 `cdc72f7d6ce9147f0b6ece0c9c0d614c86f2aeb8a84c99cf0463e50a7e5f70b9`。
- 未修改计划、产品需求、生产源码、现行 owner 文档、个人脚本或其他 evidence。

## 确定性检查

- 命令：`npm run docs:check`。
- 退出分类：`exit 1`，9702 个错误、3 个警告；不是检查器/配置故障。
- 与本组相关的失败包括 archive 路径的 live 文档引用、inventory 旧分类、英文历史正文和未完成的权威切换。
- 该结果允许继续区分当前实现、已批准目标和历史意图，但禁止报告本范围通过。

## 已审查证据

### 当前实现

- 质量流水线：`src/server/quality/**`、`scripts/quality/**`、`tests/fixtures/quality/**`、`reports/quality/**` 与 `docs/testing/quality-analysis.md`。
- 质量聚焦验证：`node --import tsx --test tests/test-quality-phase0-baseline.test.ts tests/test-quality-phase1-offline-eval.test.ts tests/test-quality-phase1-reviewer.test.ts tests/test-quality-script-governance.test.ts`，47/47 通过。
- `Training`：`src/features/training/**`、`src/app/api/training/**`、`src/server/repositories/training/**`、`src/server/services/training/**`、`src/server/worker/training/**`、`prisma/schema*.prisma`。
- `Training` 与产品 owner 验证：原型/工作模式/API/产品文档组合 84/84 通过。
- 当前 API、测试和执行 owner 验证：77/77 通过。
- 当前 owner 文档：`PRODUCT.md`、`ARCHITECTURE.md`、`docs/product/training/README.md`、`docs/architecture/domains/training/README.md`、`docs/architecture/system/execution/queue-worker.md`、`docs/testing/quality-analysis.md`。

### 已批准目标

- 任务 `9.2`、`9.5`、`9.6`、`9.7`。
- 活跃变更只批准文档治理与删除核对；它没有把旧质量 `Phase 2` 至 `Phase 7` 或旧 `Training` 设计重新批准为产品目标。

### 历史意图

- 本范围 17 个冻结文件及删除前基线。
- 旧计划中的验收阈值、未来状态机、参数路由、兼容性 benchmark、训练兜底、schema 草案和前端路由逐项确认均按历史意图分类。

### 运行时证据

- 无需运行生产服务。当前源码、schema、生成产物和聚焦测试足以区分已实现子集与未实现目标。

## 文件核对

| 冻结文件 | 处置 | 发现 |
| --- | --- | --- |
| `docs/archive/plans/2026-05-17-auto-review-compatibility-router.md` | 删除；未来范围重新走 `OpenSpec` | `PLAN-001` |
| `docs/archive/plans/2026-05-17-phase0-baseline-implementation.md` | 删除；当前事实已归质量 owner | `PLAN-002` |
| `docs/archive/plans/2026-05-17-phase1-offline-eval-implementation.md` | 删除；当前事实已归质量 owner | `PLAN-002` |
| `docs/archive/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md` | 删除；以当前 schema/source 为准 | `PLAN-003` |
| `docs/archive/plans/2026-06-07-manager-lora-training-docs-index.md` | 删除；旧权威路由失效 | `PLAN-004` |
| `docs/archive/plans/2026-06-07-manager-lora-training-final-technical-design.local-before-queue-pagination-rebase.md` | 删除；不得保留并行权威 | `PLAN-003` |
| `docs/archive/plans/2026-06-07-manager-lora-training-final-technical-design.md` | 删除；当前事实已由生产 owner 重建 | `PLAN-003` |
| `docs/archive/plans/2026-06-08-manager-lora-training-frontend-alignment.md` | 删除；生产路由与原型意图均已重新归属 | `PLAN-004` |
| `docs/archive/prd/auto-review-compatibility-router/README.md` | 删除 | `PRD-001` |
| `docs/archive/prd/auto-review-compatibility-router/phase-0-historical-baseline-prd.md` | 删除；当前事实已归质量 owner | `PRD-001` |
| `docs/archive/prd/auto-review-compatibility-router/phase-1-auto-reviewer-offline-eval-prd.md` | 删除；当前事实已归质量 owner | `PRD-001` |
| `docs/archive/prd/auto-review-compatibility-router/phase-2-section-rubric-prd.md` | 删除；未来重新提案 | `PRD-002` |
| `docs/archive/prd/auto-review-compatibility-router/phase-3-online-shadow-autotrash-prd.md` | 删除；未来重新提案 | `PRD-002` |
| `docs/archive/prd/auto-review-compatibility-router/phase-4-generate-until-4-good-prd.md` | 删除；未来重新提案 | `PRD-002` |
| `docs/archive/prd/auto-review-compatibility-router/phase-5-compatibility-router-prd.md` | 删除；未来重新提案 | `PRD-002` |
| `docs/archive/prd/auto-review-compatibility-router/phase-6-lora-compatibility-benchmark-prd.md` | 删除；未来重新提案 | `PRD-002` |
| `docs/archive/prd/auto-review-compatibility-router/phase-7-cold-character-training-prd.md` | 删除；未来重新提案 | `PRD-002` |

## 审计发现

### `PLAN-001`

- `id`：`PLAN-001`
- `path`：`docs/archive/plans/2026-05-17-auto-review-compatibility-router.md`
- `location`：`Phase 0` 至 `Phase 7`、首批建议实施范围与通过/不通过标准
- `claim`：完整自动审图、自动丢弃、自动补跑、兼容性路由、benchmark 与冷门角色训练链路是当前实现或当前已批准目标。
- `claimCategory`：`history`
- `owner`：`quality-pipeline`
- `evidence`：
  - `current`：`docs/testing/quality-analysis.md` 只声明当前 `Phase 0/1` 评估工具，并明确更晚阶段不是当前承诺。
  - `current`：47/47 质量测试证明当前基线与离线评估边界。
  - `target`：当前活跃文档治理变更没有批准旧 `Phase 2` 至 `Phase 7`。
- `conflict`：旧总计划把未实施产品行为和已实现评估工具放在同一连续路线图中。
- `confidence`：`high`；当前代码入口、测试与活跃变更范围均可核对。
- `action`：`delete`
- `resolution`：`deferred-to-openspec`
- `verification`：删除后确认当前质量文档仍只描述已实现 `Phase 0/1`；任何后续阶段必须新建并批准 `OpenSpec` 变更。

### `PLAN-002`

- `id`：`PLAN-002`
- `path`：`docs/archive/plans/2026-05-17-phase0-baseline-implementation.md`
- `location`：默认约束、任务 1 至任务 4；同时覆盖相邻 `phase1-offline-eval-implementation.md`
- `claim`：旧实施步骤、旧输出路径和“未来审查者”说明仍是当前质量流水线操作权威。
- `claimCategory`：`history`
- `owner`：`quality-pipeline`
- `evidence`：
  - `current`：`docs/testing/quality-analysis.md` 精确区分 fixture、报告、重生成和可移植性。
  - `current`：`src/server/quality/**` 与 `scripts/quality/**` 是算法和命令所有者。
  - `current`：47/47 质量测试通过。
- `conflict`：旧计划把输出放在 `docs/plans/auto-review-analysis/**`，当前 owner 已迁到 `tests/fixtures/quality/**` 与 `reports/quality/**`。
- `confidence`：`high`；路径和行为迁移均有源码/测试支持。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行 47 项质量测试以及 `npm run quality:verify -- --phase 0`。

### `PLAN-003`

- `id`：`PLAN-003`
- `path`：`docs/archive/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md`
- `location`：后端边界、schema 草案、API 表面、核心流程与两个“最终技术设计”版本
- `claim`：旧 schema/API 草案和“冻结时复制版本专属 artifact”等设计决策与当前实现完全一致。
- `claimCategory`：`history`
- `owner`：`training`
- `evidence`：
  - `current`：`prisma/schema*.prisma`、当前 `Training` services/repositories/API 是现行实现。
  - `current`：`docs/architecture/domains/training/README.md` 明确主冻结端点复用 `snapshotArtifactId`，不会复制图片字节，并记录当前工作进程/租约限制。
  - `current`：84/84 `Training`、工作模式和产品 owner 测试通过。
- `conflict`：旧设计把拟议 schema、复制语义、调度器保证和未完成检查点混写为“定稿”；部分关键语义已与当前实现不同。
- `confidence`：`high`；冲突由当前 schema、源码和文档直接证明。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后运行 `Training` API、worker、schema 与产品/架构 owner 聚焦测试；不得把旧草案字段重新引入当前文档。

### `PLAN-004`

- `id`：`PLAN-004`
- `path`：`docs/archive/plans/2026-06-07-manager-lora-training-docs-index.md`
- `location`：当前有效文档、实施约束、开发前待落地；同时覆盖前端对齐文档
- `claim`：归档计划仍可充当 `Training` 当前文档入口、路由权威或原型意图责任方。
- `claimCategory`：`history`
- `owner`：`product-training`
- `evidence`：
  - `current`：`PRODUCT.md` 与 `docs/product/training/README.md` 声明 `Training` 是平级工作模式。
  - `current`：`src/features/training/routes.ts` 与 `src/features/training/app.tsx` 拥有生产路由和分派。
  - `current`：84/84 聚焦测试证明生产路由、API、资源隔离和 owner。
- `conflict`：旧索引称自身为“当前文档入口”，前端对齐文档又把静态原型当作持续意图；两者均与目标治理树冲突。
- `confidence`：`high`；当前 owner 和旧自称权威均明确。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：删除后确认文档路由只指向 `docs/product/training/README.md` 与 `docs/architecture/domains/training/README.md`，并运行生产路由清单测试。

### `PLAN-005`

- `id`：`PLAN-005`
- `path`：`docs/archive/plans/2026-05-17-auto-review-compatibility-router.md`
- `location`：组级删除门禁
- `claim`：两个计划目录现在没有 live consumer，可以直接删除。
- `claimCategory`：`current`
- `owner`：`documentation-governance`
- `evidence`：
  - `current`：`docs/documentation-map.md`、`docs/index.md`、`docs/repo-inventory.md` 与 inventory 生成器仍引用或分类本组。
  - `target`：任务 `9.6`/`9.7` 要求清除 live reference 并重生成 inventory。
- `conflict`：完整文档门禁仍为 `exit 1`。
- `confidence`：`high`；引用可重复扫描。
- `action`：`delete`
- `resolution`：`open`
- `verification`：先处理全部非 OpenSpec consumer、重生成 inventory，再要求搜索归零与 `npm run docs:check` 为 `exit 0`。

### `PRD-001`

- `id`：`PRD-001`
- `path`：`docs/archive/prd/auto-review-compatibility-router/README.md`
- `location`：阶段总览、默认决策、全局约束，以及 `Phase 0/1` 两份产品需求
- `claim`：旧 PRD 仍是当前质量产品/操作权威。
- `claimCategory`：`history`
- `owner`：`quality-pipeline`
- `evidence`：
  - `current`：当前 `Phase 0/1` 实现、CLI、fixture、报告与验证由质量源码、测试和 `docs/testing/quality-analysis.md` 拥有。
  - `current`：47/47 聚焦测试通过。
- `conflict`：旧 PRD 仍引用已迁出的 `docs/plans/**` 输入/输出和历史阈值来源。
- `confidence`：`high`；当前 owner 完整覆盖已实现子集。
- `action`：`delete`
- `resolution`：`historical-only`
- `verification`：运行质量测试和当前报告验证，不保留 PRD 作为运行入口。

### `PRD-002`

- `id`：`PRD-002`
- `path`：`docs/archive/prd/auto-review-compatibility-router/phase-2-section-rubric-prd.md`
- `location`：`Phase 2` 至 `Phase 7` 的全部产品需求与验收条件
- `claim`：评分规则、在线自动丢弃、自动补跑、参数路由、兼容性基准和训练兜底是当前实现或本变更批准的目标。
- `claimCategory`：`history`
- `owner`：`quality-pipeline`
- `evidence`：
  - `current`：当前质量 owner 明确排除更晚阶段的产品承诺。
  - `target`：活动 `OpenSpec` 只批准文档治理，不批准这些功能。
- `conflict`：这些文档描述多个合理的未来产品方向，不能从历史 PRD 自动恢复为当前待办清单。
- `confidence`：`high`；当前代码与已批准范围中不存在对应完整产品链路。
- `action`：`delete`
- `resolution`：`deferred-to-openspec`
- `verification`：删除后确认当前文档没有继承其阈值、状态机或产品承诺；未来工作必须重新提案并验证。

## 写入

- `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-plans-prd.md`
- 被审计源修改：`none`

## 验证

- 质量 owner：47/47 通过。
- `Training`、工作模式与产品 owner：84/84 通过。
- API、测试与执行 owner：77/77 通过。
- 完整门禁复跑：`npx tsx scripts/docs/check.ts --format json` 为 `exit 1`，9714 个错误、3 个警告；本文件新增诊断为 0。
- 同范围重新审计：17 个冻结文件均已映射；已实现的质量 `Phase 0/1` 与当前 `Training` 事实已有 owner，未实施意图没有被提升为当前事实。
- 删除就绪状态：未就绪；`PLAN-005` 与完整文档门禁仍开放。

## 独立审查

- 审查者：`/root/audit_archive_prototypes`，不是质量/产品/架构 owner 文档作者。
- 状态：独立 extraction/deletion disposition 审查完成。
- 最终结论：当前事实已由质量与 `Training` 生产 owner 覆盖；旧 PRD 后续阶段只能通过新的 `OpenSpec` 恢复。17 个文件语义上可删除，但必须先切断 live consumer 并取得完整门禁通过。

## 待决策项

- `none`。是否重启旧 `Phase 2` 至 `Phase 7` 不属于本次删除任务；将来如需推进，应通过新的显式提案决策。
