# Legacy documentation input baseline — 2026-07-12

Captured with `git ls-files` before deletion. This is reconciliation evidence, not current
product authority. Every item remains recoverable from Git after its verified current facts
have an owner.

## Archive: design demos and design system

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

Disposition: verify any still-current visual rules against production components and CSS,
extract them into `DESIGN.md` and `docs/design/**`, then delete all files.

## Archive: historical handoff and test plan

- `docs/archive/README.md`
- `docs/archive/historical/development-progress.md`
- `docs/archive/historical/development-todo.md`
- `docs/archive/historical/handoff.md`
- `docs/archive/historical/integration-test-plan.md`

Disposition: extract only facts confirmed by current source, schemas, tests, or required
runtime evidence into current owners; do not carry progress percentages, old next steps, or
planned tests forward as current truth.

## Archive: implementation plans and Training designs

- `docs/archive/plans/2026-05-17-auto-review-compatibility-router.md`
- `docs/archive/plans/2026-05-17-phase0-baseline-implementation.md`
- `docs/archive/plans/2026-05-17-phase1-offline-eval-implementation.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-docs-index.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-final-technical-design.local-before-queue-pagination-rebase.md`
- `docs/archive/plans/2026-06-07-manager-lora-training-final-technical-design.md`
- `docs/archive/plans/2026-06-08-manager-lora-training-frontend-alignment.md`

Disposition: current quality-pipeline behavior belongs to `docs/testing/**`; current Training
product, architecture, API, and design behavior must be rebuilt from production source and
tests. Unimplemented intent is discarded or proposed again through OpenSpec.

## Archive: quality PRDs

- `docs/archive/prd/auto-review-compatibility-router/README.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-0-historical-baseline-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-1-auto-reviewer-offline-eval-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-2-section-rubric-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-3-online-shadow-autotrash-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-4-generate-until-4-good-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-5-compatibility-router-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-6-lora-compatibility-benchmark-prd.md`
- `docs/archive/prd/auto-review-compatibility-router/phase-7-cold-character-training-prd.md`

Disposition: keep only Phase 0/1 behavior proven by the current quality source/tests. Do not
promote later PRD phases into current documentation.

## Archive: Superpowers plans

- `docs/archive/superpowers/plans/2026-05-21-queue-pause-resume.md`
- `docs/archive/superpowers/plans/2026-05-25-project-archive-comfy-cleanup.md`
- `docs/archive/superpowers/plans/2026-06-02-auto-censor-mosaic.md`
- `docs/archive/superpowers/plans/2026-06-11-bulk-preset-section-replacement.md`
- `docs/archive/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md`

Disposition: queue safety, project archive/output cleanup, auto-censor, and preset replacement
facts move only when current source/tests prove them. The refactor roadmap is never current
architecture authority.

## Training prototypes

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

Disposition: delete the complete prototype surface after production Training routes, shared
mode navigation, and current owner docs are verified. Do not preserve a history copy.

## Parallel planning surfaces

- `docs/plans/auto-review-analysis/README.md`
- `docs/superpowers/QUEUE_PAUSE_RESUME_IMPLEMENTATION.md`
- `docs/superpowers/specs/2026-05-21-queue-pause-resume-design.md`
- `docs/superpowers/specs/2026-06-02-auto-censor-mosaic-design.md`
- `docs/superpowers/specs/2026-06-11-bulk-preset-section-replacement-design.md`

Disposition: quality fixtures/reports are relocated to their test/report owners; verified
runtime behavior moves to current architecture/runbooks. Delete all parallel plan/spec paths.
