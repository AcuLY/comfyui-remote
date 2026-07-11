## Context

The repository currently has useful documentation ingredients but no single, durable knowledge contract. At the 2026-07-10 design baseline it contains 107 tracked Markdown files, including 73 below `docs/`; 13 `agent-rules/**` files with 301 lines of mixed policy and procedure; 42 archived files; and 28 Training prototype files and assets. These counts are discovery evidence, not stable requirements, so implementation re-enumerates tracked files before mutation.

Existing governance is partly circular. `docs/index.md`, `docs/documentation-map.md`, and `docs/repo-inventory.md` overlap; metadata is free-form and absent from many documents; tests hard-code current paths and sometimes read archived plans as authority; exact route and API facts are copied into prose; runtime data such as `docs/workflow.api.json` is stored under the documentation tree; and there is no checked-in CI workflow that runs a complete documentation gate.

The approved design constraints are:

- structure is decided before the complete child specification and before migration;
- OpenSpec is the only significant-change lifecycle and this `tasks.md` is the only implementation task plan;
- current implementation, approved target, and historical intent remain distinct;
- `docs/archive/**` is extracted and deleted, not renamed to history;
- all Training prototypes are discarded;
- `agent-rules/**` is split into `AGENTS.md` policy and runbook procedure, then deleted;
- `docs/generated/**` and `docs/references/**` are deliberately deferred;
- Impeccable remains a future, independent change;
- governance tests may be rewritten or removed when they encode an invalid old contract;
- documentation governance precedes observability and engineering standards.

## Goals / Non-Goals

**Goals:**

- Establish a concise, progressively disclosed, agent-legible current knowledge base.
- Give every maintained document one explicit owner, authority, typed source relationships, evidence contract, and verification route.
- Replace path heuristics and duplicated maps with per-document metadata plus a small machine policy.
- Provide one deterministic non-writing documentation command locally and in CI.
- Provide a repeatable semantic audit for meaning that software cannot prove.
- Extract verified durable knowledge, eliminate duplicate current authority, and delete obsolete documentation surfaces.
- Enable a documentation-specific required CI check only after the repository reaches zero in-scope violations.

**Non-Goals:**

- Choose or implement observability technology, performance budgets, engineering standards, or the later unified CI design.
- Install or run Impeccable, rewrite root `DESIGN.md` into its final Impeccable schema, or introduce Impeccable hooks and detector output.
- Introduce a new historical documentation store or custom historical-migration schema.
- Force a generated/reference directory taxonomy before operating evidence supports it.
- Make a linter pretend to prove semantic correctness.
- Promote ignored `.tmp/**` synthesis directly into current documentation.
- Add a controlled `docs:read` CLI, documentation MCP gateway, scheduled semantic audit, or automatic ordinary-development `$docs-audit` trigger.
- Install or productionize the preserved PreToolUse path-match spike as documentation-governance instrumentation. A separately user-authorized root successor may run only as the bounded local experiment recorded in the parent change.

## Decisions

### 1. Use a fixed core information architecture with evidence-gated current owner areas

The fixed core is:

```text
/
├── README.md
├── AGENTS.md
├── ARCHITECTURE.md
├── PRODUCT.md
├── DESIGN.md
├── CLAUDE.md                         # compatibility pointer only
├── .codex/
│   └── skills/
│       └── docs-audit/
│           ├── SKILL.md              # only semantic-audit invocation surface
│           ├── agents/openai.yaml
│           └── references/evidence-contract.md
├── openspec/
│   ├── config.yaml
│   ├── specs/
│   └── changes/
└── docs/
    ├── README.md
    ├── QUALITY_SCORE.md              # deferred placeholder
    ├── RELIABILITY.md                # deferred placeholder
    ├── SECURITY.md                   # deferred placeholder
    ├── repo-inventory.md             # existing generated artifact stays in place initially
    ├── _meta/
    │   ├── README.md
    │   ├── documentation.schema.json
    │   ├── policy.yaml
    │   └── templates/
    │       ├── document.md
    │       ├── directory-readme.md
    │       └── runbook.md
    ├── architecture/
    │   ├── README.md
    │   ├── core-beliefs.md
    │   ├── system/
    │   │   ├── README.md
    │   │   ├── context.md
    │   │   ├── dependency-model.md
    │   │   ├── runtime-topology.md
    │   │   ├── data-model.md
    │   │   ├── agent-interfaces.md
    │   │   └── execution/
    │   │       ├── README.md
    │   │       └── queue-worker.md
    │   └── domains/
    │       ├── README.md
    │       ├── generation/README.md
    │       ├── training/README.md
    │       └── shared-resources/README.md
    ├── product/
    │   ├── README.md
    │   ├── generation/README.md
    │   ├── training/README.md
    │   └── shared-resources/README.md
    ├── design/
    │   ├── README.md
    │   ├── layout-and-density.md
    │   ├── component-patterns.md
    │   ├── interaction-and-motion.md
    │   ├── responsive-and-accessibility.md
    │   ├── review-workbench.md
    │   └── design-demo-governance.md
    ├── runbooks/
    │   ├── README.md
    │   ├── git-delivery.md
    │   ├── development/
    │   │   ├── README.md
    │   │   ├── dev-service.md
    │   │   └── local-verification.md
    │   ├── deployment/
    │   │   ├── README.md
    │   │   ├── lock.md
    │   │   ├── queue-safety.md
    │   │   ├── database-sync.md
    │   │   ├── next-build.md
    │   │   ├── service-restart.md
    │   │   └── verification.md
    │   └── mypc/
    │       ├── README.md
    │       └── powershell-over-ssh.md
    ├── api/                           # retained only as a verified current owner
    │   └── README.md
    └── testing/                       # retained only as a verified current owner
        └── README.md
```

`docs/api/**` and `docs/testing/**` remain because this stage defers a generic reference taxonomy and the repository currently has distinct API-contract and test-infrastructure owners. The semantic audit may merge individual files into architecture or runbooks, but those directories disappear only if all distinct ownership is eliminated. Any retained path must appear in `policy.yaml`; there is no unrestricted `docs/**` catch-all.

Detailed design files are created only when current evidence supports content. A target filename does not authorize an empty or speculative document. The architecture `observability/` subtree is added only by the later observability change.

`CLAUDE.md` remains a thin compatibility adapter that points to `AGENTS.md`; it never owns rules. Root `PRODUCT.md` and `DESIGN.md` are current maps, while `docs/product/**` and `docs/design/**` expand verified current knowledge. Proposed product or experience changes belong to OpenSpec.

**Alternative considered:** Copy the OpenAI article tree exactly. Rejected because OpenSpec replaces ExecPlans, Impeccable expects future root context files, and this repository has explicit API, testing, deployment, and Training ownership.

**Alternative considered:** Keep every existing documentation directory and only add metadata. Rejected because it preserves duplicate and obsolete authority.

### 2. Keep document instance metadata with the document

Each governed Markdown file uses YAML frontmatter validated by `documentation.schema.json`. The common model is:

```yaml
schemaVersion: 1
document:
  type: architecture | product | design | runbook | api | testing | router | placeholder
  status: current | deferred
  owner: <stable owner id>
  authority: <normalized subject and authority kind>
  readWhen: [<task triggers>]
  sources: [<code, schema, test, or root-contract paths>]
  verifiedBy: [<non-writing command or test>]
```

Runbooks additionally require environment, risk, recovery, and last-verification fields. Existing generator-owned documents additionally declare generator, inputs, regenerate command, and non-writing check. These provenance fields do not create a generated directory class.

Root files use path-specific profiles so `AGENTS.md` stays concise and a future Impeccable frontmatter extension can coexist with the core `DESIGN.md` contract. OpenSpec artifacts are excluded from this frontmatter schema and validated by the pinned OpenSpec integration.

`policy.yaml` owns allowed paths, profile assignments, required landing pages, controlled root/detail relationships, forbidden legacy paths, the finite governed-scope matrix, and exact changed-source documentation relationships. Each relationship is either `contract`, with a deterministic non-writing verifier and blocking failure semantics, or `review`, with an owner and reason that produces a non-blocking semantic-review warning. It does not list every document's owner and values. `repo-inventory.md` is derived from tracked paths and resolved metadata; it is not an independent authority.

**Alternative considered:** A central manifest with one row per document. Rejected because it would duplicate instance metadata and become another hand-maintained map.

**Alternative considered:** Infer class and owner from path substrings. Rejected because the current generator demonstrates that heuristics conceal incorrect authority.

### 3. Separate deterministic validation from semantic audit

`npm run docs:check` is the one non-writing orchestration entrypoint implemented under
`scripts/docs/**`. Full mode is the default, the acceptance mode, and the CI mode. An
explicit fast mode starts from a valid merge base and closes over changed documents,
navigation neighbors, owners, source relationships, generators, and OpenSpec parents. It
automatically escalates to full when the merge base is missing, policy/schema/OpenSpec/Skill/
generator code changes, a document moves or is deleted, root/navigation authority changes,
or the impact closure cannot be proved complete.

Full mode always evaluates the entire current structural graph and runs every deterministic
contract, generator, OpenSpec, and Skill verifier. When a comparison revision exists, it uses
the changed set to select semantic `review` warnings. Without one, it conservatively treats
every `review` relationship as matched and labels the warning with missing-base evidence. CI
and stage acceptance always pass an explicit comparison revision.

Both modes use the repository-pinned runtime and OpenSpec integration, require no network,
and share one engine:

1. enumerate tracked paths with Git and resolve the finite scope matrix;
2. parse frontmatter and validate the applicable current-document profile;
3. validate `policy.yaml`, allowed topology, required `README.md` files, and forbidden live paths;
4. parse GFM links and headings with GitHub-compatible duplicate-heading slugs;
5. verify root-to-current reachability and required reverse links;
6. evaluate typed `contract` and `review` source relationships;
7. run existing generator and source-contract adapters without writing output;
8. run pinned OpenSpec and project-Skill validation;
9. emit deterministically sorted human or JSON diagnostics;
10. compare a content-aware before/after repository snapshot and reject any checker write.

The diagnostic schema is `ruleId`, `severity`, repository-relative `path`, `location`,
`evidence`, `remediation`, and `owner`. Exit `0` means no deterministic error, `1` means
repository rule violations, and `2` means the checker or configuration failed. Warnings are
reserved for heuristic review facts and never downgrade a deterministic contract. Writing
generators remain separate commands.

Local non-writing proof compares the before/after tracked diff, staged diff, and untracked
path/content fingerprint, so an already dirty user worktree is valid if the checker adds no
change. CI starts and ends clean. Its required full-mode job runs on every protected merge
path without a docs-only path filter because a source-only change can invalidate a contract.

The finite scope matrix is:

| Surface | Deterministic governance | Semantic/current authority |
| --- | --- | --- |
| Root entrypoints and approved `docs/**` | Metadata, topology, GFM links/anchors, navigation, typed relationships, generators | Current documentation; eligible for explicit `$docs-audit` |
| `openspec/**` | Pinned OpenSpec validation and applicable internal links | Target/history according to lifecycle; excluded from current frontmatter/navigation |
| Project Skills such as `.codex/skills/**` | Repository-pinned Agent Skills metadata, bundled-reference links, path safety, forward-test evidence | Workflow authority only for explicitly invoked Skill; not current docs |
| Registered `src/**.md` and `tests/**.md` | Explicit policy registration plus applicable links/contracts | Source-adjacent knowledge only; migrate or delete unregistered files |
| Fixtures, samples, and OpenSpec evidence | Path containment and intentional-fixture rules | Non-current evidence; excluded from live-reference/navigation findings |

Markdown parsing uses a GFM AST rather than regex. Fenced and indented code, inline code,
HTML comments, negative fixtures, and non-current OpenSpec evidence do not create live path
references or navigation edges. Internal relative targets and anchors are blocking; external
reachability, age heuristics, suspected duplicates, and prose quality remain offline warnings
or semantic findings rather than flaky network blockers.

Project-Skill validation does not depend on a user's global Skill Creator install. The child
adds exact direct `js-yaml` `4.1.1` development dependency and a repository-owned
`scripts/skills/validate.mjs`, exposed as
`npm run skills:check -- .codex/skills/docs-audit`. That offline command validates the Agent
Skills core frontmatter/folder contract, contained references, and this repository's
explicit-only activation rule; `docs:check` calls the same command path.

The semantic audit is the project-local `$docs-audit` Skill under
`.codex/skills/docs-audit/**`, not a runbook and not an `AGENTS.md` trigger. Its contract is:

- discovery: frontmatter describes only explicit user or approved OpenSpec-task invocation,
  so generic source/documentation edits do not implicitly activate it;
- invocation: `$docs-audit changed`, `$docs-audit paths <repo-relative paths>`,
  `$docs-audit change <id>`, or `$docs-audit full`; an omitted scope safely chooses changed
  scope or escalates to full;
- operation: `report` by default writes nothing; `record` writes only the explicitly named
  `openspec/changes/<id>/evidence/docs-audit/**` report; `fix` authorizes scoped document and
  evidence writes;
- evidence precedence: current source/schema/tests and required runtime evidence, then an
  approved active target, then Git/OpenSpec history;
- findings: claim category, owner, evidence, conflict, confidence, disposition, verification,
  and any `user-decision-required` boundary;
- reports: ad hoc runs return findings in the task without a permanent ledger; an approved
  OpenSpec task must name `record` or `fix` and its contained output before evidence is written;
- review: a fixer cannot sign its own semantic pass; an independent agent/reviewer reruns the
  same scope, or the result remains `review-required`;
- scheduling: none in this stage; any recurring audit requires a later approved change.

The Skill may call deterministic scope and evidence scripts, but it does not introduce a
controlled `docs:read` CLI or documentation MCP gateway. Mechanical corrections with exactly
one supported answer may proceed only in explicit fix mode. Authority, product direction,
partial implementation, deletion of potentially current knowledge, missing runtime evidence,
or conflicting interpretations are escalated. Ordinary source or documentation changes do not
auto-run the Skill. `review` relationship warnings are disposed during an explicit audit or
stage-acceptance review; every warning and semantic finding must be dispositioned before this
stage is accepted.

The Skill itself follows skill TDD: capture baseline failures without the Skill, write the
minimal workflow, validate its package with the repository-pinned command, rerun the same
scenarios with it, test report/record/fix path boundaries independently, and forward-test
fresh agents on representative current/target/history conflicts before adoption.

**Alternative considered:** Encode semantic correctness in tests. Rejected because current tests already demonstrate that a test can preserve obsolete structure while meaning remains wrong.

**Alternative considered:** Keep `docs/runbooks/documentation-audit.md` as a second entrypoint.
Rejected because it would split invocation and rule authority; detailed reusable material stays
inside the Skill's `references/**` instead.

### 4. Treat governance tests as consumers of policy

`tests/test-documentation-governance.test.ts` and related tests are implementation inputs, not authority. They are rewritten around schema/policy fixtures and public `docs:check` behavior. Tests no longer assert that specific legacy paths must exist merely because they existed when the test was written.

Every critical rule has one valid fixture and one controlled invalid fixture. High-value counterexamples include missing metadata, broken links and anchors, duplicate GFM headings, code-block false references, orphan current docs, invalid root/detail authority, stale contracts, review warnings, forbidden live legacy paths, stale generator output, malformed OpenSpec relationships, unsafe fast-scope narrowing, and checker exit-code separation.

**Alternative considered:** Preserve all current tests and shape the migration around them. Rejected because multiple tests currently depend on archived or prototype files that the approved architecture deletes.

### 5. Perform evidence-owned migration, not mechanical renames

The migration map is:

| Current surface | Target action |
| --- | --- |
| `README.md` | Keep as human entrypoint; remove volatile inventories and route to owner docs. |
| `AGENTS.md` + `agent-rules/**` | Rebuild policy in `AGENTS.md`, procedures in runbooks, update every consumer, then delete `agent-rules/**`. |
| semantic documentation audit | Create and forward-test `.codex/skills/docs-audit/**` as the only explicit audit entrypoint; do not create an audit runbook or `AGENTS.md` trigger. |
| `docs/index.md` + `docs/documentation-map.md` | Merge human routing into `docs/README.md`; move machine rules into `_meta/policy.yaml`; delete duplicates. |
| `docs/analysis/**`, worker/Prisma boundary docs | Verify and split into `docs/architecture/**`; delete superseded sources. |
| `docs/ui/**`, frontend guide, design parity docs | Split verified visual knowledge into root/design docs and code ownership into architecture; remove duplicate sources. |
| API and MCP docs | Verify against source/tests and retain under `docs/api/**` while the generated/reference taxonomy is deferred. |
| testing guidance | Retain distinct test-infrastructure knowledge under `docs/testing/**`; move executable operational sequences into runbooks. |
| local verification, script maintenance, deployment rules | Consolidate into task-oriented runbooks. |
| root `position_presets.md` | Move verified product/prompt knowledge to `docs/product/shared-resources/**`. |
| `docs/workflow.api.json` | Move the runtime template to a configuration-owned path such as `config/workflows/standard-workflow.api.json`; update loader, tests, and documentation. |
| `docs/plans/auto-review-analysis/**` | Split benchmark/config inputs to their test/config owner and generated analysis output to a non-plan artifact owner; remove `docs/plans/**`. |
| old specs, plans, PRDs, implementation notes | Extract verified current knowledge into owner docs or living specs, then delete. |
| `docs/archive/**` | Review every baseline item, extract verified current value, update consumers, then delete the entire directory. |
| `docs/prototypes/**` | Prove no production dependency, remove prototype-specific consumers/tests, then delete all files without history copy. |
| `docs/repo-inventory.md` | Keep at its current path during this stage, derive it from resolved metadata, and add non-writing freshness verification. |

The move of `workflow.api.json` is runtime-affecting even though it is motivated by documentation ownership. Its implementation batch therefore runs the applicable code tests and normal runtime/deployment gate rather than being treated as documentation-only.

### 6. Make agent-policy migration atomic

The new runbooks are created and verified before old rule files are deleted. In one cutover batch, `AGENTS.md`, `CLAUDE.md`, `openspec/config.yaml`, root/docs routers, generator classification, governance tests, and all current links switch to the new paths. Only then is `agent-rules/**` removed. `$docs-audit` remains an explicitly invoked Skill outside ordinary `AGENTS.md` trigger routing; OpenSpec migration and acceptance tasks name the invocation when it is required.

During semantic verification, hardcoded environment facts are rechecked instead of copied blindly: local-versus-`mypc` deployment, Windows paths, ports, public URL, log names, Prisma `db push`, queue authentication and recovery, and service restart targeting. Uncertain major policy is presented to the user. Default commit/push and deployment behavior remains unchanged unless separately approved.

### 7. Delete archive and prototype surfaces with explicit gates

Archive migration uses `git ls-files docs/archive` at implementation start as the complete input set. Each semantic batch must reach one of two outcomes: verified current information has been integrated into an owner and its consumers pass, or the source has no current value. The final gate requires no tracked archive/history path and no live reference. Git preserves recovery; OpenSpec archive preserves change artifacts.

Prototype cleanup does not require design preservation because the user explicitly discarded the entire set. Before deletion, a source scan proves production does not import prototype assets. Prototype-only tests and mappings are removed; current Training routes, the shared navigation mode toggle, and peer-work-mode behavior remain protected by production tests and current docs.

### 8. Activate documentation-specific CI only at zero violations

The implementation may run fast or full `docs:check` locally while migration is in progress, but stage acceptance requires zero deterministic errors, explicit disposition of every warning and semantic finding, and a checked-in doc-specific CI job using full mode from a clean start to a clean end. Evidence includes success, a controlled negative fixture failure, restored success, no documentation-only path filter, and confirmation that the check is required on every protected merge path.

This is narrower than the final harness CI convergence. It protects documentation immediately without prematurely choosing observability or engineering-standard jobs.

### 9. Keep future files honest and future tooling deferred

`QUALITY_SCORE.md`, `RELIABILITY.md`, and `SECURITY.md` contain only metadata, purpose, deferred state, activation owner/stage, and authority boundaries. Findings and proposed work go to OpenSpec, not placeholder backlogs.

The documentation stage establishes root `PRODUCT.md`/`DESIGN.md` and detailed design routing that can support Impeccable later, but it does not change root `DESIGN.md` to the Impeccable six-section schema or create `.impeccable/**`, `.agents/skills/impeccable/**`, Impeccable Hook configuration, detector baselines, or sidecar checks. That integration must revalidate the then-current repository in its own change. The independent coarse path-match Hook is not an Impeccable integration.

### 10. Transfer the PreToolUse spike to the observability stage without adopting it

The sanitized `pretooluse-file-access-poc/**` remains under this change's evidence directory
as a non-normative feasibility record. This child does not directly install that preserved
script or use it for acceptance. After the Windows continuation, the user separately
authorized a simplified root successor with no operation taxonomy or service dependency.
That successor writes only ignored `logs/**` and `metrics/**`, is outside this child's
implementation and acceptance, and does not make the evidence copy normative. The legacy
sample field `access_total` and the successor field `access_attempt_total` both mean only an
attempted path match; neither proves tool success, filesystem reads, or model comprehension.

When this child is archived, the evidence remains recoverable with the archive. After
documentation governance is accepted, `build-agent-observability` may reference the archived
path or copy a digest-bound snapshot, then must freshly decide signal ownership and validate
Windows/POSIX parsing, concurrent writers, crash recovery, retention, privacy, overhead,
environment/worktree/service/run identity, fail-closed storage isolation, and teardown. No
offline store or retention mechanics are selected in this stage.

## Data Flow

```text
tracked files + current source/tests/schemas + active OpenSpec changes + Git history
  -> governed-path enumeration
  -> metadata/profile resolution
  -> topology/link/reachability graph
  -> deterministic docs:check errors and review warnings
  -> explicitly invoked $docs-audit for selected semantic scope
  -> current-owner rewrite or extract/delete decision
  -> independent semantic review when fixes were applied
  -> owning tests/runtime verification
  -> regenerated in-place inventory
  -> zero-violation local docs:check
  -> clean-checkout documentation CI
  -> user review and stage acceptance
```

## Error Handling

- Invalid metadata, topology, links, or OpenSpec structure blocks migration acceptance with deterministic diagnostics.
- A repository rule violation exits `1`; an engine/configuration failure exits `2`; neither is hidden as a warning.
- An unsafe fast-scope calculation escalates to full mode instead of skipping uncertain checks.
- Conflicting evidence blocks only the affected semantic rewrite and is escalated; it is not resolved by choosing the newest prose file.
- Missing required runtime evidence prevents the affected claim from becoming current truth.
- A failed mixed-content migration keeps the original file until all current owner replacements for that batch are verified.
- A failed `agent-rules` cutover restores the prior paths as one batch; no half-migrated dual authority is accepted.
- Archive deletion fails if any baseline item lacks a disposition, any consumer still reads the path, or an extracted contract lacks verification.
- Prototype deletion fails if production source imports prototype assets or current Training coverage regresses.
- Generator check mode must never repair drift automatically; it reports the separate write command.
- Missing branch-protection authority leaves the required-check task incomplete and is reported as an external action.
- An explicitly authorized audit fix without an independent review remains `review-required` and cannot pass.

## Verification

- Validate proposal, design, specs, and tasks with the repository-pinned OpenSpec version in strict, non-interactive mode.
- Unit-test metadata parsing, schema profiles, path normalization, scope resolution, policy validation, GFM links/anchors, graph reachability, `contract`/`review` matching, diagnostic formats/exit codes, fast-to-full escalation, repository snapshot preservation, and generator check mode.
- Exercise valid and invalid fixtures for every critical docs rule.
- Run focused source-contract tests after each migration batch and the full repository suite before cutover.
- Baseline-test `$docs-audit` without the Skill, implement the minimal Skill, validate its package, rerun the same scenarios, and forward-test fresh agents on representative current/target/history conflicts and independent-review boundaries.
- Run the explicit semantic audit navigation exercise: `AGENTS.md -> docs/README.md -> owner README -> detail/runbook/test` for representative architecture, Generation, Training, shared resource, deployment, API, design, and testing tasks.
- Prove `npm run docs:check` full/fast behavior is deterministic, network-free, non-writing in an already dirty local checkout, and full-mode-equivalent in clean CI.
- Prove `rg`/tracked-file checks contain no live `agent-rules`, archive, history, prototype, legacy Superpowers planning, or non-OpenSpec plan authority.
- Verify the runtime-template relocation with loader, generation workflow, build, and applicable deployment checks.
- Require explicit user review of the exact OpenSpec artifact revision before apply and explicit acceptance after verification.

## Risks / Trade-offs

- **Semantic migration scope is large** → Use small domain batches, explicit evidence, and owner-specific verification; do not reduce scope by retaining stale compatibility directories.
- **Metadata becomes bureaucratic** → Keep instance fields limited to routing, authority, evidence, triggers, and verification; derive inventories rather than duplicating them.
- **Changed-source relationships create false positives** → Keep deterministic `contract` mappings narrow; represent heuristic ownership signals as non-blocking `review` warnings and require explicit acceptance disposition.
- **A Skill becomes hidden policy** → Require explicit `$docs-audit` invocation, keep rules out of `AGENTS.md`, and forward-test discovery and scope behavior.
- **Deleting historical files loses convenient browsing** → Git and OpenSpec retain recovery while current agents avoid stale default context.
- **API/testing paths may later fit another taxonomy** → Keep them as verified current owners now and revisit only with observed harness evidence.
- **CI branch settings may require external access** → Treat configuration proof as an explicit acceptance gate.
- **Moving a runtime template expands verification** → Isolate it in its own batch and follow normal runtime safety rules.

## Migration Plan

1. Complete the parent repository-pinned OpenSpec, digest-bound approval/acceptance gate, stage manifest, and tests.
2. Validate this exact revised artifact set, obtain and record explicit user approval, then keep child apply blocked if any digest changes.
3. Freeze a read-only `git ls-files` baseline and run current tests to capture known failures without treating them as target authority.
4. Add `_meta` schema, typed relationship policy, finite scope matrix, templates, deterministic full/fast check components, and counterexample fixtures.
5. Baseline-test, create, validate, and forward-test the explicit `$docs-audit` Skill before using it for migration decisions.
6. Establish root and directory routers, then rebuild current architecture, product, design, API, testing, and runbook knowledge in evidence-reviewed batches.
7. Perform the atomic `AGENTS.md`/runbook cutover and remove `agent-rules/**` without adding an audit trigger.
8. Remove legacy non-OpenSpec plan/spec surfaces and relocate non-plan data out of `docs/plans/**`.
9. Extract current value from all archive items, update dependent tests/consumers, and delete `docs/archive/**`.
10. Remove prototype-specific consumers and delete all `docs/prototypes/**` files while preserving the shared Training mode toggle.
11. Move runtime/config assets out of documentation ownership in isolated verified batches.
12. Rebuild the in-place inventory, clear every deterministic error, disposition every warning and semantic finding, and run the full verification suite.
13. Add and prove the required full-mode documentation CI check, present evidence for user acceptance, preserve the PoC as future observability evidence, and archive the child under OpenSpec only after acceptance.

Rollback is commit- and batch-scoped. Each migration batch keeps its source until replacements and consumers pass. Revert only the failed batch, preserve unrelated worktree changes, and never use broad destructive reset commands.

## Documentation Impact

This change intentionally rewrites the documentation control plane and current knowledge set. Its own OpenSpec artifacts remain approved-target authority until applied. Current docs are updated only from verified implementation evidence. Deleted material remains recoverable through Git; change rationale and acceptance remain in the archived OpenSpec child.

## Open Questions

No information-architecture or handoff-design decision remains unresolved in this revision. The `$docs-audit` contract, deterministic check modes and diagnostics, typed relationship model, finite scope/parser semantics, dirty-worktree proof, CI surface, and PoC transfer are proposed targets pending explicit approval of this exact artifact revision. During apply, any factual conflict about current product behavior, deployment policy, runtime ownership, or partial implementation is handled through the semantic-audit user-decision path rather than silently resolved in implementation.
