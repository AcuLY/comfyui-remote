# Documentation-governance apply baseline — 2026-07-12

This is non-normative implementation evidence captured before documentation mutation.
The active proposal, specification, design, and `tasks.md` remain authoritative.

## Tracked scope

The baseline was enumerated with `git ls-files` and non-writing `rg` searches.

- 91 tracked Markdown files in the migration surface:
  - 5 root Markdown files
  - 13 files below `agent-rules/**`
  - 40 current Markdown files below `docs/**`
  - 33 Markdown files below `docs/archive/**`
- 42 total files below `docs/archive/**`, including 9 non-Markdown files.
- 28 total files below `docs/prototypes/**`, including 27 non-Markdown files.
- 7 total files below `docs/plans/**`, including 5 non-Markdown files.
- 4 Markdown files below `docs/superpowers/**`.
- OpenSpec artifacts and evidence, project Skills, documentation generators, governance
  tests, source-adjacent Markdown, and inbound references were included in the searches.

The five pre-existing untracked `scripts/*.ts` recovery/debug files listed by `git status`
are unrelated and must remain untouched.

## Known consumers that block deletion

- `tests/test-asset-page-boundaries.test.ts` and
  `tests/test-work-mode-resource-boundary.test.ts` read the archived whole-repository
  roadmap.
- `tests/test-documentation-governance.test.ts` requires the current archive and
  `agent-rules/**` structure.
- `tests/test-legacy-static-design-demos.test.ts` requires archived demo assets.
- `tests/test-training-prototype-governance.test.ts` requires the prototype route/file map.
- `src/server/quality/phase0-baseline.ts`,
  `src/server/quality/phase1-offline-eval.ts`, and
  `tests/test-quality-script-governance.test.ts` use
  `docs/plans/auto-review-analysis/**` as an owner path.
- `src/server/services/comfyui-service.ts` and workflow tests load
  `docs/workflow.api.json` at runtime.
- `scripts/docs/generate-repo-inventory.ts` classifies the legacy archive, prototype,
  plans, Superpowers, and agent-rule paths heuristically.

## Verification baseline

- `npm run docs:check`: unavailable before apply (`Missing script: docs:check`).
- Repository-pinned `npm run openspec:validate`: passed, 2 changes passed and 0 failed.
- Focused legacy governance suite: 79 tests, 78 passed and 1 failed. The pre-existing
  failure is `README current route and MCP facts match source` because `/` is no longer
  present in the test's source route enumeration.
- Full `npm test`: 1303 tests, 1298 passed and 5 failed. The pre-existing failures are:
  - design-demo showcase CSS ownership;
  - two Python auto-censor CLI process assertions;
  - the same README route/MCP assertion;
  - a Training API test reading a missing legacy
    `docs/plans/2026-06-07-manager-lora-training-backend-api-schema-design.md` file.

These failures are baseline evidence, not exemptions from the new documentation gate.
Documentation-owned obsolete assertions will be replaced during the cutover; unrelated
application failures remain out of this change and must not be hidden.

## Apply batch boundaries

The single OpenSpec `tasks.md` is executed in narrow batches:

1. OpenSpec foundation and read-only baseline.
2. Metadata schema/policy/templates and deterministic checker.
3. Explicit `$docs-audit` Skill and validation.
4. Root/current product, architecture, design, API, and testing owners.
5. Runbooks plus atomic `AGENTS.md` authority cutover.
6. Planning/archive/prototype reconciliation and deletion.
7. Runtime/config asset relocation with runtime verification.
8. Inventory, zero-violation gate, documentation CI, and final audit.

Each batch is reviewed with a path-scoped `git diff`, its focused checks, and
`git diff --check`. A failed uncommitted batch is repaired with explicit path-scoped edits;
after submission, rollback uses a normal revert commit. Broad reset/checkout operations are
not part of this workflow.
