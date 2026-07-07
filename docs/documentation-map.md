# Documentation Map

Classification: current
Update trigger: tracked file moves, new maintained docs, doc classification changes, archive decisions, or workflow ownership changes.

This map separates active operating docs from historical notes and generated artifacts. `docs/index.md` remains the read-first routing table; this file explains where durable documentation should live.

## Maintained Layers

| Layer | Classification | Purpose | Current sources mapped here |
| --- | --- | --- | --- |
| `README.md` | current | Human entrypoint, setup, high-level feature map, and links to current docs. | `README.md`, `docs/index.md`, `docs/repo-inventory.md` |
| `AGENTS.md` and `agent-rules/**` | runbook | Agent workflow entrypoint, git rules, dev-service rules, deploy lock, queue, Prisma, build, restart, verification, and `mypc` command quoting. | `AGENTS.md`, `agent-rules/git.md`, `agent-rules/dev-service.md`, `agent-rules/mypc-powershell.md`, `agent-rules/deploy/**` |
| `docs/architecture/` | architecture reference | Current module boundaries, dependency rules, data flow, queue/worker semantics, and training/generation ownership. | `docs/worker-boundaries.md`, `docs/prisma-provider-matrix.md`, `docs/prisma-schema-compatibility.md`, `docs/analysis/**`, durable decisions extracted from `docs/superpowers/plans/**` |
| `docs/runbooks/` | runbook | Local development, deployment, `mypc`, ComfyUI, Prisma, auth verification, and incident triage. | `docs/local-verification.md`, `agent-rules/deploy/**`, `agent-rules/dev-service.md` |
| `docs/api/` | API contract | Agent API, MCP, public route contracts, response envelopes, and workflow schema. | `docs/agent-api.md`, `docs/workflow.api.json`, `docs/api/route-handler-template.md` |
| `docs/ui/` | product/design reference | Design system, page patterns, shell/navigation rules, design-demo relationship, accessibility, and layout gates. | `DESIGN.md`, `docs/frontend-design-guide.md`, `docs/ui/**`, `docs/design-demos-frontend-parity.md` |
| `docs/testing/` | testing reference | Test groups, fixture builders, DB bootstrap, known environment requirements, and verification matrix. | `tests/README.md`, `tests/fixtures/**`, `docs/local-verification.md` |
| `docs/archive/` | historical record | Historical plans, superseded handoffs, old PRDs, obsolete static demos, and retained rationale after replacement links exist. | `docs/plans/**`, `docs/prd/**`, `docs/development-progress.md`, superseded docs after banners are added |
| `docs/superpowers/plans/` | historical record after completion | Execution plans only; durable architecture/runbook decisions must be extracted into current layers before a plan is treated as complete. | `docs/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md` |
| `docs/repo-inventory.md` | generated artifact | Generated file inventory with current role, target role, owner, and action columns. | Regenerate with `npx tsx scripts/docs/generate-repo-inventory.ts` |

## Classification Rules

| Classification | Meaning | Maintenance rule |
| --- | --- | --- |
| current | Maintained source of truth for active work. | Update in the same change that changes the behavior or ownership. |
| runbook | Operational procedure with exact commands or checks. | Keep commands executable and keep deploy/dev-service scopes separate. |
| architecture reference | Durable module, data-flow, or dependency contract. | Extract decisions from plans once implementation lands. |
| API contract | Agent-facing or route-facing request and response contract. | Keep synchronized with route tests, MCP tests, and `docs/workflow.api.json`. |
| product/design reference | UI, product, prompt, or visual direction. | Keep separate from runtime truth and generated inventories. |
| testing reference | Test structure, fixtures, environment setup, or verification matrix. | Update when test helpers, native module requirements, or DB setup changes. |
| historical record | Completed handoff, progress note, PRD, or old plan retained for context. | Add a banner before relying on a replacement as current truth. |
| generated artifact | Rebuilt from a script or analysis source. | Change the generator or source fixture, then regenerate. |
| superseded | Retained only with a pointer to the replacement source. | Must name the replacement and must not contain the only active workflow instructions. |

## Duplicate Authority Decisions

| Duplicate area | Current authority | Retained context |
| --- | --- | --- |
| README vs handoff | `README.md` is the human entrypoint and `docs/index.md` is the agent read-first source. | `docs/handoff.md`, `docs/development-progress.md`, and `docs/development-todo.md` are historical records only. |
| design docs vs frontend guides | `DESIGN.md`, `docs/frontend-design-guide.md`, and `docs/ui/**` own current UI direction. | `docs/design-v0.1.md`, `docs/design-v0.3-workflow-integration.md`, and migration summaries are retained as product/design context. |
| workflow quick references vs API JSON | `docs/workflow.api.json`, `docs/worker-boundaries.md`, and the workflow service tests own current workflow behavior. | `docs/quick-reference.md`, `docs/WORKFLOW_QUICK_REFERENCE.md`, `docs/WORKFLOW_SYSTEM_ANALYSIS.md`, and analysis notes are retained as architecture context. |
| local verification vs deploy rules | `docs/local-verification.md` owns local verification, while `AGENTS.md` and `agent-rules/deploy/**` own production deployment workflow. | Older handoff/checklist wording must point to those current runbooks. |

## Cleanup Gate

Before documentation cleanup is declared complete, the repo must have no unclassified docs, no stale task-note files acting as current truth, no duplicate conflicting instructions, and no active workflow documented only in old plans.
