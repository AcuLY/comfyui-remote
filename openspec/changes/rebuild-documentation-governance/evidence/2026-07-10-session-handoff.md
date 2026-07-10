# Agent harness design handoff — 2026-07-10

## Status and continuation

Work was paused at the user's request before documentation-governance apply. This
handoff preserves decisions, evidence, open questions, and the isolated hook spike so
the design can continue on another device without relying on conversation context.

- Branch: `codex/harness-doc-governance-handoff-20260710`
- Base commit: `74080ce3` (`docs: specify documentation governance rebuild`)
- Runtime/deployment: not touched
- Formal child apply: not started
- Handoff evidence: non-normative until incorporated into the active OpenSpec artifacts

Resume by reading, in order:

1. `openspec/changes/establish-agent-harness/{proposal.md,specs/agent-harness/spec.md,design.md,tasks.md}`
2. `openspec/changes/rebuild-documentation-governance/{proposal.md,specs/documentation-governance/spec.md,design.md,tasks.md}`
3. this handoff
4. `evidence/pretooluse-file-access-poc/README.md`

## Program goal and boundaries

The repository is being rebuilt around an AI-agent-friendly harness inspired by
OpenAI's harness-engineering article. The requested program has three main capability
tracks followed by convergence:

1. documentation governance and verified historical migration;
2. agent-friendly observability, including performance diagnosis;
3. repository-wide engineering standards for TypeScript, React, other languages, and
   module-level architecture;
4. final documentation synchronization and unified CI convergence.

The stage order is mandatory. Each later stage receives a fresh design review before
its implementation. Observability must use the same versioned implementation locally
and on `mypc`, while isolating local, production, CI, and every worktree's reads,
writes, ports, stores, identities, and teardown lifecycle.

OpenSpec is the sole significant-change lifecycle. There is no parallel `PLANS.md`,
ExecPlan, Superpowers plan, or hand-maintained implementation-plan system. This file
is a handoff/evidence record, not another plan authority.

## Confirmed documentation architecture decisions

The complete approved tree is recorded in the child `design.md`. Important decisions
that must not be lost are:

- Root entrypoints are `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `PRODUCT.md`, and
  `DESIGN.md`; `CLAUDE.md` remains a thin compatibility pointer.
- `docs/README.md` and directory `README.md` files provide progressive disclosure.
- Detailed current product knowledge lives under `docs/product/**`.
- Detailed current design knowledge lives under `docs/design/**`; root `DESIGN.md`
  remains the design map/context file and can later be adapted for Impeccable.
- Detailed architecture uses `docs/architecture/**`. The prior `design-docs` naming was
  rejected to avoid collision with root `DESIGN.md`.
- There is no root or docs-level `FRONTEND.md`; future Impeccable integration owns any
  additional frontend/design context it requires.
- There is no `PLANS.md` or ExecPlan system. OpenSpec proposal/spec/design/tasks/apply/
  verify/archive is the only significant-change workflow.
- `docs/runbooks/**` owns executable operational procedures after verification.
- `agent-rules/**` is split into concise hard policy in `AGENTS.md` and detailed
  procedures in runbooks, then deleted atomically with all consumers updated.
- `docs/archive/**` is reviewed, valuable current facts are extracted, and the entire
  directory is deleted. No `docs/history/**` replacement is introduced.
- All current Training prototypes are discarded after proving production has no
  dependency on their assets. Training itself remains a production work mode peer to
  Generation, selected through the shared navigation mode toggle.
- `docs/generated/**` versus `docs/references/**` is deliberately deferred until the
  harness has operating evidence.
- `docs/QUALITY_SCORE.md`, `docs/RELIABILITY.md`, and `docs/SECURITY.md` begin as honest
  deferred placeholders only.
- Existing governance tests may be rewritten or deleted where they encode obsolete
  structure instead of current truth.
- Impeccable installation, generated files, hooks, detectors, and root `DESIGN.md`
  schema conversion remain a later independent OpenSpec change.

The ignored repository-understanding drafts remain useful factual input but are not
tracked truth:

- `.tmp/repo-understanding-deep-2026-07-08.md`
- `.tmp/repo-understanding-2026-07-08.md`

Every claim migrated from them must be revalidated against code, schemas, tests,
runtime evidence when required, and Git history. Uncertain current behavior or product
intent must be presented to the user rather than silently resolved.

## Documentation quality-gate design state

The existing child already requires a deterministic, non-writing `npm run docs:check`
locally and in CI plus a semantic documentation audit. A subsequent audit identified
the following useful refinements; they have not yet been incorporated into the formal
child artifacts:

- one check engine with a fast changed-scope mode and a full acceptance mode;
- stable `error`, `warning`, and semantic-audit finding classes;
- exact source mappings split into machine-provable `contract` relationships and
  semantic `review` triggers;
- deterministic blockers for metadata/profile validity, allowed topology, required
  directory landing pages, internal links and anchors, navigation reachability,
  declared authority conflicts, forbidden live paths, generator freshness, pinned
  OpenSpec validation, and non-writing behavior;
- external links, age heuristics, suspected duplicates, and prose quality must not
  become flaky deterministic blockers;
- stable human and JSON diagnostics with rule ID, severity, repository-relative path,
  location, evidence, remediation, owner, deterministic ordering, and distinct rule
  versus tool-failure exit codes;
- local non-writing proof compares before/after worktree state rather than requiring an
  initially clean user worktree; CI additionally starts and ends clean;
- the required documentation job runs on every protected merge path without a docs-only
  path filter because source changes can invalidate documentation contracts.

The repository currently has no `docs:check` script and no checked-in GitHub Actions
workflow. The current repo-inventory test is already stale because the new OpenSpec
files are not in its generated output. Existing generators write directly and need a
pure render/check path before they can participate safely in CI.

## Confirmed semantic-audit interaction decision

The user explicitly rejected placing semantic-audit triggers or rules in `AGENTS.md`
because that would add noise to normal development.

The selected interaction is option B: an explicitly invoked repository Skill, such as
`$docs-audit`. It is not automatically required during ordinary development. The Skill
may call deterministic scope-selection and evidence scripts, but the semantic judgment
remains in the Skill workflow. Scheduled execution can be designed later without
turning normal tasks into mandatory audit sessions.

Do not implement a custom controlled `docs:read` CLI or documentation MCP gateway. The
user rejected that approach.

## File-access observability decision

The metric semantics changed from "document read frequency" to the more defensible
"repository file access frequency". The intended source is a coarse Codex
`PreToolUse` hook that observes supported tool calls and records calls whose structured
arguments or shell command contain paths resolving inside the current repository.

Requirements confirmed in conversation:

- record repository-local file-related calls broadly, not only Markdown reads;
- avoid `AGENTS.md` instructions and a controlled read gateway;
- remain completely offline and independent of a running application, metrics server,
  collector, or dashboard service;
- store raw events and derived statistics in ignored local directories such as
  `logs/**` and `stats/**`;
- later local/`mypc` and worktree layouts must remain implementation-identical and
  data-isolated.

The exact production directory names, retention, rotation, per-worktree identity,
concurrency strategy, and whether this belongs to documentation governance or the later
observability child remain open. Do not silently choose them during apply.

## PreToolUse spike result

The spike in `evidence/pretooluse-file-access-poc/` was developed test-first in an
ignored nested Git repository and then exercised with the installed
`codex-cli 0.142.5`.

Unit verification:

```text
python3 -m unittest -v test_file_access_hook.py
Ran 7 tests
OK
```

Covered behavior:

- `sed ... docs/guide.md` becomes a `read` event for `docs/guide.md`;
- `rg ... docs` becomes a `search` event for directory scope `docs`;
- `apply_patch` update becomes a `write` event for the existing file;
- `apply_patch` add recognizes a not-yet-existing `planned-file` path;
- a structured MCP `read_file` argument becomes a `read` event;
- raw events append to NDJSON without a service;
- NDJSON aggregates into offline JSON statistics.

The first real Codex run executed all requested tools but produced no log. Root cause:
it used `--ignore-user-config`, which also removed the saved project-trust decision;
project-local hooks are gated before individual hook-script trust is considered.
`--dangerously-bypass-hook-trust` bypasses hook hash review but does not independently
enable an untrusted project config layer.

A second diagnostic run loaded user configuration but inherited the user's configured
`gpt-5.6-sol`, which this CLI reported as requiring a newer Codex version. The successful
test therefore used the locally listed `gpt-5.4-mini` explicitly. This model mismatch is
incidental environment evidence, not a harness design decision.

Successful isolated run:

```text
codex --dangerously-bypass-hook-trust \
  -C . -s workspace-write -a never \
  exec --ephemeral -m gpt-5.4-mini --json \
  "run pwd; read docs/guide.md with sed; search docs with rg; edit notes.txt with apply_patch"
```

Observed result:

- `pwd` produced no file-access event, as desired;
- `sed` produced one `Bash/read/docs/guide.md` event;
- `rg` produced one `Bash/search/docs` event;
- `apply_patch` produced one `apply_patch/write/notes.txt` event;
- three events were appended to `logs/file-access.ndjson`;
- aggregation generated `stats/file-access.json` with three paths and one access each;
- neither hook path stored raw commands, prompts, tool outputs, file contents, absolute
  paths, usernames, environment variables, or the raw Codex session ID.

The successful run also proves that automatic `AGENTS.md` loading is not represented by
this hook path: only supported tool calls were observed.

## Interpretation and limitations

The PoC establishes feasibility, not production readiness.

- A `PreToolUse` event means an access attempt was requested, not that execution
  succeeded. If the product metric is named `file_access_frequency`, its documentation
  must preserve this attempted-access qualification unless a later success signal is
  joined.
- A shell hook receives a command string, not the set of files actually opened by the
  process. `rg docs` can honestly record directory scope `docs`, but not every file the
  process scans.
- Shell variables, command substitution, scripts, complex pipelines, globs, symlinks,
  and unusual quoting can create false negatives or false positives.
- Structured MCP path arguments are easier to classify, but the user does not want a
  custom documentation MCP gateway.
- Only repository-contained paths are retained. Outside paths are deliberately dropped.
- The NDJSON prototype uses one small `O_APPEND` write per event. Cross-process behavior
  on Windows, crash tolerance, rotation, malformed-line recovery, and high-volume
  overhead were not tested.
- The matcher `"*"` means all hook-supported tool calls, not every possible Codex action.
- Hook configuration requires both a trusted project layer and a trusted hook definition
  (or an explicit test-only bypass).
- The local test caused Codex to persist a trust entry for the ignored PoC path in the
  original device's `~/.codex/config.toml`. It is not part of this branch and can be
  removed after the spike directory is discarded.

Use names such as `file_access_attempt_total`, `file_access_scope_total`, or
`pretooluse_path_match_total`; do not claim filesystem-complete reads or human/model
comprehension.

## Current artifacts and authority

Formal, already committed and pushed artifacts:

- parent change: `openspec/changes/establish-agent-harness/**`
- documentation child: `openspec/changes/rebuild-documentation-governance/**`
- base commit: `74080ce3`

New handoff branch artifacts:

- this handoff;
- non-normative hook source and tests;
- exact hook configuration shape used by the spike;
- sanitized event and aggregate examples.

No root documentation, `agent-rules/**`, current `docs/**`, product code, runtime service,
database, deployment state, or `mypc` state was changed during this session.

## Recommended next actions after resume

1. Review this handoff and the spike; do not treat sample code as approved production code.
2. Decide whether file-access logging belongs in the current documentation child or is
   only an input to the later `build-agent-observability` child, preserving stage order.
3. Decide the exact `$docs-audit` Skill contract: invocation syntax, supported scopes,
   evidence precedence, report location, user-escalation boundary, and scheduling owner.
4. Decide offline log/store mechanics and retention after cross-platform concurrency and
   overhead tests.
5. Revise the active OpenSpec artifacts to incorporate only the accepted decisions:
   independent Skill audit, no `AGENTS.md` audit rule, no controlled read gateway, and
   accurately qualified file-access telemetry.
6. Run strict OpenSpec validation and present the exact revised artifacts for user review
   before apply.

Do not begin documentation migration, observability implementation, engineering
standards, Impeccable integration, deployment, or production instrumentation merely
because this handoff exists.
