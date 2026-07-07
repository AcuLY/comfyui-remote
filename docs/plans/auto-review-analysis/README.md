# Auto Review Analysis Data Ownership

Files in this directory are quality-analysis inputs or generated report artifacts. Do not edit generated artifacts by hand; regenerate them from the owning script into a scratch directory first, review the diff, then replace the checked-in artifact intentionally.

## Data Files

| file | owner | classification | command owner | notes |
| --- | --- | --- | --- | --- |
| `docs/plans/auto-review-analysis/phase0-labeled-images.csv` | quality-analysis | regenerated artifact | `quality:baseline` writes it and `quality:verify -- --phase 0` verifies the summary. | Phase 0 labeled image export consumed by Phase 1 evaluation and review scripts. |
| `docs/plans/auto-review-analysis/reference-section-exclusions.json` | quality-analysis | checked-in benchmark fixture | `quality:baseline -- --exclusions` consumes it and `quality:verify -- --phase 0` verifies the generated summary. | Human-owned manual exclusion fixture for non-representative canonical sections. |
| `docs/plans/auto-review-analysis/valid-projects-trash-rate-by-section-project.csv` | quality-analysis | regenerated artifact | `quality:baseline` writes it and `quality:verify -- --phase 0` verifies the summary. | Phase 0 per-section-per-project aggregate report. |
| `docs/plans/auto-review-analysis/valid-projects-trash-rate-by-section.csv` | quality-analysis | regenerated artifact | `quality:baseline` writes it and `quality:verify -- --phase 0` verifies the summary. | Phase 0 canonical-section aggregate report. |
| `docs/plans/auto-review-analysis/valid-projects-trash-rate-by-section.md` | quality-analysis | regenerated artifact | `quality:baseline` writes it and `quality:verify -- --phase 0` verifies the summary. | Human-readable Phase 0 report generated from the same baseline data. |
| `docs/plans/auto-review-analysis/valid-projects-trash-rate-summary.json` | quality-analysis | regenerated artifact | `quality:baseline` writes it and `quality:verify -- --phase 0` verifies acceptance criteria. | Machine-readable Phase 0 summary and report path manifest. |

## Regeneration

Run Phase 0 baseline generation with an explicit output directory before replacing these artifacts:

```bash
npm run quality:baseline -- --out /tmp/auto-review-analysis
npm run quality:verify -- --phase 0 --out /tmp/auto-review-analysis
```

Use `scripts/quality/evaluate.ts` and `scripts/quality/review.ts` for Phase 1 artifacts when prediction files are introduced. Add every new tracked CSV, JSON, JSONL, or Markdown artifact in this directory to the table above with either `regenerated artifact` or `checked-in benchmark fixture`.
