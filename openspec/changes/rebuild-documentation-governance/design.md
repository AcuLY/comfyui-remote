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
- Give every maintained document one explicit owner, authority, update trigger, evidence contract, and verification route.
- Replace path heuristics and duplicated maps with per-document metadata plus a small machine policy.
- Provide one deterministic non-writing documentation command locally and in CI.
- Provide a repeatable semantic audit for meaning that software cannot prove.
- Extract verified durable knowledge, eliminate duplicate current authority, and delete obsolete documentation surfaces.
- Enable a documentation-specific required CI check only after the repository reaches zero in-scope violations.

**Non-Goals:**

- Choose or implement observability technology, performance budgets, engineering standards, or the later unified CI design.
- Install or run Impeccable, rewrite root `DESIGN.md` into its final Impeccable schema, or introduce hooks and detector output.
- Introduce a new historical documentation store or custom historical-migration schema.
- Force a generated/reference directory taxonomy before operating evidence supports it.
- Make a linter pretend to prove semantic correctness.
- Promote ignored `.tmp/**` synthesis directly into current documentation.

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
    │   ├── documentation-audit.md
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
  updateWhen: [<source globs or semantic triggers>]
  sources: [<code, schema, test, or root-contract paths>]
  verifiedBy: [<non-writing command or test>]
```

Runbooks additionally require environment, risk, recovery, and last-verification fields. Existing generator-owned documents additionally declare generator, inputs, regenerate command, and non-writing check. These provenance fields do not create a generated directory class.

Root files use path-specific profiles so `AGENTS.md` stays concise and a future Impeccable frontmatter extension can coexist with the core `DESIGN.md` contract. OpenSpec artifacts are excluded from this frontmatter schema and validated by the pinned OpenSpec integration.

`policy.yaml` owns allowed paths, profile assignments, required landing pages, controlled root/detail relationships, forbidden legacy paths, and changed-source documentation mappings. It does not list every document's owner and values. `repo-inventory.md` is derived from tracked paths and resolved metadata; it is not an independent authority.

**Alternative considered:** A central manifest with one row per document. Rejected because it would duplicate instance metadata and become another hand-maintained map.

**Alternative considered:** Infer class and owner from path substrings. Rejected because the current generator demonstrates that heuristics conceal incorrect authority.

### 3. Separate deterministic validation from semantic audit

`npm run docs:check` is a non-writing orchestration entrypoint implemented under `scripts/docs/**`. It uses the repository's pinned runtime and OpenSpec integration, requires no network, and runs the same components locally and in CI:

1. enumerate tracked governed paths with Git;
2. parse frontmatter and validate the applicable schema profile;
3. validate `policy.yaml`, allowed topology, required `README.md` files, and forbidden paths;
4. parse Markdown links and headings, validate relative targets and anchors, and build the navigation graph;
5. verify root-to-current reachability and required reverse links;
6. evaluate changed-source/update-trigger coverage against the merge base when one is available;
7. run existing generator check adapters without writing output;
8. run pinned OpenSpec validation;
9. emit stable diagnostics containing rule ID, file, location, reason, and remediation;
10. exit nonzero on any violation and prove a clean worktree after execution.

Writing generators remain separate commands. An unchanged document whose update trigger matched must still receive a reviewable verification update under the policy; silently ignoring the trigger is not allowed.

The semantic audit lives in `docs/runbooks/documentation-audit.md`. For each file or mixed section it records, in the active change's task/verification evidence rather than a permanent docs ledger:

- claim category: current implementation, approved target, or historical intent;
- evidence from source, schemas, tests, runtime, and Git;
- current owner and authority;
- conflicts or missing evidence;
- action: keep, rewrite, move, split, merge, extract-delete, delete, or user decision;
- verification performed after the action.

Mechanical corrections with exactly one supported answer may proceed. Authority, product direction, partial implementation, deletion of potentially current knowledge, or conflicting evidence is escalated. This keeps CI deterministic while making semantic review executable by agents.

**Alternative considered:** Encode semantic correctness in tests. Rejected because current tests already demonstrate that a test can preserve obsolete structure while meaning remains wrong.

### 4. Treat governance tests as consumers of policy

`tests/test-documentation-governance.test.ts` and related tests are implementation inputs, not authority. They are rewritten around schema/policy fixtures and public `docs:check` behavior. Tests no longer assert that specific legacy paths must exist merely because they existed when the test was written.

Every critical rule has one valid fixture and one controlled invalid fixture. High-value counterexamples include missing metadata, broken links and anchors, orphan current docs, invalid root/detail authority, stale update triggers, forbidden legacy paths, stale generator output, and malformed OpenSpec relationships.

**Alternative considered:** Preserve all current tests and shape the migration around them. Rejected because multiple tests currently depend on archived or prototype files that the approved architecture deletes.

### 5. Perform evidence-owned migration, not mechanical renames

The migration map is:

| Current surface | Target action |
| --- | --- |
| `README.md` | Keep as human entrypoint; remove volatile inventories and route to owner docs. |
| `AGENTS.md` + `agent-rules/**` | Rebuild policy in `AGENTS.md`, procedures in runbooks, update every consumer, then delete `agent-rules/**`. |
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

The new runbooks are created and verified before old rule files are deleted. In one cutover batch, `AGENTS.md`, `CLAUDE.md`, `openspec/config.yaml`, root/docs routers, generator classification, governance tests, and all current links switch to the new paths. Only then is `agent-rules/**` removed.

During semantic verification, hardcoded environment facts are rechecked instead of copied blindly: local-versus-`mypc` deployment, Windows paths, ports, public URL, log names, Prisma `db push`, queue authentication and recovery, and service restart targeting. Uncertain major policy is presented to the user. Default commit/push and deployment behavior remains unchanged unless separately approved.

### 7. Delete archive and prototype surfaces with explicit gates

Archive migration uses `git ls-files docs/archive` at implementation start as the complete input set. Each semantic batch must reach one of two outcomes: verified current information has been integrated into an owner and its consumers pass, or the source has no current value. The final gate requires no tracked archive/history path and no live reference. Git preserves recovery; OpenSpec archive preserves change artifacts.

Prototype cleanup does not require design preservation because the user explicitly discarded the entire set. Before deletion, a source scan proves production does not import prototype assets. Prototype-only tests and mappings are removed; current Training routes and behaviors remain protected by production tests and current docs.

### 8. Activate documentation-specific CI only at zero violations

The implementation may run `docs:check` locally while migration is in progress, but stage acceptance requires zero violations and a checked-in doc-specific CI job using the exact command in a clean checkout. Evidence includes success, a controlled negative fixture failure, restored success, and confirmation that the check is required on protected merge paths.

This is narrower than the final harness CI convergence. It protects documentation immediately without prematurely choosing observability or engineering-standard jobs.

### 9. Keep future files honest and future tooling deferred

`QUALITY_SCORE.md`, `RELIABILITY.md`, and `SECURITY.md` contain only metadata, purpose, deferred state, activation owner/stage, and authority boundaries. Findings and proposed work go to OpenSpec, not placeholder backlogs.

The documentation stage establishes root `PRODUCT.md`/`DESIGN.md` and detailed design routing that can support Impeccable later, but it does not change root `DESIGN.md` to the Impeccable six-section schema or create `.impeccable/**`, `.agents/skills/impeccable/**`, `.codex/hooks.json`, detector baselines, or sidecar checks. That integration must revalidate the then-current repository in its own change.

## Data Flow

```text
tracked files + current source/tests/schemas + active OpenSpec changes + Git history
  -> governed-path enumeration
  -> metadata/profile resolution
  -> topology/link/reachability graph
  -> deterministic docs:check findings
  -> semantic section audit for meaning
  -> current-owner rewrite or extract/delete decision
  -> owning tests/runtime verification
  -> regenerated in-place inventory
  -> zero-violation local docs:check
  -> clean-checkout documentation CI
  -> user review and stage acceptance
```

## Error Handling

- Invalid metadata, topology, links, or OpenSpec structure blocks migration acceptance with deterministic diagnostics.
- Conflicting evidence blocks only the affected semantic rewrite and is escalated; it is not resolved by choosing the newest prose file.
- Missing required runtime evidence prevents the affected claim from becoming current truth.
- A failed mixed-content migration keeps the original file until all current owner replacements for that batch are verified.
- A failed `agent-rules` cutover restores the prior paths as one batch; no half-migrated dual authority is accepted.
- Archive deletion fails if any baseline item lacks a disposition, any consumer still reads the path, or an extracted contract lacks verification.
- Prototype deletion fails if production source imports prototype assets or current Training coverage regresses.
- Generator check mode must never repair drift automatically; it reports the separate write command.
- Missing branch-protection authority leaves the required-check task incomplete and is reported as an external action.

## Verification

- Validate proposal, design, specs, and tasks with the repository-pinned OpenSpec version in strict, non-interactive mode.
- Unit-test metadata parsing, schema profiles, path normalization, policy validation, Markdown links/anchors, graph reachability, trigger matching, and generator check mode.
- Exercise valid and invalid fixtures for every critical docs rule.
- Run focused source-contract tests after each migration batch and the full repository suite before cutover.
- Run the semantic audit navigation exercise: `AGENTS.md -> docs/README.md -> owner README -> detail/runbook/test` for representative architecture, Generation, Training, shared resource, deployment, API, design, and testing tasks.
- Prove `npm run docs:check` is deterministic, network-free, non-writing, and identical in local and CI execution.
- Prove `rg`/tracked-file checks contain no live `agent-rules`, archive, history, prototype, legacy Superpowers planning, or non-OpenSpec plan authority.
- Verify the runtime-template relocation with loader, generation workflow, build, and applicable deployment checks.
- Require explicit user review of the exact OpenSpec artifact revision before apply and explicit acceptance after verification.

## Risks / Trade-offs

- **Semantic migration scope is large** → Use small domain batches, explicit evidence, and owner-specific verification; do not reduce scope by retaining stale compatibility directories.
- **Metadata becomes bureaucratic** → Keep instance fields limited to routing, authority, evidence, triggers, and verification; derive inventories rather than duplicating them.
- **Changed-source triggers create false positives** → Map at owner/module granularity and permit a reviewable verification-only update, never a silent bypass.
- **Deleting historical files loses convenient browsing** → Git and OpenSpec retain recovery while current agents avoid stale default context.
- **API/testing paths may later fit another taxonomy** → Keep them as verified current owners now and revisit only with observed harness evidence.
- **CI branch settings may require external access** → Treat configuration proof as an explicit acceptance gate.
- **Moving a runtime template expands verification** → Isolate it in its own batch and follow normal runtime safety rules.

## Migration Plan

1. Complete the parent OpenSpec pinning, exact-artifact approval, and stage-order prerequisites before child apply.
2. Freeze a read-only `git ls-files` baseline and run current tests to capture known failures without treating them as target authority.
3. Add `_meta` schema, policy, templates, deterministic check components, and counterexample fixtures.
4. Establish root and directory routers, then rebuild current architecture, product, design, API, testing, and runbook knowledge in evidence-reviewed batches.
5. Perform the atomic `AGENTS.md`/runbook cutover and remove `agent-rules/**`.
6. Remove legacy non-OpenSpec plan/spec surfaces and relocate non-plan data out of `docs/plans/**`.
7. Extract current value from all archive items, update dependent tests/consumers, and delete `docs/archive/**`.
8. Remove prototype-specific consumers and delete all `docs/prototypes/**` files.
9. Move runtime/config assets out of documentation ownership in isolated verified batches.
10. Rebuild the in-place inventory, clear every deterministic and semantic finding, and run the full verification suite.
11. Add and prove the required documentation CI check, present evidence for user acceptance, and archive the child under OpenSpec only after acceptance.

Rollback is commit- and batch-scoped. Each migration batch keeps its source until replacements and consumers pass. Revert only the failed batch, preserve unrelated worktree changes, and never use broad destructive reset commands.

## Documentation Impact

This change intentionally rewrites the documentation control plane and current knowledge set. Its own OpenSpec artifacts remain approved-target authority until applied. Current docs are updated only from verified implementation evidence. Deleted material remains recoverable through Git; change rationale and acceptance remain in the archived OpenSpec child.

## Open Questions

No information-architecture decision remains open. During apply, any factual conflict about current product behavior, deployment policy, runtime ownership, or partial implementation is handled through the semantic-audit user-decision path rather than silently resolved in implementation.
