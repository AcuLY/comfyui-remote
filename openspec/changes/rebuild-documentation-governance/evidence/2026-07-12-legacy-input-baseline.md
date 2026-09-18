# 遗留文档输入基线 — 2026-07-12

删除前使用 `git ls-files` 采集。这是核对证据，不是当前产品权威。各项已验证当前事实有责任方后，仍可从 Git 恢复原项。

## 归档：设计演示与设计系统

- `docs/archive/design-demos/README.md`
- `docs/archive/design-demos/app.html`
- `docs/archive/design-demos/components/components.css`
- `docs/archive/design-demos/design-system.css`
- `docs/archive/design-demos/full-demo.html`
- `docs/archive/design-demos/index.html`
- `docs/archive/design-demos/pages-checklist.md`
- `docs/archive/design-demos/router.js`
- `docs/archive/design-demos/style-audit-report.md`
- `docs/archive/design-demos/v2-projects-page.html`
- `docs/archive/design-demos/v2-queue-page.html`
- `docs/archive/design-demos/v2-review-page.html`
- `docs/archive/design-system/DESIGN_SYSTEM_SUMMARY.md`
- `docs/archive/design-system/design-system-migration.md`
- `docs/archive/design-system/shadcn-design-guide.md`

处理结论：对照生产组件与 CSS 验证仍有效的视觉规则，提取到 `DESIGN.md` 和 `docs/design/**`，然后删除全部文件。

## 归档：历史交接与测试计划

- `docs/archive/README.md`
- `docs/archive/historical/development-progress.md`
- `docs/archive/historical/development-todo.md`
- `docs/archive/historical/handoff.md`
- `docs/archive/historical/integration-test-plan.md`

处理结论：只把由当前源码、schema、测试或必要运行时证据确认的事实提取到当前责任方；不把进度百分比、旧的下一步或计划测试延续为当前事实。

## 归档：实施计划与 Training 设计

- `docs/archive/plans/2026-05-17-auto-review-compatibility-router.md`
- `docs/archive/plans/2026-05-17-phase0-baseline-implementation.md`
- `docs/archive/plans/2026-05-17-phase1-offline-eval-implementation.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-docs-index.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-final-technical-design.local-before-queue-pagination-rebase.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-final-technical-design.md`
- `docs/archive/plans/2026-06-08-manager-lora-training-frontend-alignment.md`

处理结论：当前质量流水线行为属于 `docs/testing/**`；当前 Training 产品、架构、API 和设计行为必须从生产源码与测试重建。未实施意图直接丢弃，或重新通过 OpenSpec 提议。

## Archive：质量 PRD

- `docs/archive/prd/auto-review-compatibility-router/README.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-0-historical-baseline-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-1-auto-reviewer-offline-eval-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-2-section-rubric-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-3-online-shadow-autotrash-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-4-generate-until-4-good-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-5-compatibility-router-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-6-lora-compatibility-benchmark-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-7-cold-character-training-prd.md`

处理结论：只保留当前质量源码与测试证明的 Phase 0/1 行为。不得把后续 PRD 阶段提升为当前文档。

## 归档：`Superpowers` 计划

- `docs/archive/superpowers/plans/2026-05-21-queue-pause-resume.md`
- `docs/archive/superpowers/plans/2026-05-25-project-archive-comfy-cleanup.md`
- `docs/archive/superpowers/plans/2026-06-02-auto-censor-mosaic.md`
- `docs/archive/superpowers/plans/2026-06-11-bulk-preset-section-replacement.md`
- `docs/archive/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md`

处理结论：只有当前源码与测试证明时，才迁移队列安全、项目归档与输出清理、自动审查和预设替换事实。重构路线图永远不是当前架构权威。

## Training 原型

- `docs/prototypes/README.md`
- `docs/prototypes/assets/fonts/geist-latin.woff2`
- `docs/prototypes/assets/images/lora-training-generation-result-output.png`
- `docs/prototypes/assets/images/lora-training-generation-result-thumb.png`
- `docs/prototypes/assets/lora-training-shared.css`
- `docs/prototypes/assets/lora-training-shared.js`
- `docs/prototypes/manager-lora-training-generation-compose-prototype.html`
- `docs/prototypes/manager-lora-training-generation-detail-prototype.html`
- `docs/prototypes/manager-lora-training-preset-detail-prototype.html`
- `docs/prototypes/manager-lora-training-preset-sort-rules-prototype.html`
- `docs/prototypes/manager-lora-training-presets-prototype.html`
- `docs/prototypes/manager-lora-training-project-dataset-prototype.html`
- `docs/prototypes/manager-lora-training-project-dataset-revision-prototype.html`
- `docs/prototypes/manager-lora-training-project-detail-prototype.html`
- `docs/prototypes/manager-lora-training-project-generation-tasks-prototype.html`
- `docs/prototypes/manager-lora-training-project-new-prototype.html`
- `docs/prototypes/manager-lora-training-project-profile-prototype.html`
- `docs/prototypes/manager-lora-training-project-results-prototype.html`
- `docs/prototypes/manager-lora-training-project-section-detail-prototype.html`
- `docs/prototypes/manager-lora-training-project-sections-prototype.html`
- `docs/prototypes/manager-lora-training-project-training-runs-prototype.html`
- `docs/prototypes/manager-lora-training-projects-prototype.html`
- `docs/prototypes/manager-lora-training-runs-prototype.html`
- `docs/prototypes/manager-lora-training-template-edit-prototype.html`
- `docs/prototypes/manager-lora-training-template-new-prototype.html`
- `docs/prototypes/manager-lora-training-template-section-prototype.html`
- `docs/prototypes/manager-lora-training-templates-prototype.html`
- `docs/prototypes/manager-lora-training-training-detail-prototype.html`

处理结论：验证生产 Training 路由、共享模式导航和当前责任方文档后，删除完整原型表面。不保留历史副本。

## 平行规划表面

- `docs/plans/auto-review-analysis/README.md`
- `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`
- `docs/superpowers/specs/2026-05-21-queue-pause-resume-design.md`
- `docs/superpowers/specs/2026-06-02-auto-censor-mosaic-design.md`
- `docs/superpowers/specs/2026-06-11-bulk-preset-section-replacement-design.md`

处理结论：把质量 fixture 与报告迁移到测试和报告责任方；已验证运行时行为迁移到当前架构与运行手册。删除全部平行计划与规范路径。
