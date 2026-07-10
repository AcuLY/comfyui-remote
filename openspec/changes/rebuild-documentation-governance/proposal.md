## Why

The repository has a partial documentation-governance skeleton, but current truth, generated inventories, prototypes, implementation notes, and historical plans still conflict or drift. Before later harness stages can be designed reliably, the repository needs an agreed information architecture, executable semantic audit workflow, deterministic document gates, and evidence-backed migration of every historical design artifact.

## What Changes

- Co-design the repository-specific target documentation structure with the user before any migration mutation begins.
- Define machine-readable document identity, classification, ownership, authority, lifecycle, evidence, update triggers, and replacement relationships.
- Build a deterministic `docs:check` entrypoint for structure, links, anchors, reachability, generated-artifact freshness, OpenSpec validity, and source-derived contracts.
- Define an agent-executable semantic audit workflow for correctness, completeness, duplicate authority, partial implementation, stale runbooks, and current-versus-target confusion.
- Permit automatic repair only when one evidence-backed interpretation exists; escalate deletion, authority conflicts, product direction, partial implementation, and ambiguous evidence to the user.
- Freeze a complete governed-artifact baseline, semantically audit every current document, and migrate every historical planning, design, operational, prototype, handoff, progress, analysis, and retained attachment artifact through a repository-owned OpenSpec historical-migration schema after validating it against current code, tests, schemas, Git history, and required runtime evidence.
- Remove duplicate current authority after migration and enable documentation-specific blocking CI only after all existing documentation violations are cleared.

## Capabilities

### New Capabilities

- `documentation-governance`: Defines the agent-legible knowledge architecture, deterministic document gates, semantic audit protocol, verified historical migration, and documentation CI contract.

### Modified Capabilities

None.

## Non-goals

- The target directory tree is not preselected by this proposal; it requires a dedicated user-approved design workshop at the start of the change.
- This change does not implement the observability or engineering-standards stages.
- Historical material is not assumed to be correct, implemented, or suitable for living specs merely because it is migrated.
- The deep repository-understanding drafts in `.tmp` remain scratch evidence and are not promoted directly.

## Related Changes

- Parent: `establish-agent-harness`.
- Successor proposals: `build-agent-observability`, then `enforce-engineering-standards`, each created only after its stage gate.

## Impact

- Affects `AGENTS.md`, `agent-rules/**`, repository documentation, OpenSpec configuration and archives, documentation generators, governance tests, and CI.
- Retires the old `docs/superpowers/specs/**` planning model for new work after verified migration.
- May move, rewrite, archive, or remove historical documentation only after evidence review and required user decisions.
- Requires externally verifiable CI runs and required-check configuration before the documentation gate can be called blocking.
