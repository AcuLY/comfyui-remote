# Phase 0 Historical Baseline CLI Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Follow strict TDD: write failing node:test tests first, verify RED, implement, verify GREEN.

**Goal:** Implement a reproducible Phase 0 quality baseline CLI for ComfyUI Manager that exports labeled image datasets and canonical-section trash-rate reports from the 7 valid reference projects, then verifies hard acceptance criteria programmatically.

**Architecture:** Add a pure TypeScript baseline module that can aggregate in-memory rows for tests and read live SQLite via `better-sqlite3` for CLI use. Add CLI entrypoints under `scripts/quality/` and package scripts `quality:baseline` / `quality:verify`. Outputs remain under `docs/plans/auto-review-analysis/` for now.

**Tech Stack:** Node built-in `node:test`, TypeScript via `tsx`, `better-sqlite3`, existing project package scripts.

---

## Defaults and constraints

- Valid reference projects: `叶瞬光`, `大乔`, `安魂曲`, `洛茜`, `花火`, `西格莉卡`, `零`.
- Manual exclusions file: `docs/plans/auto-review-analysis/reference-section-exclusions.json`.
- Current manual exclusions: `单人 · 拎鞋`, `第一人称 · 胸压`.
- Cross-project section identity must use canonical section name / pose key, never `sortOrder`.
- DB reads must be read-only from the app's SQLite file; do not write production DB.
- Generated reports should be reproducible with deterministic ordering.
- Do not commit during implementation; Luca has not requested commit/push.

## Task 1: Add pure baseline aggregation tests and module

**Objective:** Create pure functions for Phase 0 aggregation and verification from in-memory rows.

**Files:**
- Create: `src/server/quality/phase0-baseline.ts`
- Create: `test-quality-phase0-baseline.test.ts`

**Tests to write first:**
1. `aggregatePhase0Baseline groups by canonical section name, not sortOrder`:
   - Input two projects with the same section name but different sortOrder.
   - Expected one aggregate row with both positions.
2. `aggregatePhase0Baseline marks manual exclusions and low-reference flags`:
   - Input `单人 · 拎鞋`, sample count `<20`, project coverage `<5`.
   - Expected flags include `manual_excluded`, `low_sample_lt20`, `low_project_coverage_lt5`.
3. `verifyPhase0Baseline enforces valid project count, labeled minimum, manual exclusions, sortOrder variance, and reproducibility marker`:
   - Provide a valid summary and invalid summaries.
   - Expected pass/fail and failed criteria list.

**Implementation requirements:**
- Export constants: `VALID_REFERENCE_PROJECT_TITLES`, `DEFAULT_MANUAL_EXCLUSION_NAMES`.
- Export types for source rows, aggregate rows, detail rows, summary, verification result.
- Export `aggregatePhase0Baseline(rows, options)`.
- Export `verifyPhase0Baseline(summary)`.
- Use deterministic sorting by trashRate desc, labeled desc, canonicalSectionName asc.
- Preserve Chinese text exactly.

**Verification command:**

```bash
node --import tsx --test test-quality-phase0-baseline.test.ts
```

## Task 2: Add SQLite reader and report writer CLI

**Objective:** Read the live SQLite DB read-only and write Phase 0 reports.

**Files:**
- Modify: `src/server/quality/phase0-baseline.ts`
- Create: `scripts/quality/baseline.ts`

**Tests to write first:**
1. Test report serialization with a temp output directory:
   - Use pure summary data.
   - Expected files: aggregate CSV, detail CSV, markdown, summary JSON.
   - Expected manual exclusion appears in CSV and Markdown.
2. Test argument/default normalization if implemented separately.

**Implementation requirements:**
- Read DB path from `--db` or default `prisma/data/comfyui.db` relative to project root.
- Read output dir from `--out` or default `docs/plans/auto-review-analysis`.
- Read exclusions from `--exclusions` or default `docs/plans/auto-review-analysis/reference-section-exclusions.json`.
- If exclusions file does not exist, create/use defaults in memory; do not fail.
- Query only valid reference projects.
- Include `loraConfig`/checkpoint summary in labeled dataset export.
- Write deterministic outputs:
  - `phase0-labeled-images.csv`
  - `valid-projects-trash-rate-by-section.csv`
  - `valid-projects-trash-rate-by-section-project.csv`
  - `valid-projects-trash-rate-by-section.md`
  - `valid-projects-trash-rate-summary.json`
- Print the summary JSON path and pass/fail status.

**Verification command:**

```bash
node --import tsx scripts/quality/baseline.ts --out docs/plans/auto-review-analysis
```

## Task 3: Add Phase 0 verifier CLI and package scripts

**Objective:** Provide `npm run quality:baseline` and `npm run quality:verify -- --phase 0`.

**Files:**
- Create: `scripts/quality/verify.ts`
- Modify: `package.json`
- Add tests in `test-quality-phase0-baseline.test.ts` or a new `test-quality-phase0-verify.test.ts`.

**Tests to write first:**
1. `verify CLI reads summary JSON and returns failed criteria` via exported verifier function, not shelling if easier.
2. `phase argument rejects unsupported phases`.

**Implementation requirements:**
- `quality:baseline`: `tsx scripts/quality/baseline.ts`
- `quality:verify`: `tsx scripts/quality/verify.ts`
- Verify script supports `--phase 0`, `--summary <path>`, defaults summary path under report dir.
- Exit code 0 if pass, 1 if fail.
- JSON output includes:
  - phase
  - pass
  - validProjects
  - labeledImages
  - canonicalSections
  - manualExclusionsLoaded
  - sortOrderVarianceVerified
  - reproducible
  - failedCriteria[]

**Verification commands:**

```bash
node --import tsx --test test-quality-phase0-baseline.test.ts
npm run quality:baseline
npm run quality:verify -- --phase 0
```

## Task 4: Final integration review

**Objective:** Ensure implementation matches PRD and does not introduce unrelated changes.

**Files:** all changed files.

**Checks:**
- `docs/prd/auto-review-compatibility-router/phase-0-historical-baseline-prd.md` acceptance criteria are covered.
- Existing docs under `docs/plans/auto-review-analysis/` can be regenerated by the CLI.
- `package-lock.json` should not be modified for this feature.
- No production DB mutations.

**Verification commands:**

```bash
node --import tsx --test test-quality-phase0-baseline.test.ts
npm run quality:baseline
npm run quality:verify -- --phase 0
npm run lint
```

If `npm run lint` surfaces pre-existing unrelated issues, report separately rather than hiding them.
