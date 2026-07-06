# Documentation Index

This is the read-first map for agents working in this repository. Detailed file ownership and status live in the generated inventory at `docs/repo-inventory.md`.

## Read First

| Need | Read first | Classification | Owner area | Update trigger | Verification |
| --- | --- | --- | --- | --- | --- |
| architecture | `docs/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md` | current execution plan | documentation-system | module boundaries, dependency rules, or refactor scope change | `npm test` and inventory check |
| local development | `docs/local-verification.md` | runbook | agent-workflow | local auth, dev service, or verification command changes | local command named in the runbook |
| database/Prisma | `docs/prisma-provider-matrix.md`, `docs/prisma-schema-compatibility.md`, `prisma.config.ts`, `prisma/schema.prisma`, `prisma/schema.sqlite.prisma` | runbook plus current schema source | data-model | Prisma provider, schema, migration, generated client, or DB bootstrap changes | Prisma generate and schema compatibility tests |
| deployment | `AGENTS.md`, `agent-rules/deploy/index.md`, `agent-rules/git.md` | runbook | agent-workflow | deploy, queue, git, lock, build, or restart workflow changes | deploy-rule review and runtime status gate |
| API contracts | `docs/agent-api.md`, `docs/workflow.api.json`, `src/server/mcp/server.ts` | API contract | agent-api | Agent API, MCP, workflow schema, or response envelope changes | route and MCP contract tests |
| UI design | `DESIGN.md`, `docs/frontend-design-guide.md`, `docs/design-demos-frontend-parity.md` | product/design reference | ui-design-system | shared shell, page pattern, token, accessibility, or design-demo changes | UI/source-contract tests |
| training | `docs/plans/2026-06-07-manager-lora-training-docs-index.md`, `src/features/training`, `src/server/services/training` | product/design reference plus current source | training | training route, API, service, repository, or prototype changes | training frontend/API/service tests |
| queue/worker behavior | `agent-rules/deploy/queue.md`, `src/server/worker`, `src/lib/actions/run-lifecycle.ts` | runbook plus current source | queue-worker | queue pause/resume, worker lease, active run, or scheduler changes | queue, run, worker, and deploy tests |
| troubleshooting | `docs/local-verification.md`, `agent-rules/dev-service.md`, `agent-rules/deploy/verification.md` | runbook | agent-workflow | local outage, protected page, public verification, or service probe changes | recorded failing command and passing re-run |

## Repo Rules

- Preferred request dependency direction: `src/app/api -> src/server/services -> src/server/repositories -> prisma`.
- Preferred page dependency direction: `src/app/* route/page -> src/features or src/components -> src/lib client-safe helpers`.
- `src/features/*` and `src/components/*` must not import server-only modules such as `src/server/**`, `src/lib/db.ts`, `src/lib/prisma.ts`, or Node built-ins.
- `src/generated/**` is generated from Prisma and must be regenerated, not manually edited.
- `.next/**`, `data/**`, `logs/**`, `.tmp/**`, `server-dev-*.log`, `server-prod-*.log`, `build-prod*.log`, `.deploy.lock/**`, and local DB files are runtime artifacts.

## Documentation Classes

| Class | Meaning | Current examples |
| --- | --- | --- |
| current | Maintained source of truth for active work. | `README.md`, `AGENTS.md`, `docs/index.md` |
| runbook | Operational procedure with exact commands or checks. | `docs/local-verification.md`, `agent-rules/**` |
| architecture reference | Durable module, data-flow, or system analysis. | `docs/analysis/**`, `docs/superpowers/specs/**` |
| API contract | Agent-facing or route-facing request and response contract. | `docs/agent-api.md`, `docs/workflow.api.json` |
| product/design reference | UI, product, and visual direction. | `DESIGN.md`, `docs/frontend-design-guide.md` |
| prototype | Intent or visual reference, not runtime truth. | `docs/prototypes/**`, `design-demos/**` |
| historical record | Completed handoff, progress, PRD, or older plan retained for context. | `docs/plans/**`, `docs/prd/**`, `docs/development-progress.md` |
| generated artifact | Rebuilt from a script or analysis source. | `docs/repo-inventory.md`, `docs/plans/auto-review-analysis/**` |
| superseded | Retained only with a pointer to the replacement source. | Add a banner before keeping any superseded doc. |

## Maintenance

- Re-run `npx tsx scripts/docs/generate-repo-inventory.ts` when tracked files are added, removed, renamed, or moved.
- Update this index when a new current documentation source appears or when a workflow changes.
- Keep old plans and PRDs as historical or product intent unless their durable decisions are extracted into current docs.
