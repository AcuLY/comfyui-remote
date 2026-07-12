## Why

The repository already contains useful agent rules, documentation maps, tests, and logging pieces, but they do not form a coherent harness that keeps knowledge current, makes runtime behavior queryable, and enforces repository-wide architecture. A staged, evidence-backed program is needed so agent throughput can increase without multiplying stale documentation, opaque performance failures, or structural drift.

## What Changes

- **BREAKING**: Adopt OpenSpec as the required lifecycle for significant feature, architecture, performance, and engineering-policy changes.
- Establish a parent harness program with documentation governance first, observability second, engineering standards third, and documentation/CI convergence last.
- Require each later stage to present a fresh proposal, spec, design, and tasks for explicit user approval before apply.
- Require local, CI, worktree, and production verification to use agent-legible evidence while preserving strict data isolation.
- Treat self-hosting, implementation-identical local/CI/production observability, per-worktree isolation, and hard-cutover enforcement as approved program constraints; later child changes still choose the concrete stacks and thresholds.
- Require repository-specific checks only where OpenSpec itself does not cover domain constraints such as stage ordering, deployment safety, queue handling, documentation authority, and telemetry isolation.
- Keep generic artifact dependencies, apply, verify, archive, and recovery behavior aligned with the installed OpenSpec version rather than inventing a parallel lifecycle.

## Capabilities

### New Capabilities

- `agent-harness`: Governs the repository-wide harness program, stage ordering, approval boundaries, evidence rules, and cross-stage completion contract.

### Modified Capabilities

None.

## Non-goals

- This parent change does not choose the detailed observability stack or engineering-rule toolchain.
- This parent change does not authorize applying observability or engineering-standards work before their separate approvals.
- This parent change does not promote scratch drafts or unverified historical designs into current truth.

## Related Changes

- `rebuild-documentation-governance` is the first child and is authored from the repository-specific documentation information architecture approved on 2026-07-10. The user authorized its OpenSpec apply workflow on 2026-07-12.
- `build-agent-observability` will be proposed only after documentation governance is accepted.
  Its fresh design SHALL re-evaluate the non-normative PreToolUse path-match spike preserved
  by the documentation child; the spike is evidence, not approved instrumentation.
- `enforce-engineering-standards` will be proposed only after the observability stage is accepted.

## Impact

- Adds repository-local OpenSpec configuration and change artifacts.
- Will eventually affect `AGENTS.md`, `agent-rules/**`, `docs/**`, documentation tooling, CI, runtime observability, and code-quality enforcement through separately approved child changes.
- Does not change application runtime behavior in this parent proposal.
