# Quality analysis pipeline

Owner: `quality-pipeline`

The Phase 0 and Phase 1 quality commands are evaluation tooling, not active product plans.
Their checked-in benchmark input belongs to test fixtures and their reproducible outputs
belong to reports.

| path | owner | classification | regeneration or verification |
| --- | --- | --- | --- |
| `tests/fixtures/quality/auto-review-analysis/reference-section-exclusions.json` | quality-analysis | checked-in benchmark fixture | `npm run quality:baseline -- --exclusions tests/fixtures/quality/auto-review-analysis/reference-section-exclusions.json` |
| `reports/quality/auto-review-analysis/phase0-labeled-images.csv` | quality-analysis | regenerated artifact | `npm run quality:baseline` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section-project.csv` | quality-analysis | regenerated artifact | `npm run quality:baseline` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section.csv` | quality-analysis | regenerated artifact | `npm run quality:baseline` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-by-section.md` | quality-analysis | regenerated artifact | `npm run quality:baseline` |
| `reports/quality/auto-review-analysis/valid-projects-trash-rate-summary.json` | quality-analysis | regenerated artifact | `npm run quality:verify -- --phase 0` |

The default Phase 0/1 output directory is
`reports/quality/auto-review-analysis`. Phase 1 consumes the Phase 0 labeled CSV from that
directory. The manual exclusion JSON is human-owned input and must not be overwritten by a
report command.

Use a scratch `--out` directory when evaluating changes. Replace checked-in reports only
after reviewing their diff and running the matching verification command. The source of
truth for thresholds and serialization is `src/server/quality/**`; the CLI entrypoints are
under `scripts/quality/**`.
