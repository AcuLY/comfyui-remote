## 0. Bounded Bootstrap Authorization

- [ ] 0.1 Commit and strictly validate the exact parent artifact revision that defines foundation tasks 1.1-1.4 and no child apply.
- [ ] 0.2 Present that immutable revision, bounded scope, risks, tests, and rollback to the user and obtain explicit bootstrap approval with a durable decision reference before implementation.

## 1. OpenSpec Program Foundation

- [ ] 1.1 Pin `@fission-ai/openspec` exactly at `1.5.0` in `package.json` and the lockfile, expose local-bin package scripts, and document verified native status, validate, instructions, and archive commands plus the upstream agent apply/verify workflows in `openspec/README.md`.
- [ ] 1.2 Implement a non-writing approval/acceptance gate with parent-owned `approvals/**` and `acceptances/**` records that bind one immutable full Git revision, retain raw artifact digests, normalize only existing task-checkbox state in the semantic plan digest, hash canonical Git blob bytes, validate scope and decision references, print candidates without manufacturing decisions, and mark every other content change stale.
- [ ] 1.3 Add `openspec/changes/establish-agent-harness/program.json` and a narrow prerequisite check for stage order and prior acceptance without storing or replacing OpenSpec lifecycle state.
- [ ] 1.4 Add positive and negative tests for the pin, artifact enumeration, checkbox-only progress, semantic task drift, digest staleness, malformed/path-escaping records, bootstrap scope, parent/stage ordering, and the non-writing gate; keep the real documentation-child approval record absent until the user approves the exact validated revision.
- [ ] 1.5 After tasks 1.1-1.4 pass, create and revalidate the durable bootstrap record against the original source revision and decision reference; prohibit this exception for every child and later stage.

## 2. Documentation Structure and Governance Specification Gate

- [x] 2.1 Reverify the current documentation inventory, authority map, module boundaries, generated artifacts, and historical surfaces needed to compare target structures.
- [x] 2.2 Present two or three repository-specific documentation information architectures with exact trees, ownership, routing, lifecycle, OpenSpec boundaries, and migration trade-offs.
- [x] 2.3 Obtain explicit user approval for the target tree before authoring complete documentation-governance specs, design, or tasks.
- [x] 2.4 Create `rebuild-documentation-governance` and author its complete proposal, specs, design, and tasks from the approved structure.
- [x] 2.5 Ensure the child routes significant future changes through the approved OpenSpec entrypoints and records the boundary in the repository agent map.
- [ ] 2.6 Obtain user review of the exact child artifacts and record approval against their content digests.
- [ ] 2.7 Approve the child `tasks.md` as the only implementation task plan for the documentation-governance child after the separately bounded parent foundation is complete; do not create a parallel Plan artifact.
- [ ] 2.8 Apply the documentation-governance child change in verified batches under its own tasks.
- [ ] 2.9 Record user acceptance against the applied revision and verification evidence, then archive the child only after its blocking documentation gate is required and green.

## 3. Observability Stage Gate

- [ ] 3.1 After documentation governance is accepted, capture a fresh runtime and performance baseline.
- [ ] 3.2 Present two or three observability design options that preserve the approved self-hosted, local/CI/production isomorphism and per-worktree isolation invariants, and re-evaluate the preserved PreToolUse path-match spike as unapproved input.
- [ ] 3.3 Create, validate, and obtain user approval for `build-agent-observability` artifacts before apply.
- [ ] 3.4 Apply, verify, and obtain user acceptance for the approved observability child change.

## 4. Engineering Standards Stage Gate

- [ ] 4.1 After observability is accepted, capture a fresh repository-wide style, dependency, complexity, test, and architecture baseline.
- [ ] 4.2 Present two or three engineering-standards design options with automated and human-review trade-offs.
- [ ] 4.3 Create, validate, and obtain user approval for `enforce-engineering-standards` artifacts before apply.
- [ ] 4.4 Clear all in-scope legacy violations, apply blocking enforcement, and obtain user acceptance.

## 5. Final Documentation and CI Convergence

- [ ] 5.1 Propose and obtain user approval for the final documentation-convergence and unified-CI change.
- [ ] 5.2 Update maintained architecture, module, observability, standards, runbook, and testing documentation from implemented reality.
- [ ] 5.3 Verify living specs and archive completed child changes under OpenSpec conventions.
- [ ] 5.4 Enable the unified blocking CI only after every gate is green locally and in CI.

## 6. Parent Completion

- [ ] 6.1 Verify that all required child stages are accepted and no unapproved future behavior appears as current truth.
- [ ] 6.2 Run strict OpenSpec validation and the repository's full harness verification suite.
- [ ] 6.3 Obtain final user acceptance and archive `establish-agent-harness` last.
