# Agent harness design handoff — 2026-07-10

## Status and continuation

Work was paused at the user's request before documentation-governance apply. This
handoff preserves decisions, evidence, open questions, and the isolated hook spike so
the design can continue on another device without relying on conversation context.

- Branch: `codex/harness-doc-governance-handoff-20260710`
- Base commit: `74080ce3` (`docs: specify documentation governance rebuild`)
- First handoff commit: `d5ff645c` (`docs: preserve harness design handoff`), pushed
- Runtime/deployment: not touched
- Formal child apply: not started
- Handoff evidence: non-normative until incorporated into the active OpenSpec artifacts
- Target information architecture: approved
- Exact child artifact digest approval: not recorded; parent tasks 2.6 and 2.7 remain open
- Parent OpenSpec pin, approval-record, and stage-order prerequisites: not implemented

Resume by reading, in order:

1. `openspec/changes/establish-agent-harness/{proposal.md,specs/agent-harness/spec.md,design.md,tasks.md}`
2. `openspec/changes/rebuild-documentation-governance/{proposal.md,specs/documentation-governance/spec.md,design.md,tasks.md}`
3. this handoff
4. [`session-materials/README.md`](session-materials/README.md), then its decision and
   information-architecture drafts
5. [`pretooluse-file-access-poc/README.md`](pretooluse-file-access-poc/README.md)

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

## Decision status matrix

| Topic | Status | Continuation rule |
| --- | --- | --- |
| Harness program order and OpenSpec-only significant-change lifecycle | Confirmed | Preserve documentation governance, observability, engineering standards, then convergence. |
| Documentation information architecture, authority split, archive/prototype removal, and deferred directories | Confirmed target | The exact written child artifacts still require digest-bound review before apply. |
| Fast/full docs checks, diagnostic levels, `contract`/`review`, and detailed parser semantics | Audit proposal, not yet formal | Reconcile with the current child spec/design/tasks before seeking artifact approval. |
| Explicit `$docs-audit` Skill; no audit rules in `AGENTS.md`; no controlled `docs:read` or docs MCP gateway | Confirmed interaction choices | Resolve the remaining Skill-versus-runbook artifact conflict before apply. |
| Coarse, offline PreToolUse path-match experiment and data isolation | Confirmed experiment boundary | Treat as attempted-access evidence only; production design and stage ownership remain open. |
| Impeccable installation and schema/tool coupling | Deferred independent change | Do not install or reshape root `DESIGN.md` in this child. |
| Observability, engineering standards, and final convergence implementation details | Not yet designed | Present each stage's fresh repository-validated design to the user before its artifacts/apply. |

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

The original ignored drafts have now been preserved under tracked, non-normative
evidence so another device receives the complete factual and decision inputs:

- [`session-materials/harness-design-decisions-2026-07-10.md`](session-materials/harness-design-decisions-2026-07-10.md)
- [`session-materials/harness-docs-ia-draft-2026-07-10.md`](session-materials/harness-docs-ia-draft-2026-07-10.md)
- [`session-materials/repo-understanding-deep-2026-07-08.md`](session-materials/repo-understanding-deep-2026-07-08.md)
- [`session-materials/repo-understanding-2026-07-08.md`](session-materials/repo-understanding-2026-07-08.md)

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

The formal reconciliation still needs to define governed scope and exclusions (including
OpenSpec, project skills, `src/**.md`, and testing documentation), exact fast-to-full
escalation rules, the `contract`/`review` disposition carrier, GFM anchor and code-block
semantics, legacy live-reference parsing, external-link behavior, diagnostic exit codes
`0/1/2`, and the difference between local before/after non-writing proof and clean-CI
absolute cleanliness. Warnings may cover only heuristic facts that cannot be proved
deterministically; they must not downgrade an existing required contract. Every warning
and semantic finding must receive an explicit disposition before stage acceptance.

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

The existing proposal/spec/design/tasks still describe
`docs/runbooks/documentation-audit.md` as the executable workflow. This conflicts with
the confirmed Skill interaction and must be reconciled before artifact approval. A
supporting runbook may remain reference material only if the Skill is unambiguously the
single invocation surface. Although ordinary development does not automatically invoke
the audit, documentation migration batches, archive/prototype deletion, authority
cutovers, and final stage acceptance must explicitly run the approved semantic audit.

Do not implement a custom controlled `docs:read` CLI or documentation MCP gateway. The
user rejected that approach.

## File-access observability decision

The requested metric moved away from "document read frequency". The defensible PoC
semantics are `file_access_attempt_total` or `pretooluse_path_match_total`: a coarse
Codex `PreToolUse` hook observes supported tool calls and records calls whose structured
arguments or shell command contain paths resolving inside the current repository. It
does not prove that the tool succeeded or that a file was actually opened or understood.

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
observability child remain open. The current child explicitly excludes observability
implementation. Decide ownership first; if it belongs to observability, keep this PoC
only as future-child input and do not expand the current child's normative scope.

## PreToolUse spike result

The spike now preserved in
[`pretooluse-file-access-poc/`](pretooluse-file-access-poc/README.md) was developed
test-first in an ignored nested Git repository and then exercised with the installed
`codex-cli 0.142.5`. The tracked directory is a sanitized copy; it deliberately excludes
the nested `.git`, real logs/session hash, Python cache, mutated runtime files, and the
original machine's trust entry.

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

The tracked evidence includes sanitized initial fixture files and exact source/config
shapes. It is sufficient for the seven Python tests and offline aggregation. A fresh
device still needs its own project-trust bootstrap and an account-available model for a
manual Codex E2E. Windows was not tested, the POSIX hook has no `commandWindows`, and a
deterministic one-command cross-platform assertion remains future work.

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
- first handoff commit: `d5ff645c`

New handoff branch artifacts:

- this handoff;
- the complete decision log, information-architecture draft, and both repository-
  understanding drafts under `session-materials/**`;
- non-normative hook source and tests;
- exact hook configuration shape used by the spike;
- sanitized fixture files used by the spike;
- sanitized event and aggregate examples.

## Verification baseline at handoff

- Focused governance command:
  `node --import tsx --test tests/test-documentation-governance.test.ts tests/test-repo-inventory.test.ts tests/test-prisma-schema-compatibility-doc.test.ts`.
  It currently reports 16 passes and one expected pre-apply failure because
  `docs/repo-inventory.md` does not include the new OpenSpec/evidence paths.
- The complete `npm test` suite was not run for this evidence-only handoff.
- Repository-pinned OpenSpec does not exist yet; parent task 1.1 remains open. Bootstrap
  strict validation uses explicit `npx @fission-ai/openspec@1.5.0` only as temporary
  evidence, not as the final reproducible integration. The completeness pass ran
  `npx --yes @fission-ai/openspec@1.5.0 validate --all --strict --no-interactive` and
  both active changes passed.
- The preserved PoC ran all seven Python tests successfully and regenerated an offline
  aggregate byte-identical to the sanitized expected file.
- `npm run docs:check` and a checked-in documentation CI workflow do not exist yet.
- No migration, generator rewrite, inventory regeneration, runtime check, deployment,
  database operation, or `mypc` mutation was performed.

## Known artifact conflicts to resolve before approval

1. Make the explicitly invoked `$docs-audit` Skill the single execution surface, and
   either demote the audit runbook to supporting reference or remove it.
2. Reconcile audit-proposed warnings and `review` triggers with the current specification's
   required changed-source contracts; do not turn deterministic blockers into warnings.
3. Decide the PreToolUse PoC's stage ownership before changing any normative artifact.
4. Use attempted-access/path-match naming consistently; never report real reads or
   comprehension.
5. Define the PoC's final archival or transfer disposition before the documentation child
   is archived.

No root documentation, `agent-rules/**`, current `docs/**`, product code, runtime service,
database, deployment state, or `mypc` state was changed during this session.

## Recommended next actions after resume

1. Review this handoff and the spike; do not treat sample code as approved production code.
2. Decide whether PreToolUse path-match logging belongs in the current documentation child or is
   only an input to the later `build-agent-observability` child, preserving stage order.
3. Decide the exact `$docs-audit` Skill contract: invocation syntax, supported scopes,
   evidence precedence, report location, user-escalation boundary, and scheduling owner.
4. Decide offline log/store mechanics and retention after cross-platform concurrency and
   overhead tests.
5. Revise the active OpenSpec artifacts only after resolving the conflicts above. If the
   telemetry work belongs to observability, do not add it to the current child's scope.
6. Run strict OpenSpec validation and present the exact revised artifacts for user review
   before apply.

Do not begin documentation migration, observability implementation, engineering
standards, Impeccable integration, deployment, or production instrumentation merely
because this handoff exists.

## Post-resume design resolution — 2026-07-10

The continuation branch was fetched and reviewed on Windows. The formal parent and child
artifacts were revised for exact-revision review; this section records the resolution of the
handoff questions without turning this evidence file into normative authority.

- The PreToolUse path-match spike belongs to the future `build-agent-observability` design.
  The documentation child keeps the sanitized files only as non-normative attempted-match
  evidence, installs nothing, and transfers no acceptance credit. The future child must
  revalidate platform support, concurrency, crash recovery, retention, privacy, overhead,
  identity, isolation, and teardown.
- `.codex/skills/docs-audit/**` is the proposed single explicit semantic-audit surface.
  `AGENTS.md` has no audit rule or auto-trigger; there is no audit runbook, controlled
  `docs:read` CLI, documentation MCP gateway, scheduler, or permanent audit ledger.
- The proposed Skill accepts changed, explicit paths, active OpenSpec change, and full scopes;
  `report` writes nothing, `record` writes only explicitly named active-change evidence, and
  `fix` authorizes scoped document mutation. Independent review is required before a changed
  scope passes.
- The deterministic check remains one `npm run docs:check` engine. Full is the safe default
  and required CI/acceptance mode; explicit fast mode escalates to full whenever impact
  closure is unsafe. Human/JSON diagnostics share stable fields and exit codes `0/1/2` for
  success, rule violation, and tool/configuration failure.
- Full mode without a comparison base runs every deterministic verifier and emits all
  semantic `review` relationships as missing-base warnings; CI and acceptance provide an
  explicit base. Project-Skill validation uses a repository-owned offline command rather than
  a developer's global Skill Creator installation.
- Source relationships are typed as blocking machine-provable `contract` mappings or
  non-blocking owned `review` warnings. Ordinary development does not auto-run the Skill.
  Every warning and semantic finding still requires explicit disposition before stage
  acceptance, and a deterministic contract cannot be downgraded.
- Local non-writing proof compares complete before/after repository state and therefore
  permits pre-existing dirty or untracked work. CI starts and ends clean, runs full mode on
  every protected merge path, and has no docs-only path filter.
- The parent foundation proposal now pins OpenSpec exactly, hashes canonical Git blob bytes
  for approvals, preserves raw tasks snapshots while normalizing only checkbox progress, and
  uses a narrow stage manifest/gate without duplicating lifecycle state. One explicit bounded
  bootstrap approval authorizes only parent foundation tasks 1.1-1.4, after which every child
  uses the normal gate.

These are proposed target decisions pending an immutable commit and explicit user approval of
the exact parent/child artifact revision. Child apply, documentation migration, hook
installation, runtime work, and deployment remain blocked.

Post-resume verification before commit:

- temporary strict OpenSpec validation with `@fission-ai/openspec` 1.5.0 passed both active
  changes;
- the focused documentation suite reported 15 passes and two existing baseline failures:
  the root `/` route assertion in the rewritten README contract and the intentionally stale
  repository inventory that does not yet include the new OpenSpec/evidence paths;
- all seven preserved PoC unit tests passed under Windows Python, which does not supply the
  missing `commandWindows`, PowerShell parsing, concurrency, retention, isolation, or real
  Codex E2E evidence.

## Windows PreToolUse continuation — 2026-07-11

The resumed task was corrected back to the interrupted hook experiment before any parent
foundation or documentation migration work began. The earlier evidence already proved one
real macOS Codex run; the missing platform result was a real Windows Codex hook invocation.

Fresh local evidence used Windows 11, Python 3.11.9, and the installed `codex-cli 0.142.2`.
The local CLI reports hooks as stable, accepts `commandWindows`, and sends shell hooks the
canonical `tool_name: "Bash"` with `tool_input.command` on Windows. The experiment used two
ephemeral, read-only Codex tasks in the already trusted repository. A temporary project
`.codex/hooks.json` was removed immediately after the test, and the raw NDJSON remained in
the system temporary directory rather than the repository before being deleted after the
assertions.

Observed results:

- the POSIX handler was deliberately `exit 91`, while only `commandWindows` invoked the
  Python recorder; the resulting log therefore proves the Windows override was selected;
- `cat <fixture guide path>` completed successfully and produced one `Bash/read` event for
  the exact repository-relative file;
- native `Get-Content -LiteralPath <fixture guide path>` also completed successfully and
  produced a second event for that file, but the prototype categorized it as generic
  `access`, exposing the missing PowerShell read-command classification;
- both events contained only timestamp, truncated session hash, tool name, operation,
  repository-relative path/match kind, schema version, and coverage class; they contained
  no raw command, prompt, output, absolute path, raw session id, or file content;
- the temporary hook configuration was deleted and the five unrelated untracked
  `scripts/*.ts` files remained untouched.

This closes the narrow feasibility question: a Codex `PreToolUse` hook can detect a Windows
tool-call attempt that names a repository file. It does not prove tool success, an actual
filesystem read, or model comprehension. PowerShell semantic classification, Windows
concurrency, retention, crash recovery, isolation, privacy policy, overhead, and a stable
one-command cross-platform assertion remain future `build-agent-observability` work.

## Simplified local Hook authorization - 2026-07-11

After reviewing the Windows result, the user explicitly narrowed and authorized the next
experiment: stop classifying read, search, write, or PowerShell commands; count every matched
repository path as one coarse access attempt; and write directly to ignored repository-local
`logs/**` and `metrics/**` without a running application or telemetry service.

The authorized successor is limited to `.codex/hooks.json`, a standard-library recorder,
focused tests, ignored runtime output, and the repository-maintenance documentation required
for those tracked files. It stores no raw command, prompt, output, file content, absolute path,
or raw session id. This is a separately authorized local experiment, not documentation-
governance acceptance, not the start of the full observability child, and not evidence that a
tool call succeeded or that an agent read or understood a file. The append-only NDJSON is the
canonical rough record; aggregate freshness under overlapping Hook processes remains explicitly
outside this experiment rather than reintroducing the deferred concurrency work.

The installed successor then passed a real Windows Codex E2E with `codex-cli 0.142.2`: a new
ephemeral read-only task loaded the tracked project manifest, selected `commandWindows`, and
executed one native `Get-Content -LiteralPath` call for the fixture guide. The command exited
zero, the NDJSON event contained only `occurred_at`, `paths`, `schema_version`, `session_hash`,
and `signal`, and the aggregate recorded that repository-relative path once. Both generated
files remained ignored and untracked. Hook trust was bypassed only for this automated E2E;
normal tasks still require explicit per-machine review.
