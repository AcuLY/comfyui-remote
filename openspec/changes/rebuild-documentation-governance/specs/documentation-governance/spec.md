## ADDED Requirements

### Requirement: Approved documentation architecture
The repository SHALL implement the user-approved documentation architecture with root `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `PRODUCT.md`, and `DESIGN.md` entrypoints; current product, architecture, detailed design, and runbook layers under `docs/**`; a minimal `docs/_meta/**` governance control plane; an explicitly invoked repository Skill at `.codex/skills/docs-audit/**`; and honest `QUALITY_SCORE.md`, `RELIABILITY.md`, and `SECURITY.md` placeholders.

Every retained documentation directory SHALL use `README.md` as its landing page. The target SHALL NOT contain a parallel `FRONTEND.md`, `PLANS.md`, `docs/exec-plans/**`, `docs/history/**`, `docs/archive/**`, or `docs/prototypes/**` surface.

#### Scenario: An agent enters the repository
- **WHEN** the agent opens the root documentation entrypoints
- **THEN** it SHALL find the project, agent-policy, architecture, product, and design maps at the approved root paths
- **AND** detailed current knowledge SHALL be reachable through `docs/README.md`

#### Scenario: A retained documentation directory is inspected
- **WHEN** a directory contains maintained documentation
- **THEN** it SHALL expose a `README.md` landing page declaring the directory purpose, authority, read triggers, and child routes

#### Scenario: A forbidden parallel layer is introduced
- **WHEN** a tracked change adds or restores a forbidden documentation or planning surface
- **THEN** documentation validation SHALL fail with the conflicting path and approved owner

### Requirement: Evidence categories and authority remain explicit
Governed knowledge SHALL distinguish verified current implementation, approved target behavior in active OpenSpec changes, and historical intent available through Git or archived OpenSpec changes. No category SHALL silently replace another.

Current descriptive documentation SHALL explain verified implemented behavior; it SHALL NOT claim an approved but unimplemented target as current. OpenSpec SHALL remain authoritative for proposed behavior, change design, implementation tasks, verification, and change archive.

#### Scenario: Old design intent conflicts with implementation
- **WHEN** historical material differs from current source, schemas, tests, or required runtime evidence
- **THEN** maintained documentation SHALL describe the verified current behavior
- **AND** historical intent SHALL remain recoverable through Git without being copied into a current-history directory

#### Scenario: An approved target is not implemented
- **WHEN** an active OpenSpec change describes behavior that has not been applied and verified
- **THEN** current descriptive documentation SHALL NOT present that behavior as implemented
- **AND** readers SHALL be routed to the active change for the proposed target

### Requirement: Progressive disclosure and navigable knowledge graph
`AGENTS.md` SHALL stay a concise policy-and-routing entrypoint. `docs/README.md` and directory `README.md` files SHALL progressively route agents to the smallest task-relevant current source without duplicating full downstream content.

Every maintained current document SHALL be reachable from an approved entrypoint, and every detail document SHALL link back to its owning landing page or governing root contract.

#### Scenario: An agent starts a scoped task
- **WHEN** the task matches a declared read trigger
- **THEN** `AGENTS.md` or `docs/README.md` SHALL identify the next required owner document or runbook
- **AND** unrelated documentation SHALL not be mandatory reading

#### Scenario: A current document becomes orphaned
- **WHEN** no approved root or directory entrypoint reaches a maintained document
- **THEN** documentation validation SHALL fail and report the missing routing edge

#### Scenario: A detail document duplicates its root contract
- **WHEN** a detail document attempts to redefine root product, architecture, design, or policy authority instead of linking to it
- **THEN** the semantic audit SHALL report duplicate authority for resolution

### Requirement: Minimal machine-governance control plane
`docs/_meta/**` SHALL contain only the documentation-governance README, machine-readable document schema, structural/link policy, and current-document authoring templates. It SHALL NOT contain product or architecture facts, a manually synchronized per-file registry, generated audit reports, OpenSpec artifact templates, or a second planning lifecycle.

Per-document metadata SHALL be authoritative at the document instance. The `_meta` schema and policy SHALL define valid profiles and constraints without duplicating every document's instance values. Exact source-to-document relationships SHALL be typed as deterministic `contract` relationships or semantic `review` relationships rather than sharing one ambiguous update-trigger meaning.

#### Scenario: A governed document is added or changed
- **WHEN** documentation validation reads the document
- **THEN** its applicable profile, owner, authority, status, read triggers, typed source relationships, evidence, and verification contract SHALL resolve without path-guessing ambiguity

#### Scenario: A runbook is validated
- **WHEN** a document uses the runbook profile
- **THEN** its metadata SHALL additionally identify the applicable environment, risk boundary, last verification state, and recovery path

#### Scenario: A generated artifact already exists
- **WHEN** an existing document is owned by a generator
- **THEN** its metadata SHALL identify the generator, source inputs, regeneration command, and non-writing check
- **AND** this SHALL NOT require moving it into a generated directory

#### Scenario: A source relationship is declared
- **WHEN** policy maps a source path to maintained documentation
- **THEN** the mapping SHALL declare either `contract` with a deterministic non-writing verifier or `review` with a reason and owner
- **AND** a required deterministic contract SHALL NOT be downgraded to a warning or semantic review

### Requirement: OpenSpec is the only significant-change lifecycle
The repository SHALL use OpenSpec proposal, behavior specs, change design, tasks, apply, verification, and archive conventions as the only lifecycle for significant changes. Legacy Superpowers specs, implementation notes, execution plans, PRDs acting as plans, and `docs/plans/**` planning authority SHALL be extracted or relocated by ownership and then removed.

The child change's `tasks.md` SHALL be the complete implementation task plan for this stage; no separate ExecPlan, `PLANS.md`, or detailed implementation-plan artifact SHALL be created.

#### Scenario: Significant work is proposed
- **WHEN** work changes a capability, architecture, performance contract, or repository-wide policy
- **THEN** the work SHALL be represented by an OpenSpec change before implementation
- **AND** no parallel plan or spec document SHALL become authoritative

#### Scenario: Legacy planning content contains a current fact
- **WHEN** semantic audit verifies that the fact still describes implemented behavior
- **THEN** the fact SHALL be rewritten into its current owner document or living spec
- **AND** the legacy planning artifact SHALL then be deleted

#### Scenario: A non-plan dataset is stored below docs/plans
- **WHEN** audit proves the files are runtime inputs, benchmark fixtures, or generated analysis outputs rather than plans
- **THEN** they SHALL be relocated to their code, test-fixture, configuration, or artifact owner
- **AND** `docs/plans/**` SHALL not remain as a naming exception

### Requirement: Agent policy and runbook authority are separated
`AGENTS.md` SHALL be the only authority for mandatory ordinary-development agent workflow policy, including triggers, default behavior, prohibitions, and safety boundaries. `docs/runbooks/**` SHALL be the only authority for executable operational procedures, commands, expected results, failure handling, and recovery. The explicitly invoked `$docs-audit` Skill SHALL own its semantic-audit workflow and SHALL NOT be copied into `AGENTS.md` or exposed as a second runbook entrypoint.

After policy and procedure have been verified in their new owners, `agent-rules/**` SHALL be deleted atomically with all documentation, OpenSpec configuration, generator, and test references to it. No compatibility stub or manually synchronized projection SHALL remain.

#### Scenario: A task has no operational trigger
- **WHEN** an agent reads `AGENTS.md` for a task that does not involve Git delivery, local service work, deployment, authentication, or another declared operation
- **THEN** the agent SHALL receive the applicable hard boundaries without loading unrelated runbook commands

#### Scenario: A deployment operation is triggered
- **WHEN** the task requires production build, synchronization, queue interruption, service restart, or public verification
- **THEN** `AGENTS.md` SHALL require the applicable deployment runbook
- **AND** the runbook SHALL contain the executable sequence and recovery behavior

#### Scenario: Migration of agent rules completes
- **WHEN** the new policy and runbooks pass their contract and navigation tests
- **THEN** `agent-rules/**` and every live reference to it SHALL be absent from the tracked repository

#### Scenario: Ordinary development changes documentation or source
- **WHEN** no user request or approved OpenSpec task explicitly invokes `$docs-audit`
- **THEN** `AGENTS.md`, source mappings, and documentation routers SHALL NOT auto-run the Skill
- **AND** deterministic contract checks and non-blocking review diagnostics MAY still run through `docs:check`

### Requirement: Explicit repository Skill for semantic documentation audit
The repository SHALL provide `.codex/skills/docs-audit/**` as the single explicitly invoked `$docs-audit` execution surface for semantic defects not provable by deterministic tooling, including stale claims, missing coverage, duplicate authority, partial implementation, invalid runbook steps, and current-versus-target confusion. It SHALL NOT add a controlled `docs:read` CLI, documentation MCP gateway, automatic ordinary-development trigger, or scheduled audit job.

Invocation SHALL accept one of `changed`, explicit repository-relative `paths`, active OpenSpec `change <id>`, or `full` scope. `report` SHALL be the default operation and write nothing. Explicit `record` MAY write only the scoped audit evidence named by an approved OpenSpec task under that change's `evidence/docs-audit/**`; it SHALL NOT edit audited documents. High-confidence document mutation SHALL require an explicit `fix` operation and independent semantic review before the same scope can pass. The audit SHALL examine source, schemas, tests, Git history, and required runtime evidence; categorize claims as current implementation, approved target, or historical intent; and produce one of `keep`, `rewrite`, `move`, `split`, `merge`, `extract-delete`, `delete`, or `user-decision-required` for the audited scope.

Ad hoc audits SHALL return their report in the invoking task without writing a permanent ledger. An approved OpenSpec task that requires durable evidence SHALL explicitly invoke `record` or `fix` and name the contained evidence path. Scheduling remains a future separately approved decision.

#### Scenario: Static evidence proves one current correction
- **WHEN** source, schema, tests, or unambiguous Git history support exactly one current-behavior correction
- **THEN** read-only audit SHALL propose that correction with cited evidence
- **AND** explicit `fix` mode MAY apply it, run the owning verification, and require independent review

#### Scenario: Evidence is conflicting or incomplete
- **WHEN** more than one interpretation remains reasonable, required runtime evidence is unavailable, or the decision changes product direction or authority
- **THEN** the agent SHALL preserve the uncertainty
- **AND** request user judgment before rewriting current truth

#### Scenario: Structural checks pass but meaning is stale
- **WHEN** a document has valid metadata and links but contradicts verified behavior or contains an unsafe operational sequence
- **THEN** semantic audit SHALL fail that scope and identify the conflicting claim and evidence

#### Scenario: A semantic audit is requested without a scope
- **WHEN** the user explicitly invokes `$docs-audit` without a narrower scope
- **THEN** the Skill SHALL use changed scope when a safe merge base exists
- **AND** SHALL use full scope when the changed impact closure cannot be established safely

#### Scenario: A high-confidence finding is fixed
- **WHEN** an explicitly authorized audit applies a correction with one evidence-supported answer
- **THEN** a separate agent or reviewer SHALL verify the changed scope against the same evidence contract
- **AND** the fixer SHALL NOT sign its own semantic pass

#### Scenario: An OpenSpec task requests an audit record
- **WHEN** an approved task explicitly invokes `$docs-audit ... record` and names its evidence output
- **THEN** the Skill MAY write only that contained audit evidence
- **AND** SHALL leave audited documents and every other path unchanged

#### Scenario: No write operation is authorized
- **WHEN** `$docs-audit` is invoked without `record` or `fix`
- **THEN** the Skill SHALL write no repository file

#### Scenario: Independent review is unavailable
- **WHEN** an audit applied changes but no independent reviewer can run
- **THEN** the result SHALL remain `review-required`
- **AND** SHALL NOT be recorded as a passing semantic audit

### Requirement: Current documentation is reconstructed from evidence
Every retained current document SHALL be reviewed at section level against its owning implementation, schemas, tests, and required runtime behavior. Content SHALL be moved by knowledge ownership rather than by mechanical directory rename, and duplicate current authority SHALL be eliminated.

Code or configuration changes that match a deterministic `contract` relationship SHALL update and reverify the owned document or satisfy its exact non-writing no-content-change verifier in the same change. A matched semantic `review` relationship SHALL emit a non-blocking review diagnostic; it SHALL NOT auto-run `$docs-audit`, but every such diagnostic SHALL receive an explicit disposition before documentation-stage acceptance.

#### Scenario: A mixed legacy document is migrated
- **WHEN** one file contains product intent, architecture, operational commands, and obsolete implementation notes
- **THEN** each verified section SHALL move to the corresponding product, architecture, or runbook owner
- **AND** obsolete or unverified sections SHALL not be copied as current truth

#### Scenario: An owning source changes
- **WHEN** a changed path matches a document's deterministic `contract` relationship
- **THEN** local and CI validation SHALL require the owning documentation update or exact no-content-change proof
- **AND** fail when the required contract is absent or stale

#### Scenario: A semantic review relationship matches
- **WHEN** a changed path matches a `review` relationship
- **THEN** deterministic validation SHALL emit an owned warning with the relationship evidence
- **AND** ordinary development SHALL NOT automatically invoke `$docs-audit`

### Requirement: Archive knowledge is extracted and the archive is deleted
Every tracked item under `docs/archive/**` at migration baseline SHALL be reviewed for still-valid current knowledge. Verified durable knowledge SHALL be incorporated into its current owner before the source is deleted; content without current value SHALL be deleted without a replacement document.

The completed repository SHALL contain no `docs/archive/**`, no `docs/history/**`, no live link to either path, and no code or test that treats deleted historical material as current authority. Git and OpenSpec archives SHALL provide historical recovery.

#### Scenario: A test reads an archived roadmap as authority
- **WHEN** migration finds a test, script, or current document reading an archived file
- **THEN** the still-valid contract SHALL first move to current code, tests, policy, or descriptive documentation
- **AND** the consumer SHALL be updated before archive deletion

#### Scenario: Archived content has no current value
- **WHEN** evidence shows the content is obsolete, abandoned, duplicated, or never implemented
- **THEN** it SHALL be deleted without creating a history replacement

#### Scenario: Archive deletion is proposed complete
- **WHEN** the final archive batch is removed
- **THEN** tracked-file and reference checks SHALL prove zero archive/history files and zero live references

### Requirement: Training prototypes are discarded
All tracked files under `docs/prototypes/**`, including Training HTML, CSS, JavaScript, images, fonts, and prototype metadata, SHALL be deleted. Prototype-specific route maps, inventory classifications, documentation links, and governance tests SHALL also be removed or replaced with current production contracts.

Training SHALL remain documented as a production work mode peer to Generation, selected through the shared navigation mode toggle, and production source SHALL not depend on deleted prototype assets.

#### Scenario: Prototype deletion begins
- **WHEN** the prototype surface is removed
- **THEN** validation SHALL first prove that production source does not import or load prototype-only assets
- **AND** current Training behavior SHALL remain covered by production source and tests

#### Scenario: A prototype-only governance test remains
- **WHEN** a test requires deleted prototype files or mappings to exist
- **THEN** the test SHALL be deleted or rewritten to verify a current production boundary

#### Scenario: Prototype cleanup completes
- **WHEN** the cleanup is declared complete
- **THEN** no tracked prototype file, prototype-specific live link, or history copy SHALL remain
- **AND** production verification SHALL preserve the shared navigation mode toggle between Generation and Training

### Requirement: Generated and reference directory taxonomy is deferred
This change SHALL NOT create `docs/generated/**` or `docs/references/**` or mechanically move documents merely to impose that distinction. Existing generated and reference-like material SHALL remain at a verified current owner unless another approved migration reason applies.

The documentation policy SHALL retain enough provenance to validate existing generators and hand-maintained evidence without deciding a permanent directory taxonomy. A later OpenSpec change SHALL use observed maintenance evidence before introducing either directory.

#### Scenario: Existing generated inventory is validated
- **WHEN** its source or generator changes
- **THEN** the existing artifact SHALL be regenerated or checked in its current approved location
- **AND** this stage SHALL not create a generated directory solely for it

#### Scenario: A document could be called a reference
- **WHEN** the document has a clear current product, architecture, API, testing, or runbook owner
- **THEN** it SHALL remain with that owner during this stage

### Requirement: Finite governed scope and Markdown semantics
The documentation policy SHALL enumerate a finite scope matrix. Root entrypoints and approved `docs/**` current knowledge SHALL receive documentation metadata, topology, navigation, relationship, and semantic-audit governance. OpenSpec artifacts SHALL receive pinned OpenSpec validation and internal-link checks but no current-document frontmatter or navigation authority. Project Skills SHALL receive Agent Skills validation and internal-link checks but no documentation frontmatter. Source-adjacent Markdown such as `src/**.md` and `tests/**.md` SHALL be explicitly registered, migrated, or deleted rather than admitted by an unrestricted catch-all.

Markdown validation SHALL use GitHub-Flavored Markdown parsing and GitHub-compatible heading slugs, including duplicate-heading suffixes. Fenced or indented code, inline code, HTML comments, and non-current OpenSpec evidence SHALL not create live path references or navigation edges. Internal relative links and anchors SHALL be deterministic; external link reachability, document age, suspected prose duplication, and prose quality SHALL not become network-dependent blockers.

#### Scenario: An OpenSpec artifact is checked
- **WHEN** a proposal, spec, design, task, or evidence file is in scope
- **THEN** pinned OpenSpec and applicable internal-link validation SHALL run
- **AND** the artifact SHALL NOT be treated as current descriptive documentation or required to join the current navigation graph

#### Scenario: A project Skill is checked
- **WHEN** a tracked project Skill is in scope
- **THEN** the repository-pinned offline `npm run skills:check` command SHALL validate Agent Skills metadata, bundled-reference reachability, and repository-path safety
- **AND** the Skill SHALL NOT receive current-document frontmatter

#### Scenario: A forbidden legacy path appears only as evidence
- **WHEN** a forbidden path is quoted in a code example, negative fixture, or non-current OpenSpec evidence
- **THEN** it SHALL NOT count as a live reference
- **AND** a link, policy field, source/config consumer, or current-document route to that path SHALL still fail

### Requirement: Deterministic non-writing documentation gate
The repository SHALL expose one stable `npm run docs:check` engine used locally and in CI. Full mode SHALL be the safe default and the required acceptance/CI mode. An explicit fast mode MAY compute a changed-scope impact closure from a valid merge base, but SHALL escalate to full when the base is unavailable, policy/schema/OpenSpec/Skill/generator code changes, documents move or are deleted, root/navigation authority changes, or impact cannot be bounded safely. Full mode SHALL always run every current-state structural, contract, generator, OpenSpec, and Skill check. With no comparison base, it SHALL conservatively emit every semantic `review` relationship as a warning rather than skip review coverage; CI and stage-acceptance invocations SHALL provide an explicit comparison revision. The engine SHALL run without network access, produce deterministic results, and preserve the complete pre-existing worktree state.

The gate SHALL validate applicable metadata profiles, the finite scope matrix, allowed structure, required landing pages, GFM relative links and anchors, root-to-owner reachability, required reverse links, forbidden live legacy paths, OpenSpec structure, `contract` and `review` relationships, source-derived contract synchronization, and freshness of existing generator-owned artifacts.

Human and JSON diagnostics SHALL share a stable schema with rule identifier, `error` or `warning` severity, repository-relative path, location, evidence, remediation, and owner, sorted deterministically. Exit `0` means no deterministic error, exit `1` means rule violations, and exit `2` means tool/configuration failure. Warnings MAY represent heuristic review facts only and SHALL NOT downgrade a required deterministic contract.

#### Scenario: Documentation is valid
- **WHEN** the local documentation check runs on a compliant checkout
- **THEN** it SHALL exit successfully
- **AND** a before/after snapshot SHALL prove it changed no tracked, staged, or pre-existing untracked content even when the checkout was already dirty

#### Scenario: A document violates a deterministic rule
- **WHEN** metadata, structure, navigation, links, anchors, relationship coverage, OpenSpec validity, or generated freshness is invalid
- **THEN** the command SHALL exit `1` with the stable file, location, rule identifier, evidence, owner, and remediation fields

#### Scenario: Fast scope is unsafe
- **WHEN** fast mode cannot establish a complete impacted-document and contract closure
- **THEN** the same engine SHALL run full mode rather than silently skip checks

#### Scenario: Full mode has no comparison revision
- **WHEN** full mode cannot resolve a merge base and no explicit base is supplied
- **THEN** it SHALL run every deterministic current-state verifier
- **AND** emit every semantic `review` relationship as an owned warning with missing-base evidence

#### Scenario: The checker itself fails
- **WHEN** configuration cannot be parsed, Git state cannot be inspected, or a required adapter crashes
- **THEN** the command SHALL exit `2`
- **AND** SHALL distinguish the tool failure from repository rule violations

#### Scenario: A generator is stale
- **WHEN** existing source inputs no longer match a committed generator-owned document
- **THEN** check mode SHALL fail without rewriting the document
- **AND** identify the separate regeneration command

#### Scenario: A volatile contract drifts
- **WHEN** documented route, method, request/response, schema, MCP, or configuration inventory differs from its owning source
- **THEN** the source-contract check SHALL fail with the mismatched contract and owner
- **AND** handwritten explanation SHALL not become an unverified second inventory

### Requirement: Governance tests prove target contracts rather than preserve legacy structure
Documentation-governance tests SHALL be derived from the approved schema and policy. Existing tests SHALL be rewritten or removed when they hard-code obsolete paths, stale content, duplicate authority, historical documents, or implementation details that are not part of the target contract.

Every critical deterministic rule family SHALL include a valid fixture and a counterexample that demonstrates failure.

#### Scenario: An old test requires agent-rules or archive files
- **WHEN** the approved target deletes those paths
- **THEN** the old assertion SHALL not block migration
- **AND** replacement coverage SHALL verify the new AGENTS/runbook or current-authority contract

#### Scenario: A linter regression stops detecting a violation
- **WHEN** metadata, broken-link, orphan, forbidden-path, relationship, or generated-drift validation is weakened
- **THEN** the corresponding negative fixture SHALL fail the test suite

### Requirement: Documentation-specific CI hard cutover
After all in-scope legacy violations are cleared, a checked-in documentation CI job SHALL run the exact local non-writing gate in full mode from a clean checkout, prove a clean end state, and become required on every protected merge path without a documentation-only path filter. The stage SHALL NOT retain permanent legacy allowlists or call a warning-only job complete. Every warning and semantic-audit finding in the acceptance scope SHALL have an explicit evidence-backed disposition, while every deterministic error SHALL be resolved.

This documentation-specific gate SHALL not preselect the later unified repository CI design.

#### Scenario: Cleanup is incomplete
- **WHEN** deterministic violations, required semantic decisions, forbidden paths, or migration references remain
- **THEN** the documentation stage SHALL not be accepted or archived

#### Scenario: Blocking CI is enabled
- **WHEN** the documentation gate is proposed for acceptance
- **THEN** evidence SHALL include a successful clean-start/clean-end full run with the protected comparison revision, a controlled counterexample failure, a restored successful run, no docs-only path filter, and required-check configuration

#### Scenario: A warning remains at acceptance
- **WHEN** a heuristic review warning or semantic-audit finding remains after cleanup
- **THEN** the acceptance evidence SHALL record its owner, evidence, and explicit disposition
- **AND** SHALL NOT relabel a deterministic contract failure as a warning

#### Scenario: Required-check permission is unavailable
- **WHEN** repository settings cannot be changed with available authority
- **THEN** the missing external action SHALL be reported
- **AND** the blocking-gate task SHALL remain incomplete

### Requirement: Deferred placeholders and future integrations remain honest
`docs/QUALITY_SCORE.md`, `docs/RELIABILITY.md`, and `docs/SECURITY.md` SHALL initially contain only purpose, deferred status, owner, activation stage, and authority boundaries. They SHALL NOT claim unverified scores, SLOs, security models, or backlog authority.

Impeccable installation, root `DESIGN.md` schema conversion, sidecar generation, Impeccable hooks, detectors, critique reports, and CI integration SHALL remain outside this change and require a separate approved OpenSpec change. Observability and engineering-standard content SHALL likewise remain deferred to their approved stages, except for the separately authorized local path-match experiment recorded by the parent change.

The sanitized PreToolUse path-match spike under this change's evidence directory SHALL remain non-normative and uninstalled, and SHALL be excluded as documentation-governance implementation, instrumentation, CI input, or acceptance evidence. A pre-archive hygiene task MAY confirm those boundaries without adopting the spike. It SHALL be interpreted only as attempted repository-path matching, not successful file access or comprehension. When this child is archived, the evidence SHALL remain recoverable there; the later observability child MAY reference or copy a digest-bound snapshot only after fresh design and revalidation.

The separately user-authorized root Hook successor SHALL remain outside this child. Its tracked Hook and recorder MAY produce only ignored repository-local `logs/**` and `metrics/**`; their existence SHALL NOT count as documentation-governance implementation, instrumentation, or acceptance evidence.

#### Scenario: A placeholder is read before activation
- **WHEN** an agent opens a deferred placeholder
- **THEN** it SHALL clearly state that no current metric, SLO, or security contract is being asserted
- **AND** route proposed work through OpenSpec

#### Scenario: Impeccable-compatible files are planned
- **WHEN** this change establishes root product/design placement and detailed design routing
- **THEN** it SHALL preserve a viable future integration boundary
- **BUT** SHALL not install, execute, or enforce Impeccable artifacts

#### Scenario: A later stage has not been approved
- **WHEN** documentation governance encounters desired observability or engineering-policy content
- **THEN** it SHALL record only the current verified boundary or placeholder
- **AND** defer implementation choices to the later user-approved change

#### Scenario: The PreToolUse spike is encountered during this child
- **WHEN** an agent reviews the preserved hook source, sample events, or aggregate field named `access_total`
- **THEN** it SHALL treat them as non-production feasibility evidence for attempted path matches
- **AND** SHALL NOT install, expand, or accept them as documentation-governance instrumentation

#### Scenario: The separately authorized successor Hook is encountered
- **WHEN** an agent encounters `.codex/hooks.json`, `scripts/observability/agent_file_access_hook.py`, or ignored local access-attempt data
- **THEN** it SHALL treat them as the user's bounded service-free experiment outside this child
- **AND** SHALL NOT infer successful reads, comprehension, production observability acceptance, or permission to expand the experiment
