## 1. Apply Gate and Read-Only Baseline

- [x] 1.1 Reconcile the paused-session handoff into this artifact revision: explicit `$docs-audit`, typed `contract`/`review` relationships, full/fast checks, stable diagnostics, finite scope/parser semantics, dirty-worktree proof, CI surface, and observability-owned PreToolUse evidence.
- [ ] 1.2 Verify that parent tasks 1.1-1.5 have completed repository-pinned OpenSpec, canonical-digest approval/acceptance tooling, stage-order prerequisites, tests, and durable bootstrap revalidation; stop child apply if any prerequisite is incomplete.
- [ ] 1.3 Strictly validate and present this exact child proposal, spec, design, and tasks revision to the user before any migration mutation.
- [ ] 1.4 After explicit user approval, record the exact sorted artifact set, canonical Git blob digests, apply scope, decision reference, and approval time; reject stale or absent approval.
- [ ] 1.5 Enumerate root docs, `docs/**`, `agent-rules/**`, OpenSpec artifacts/evidence, project Skills, source-adjacent Markdown, documentation generators, governance tests, runtime assets stored under docs, and all inbound live references with `git ls-files` and non-writing searches.
- [ ] 1.6 Capture the current documentation-check, focused governance-test, OpenSpec validation, and full-test baselines, distinguishing pre-existing failures from target requirements.
- [ ] 1.7 Divide apply work into narrow owner-based batches with explicit verification and rollback commands; preserve unrelated worktree changes and submit completed batches without accumulating unrelated dirt.

## 2. Documentation Metadata Control Plane

- [ ] 2.1 Create `docs/_meta/README.md`, `documentation.schema.json`, `policy.yaml`, and the approved `document.md`, `directory-readme.md`, and `runbook.md` templates.
- [ ] 2.2 Define common router, architecture, product, design, API, testing, runbook, placeholder, root-file, and existing-generator metadata profiles without creating a per-file central registry.
- [ ] 2.3 Encode the finite scope matrix, allowed documentation roots, mandatory `README.md` landing pages, root/detail relationships, forbidden live legacy paths, OpenSpec/Skill/evidence/source-adjacent rules, and typed `contract`/`review` source relationships in `policy.yaml`.
- [ ] 2.4 Add runbook-specific environment, risk, recovery, and last-verification requirements and deferred-placeholder requirements to the schema.
- [ ] 2.5 Add metadata parsing, profile selection, schema validation, and path-normalization tests using positive and negative fixtures.

## 3. Deterministic Documentation Check

- [ ] 3.1 Write failing tests first for Git-backed scope enumeration, diagnostic ordering/schema, exit `0/1/2`, and content-aware preservation of an already dirty worktree; then implement the shared non-writing engine under `scripts/docs/**`.
- [ ] 3.2 Implement full mode as the default/acceptance mode and an explicit merge-base fast mode that computes the complete impact closure and escalates to full on every unsafe narrowing condition; full mode without a base runs all deterministic verifiers and emits every `review` relationship as a missing-base warning, while CI/acceptance require an explicit base.
- [ ] 3.3 Implement allowed-topology, required-landing-page, finite-scope, forbidden-live-path, root/detail, OpenSpec, project-Skill, evidence, and source-adjacent policy checks.
- [ ] 3.4 Implement GFM relative-link and GitHub-compatible duplicate-anchor parsing with precise source locations, excluding code, comments, negative fixtures, and non-current evidence from live-reference semantics.
- [ ] 3.5 Build the navigation graph and enforce root-to-current reachability plus required reverse links only for current descriptive documentation.
- [ ] 3.6 Implement `contract` relationship blocking verification and non-blocking owned `review` warnings against the merge base; never downgrade a deterministic contract or auto-run `$docs-audit`.
- [ ] 3.7 Refactor existing documentation generators to expose separate write and exact non-writing check modes without moving outputs into a new generated directory.
- [ ] 3.8 Add check adapters for the existing repository inventory, Prisma compatibility documentation, route/API/MCP/configuration contracts, and other verified generator-owned artifacts discovered in the baseline.
- [ ] 3.9 Add exact direct `js-yaml` `4.1.1`, implement repository-owned `scripts/skills/validate.mjs`, expose `npm run skills:check -- .codex/skills/docs-audit`, and integrate that offline validator plus repository-pinned OpenSpec strict validation into `docs:check`.
- [ ] 3.10 Expose one stable `npm run docs:check` command with full/fast and human/JSON options; keep external reachability offline and non-blocking.
- [ ] 3.11 Add valid and invalid fixtures for metadata, scope, topology, links, duplicate anchors, code-block false references, reachability, reverse links, contract/review mappings, missing-base full behavior, fast escalation, diagnostics/exit codes, forbidden live paths, generator drift, malformed OpenSpec relationships, and Skill metadata/references.

## 4. Explicit `$docs-audit` Skill

- [ ] 4.1 Create representative baseline scenarios without the Skill for current/target/history confusion, missing runtime proof, duplicate authority, unsafe operations, fix authorization, and self-review; record the observed failures before writing Skill content.
- [ ] 4.2 Initialize `.codex/skills/docs-audit/**` with the approved Agent Skills tooling; write frontmatter that triggers only on explicit user or approved OpenSpec-task invocation, then implement changed, paths, OpenSpec change, and full scopes with write-free `report`, contained evidence-only `record`, and explicit scoped `fix` operations.
- [ ] 4.3 Put evidence precedence, finding schema, dispositions, escalation, report-location and path-containment rules, and independent-review boundary in the Skill and its one-level references; do not create an audit runbook, `AGENTS.md` trigger, controlled read CLI, MCP gateway, scheduler, or permanent ledger.
- [ ] 4.4 Validate the Skill package with `npm run skills:check`, test report/record/fix writes independently, and rerun the same baseline scenarios until agents preserve uncertainty, enforce authorization/containment, and refuse self-signoff.
- [ ] 4.5 Forward-test fresh agents on one root router, one architecture document, one Training document, and one deployment rule; independently review changes and close discovered workflow gaps.
- [ ] 4.6 Perform representative navigation exercises from `AGENTS.md` through docs routers to owner docs and verification entrypoints, recording dead ends and duplicate authority for later batches without making `$docs-audit` an ordinary navigation trigger.

## 5. Root Entrypoints and Documentation Routers

- [ ] 5.1 Rebuild root `README.md` as the stable human entrypoint, remove volatile hand-copied inventories, and route detailed facts to verified owners.
- [ ] 5.2 Replace `docs/index.md` and the human portion of `docs/documentation-map.md` with `docs/README.md`; move machine policy into `_meta/policy.yaml` and remove the duplicate sources.
- [ ] 5.3 Rebuild root `ARCHITECTURE.md` as a concise current architecture map pointing to `docs/architecture/**`.
- [ ] 5.4 Create root `PRODUCT.md` and verified `docs/product/**` routers for Generation, Training, and shared resources, preserving Training as a peer work mode selected through the shared navigation mode toggle.
- [ ] 5.5 Keep root `DESIGN.md` as current design knowledge, create only evidence-supported `docs/design/**` detail files, and defer every Impeccable schema, hook, detector, sidecar, and CI change.
- [ ] 5.6 Create metadata-only deferred `docs/QUALITY_SCORE.md`, `docs/RELIABILITY.md`, and `docs/SECURITY.md` placeholders with no invented metrics, SLOs, models, or backlog authority.
- [ ] 5.7 Keep `CLAUDE.md` as a thin compatibility pointer to `AGENTS.md` and test that it cannot become a second policy source.

## 6. Verified Current Architecture, Product, Design, API, and Testing Knowledge

- [ ] 6.1 Audit and write architecture context, dependency model, runtime topology, data model, agent interfaces, and core beliefs from current source, schemas, tests, and required runtime evidence.
- [ ] 6.2 Audit and write Generation, Training, and shared-resource architecture domain routers with explicit ownership, dependency, failure, and verification boundaries.
- [ ] 6.3 Extract verified queue/worker, Prisma-provider, schema-compatibility, and runtime boundaries into their architecture owners and remove superseded analysis sources.
- [ ] 6.4 Split current UI/frontend material into root visual rules, detailed `docs/design/**` patterns, architecture ownership, and runbook/testing verification; remove duplicate sources after each owner passes.
- [ ] 6.5 Move verified `position_presets.md` product/prompt knowledge into `docs/product/shared-resources/**` and update all current links.
- [ ] 6.6 Audit Agent API, MCP, route-template, and workflow-contract documentation against current source and tests; retain a distinct `docs/api/**` owner only for non-duplicative current contract knowledge.
- [ ] 6.7 Audit test-infrastructure documentation; retain `docs/testing/**` only for distinct current testing knowledge and move executable environment/verification sequences into runbooks.
- [ ] 6.8 Remove or split every remaining root/docs file that mixes current facts, target design, historical intent, operations, or duplicate inventories, then verify the resulting owner links.
- [ ] 6.9 For every tasks 6.1-6.8 owner batch, explicitly invoke `$docs-audit paths <batch-owned paths> record`, write only `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-6-<batch>.md`, and independently review any applied correction before the batch passes.

## 7. Runbooks and Atomic Agent-Policy Cutover

- [ ] 7.1 Build and verify Git delivery, development service, local verification, deployment orchestration, deployment lock, queue safety, database sync, Next build, service restart, deployment verification, and `mypc` PowerShell runbooks.
- [ ] 7.2 Reverify local-versus-`mypc` execution, project paths, ports, public URL, log names, Prisma synchronization policy, queue authentication/recovery, and process targeting; escalate uncertain major policy rather than copying it.
- [ ] 7.3 Rewrite `AGENTS.md` as the sole concise ordinary-development hard-policy and trigger router, preserving approved commit/push and deployment semantics unless separately changed and excluding `$docs-audit` rules or automatic triggers.
- [ ] 7.4 Atomically update `CLAUDE.md`, `openspec/config.yaml`, root/docs routers, inventory generator, and all current documentation links from `agent-rules/**` to the new authority paths.
- [ ] 7.5 Rewrite governance tests to validate AGENTS hard boundaries, trigger reachability, complete deployment sub-runbooks, dev/production isolation, token safety, and exact service targeting.
- [ ] 7.6 Delete all `agent-rules/**` files and prove zero tracked files or live references remain; do not leave compatibility stubs or synchronization instructions.
- [ ] 7.7 Explicitly invoke `$docs-audit paths AGENTS.md CLAUDE.md docs/runbooks openspec/config.yaml record`, write only `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-7-authority-cutover.md`, and require independent review before accepting the authority cutover.

## 8. Remove Parallel Planning and Relocate Misowned Data

- [ ] 8.1 Audit legacy `docs/superpowers/specs/**`, implementation notes, plan files, PRDs, handoffs, and progress records; extract only verified current knowledge into current docs or living specs.
- [ ] 8.2 Explicitly invoke `$docs-audit paths docs/superpowers docs/plans record`, write only `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-8-planning-cutover.md`, and independently review every extract/relocation/deletion disposition before removal.
- [ ] 8.3 Remove all Superpowers planning/spec authority, `PLANS.md`, ExecPlan routes, and non-OpenSpec plan instructions after current replacements pass.
- [ ] 8.4 Split `docs/plans/auto-review-analysis/**` into benchmark/config inputs owned by tests/config and generated analysis outputs owned by a non-plan artifact location; update quality code, scripts, tests, and documentation.
- [ ] 8.5 Delete `docs/plans/**` after proving no remaining item is an active plan or misowned runtime/test artifact and no current link routes agents there.
- [ ] 8.6 Update the parent harness artifacts to replace every extra detailed-plan instruction with the child OpenSpec `tasks.md` lifecycle and to state that historical recovery uses Git/OpenSpec archives.

## 9. Extract and Delete the Current Archive

- [ ] 9.1 Freeze the complete `git ls-files docs/archive` input list for reconciliation and group it by historical notes, design system/demos, plans, PRDs, and legacy Superpowers plans.
- [ ] 9.2 Before deleting each frozen archive group, explicitly invoke `$docs-audit paths <frozen archive group> record`, write only `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-9-<group>.md`, and independently review the extraction/deletion dispositions.
- [ ] 9.3 Audit historical handoff/progress/todo/integration material, extract any verified current operational or testing facts, and delete the sources.
- [ ] 9.4 Audit archived design-system and static-demo material, extract any verified current visual or implementation boundary, and delete the sources.
- [ ] 9.5 Audit archived implementation plans and PRDs, extract only verified current product/architecture behavior, and delete abandoned, never-built, duplicated, or obsolete content.
- [ ] 9.6 Replace tests and current docs that read the archived whole-repo roadmap or any other archived file as authority with current code, policy, architecture, or test-owned contracts.
- [ ] 9.7 Delete the entire `docs/archive/**` tree and prove every baseline path has been processed, `docs/history/**` was not created, and tracked/reference searches return zero live archive/history paths.

## 10. Discard Training Prototypes

- [ ] 10.1 Prove with source scans and tests that production code does not import, load, or serve assets from `docs/prototypes/**`.
- [ ] 10.2 Before prototype deletion, explicitly invoke `$docs-audit paths docs/prototypes record`, write only `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-10-prototypes.md`, and independently verify that any current fact is owned by production documentation rather than preserving prototype assets.
- [ ] 10.3 Remove prototype route maps, prototype intent links, inventory classifications, and prototype-specific documentation tests; preserve only production Training contracts.
- [ ] 10.4 Delete every tracked Training prototype HTML, CSS, JavaScript, image, font, and README under `docs/prototypes/**` without creating a history copy.
- [ ] 10.5 Verify current Training navigation, shared navigation mode toggle, APIs, services, repositories, and frontend tests remain green and documentation still presents Training as a peer work mode.

## 11. Move Runtime and Configuration Assets Out of Documentation Ownership

- [ ] 11.1 Move `docs/workflow.api.json` to the approved configuration-owned path, update its loader and every test/reference, and verify identical workflow-template behavior.
- [ ] 11.2 Audit remaining non-document files below `docs/**` and relocate runtime inputs, fixtures, or generated outputs to their actual config, test, data, or artifact owner.
- [ ] 11.3 Run targeted runtime, workflow-generation, build, queue, and deployment verification for any migration that changes runtime file loading; do not classify those batches as documentation-only.

## 12. Inventory, Governance Tests, and Zero-Violation Cutover

- [ ] 12.1 Refactor the repository inventory generator to derive classification and ownership from approved metadata/policy rather than path heuristics, while keeping its output at `docs/repo-inventory.md` during this stage.
- [ ] 12.2 Regenerate the inventory and prove its non-writing check catches stale output without rewriting the worktree.
- [ ] 12.3 Replace hard-coded documentation-governance tests with schema/policy and public-command contract tests; remove assertions whose only purpose was preserving deleted paths or stale prose.
- [ ] 12.4 Resolve every deterministic `docs:check` error and record an explicit evidence-backed disposition for every warning and `$docs-audit` finding in the approved scope without permanent allowlists or downgraded contracts.
- [ ] 12.5 Run the full agent navigation audit across architecture, Generation, Training, shared resources, design, API, testing, local development, deployment, and troubleshooting.

## 13. Documentation-Specific CI and Acceptance

- [ ] 13.1 Add a checked-in documentation-only CI job that installs pinned dependencies, starts clean, runs exact non-writing `npm run docs:check` full mode with the protected comparison revision, ends clean, and has no documentation-only path filter.
- [ ] 13.2 Run focused documentation/OpenSpec tests and the complete repository test suite in the approved Node/runtime environment.
- [ ] 13.3 Run strict non-interactive OpenSpec validation for all active changes and living specs.
- [ ] 13.4 Prove local checks preserve the complete pre-existing tracked/staged/untracked state, CI starts and ends clean, and no forbidden live legacy path, duplicate policy authority, or non-OpenSpec planning authority remains.
- [ ] 13.5 Capture a successful full-mode clean-checkout CI run, controlled rule-failure and tool-failure cases, and a restored successful run.
- [ ] 13.6 Make the documentation job required on every protected merge path; if permission is unavailable, leave this task incomplete and report the exact external action.
- [ ] 13.7 Explicitly invoke `$docs-audit full record` with the approved comparison revision, write only `openspec/changes/rebuild-documentation-governance/evidence/docs-audit/task-13-final-acceptance.md`, independently review the result, then present the final target tree, migration reconciliation, audit dispositions, local/CI evidence, runtime-asset verification, and remaining risks for explicit user stage acceptance.
- [ ] 13.8 Before archive, confirm the sanitized PreToolUse spike remains non-normative attempted-path-match evidence with no installed hook or live data, and record that the later observability child must revalidate any digest-bound transfer.
- [ ] 13.9 After user acceptance, archive `rebuild-documentation-governance` under OpenSpec conventions and update the parent stage state without starting observability implementation.
