## Why

The repository's documentation contains overlapping entrypoints, stale plans, prototype-only material, hand-maintained inventories, misplaced operational knowledge, and governance tests that sometimes preserve the old structure instead of proving current truth. Documentation governance must become a small, agent-legible system before observability or repository-wide engineering standards can be designed against it.

## What Changes

- **BREAKING**: Replace the current documentation layout with the approved root entrypoints and layered `docs/` structure, using short routers and progressive disclosure from `AGENTS.md` and `docs/README.md`.
- **BREAKING**: Split mandatory ordinary-development agent policy from operational procedure: make `AGENTS.md` the only ordinary-development workflow policy authority, move executable detail into `docs/runbooks/**`, then remove `agent-rules/**` without compatibility stubs.
- **BREAKING**: Extract every still-valid fact from `docs/archive/**`, update all consumers that incorrectly treat historical files as current authority, and then delete the entire archive rather than recreating it as `docs/history/**`.
- **BREAKING**: Delete the complete Training static-prototype surface under `docs/prototypes/**` and remove prototype-specific routing, inventory, and test contracts; production source and verified current documentation remain authoritative for Training as a peer work mode.
- Establish root `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `PRODUCT.md`, and `DESIGN.md` authority boundaries; keep the root design contract compatible with a separately approved future Impeccable integration.
- Establish current product, architecture, detailed design, and runbook layers; add honest placeholder contracts for `QUALITY_SCORE.md`, `RELIABILITY.md`, and `SECURITY.md` without inventing later-stage content.
- Add a minimal `docs/_meta/**` machine-governance control plane containing the documentation schema, structural/link policy, and authoring templates.
- Add one deterministic, non-writing documentation-check engine with full and safely bounded changed-scope modes, stable human/JSON diagnostics, and the same full blocking CI check for metadata, structure, entrypoint reachability, links, anchors, forbidden legacy paths, OpenSpec validity, source contracts, and owned generated-file freshness where generators already exist.
- Add an explicitly invoked repository Skill at `.codex/skills/docs-audit/**` as the single semantic-audit execution surface for stale claims, incomplete coverage, duplicate authority, invalid operational steps, and conflicts between source, tests, documentation, and historical intent. Ordinary development SHALL NOT auto-run it, and `AGENTS.md` SHALL NOT contain its rules or triggers.
- Reconstruct maintained documentation from current code, schemas, tests, Git history, and required runtime evidence; treat existing governance tests as changeable implementation inputs and rewrite or remove assertions that encode obsolete structure or incorrect authority.
- Keep existing generated and reference-like documents in their verified owner locations during this stage; do not introduce `docs/generated/**` or `docs/references/**` until operating evidence justifies that split through a later OpenSpec change.
- Use OpenSpec proposal, specs, design, tasks, verification, and archive artifacts as the only significant-change lifecycle; do not retain or create a parallel `PLANS.md`, `docs/plans/**`, or Superpowers planning authority.

## Capabilities

### New Capabilities

- `documentation-governance`: Defines the approved knowledge architecture, authority boundaries, verified migration and deletion rules, deterministic documentation gates, agent semantic-audit workflow, and local/CI enforcement contract.

### Modified Capabilities

None.

## Non-goals

- This change does not implement or select the later observability stack, performance budgets, engineering-standard tools, code-style thresholds, or final unified repository CI.
- This change does not install Impeccable or create its project skills, hooks, configuration, generated design sidecar, or critique reports.
- This change does not add a controlled `docs:read` CLI, documentation MCP gateway, scheduled semantic-audit job, or automatic `$docs-audit` trigger.
- This change does not install or productionize the preserved PreToolUse path-match spike; that evidence is transferred for fresh review by the later `build-agent-observability` change.
- This change does not create a new historical-document store; Git history and OpenSpec archives retain past artifacts after verified current knowledge is extracted.
- This change does not force a generated-versus-reference directory taxonomy before the harness has produced evidence that the distinction improves maintenance.
- Ignored `.tmp/**` drafts remain evidence for authoring and are never promoted directly into current truth.

## Related Changes

- Parent: `establish-agent-harness`.
- Future, separately approved changes: Impeccable integration, `build-agent-observability`, `enforce-engineering-standards`, and final documentation/CI convergence.

## Impact

- Affects root documentation, `AGENTS.md`, `CLAUDE.md`, `agent-rules/**`, `docs/**`, `.codex/skills/docs-audit/**`, OpenSpec configuration and parent artifacts, documentation scripts, package scripts, documentation/source-contract tests, and a checked-in documentation CI workflow.
- Removes `docs/archive/**`, `docs/prototypes/**`, legacy planning/spec surfaces outside OpenSpec, and all live references to those paths after verified extraction.
- Updates existing generated artifacts such as `docs/repo-inventory.md` and their generators in place; their directory taxonomy remains deferred.
- May update code or configuration references for non-document runtime assets incorrectly stored under `docs/**`, but any runtime-affecting migration remains subject to the repository's normal build, queue, deployment, and verification boundaries.
- Does not itself change Generation or Training product behavior.
