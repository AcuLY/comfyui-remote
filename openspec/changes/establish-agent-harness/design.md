## Context

`comfyui-remote` has evolved into a large private control plane with two peer work modes: ComfyUI generation and LoRA Training. It already has a short `AGENTS.md`, workflow rules, documentation maps, a generated repository inventory, many source-contract tests, a structured logger, runtime status routes, and scattered architectural guards. Those pieces are useful but do not yet create a closed harness:

- documentation structure and semantics still drift;
- runtime performance cannot be traced end to end;
- code and module rules are not enforced repository-wide;
- there is no checked-in CI workflow covering the complete system;
- old design plans and current behavior are still easy for agents to conflate.

The approved program must start with documentation governance, preserve Training as a peer work mode, use OpenSpec for significant changes, keep later technical choices behind explicit stage approvals, and avoid mixing local/worktree/production observability data.

## Goals / Non-Goals

**Goals:**

- Establish a durable parent program for documentation governance, observability, engineering standards, and final convergence.
- Make the ordering and approval boundaries mechanically legible to agents.
- Separate current facts, approved targets, and historical intent.
- Use OpenSpec's upstream lifecycle while adding only repository-specific safety rules.
- Reach blocking gates through a clean hard cutover rather than permanent legacy exemptions.

**Non-Goals:**

- Select the detailed observability backend, sampling, retention, dashboards, or performance budgets now.
- Select the detailed formatter, dependency checker, complexity thresholds, or review matrix now.
- Treat the parent program as approval to apply future child stages.
- Convert scratch drafts or unverified historical content directly into living specs.
- Deploy any runtime change as part of authoring this program specification.

## Decisions

### 1. Use one parent change and just-in-time child changes

`establish-agent-harness` owns cross-stage invariants and stays active until all stages are complete. `rebuild-documentation-governance` is the first child and was created only after the target documentation information architecture was approved. Its exact proposal, specs, design, and tasks still require user review before apply. Observability, engineering standards, and final convergence receive detailed artifacts only after the preceding stage is accepted.

Each child change is verified and archived independently when its stage is accepted. The parent delta is a program completion contract: it is not partially synchronized into living specs, and it is archived only after the complete program is implemented. Current documentation records capabilities that have actually landed while the parent remains active.

**Rationale:** This keeps the program coherent without freezing later technical choices against an outdated baseline.

**Alternative considered:** Create all child changes immediately. Rejected because the user requires a fresh design review before each later stage and empty future artifacts would create false certainty.

**Alternative considered:** Partially synchronize the long-running parent delta after each stage. Rejected because partial synchronization could promote not-yet-implemented program requirements into living current truth; independently archived child specs provide the durable per-stage truth instead.

### 2. Follow OpenSpec for generic lifecycle behavior

OpenSpec owns artifact dependencies, its native status/validate/instructions/archive commands, the upstream agent apply/verify workflows, and generic recovery semantics. The repository adds checks only for explicit approval validity, documentation authority, deploy/queue safety, and telemetry isolation.

The repository pins `@fission-ai/openspec` exactly in `package.json` and the lockfile and
invokes the local binary through stable package scripts. A small, non-writing program gate
uses `openspec/changes/establish-agent-harness/program.json` only for repository-specific
parent/child stage ordering; it does not duplicate OpenSpec lifecycle state. Approval and
acceptance records live under the parent program's `approvals/**` and `acceptances/**`
directories. They bind an immutable full Git revision and the exact sorted proposal,
`specs/**/*.md`, design, and tasks artifact set, then hash canonical Git blob bytes so Windows
line-ending conversion cannot invalidate an otherwise identical revision. Candidate creation
fails if a normative artifact differs from the named revision. The gate can print an approval
candidate, but it never manufactures a user decision or performs apply, verify, or archive.

The gate stores the raw digest of the approved `tasks.md` snapshot and a second semantic plan
digest that normalizes only checkbox markers at already approved task positions. Apply may
toggle those markers to record progress; any task text, identity, order, nesting, addition, or
deletion changes the semantic digest and requires renewed approval.

Because this repository gate does not yet exist, parent foundation tasks 1.1-1.4 use one
bounded bootstrap path. The user must explicitly approve an immutable parent revision, those
four tasks, and a decision reference before implementation. Once the gate passes, it writes
and revalidates that bootstrap decision as a durable record. The exception cannot authorize
the documentation child, later stages, or any additional parent work.

**Rationale:** A parallel state machine would duplicate upstream behavior and drift as OpenSpec evolves.

**Alternative considered:** Implement a custom harness lifecycle. Rejected as unnecessary and contrary to the requested OpenSpec adoption.

### 3. Preserve three evidence categories

- Current behavior: source, schemas, tests, and required runtime evidence.
- Approved target: active, user-approved OpenSpec changes.
- Historical intent: Git history and original artifacts.

No category silently overrides another. A conflict becomes an explicit evidence or decision state.

**Rationale:** The repository contains old designs that are implemented, modified, partial, abandoned, or never built. Collapsing these states would corrupt living specs.

### 4. Apply stages serially

The order is documentation governance, observability, engineering standards, then final documentation/CI convergence. Each stage produces a trusted baseline consumed by the next.

**Rationale:** Observability and architectural rules need reliable domain and ownership maps; final documentation must describe the implementation that actually landed.

**Alternative considered:** Run all tracks in parallel. Rejected because cross-track vocabulary, module ownership, telemetry naming, and rule boundaries would diverge before the knowledge model stabilizes.

### 5. Require stage-specific approval

Approval of the brainstormed program authorizes drafting the parent and first child artifacts; it does not authorize apply. Every child, including documentation governance, requires explicit user review of its exact proposal, spec, design, and tasks before apply. The approval record binds the change identifier, artifact content digests, approval scope, and decision reference. Any post-approval semantic artifact content change invalidates the record and requires renewed approval.

Planning approval and stage acceptance are distinct repository-specific gates around the upstream OpenSpec lifecycle. Acceptance is recorded only after the approved revision is applied, required verification evidence is presented, and the user explicitly accepts the stage. These gates do not introduce a competing generic change state machine.

The exact approved tasks snapshot remains preserved even while apply records progress in the
live `tasks.md`. Only checkbox-state transitions at pre-existing task positions are normalized
for approval validity; every semantic plan edit requires renewed approval.

**Rationale:** The user explicitly requires design confirmation before each later phase, and the relevant baseline will change after each accepted stage.

### 6. Use hard-cutover enforcement per stage

Before implementation, each child enumerates its governed scope, violation inventory, non-writing proof command, and blocking surface. The stage clears all violations within that finite scope and then enables blocking enforcement. A CI workflow may run in trial mode while cleanup proceeds, but the stage is not accepted until the check is actually required. There is no permanent baseline allowance, ratchet exception, or warning-only mode.

**Rationale:** The requested target is one coherent standard across the whole repository rather than a long-lived two-tier system.

**Trade-off:** Upfront cleanup is larger and stage completion takes longer.

### 7. Fix observability invariants now, defer implementation choices

The future system must be self-hosted and implementation-identical locally, in CI, and on `mypc`: the same versioned instrumentation, telemetry schema, stack components, and query semantics are used, with only environment-specific configuration. Local, CI, and production reads and writes are isolated, and every worktree receives its own ports, collector, telemetry stores, service identifiers, and teardown lifecycle. CI receives the same isolation treatment and fails closed if it is configured with production endpoints, credentials, identities, or storage. The concrete products, deployment packaging, sampling, retention, dashboards, and budgets remain child-stage decisions.

The documentation child preserves the sanitized PreToolUse path-match spike only as
non-normative future-stage evidence. On 2026-07-11 the user separately authorized one narrow
successor experiment before documentation acceptance: a tracked project Hook and standard-
library recorder may write ignored repository-local NDJSON and aggregate JSON files, with no
service and no read/search/write taxonomy. This exception is outside documentation-governance
implementation and does not start or satisfy the observability stage. The later observability
child still decides whether any equivalent signal becomes durable harness instrumentation
after fresh cross-platform, concurrency, retention, privacy, overhead, and isolation design.
Both the archived spike and the successor signal mean only attempted path matching, never a
proven file read or comprehension metric.

**Rationale:** These are program constraints, not vendor choices. They ensure local agent validation can prove production behavior without contaminating production data.

## Program Data Flow

1. Documentation-architecture discovery compares repository-specific target trees and produces an explicitly approved information architecture.
2. The documentation-governance child is then fully specified from that approved structure and, when applied, reconstructs verified current documentation, deletes obsolete sources after extraction, preserves recovery through Git and OpenSpec archives, and enables blocking documentation checks.
3. The observability stage reads that ownership map, proposes a fresh design, and produces agent-queryable runtime evidence and performance baselines.
4. The engineering-standards stage uses the knowledge map and telemetry evidence to define repository-wide automated and manual rules.
5. Final convergence updates maintained docs and living specs from implemented reality, validates all changes, and activates unified blocking CI.

## Error Handling

- Generic change and recovery behavior follows the installed OpenSpec version.
- An unmet stage dependency blocks the later child change before apply.
- Any artifact content digest change invalidates repository-specific approval.
- Evidence conflicts remain explicit and do not get resolved by copying one source into another.
- Runtime-affecting work continues to obey existing queue, lock, build, restart, and verification rules.
- A defect discovered after archive is handled by a corrective change rather than rewriting history.

## Verification

- `openspec validate --all --strict --no-interactive` must pass for program artifacts.
- The planning artifacts are bootstrap-validated with `@fission-ai/openspec` 1.5.0 through `npx`; phase 1 replaces this bootstrap command with a repository-pinned, reproducible integration before apply.
- Program rules must have scenario coverage for ordering, approval, evidence boundaries, hard cutover, lifecycle delegation, and telemetry isolation.
- Each child change defines its own executable acceptance suite before apply.
- The parent change cannot archive until every required child stage is accepted and current documentation reflects the implemented system.

## Risks / Trade-offs

- **Long time to first full harness** → Keep child stages independently reviewable and commit in small verified batches.
- **OpenSpec upstream changes** → Pin the CLI/integration during phase 1 and update it through an explicit change.
- **Parent/child relationship is repository-specific** → Add a narrow validation rule instead of replacing OpenSpec's lifecycle.
- **Cross-platform digest drift** → Hash canonical Git blobs for an approved revision rather than line-ending-converted worktree bytes.
- **Hard cutover exposes large legacy debt** → Inventory and size the debt before implementation, but do not preserve permanent exceptions.
- **Later stages are underspecified today** → Treat their technology choices as deliberately deferred stage-gate decisions, not omissions in current specs.

## Migration Plan

1. Commit and strictly validate the parent revision that defines the bounded foundation.
2. Obtain explicit bootstrap approval for parent tasks 1.1-1.4 only, implement and verify the repository gate, then durably revalidate that decision.
3. Compare repository-specific documentation structures and obtain explicit user approval of the target information architecture.
4. Create `rebuild-documentation-governance` and write its complete proposal, specs, design, and tasks from that approved structure.
5. Obtain user review of the exact written child artifacts and record their normal-gate approval.
6. Apply and accept documentation governance without a parallel plan.
7. Propose each later child change at its approved stage gate.
8. Verify and archive the parent only after final convergence.

Rollback for this planning-only batch is removal of the newly introduced OpenSpec artifacts before they are adopted; it does not require runtime deployment or service changes.

## Documentation Impact

This parent change introduces OpenSpec as the future planning authority. It does not yet rewrite `AGENTS.md` or `docs/**`; those changes belong to the approved documentation-governance child after the target information architecture is co-designed.

## Deferred Stage Decisions

- Documentation directory structure: approved with the user on 2026-07-10 and formalized by `rebuild-documentation-governance`; later artifact edits still require exact-revision review before apply.
- Observability technologies and budgets: resolved by the observability stage proposal after documentation governance is accepted.
- Engineering tools and thresholds: resolved by the engineering-standards stage proposal after observability is accepted.
- Final documentation and unified CI cutover details: resolved by the final convergence proposal.
