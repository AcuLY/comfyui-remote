# Phase 1 Auto Reviewer Offline Evaluation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Follow strict TDD: write failing node:test tests first, verify RED, implement, verify GREEN.

**Goal:** Implement the Phase 1 offline evaluation harness that joins reviewer predictions with Phase 0 labeled images, computes holdout metrics, and verifies Go/No-Go criteria without mutating production data.

**Architecture:** Add a pure TypeScript Phase 1 module for parsing predictions, splitting labeled rows, computing metrics, and verifying acceptance criteria. Add CLI support through `npm run quality:evaluate -- --phase 1 ...` and extend `quality:verify` to verify Phase 1 summary JSON. Phase 1 does **not** implement a real vision reviewer yet; it evaluates prediction files produced by a future/experimental reviewer.

**Tech Stack:** Node built-in `node:test`, TypeScript via `tsx`, existing Phase 0 CSV outputs, no DB writes.

---

## Scope boundaries

- This phase implements the **offline evaluation harness**, not the final image-recognition model.
- Input predictions are JSON/JSONL records matching the PRD schema: `imageId`, `prediction`, `confidence`, `reasons`, `poseMatched`, `anatomyOk`, `detailOk`, `rubricVersion`, `reviewerVersion`.
- If predictions are missing or incomplete, the evaluator must fail clearly and must not fabricate passing metrics.
- Manual-excluded sections (`单人 · 拎鞋`, `第一人称 · 胸压`) are excluded from main metrics and only shown in appendix counts.
- Cross-project section identity remains canonical section name / pose key; never use sortOrder for grouping.
- No production DB mutation.
- Do not commit during implementation.

## Task 1: Pure prediction parsing and metric tests/module

**Objective:** Create a pure Phase 1 module that validates predictions and computes metrics from in-memory Phase 0 labeled rows.

**Files:**
- Create: `src/server/quality/phase1-offline-eval.ts`
- Create: `test-quality-phase1-offline-eval.test.ts`

**Tests to write first:**
1. `computePhase1Metrics excludes manual_excluded rows from main metrics`:
   - Include a labeled row for `单人 · 拎鞋` with prediction `auto_trash`.
   - Expected main total excludes it; appendix/manualExcluded count includes it.
2. `computePhase1Metrics computes auto trash precision, kept auto trash rate, and review reduction`:
   - Mix kept/trashed labels and auto_trash/candidate/review predictions.
   - Expected exact metric values.
3. `validatePhase1Predictions requires reasons for auto_trash`:
   - Auto-trash with empty reasons should count as invalid / autoTrashWithoutReasons.
4. `splitPhase1Rows supports leave-one-project-out and hash split deterministically`:
   - LOO returns one holdout group per project.
   - Hash split is stable across runs.

**Implementation requirements:**
- Export constants:
  - `PHASE1_HIGH_RISK_SECTION_NAMES`: `第三人称 · 背后跪姿手交`, `第三人称 · 翘腿素股`, `第三人称 · 反向足交-正面`, `第一人称 · 反向足交-背面`, `第一人称 · 骑乘手交`.
- Export types:
  - prediction record, labeled input row, split mode, metric group, summary, verification result.
- Export pure functions:
  - `parsePhase1PredictionsText(text)` supporting JSON array and JSONL.
  - `computePhase1OfflineEvaluation(labeledRows, predictions, options)`.
  - `verifyPhase1Evaluation(summary)`.
- Main metrics exclude rows whose sourceFlags contain `manual_excluded`.
- Missing predictions should be counted and fail verification.
- Unknown imageIds in prediction file should be reported but not crash unless configured strict.
- `auto_trash_precision` should be `null` if no auto_trash predictions; verifier should fail because precision threshold cannot be met.

**Verification command:**

```bash
node --import tsx --test test-quality-phase1-offline-eval.test.ts
```

## Task 2: CSV/JSON I/O and evaluate CLI

**Objective:** Add a CLI that reads Phase 0 labeled images CSV + reviewer predictions and writes Phase 1 evaluation outputs.

**Files:**
- Modify: `src/server/quality/phase1-offline-eval.ts`
- Create: `scripts/quality/evaluate.ts`
- Modify: `package.json` to add `quality:evaluate` if absent.

**Tests to write first:**
1. `readPhase0LabeledImagesCsv parses exported CSV rows with source flags` using a temp CSV.
2. `writePhase1EvaluationReports writes summary JSON and per-image joined CSV` using temp output dir.
3. CLI arg parser supports:
   - `--phase 1`
   - `--split leave-one-project-out|hash`
   - `--labeled <path>`
   - `--predictions <path>`
   - `--out <dir>`

**Implementation requirements:**
- Default labeled input: `docs/plans/auto-review-analysis/phase0-labeled-images.csv`.
- Default prediction input: `docs/plans/auto-review-analysis/phase1-reviewer-predictions.jsonl`.
- Default output dir: `docs/plans/auto-review-analysis`.
- Output files:
  - `phase1-offline-evaluation-summary.json`
  - `phase1-offline-evaluation-joined.csv`
  - `phase1-offline-evaluation-by-split.csv`
  - `phase1-offline-evaluation-by-high-risk-section.csv`
- If predictions file is absent, CLI should exit nonzero with a clear message telling the user to provide `--predictions`; do not fabricate metrics.
- Print summary path and pass/fail if evaluation runs.

**Verification commands:**

```bash
node --import tsx --test test-quality-phase1-offline-eval.test.ts
npm run quality:evaluate -- --phase 1 --predictions <fixture-or-real-predictions>
```

## Task 3: Extend verifier CLI for Phase 1

**Objective:** Let `npm run quality:verify -- --phase 1` verify Phase 1 summary JSON.

**Files:**
- Modify: `scripts/quality/verify.ts`
- Tests in `test-quality-phase1-offline-eval.test.ts`.

**Tests to write first:**
1. `verifyPhase1Evaluation passes when thresholds are met`.
2. `verifyPhase1Evaluation fails on low precision, high kept-auto-trash rate, low review reduction, missing predictions, or auto-trash without reasons`.
3. `verify CLI supports --phase 1 --summary <path>`.

**Implementation requirements:**
- Default Phase 1 summary path: `docs/plans/auto-review-analysis/phase1-offline-evaluation-summary.json`.
- Exit code 0 when pass, 1 when fail.
- Failed criteria should include stable names:
  - `auto_trash_precision_min_0_95`
  - `kept_auto_trash_rate_max_0_05`
  - `review_reduction_min_0_50`
  - `auto_trash_reasons_required`
  - `predictions_complete`
  - `high_risk_precision_min_0_90`
  - `manual_exclusions_excluded_from_main_metrics`
  - `leave_one_project_out_required` when split mode is not LOO for Go/No-Go.

**Verification commands:**

```bash
node --import tsx --test test-quality-phase1-offline-eval.test.ts
npm run quality:verify -- --phase 1 --summary <fixture-summary>
```

## Task 4: Final integration review

**Objective:** Ensure Phase 1 harness matches PRD and clearly distinguishes evaluation infrastructure from an actual reviewer model.

**Checks:**
- No DB mutation path.
- Manual-excluded rows excluded from main metrics.
- Leave-one-project-out supported and default for Go/No-Go.
- Hash split supported as auxiliary.
- Missing predictions fail clearly.
- Phase 0 scripts/tests still pass.

**Verification commands:**

```bash
node --import tsx --test test-quality-phase0-baseline.test.ts
node --import tsx --test test-quality-phase1-offline-eval.test.ts
npm run quality:baseline
npm run quality:verify -- --phase 0
npx tsc --noEmit --pretty false --project tsconfig.json
npx eslint src/server/quality/phase0-baseline.ts src/server/quality/phase1-offline-eval.ts scripts/quality/baseline.ts scripts/quality/evaluate.ts scripts/quality/verify.ts test-quality-phase0-baseline.test.ts test-quality-phase1-offline-eval.test.ts
```

Full `npm run lint` may still fail on unrelated existing files; targeted lint for Phase 0/1 files must pass.
