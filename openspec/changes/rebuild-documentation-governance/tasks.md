## 1. Baseline and User-Approved Documentation Blueprint

- [ ] 1.1 Freeze a baseline of every governed current document, historical artifact, OpenSpec artifact, generator, test, and retained prototype attachment from `git ls-files`, assigning stable identifiers and content digests.
- [ ] 1.2 Record the current classification, claimed authority subject/kind/scope, inbound/outbound links, owner, generator, code mapping, and known drift for each item.
- [ ] 1.3 Present two or three repository-specific target documentation structures with migration and maintenance trade-offs.
- [ ] 1.4 Obtain explicit user approval for the target tree, classes, naming, ownership, authority, navigation, lifecycle, metadata, and update triggers.
- [ ] 1.5 Store approval against the exact blueprint digest, scope, and user decision reference; fail closed on a changed digest.
- [ ] 1.6 Prove that moves, deletion, reclassification, authority changes, governed-content rewrites, and final migration dispositions remain blocked before valid approval.

## 2. OpenSpec and Document Identity Foundation

- [ ] 2.1 Consume the repository-pinned OpenSpec version/profile owned by the parent foundation, and document the historical-schema commands, telemetry setting, and update boundary used by local agents and CI.
- [ ] 2.2 Implement and validate the repository-owned `historical-migration` OpenSpec schema.
- [ ] 2.3 Define the document identity schema for classification, lifecycle, owner, normalized authority subject/kind/scope, update trigger, evidence, replacement, and validation state.
- [ ] 2.4 Implement explicit and directory-inherited metadata resolution with path-normalization tests.
- [ ] 2.5 Convert the repository inventory into a derived view of approved metadata rather than an independent heuristic authority.

## 3. Deterministic Documentation Validation

- [ ] 3.1 Implement Markdown relative-link and anchor validation with actionable diagnostics.
- [ ] 3.2 Implement current-document reachability, orphan detection, authority uniqueness, and permitted cross-layer edge checks.
- [ ] 3.3 Refactor documentation generators to support non-writing check mode and exact committed-output comparison.
- [ ] 3.4 Generate or mechanically verify volatile API, route, request-field, response-envelope, schema, MCP, and configuration contracts.
- [ ] 3.5 Implement affected-module to documentation-impact checks and explicit no-impact attestations.
- [ ] 3.6 Expose all deterministic validation through one non-writing `docs:check` package entrypoint.

## 4. Agent Semantic Audit and Repair Workflow

- [ ] 4.1 Write the agent-executable audit runbook with evidence precedence, claim extraction, status, confidence, and escalation rules.
- [ ] 4.2 Define and validate the structured audit registry and migration-ledger formats, including stable source IDs/digests, claim categories, actor identities, confidence, and final dispositions.
- [ ] 4.3 Implement narrow evidence adapters for source, schemas, tests, Git history, and invocation of existing browser/runtime verification; do not build the later general observability infrastructure.
- [ ] 4.4 Implement the high-confidence unique-correction boundary for `current-implementation` claims and structural repairs, preserving before/after evidence and preventing automatic target/history semantic changes.
- [ ] 4.5 Implement the user-decision queue for authority, deletion, product direction, partial implementation, ownership, and evidence conflicts.
- [ ] 4.6 Implement an independent semantic verification pass with a distinct recorded agent/context identity and fresh access to original evidence.
- [ ] 4.7 Add positive and counterexample fixtures for every critical automated and semantic-audit rule family.

## 5. Verified Current-Truth Reconstruction

- [ ] 5.1 Semantically audit and rebuild every root entrypoint, agent workflow rule, documentation route, and authority map from verified evidence.
- [ ] 5.2 Semantically audit and rebuild every architecture, generation, Training, shared-runtime, worker/queue, data-model, API/MCP, UI, testing, and runbook owner doc in bounded batches.
- [ ] 5.3 Preserve current implementation and approved target design as separate statements wherever they differ.
- [ ] 5.4 Resolve every `evidence-conflict`, `runtime-verification-required`, and `user-decision-required` item before current-truth promotion.

## 6. Full Historical Migration

- [ ] 6.1 Migrate legacy specs, execution plans, handoffs, progress/todo records, and planning notes through validated historical-migration records.
- [ ] 6.2 Migrate PRDs, implementation notes, analyses, and design-system summaries while classifying implemented, drifted, partial, never-built, abandoned, and superseded outcomes.
- [ ] 6.3 Migrate prototypes and retained attachments with explicit reference value and current-source boundaries.
- [ ] 6.4 Extract only verified active behavior into living specs and maintained docs.
- [ ] 6.5 Remove or downgrade duplicate current authority only after replacement links and migration-ledger entries are verified.
- [ ] 6.6 Reconcile the frozen baseline, audit registry, and migration ledger exactly once, with zero missing, duplicate, stale-digest, or unresolved required records.

## 7. Hard-Cutover Documentation Gate

- [ ] 7.1 Run focused documentation, OpenSpec, generator, contract, and semantic-audit verification.
- [ ] 7.2 Run the full repository test suite in the approved Node/runtime environment and resolve all failures in scope.
- [ ] 7.3 Prove `docs:check` and generator check modes leave the worktree unchanged.
- [ ] 7.4 Run `openspec validate --all --strict --no-interactive` successfully.
- [ ] 7.5 Add documentation CI that runs the exact non-writing `docs:check` in a clean checkout, with no permanent legacy allowlist or warning-only exceptions.
- [ ] 7.6 Capture CI evidence for a successful clean-checkout run, a controlled negative failure, and the restored successful run.
- [ ] 7.7 Make the documentation check required on every protected merge path; if external permissions are missing, record the action as an explicit blocker rather than completing cutover.
- [ ] 7.8 Present the migration ledger, current-truth map, automated gate evidence, required-check evidence, and unresolved-risk report for user acceptance.
