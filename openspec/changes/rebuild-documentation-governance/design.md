## Context

The repository already has a partial documentation system: `AGENTS.md`, `agent-rules/**`, `docs/index.md`, `docs/documentation-map.md`, `docs/repo-inventory.md`, generator scripts, and governance tests. Current inspection still found structural and semantic gaps:

- some archived material lacks reliable replacement metadata or still claims to be current;
- local Markdown links are broken;
- inventory classification uses path heuristics that can disagree with document declarations;
- prototype retention intent conflicts with generic archive actions;
- API documentation can pass existing tests while methods or request fields drift from source;
- generators lack a non-writing check mode and there is no checked-in CI workflow;
- a 2026-07-10 Node 22 audit found a stale documentation-path expectation in `tests/test-training-api-routes.test.ts`; implementation must reverify rather than assume that transient failure still exists.

The deep repository-understanding drafts provide useful evidence but remain ignored scratch files. The final documentation structure must be co-designed with the user before migration, and all old specs, plans, PRDs, and prototypes must be verified rather than copied.

## Goals / Non-Goals

**Goals:**

- Agree on a repository-specific information architecture before any migration mutation.
- Make document identity, authority, evidence, lifecycle, and update triggers machine-readable.
- Build deterministic, non-writing document validation and blocking documentation CI.
- Define an agent-executable semantic audit and evidence-backed repair workflow.
- Validate and migrate every historical design artifact into OpenSpec history without polluting living specs.
- Leave one maintained authority for each current workflow or behavior.

**Non-Goals:**

- Preselect the final directory tree without the required user workshop.
- Implement observability or engineering-standards tooling.
- Promote all historical intent into future work.
- Treat passing structural checks as proof of semantic correctness.
- Deploy the application during documentation-only work.
- Build a general browser/runtime evidence service or the later observability platform; this stage only invokes existing browser/runtime verification through narrow documentation-audit contracts when static evidence is insufficient.

## Decisions

### 1. Co-design the documentation blueprint first

The first implementation task is a structured workshop that presents two or three concrete target trees and resolves classes, naming, owners, authority, routing, lifecycle, and OpenSpec/docs boundaries. The approval record binds the exact blueprint digest, scope, and user decision reference. Any blueprint content change invalidates approval until the user approves the new revision.

Before valid approval, only read-only inventory, evidence collection, option authoring, and planning-artifact validation are allowed. A migration mutation means moving, deleting, reclassifying, changing current authority, rewriting governed content, or assigning a final migration disposition to an existing artifact; all such mutations remain blocked before approval.

**Rationale:** Moving documents before agreeing on their durable homes would repeat the current inconsistency at a different path.

**Alternative considered:** Adopt the OpenAI article's example tree verbatim. Rejected because this repository has specific generation/training domains, operational rules, prototypes, generated inventories, and historical migration requirements.

### 2. Separate deterministic validation from semantic audit

`docs:check` owns facts that software can prove: parsing, metadata, graph reachability, links, anchors, generated output, OpenSpec validity, and source-derived contracts. The agent audit owns meaning: accuracy, completeness, authority, implementation status, and runbook semantics.

**Rationale:** Mixing these layers would either make CI nondeterministic or falsely claim that a linter understands product meaning.

### 3. Model document identity explicitly

The approved blueprint will define an explicit or directory-inherited metadata schema for document class, status, owner, normalized authority subject/kind/scope, update trigger, evidence requirement, replacement, and validation state. The generated inventory becomes a derived view rather than an independent heuristic authority. Authority uniqueness is evaluated by the normalized key and permitted cross-layer relationships, so complementary contracts, runbooks, and living specs are not mistaken for duplicates.

**Rationale:** Current path-substring classification can disagree with document declarations and cannot express why a prototype is retained.

### 4. Make every generator support check mode

Documentation generators compute output in memory, write only in generate mode, and compare exact output in check mode. Package scripts expose a single deterministic entrypoint used by local agents and CI.

**Rationale:** A generator that always writes cannot prove that committed output was already current.

### 5. Generate volatile contracts and hand-maintain semantics

Routes, methods, request fields, response envelopes, schema compatibility, MCP registries, and similar inventories are extracted or verified from source. Human documentation explains authentication, workflow semantics, exceptions, ownership, and operational risk while linking to generated contracts.

**Rationale:** Existing regex guards can keep counts synchronized while still missing method and field drift.

### 6. Use a structured semantic audit record

Each audit records document identity, claim category (`current-implementation`, `approved-target`, or `historical-intent`), claims, evidence, implementation status, conflicts, missing coverage, confidence, proposed action, actor identity, and user questions. Defined states include `evidence-conflict`, `runtime-verification-required`, `user-decision-required`, and `blocked-by-invalid-structure`.

**Rationale:** A structured record is reviewable, can be validated mechanically, and prevents uncertainty from disappearing into prose.

### 7. Allow only uniquely determined automatic repairs

An audit agent may repair unique broken paths, generator-owned drift, missing metadata, unambiguous archive banners, and explicit Git renames. A semantic content claim is eligible only when it is explicitly categorized as `current-implementation`, confidence is high, no conflict or unresolved state exists, and current evidence proves exactly one correction. Automatic repair never changes the meaning of `approved-target` or `historical-intent` claims. Authority conflicts, deletion, product direction, partial implementation, module ownership, or multi-interpretation evidence require the user.

An independent verifier with a different recorded agent/context identity reviews every automatic semantic repair and re-reads the original evidence rather than relying only on the repairer's summary.

**Rationale:** This preserves speed for mechanical fixes without letting one agent silently choose product truth and then approve itself.

### 8. Migrate all historical artifacts through a dedicated schema

Phase 1 introduces a project-local `historical-migration` OpenSpec schema. A frozen baseline manifest gives every governed artifact a stable identifier and content digest. Current documents receive exactly one semantic-audit disposition; every historical artifact and retained attachment receives exactly one migration-ledger disposition. The historical artifacts capture origin, intent, evidence, status, divergence, decision, attachments, and current-spec impact without tracking unfinished historical work as new implementation tasks.

**Rationale:** The default spec-driven schema is appropriate for future changes but does not express the difference between implemented, drifted, partial, abandoned, and never-built history.

### 9. Use evidence-appropriate verification depth

Source, tests, schemas, and Git history form the default evidence. UI, performance, worker, and operational claims escalate to browser or runtime verification when static evidence is insufficient. Missing runtime capability blocks promotion of that claim but does not force unrelated documents to stop.

**Rationale:** Requiring runtime proof for every prose fact is wasteful, while static-only review would overstate runtime truth.

### 10. Hard-cutover documentation CI after cleanup

All documentation violations, migration decisions, generated drift, audit-registry entries, and migration-ledger entries are complete and resolved before documentation checks become blocking. CI must run the same non-writing `docs:check` in a clean checkout; acceptance requires a successful run, evidence that a representative negative case fails, a restored successful run, and proof that the check is required on every protected merge path. If repository settings cannot be changed with available authority, the gate remains incomplete and is reported as an external/user action rather than being called blocking. No permanent legacy allowlist remains after activation.

**Rationale:** The user selected a coherent hard cutover rather than a long-lived two-standard repository.

## Components

The exact paths are decided by the approved documentation blueprint, but the system has these logical components:

1. **Document manifest resolver** — resolves identity and inherited metadata.
2. **Knowledge graph builder** — builds routing, authority, replacement, code-owner, and cross-link edges.
3. **Deterministic gate runner** — runs metadata, link, anchor, reachability, generator, OpenSpec, and contract checks.
4. **Semantic audit runner** — gives agents the evidence protocol and structured report schema.
5. **Repair coordinator** — applies only uniquely supported fixes and routes judgment calls to the user.
6. **Independent verifier** — re-checks semantic repairs and deterministic output.
7. **Historical migration pipeline** — creates validated OpenSpec history and living-spec impact where justified.
8. **Migration ledger** — tracks every source artifact to its final status and authority.
9. **Approval verifier** — binds blueprint and change approvals to exact artifact revisions and blocks stale approvals.
10. **CI gate verifier** — proves clean-checkout execution, negative failure behavior, recovery, and required-check configuration.

## Data Flow

`tracked documents and OpenSpec artifacts`
→ manifest resolution
→ knowledge graph and source mappings
→ deterministic checks
→ semantic claim extraction and evidence gathering
→ automatic repair or user decision
→ historical migration/current-doc rewrite
→ independent verification
→ non-writing `docs:check`
→ blocking documentation CI.

## Error Handling

- Invalid structure blocks semantic migration until repaired.
- Evidence conflicts are recorded and escalated; the agent does not select a winner.
- Unavailable required runtime evidence marks only the affected claim as not promotable.
- A high-confidence repair records evidence and before/after state.
- A scope or authority decision waits for the user.
- A blueprint digest change invalidates approval and re-blocks all migration mutations.
- Missing or duplicate baseline, audit-registry, or migration-ledger entries block cutover.
- Missing repository permission for required-check configuration is an explicit external-action blocker, not a successful CI cutover.
- A post-migration defect is corrected through a new OpenSpec change rather than rewriting archived evidence.
- Git and deployment handling continues to follow repository rules; documentation-only batches do not deploy.

## Verification

- Unit tests cover metadata inheritance, path normalization, graph construction, anchor parsing, replacement rules, and generator check mode.
- Positive and negative fixtures cover broken links, orphan current docs, invalid classes, generated drift, duplicate authority, prototype/history leakage, API contract drift, invalid OpenSpec promotion, stale approval, and missing audit evidence.
- `openspec validate --all --strict --no-interactive` validates active and living specs.
- Focused documentation tests pass before the full repository suite.
- The final `docs:check` command is non-writing and produces the same result locally and in CI.
- A clean `git diff` after check mode proves validation did not regenerate tracked artifacts.
- Baseline-to-audit and baseline-to-migration reconciliation proves zero missing, duplicate, stale-digest, or unresolved records.
- CI evidence includes clean-checkout success, controlled negative failure, restored success, and required-check configuration on protected merge paths.

## Risks / Trade-offs

- **Full historical migration is large** → Use a generated inventory, narrow batches, explicit status, and resumable ledger.
- **Semantic audit can be inconsistent** → Constrain it with evidence precedence, structured output, confidence rules, fixtures, and independent verification.
- **Exact information architecture is not yet selected** → Make user approval of the blueprint the first hard gate rather than embedding a speculative tree here.
- **Hard cutover may expose extensive stale content** → Size the work before moves, but do not preserve permanent exceptions.
- **Old prototypes include non-Markdown assets** → Let the approved blueprint define retained attachment locations while migration records preserve origin and reference value.
- **Source-derived API extraction may be incomplete** → Validate extraction against representative route patterns and keep explicit exception contracts.

## Migration Plan

1. Baseline every governed current document, historical artifact, and retained attachment using `git ls-files`, stable identifiers, and content digests.
2. Present target documentation structures and obtain user approval bound to the exact blueprint revision.
3. Implement metadata, manifest, graph, and generator check-mode foundations.
4. Implement semantic audit schema, repair boundaries, verification, and decision queue.
5. Implement and validate the `historical-migration` OpenSpec schema.
6. Audit every current document and migrate every historical artifact in bounded domain batches, resolving user decisions as they arise and reconciling exactly once to the baseline.
7. Rewrite current entrypoints and owner docs from verified evidence.
8. Remove duplicate authority and regenerate derived artifacts.
9. Run focused checks, the full repository suite, OpenSpec strict validation, and non-writing diff checks.
10. Prove clean-checkout success, negative failure, restored success, and required-check configuration; then request stage acceptance.

Rollback is batch-scoped: preserve each pre-migration path in Git history, keep commits narrow, and revert only the current failed batch. Do not use broad destructive worktree commands or mix unrelated edits.

## Documentation Impact

This change intentionally affects the whole documentation system, but exact paths and moves are outputs of the approved blueprint. `AGENTS.md` remains short; maintained detail moves to approved owner docs. Existing `docs/superpowers/specs/**`, plans, PRDs, prototypes, and archives are not removed until their migration ledger entries and replacement authorities are verified.

## Deferred Decision with Explicit Gate

The final target documentation directory tree is chosen with the user in task group 1 before any migration mutation. This is an intentional product decision gate, not an unresolved implementation gap.
