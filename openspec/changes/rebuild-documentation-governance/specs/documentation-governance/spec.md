## ADDED Requirements

### Requirement: User-approved documentation information architecture
The documentation-governance change SHALL begin by co-designing a repository-specific documentation structure with the user, and SHALL NOT perform any migration mutation before that structure is explicitly approved.

The approval record SHALL bind the exact blueprint content digest, approval scope, and user decision reference. Any blueprint content change SHALL invalidate approval. Before valid approval, migration mutations—including moves, deletion, lifecycle reclassification, current-authority changes, governed-content rewrites, and final migration dispositions—SHALL remain blocked; read-only inventory, evidence gathering, option authoring, and planning validation MAY continue.

#### Scenario: The change begins
- **WHEN** documentation-governance implementation starts
- **THEN** the agent SHALL present alternative target structures and their trade-offs
- **AND** obtain user approval for directory classes, naming, ownership, authority, navigation, lifecycle, and update triggers

#### Scenario: Target structure is not approved
- **WHEN** the documentation structure still has unresolved choices
- **THEN** automated inventory work MAY continue
- **BUT** every migration mutation SHALL remain blocked

#### Scenario: An approved blueprint changes
- **WHEN** content in the approved documentation blueprint changes
- **THEN** its approval record SHALL become stale
- **AND** migration mutations SHALL remain blocked until the user approves the new digest

### Requirement: Progressive agent disclosure
The knowledge system SHALL provide a short `AGENTS.md` entrypoint that routes agents progressively to task-relevant maintained sources without duplicating the complete knowledge base.

#### Scenario: An agent starts a task
- **WHEN** an agent reads `AGENTS.md`
- **THEN** it SHALL be able to identify required workflow rules and the next task-specific documentation entrypoint

#### Scenario: A maintained current document is added
- **WHEN** a new current documentation source is introduced
- **THEN** it SHALL be reachable through the approved documentation routing graph
- **AND** SHALL NOT require expanding `AGENTS.md` into a monolithic manual

### Requirement: Machine-readable document identity
Every governed document SHALL have an explicit or inherited machine-readable identity covering classification, lifecycle status, owner, normalized authority subject/kind/scope, update trigger, evidence expectations, and replacement relationship where applicable.

#### Scenario: A current document is inspected
- **WHEN** `docs:check` evaluates the document
- **THEN** its identity SHALL resolve without heuristic ambiguity

#### Scenario: An archived document is inspected
- **WHEN** an archived document is retained
- **THEN** its original role, implementation status, current replacement, and historical-only status SHALL be resolvable

### Requirement: Deterministic documentation gate
The repository SHALL provide one deterministic `docs:check` entrypoint that produces equivalent results locally and in CI.

#### Scenario: Structural documentation is valid
- **WHEN** `docs:check` runs on a valid repository state
- **THEN** it SHALL exit successfully without modifying tracked files

#### Scenario: Structural documentation is invalid
- **WHEN** metadata, paths, links, anchors, reachability, classification, generated artifacts, or OpenSpec structure are invalid
- **THEN** `docs:check` SHALL fail with an actionable message identifying the document, rule, and remediation

### Requirement: Documentation graph integrity
The automated gate SHALL validate relative links, anchors, current-document reachability, authority uniqueness, and permitted edges between current, generated, prototype, reference, active-change, living-spec, and historical layers.

#### Scenario: A current document becomes orphaned
- **WHEN** no approved entrypoint reaches a maintained current document
- **THEN** `docs:check` SHALL fail

#### Scenario: Current guidance relies on historical authority
- **WHEN** a current workflow is documented only in archive or a current index treats an archived artifact as active truth
- **THEN** `docs:check` SHALL fail

#### Scenario: Complementary documents cover one subject
- **WHEN** a contract, runbook, and living spec describe different permitted authority kinds for the same normalized subject and scope
- **THEN** the graph SHALL preserve the approved cross-layer relationships
- **AND** SHALL NOT report duplicate authority solely because the subject matches

### Requirement: Generated artifacts are reproducible
Every generated documentation artifact SHALL have an owning generator with a non-writing check mode, and the committed artifact SHALL match regenerated output exactly.

#### Scenario: Source input changes without regeneration
- **WHEN** a generator input changes and the committed output is stale
- **THEN** `docs:check` SHALL fail with the owning regeneration command

#### Scenario: Check mode runs
- **WHEN** CI checks a generated artifact
- **THEN** the generator SHALL compare expected output without rewriting the worktree

### Requirement: Source-derived contracts are generated or verified
Volatile API, route, schema, MCP, configuration, and similar source-derived facts SHALL be generated from source or mechanically verified instead of relying on unguarded handwritten claims.

#### Scenario: A route contract changes
- **WHEN** an HTTP method, path, request field, response envelope, or documented exception changes
- **THEN** the owning generated contract or verification SHALL detect the mismatch

#### Scenario: Human documentation explains a workflow
- **WHEN** a maintained document describes semantics that cannot be generated usefully
- **THEN** it SHALL link to the source-derived contract
- **AND** avoid becoming a second volatile inventory

### Requirement: Agent-executable semantic audit
The repository SHALL define a repeatable agent audit process for semantic defects that deterministic validation cannot prove, including stale claims, incomplete coverage, conflicting authority, partial implementation, and invalid runbook meaning.

#### Scenario: An agent audits a document
- **WHEN** a document enters the semantic audit workflow
- **THEN** the audit record SHALL identify its claims, claim categories, evidence, implementation status, conflicts, missing coverage, confidence, actor identity, recommended action, and user questions

#### Scenario: A deterministic gate passes but meaning is stale
- **WHEN** a document is structurally valid but conflicts with verified behavior or misrepresents its authority
- **THEN** the semantic audit SHALL report the defect

### Requirement: Evidence-backed automatic repair
An audit agent MUST NOT automatically repair a documentation defect unless source, schema, tests, generator output, or unambiguous Git history support exactly one reasonable correction; in every other case, the agent MUST leave the defect unchanged and route it through the required decision path.

Automatic semantic content repair MUST be limited to a claim explicitly classified as `current-implementation` with high confidence and no conflict or unresolved state. The agent MUST NOT automatically change the meaning of an `approved-target` or `historical-intent` claim.

#### Scenario: A moved file has one replacement
- **WHEN** Git history proves a unique rename and an old relative link is stale
- **THEN** the audit agent MAY update the link and record before/after evidence

#### Scenario: Multiple corrections are reasonable
- **WHEN** evidence permits more than one authority, product interpretation, deletion decision, or module ownership
- **THEN** the audit agent SHALL NOT choose automatically
- **AND** SHALL request a user decision

#### Scenario: A unique source fact conflicts with target or history
- **WHEN** current source proves one implementation fact but the affected claim is classified as `approved-target` or `historical-intent`
- **THEN** the audit agent SHALL preserve the claim category and meaning
- **AND** SHALL route any proposed semantic change to user review

### Requirement: Independent semantic verification
An agent that modifies documents from audit findings SHALL NOT be the sole semantic verifier of those changes. The verification record SHALL identify a different agent/context identity, and that verifier SHALL re-read the original evidence.

#### Scenario: High-confidence repairs complete
- **WHEN** an audit agent applies automatic repairs
- **THEN** an independent verification pass SHALL review the evidence, resulting claims, and automated checks before acceptance

#### Scenario: Repairer and verifier identities match
- **WHEN** the verification record names the same agent/context identity as the repair record
- **THEN** the repair SHALL remain unverified
- **AND** the governance gate SHALL fail

### Requirement: Explicit unresolved states
The audit workflow SHALL preserve unresolved conditions as explicit states rather than promoting uncertain material into current truth.

#### Scenario: Source and tests conflict
- **WHEN** source behavior and test expectations materially disagree
- **THEN** the record SHALL be marked `evidence-conflict`
- **AND** semantic migration SHALL stop for the affected claim

#### Scenario: Runtime evidence is required but unavailable
- **WHEN** a UI, performance, worker, or operational claim cannot be proven statically and the required environment is unavailable
- **THEN** the record SHALL be marked `runtime-verification-required`
- **AND** SHALL NOT be promoted into current truth

#### Scenario: User judgment is required
- **WHEN** the decision changes product direction, authority, deletion, module ownership, or whether a partial design continues
- **THEN** the record SHALL be marked `user-decision-required`
- **AND** migration SHALL pause for that decision

### Requirement: Full verified historical migration
Every governed historical planning, design, operational, prototype, handoff, progress, analysis, and retained-attachment artifact in the frozen baseline SHALL receive a verified OpenSpec historical migration record before the old planning model is retired.

#### Scenario: A historical design is still implemented
- **WHEN** current evidence proves that the design remains active behavior
- **THEN** its durable behavior SHALL be represented in the appropriate living spec through a validated migration
- **AND** the historical record SHALL retain origin and rationale

#### Scenario: A historical design drifted
- **WHEN** implementation differs from the original design
- **THEN** the migration SHALL preserve both original intent and verified current behavior
- **AND** explain the divergence

#### Scenario: A historical design was never implemented
- **WHEN** evidence shows no implementation or the work was abandoned
- **THEN** it SHALL remain historical-only
- **AND** SHALL NOT become an active task without a new approved change

### Requirement: Historical migration schema
The documentation-governance change SHALL introduce and validate a repository-owned OpenSpec schema for historical migration records without replacing the default spec-driven workflow for new changes.

#### Scenario: A legacy artifact enters migration
- **WHEN** an old spec, plan, PRD, or prototype is processed
- **THEN** the historical-migration schema SHALL require origin, intent, evidence, status, divergence, decision, and current-spec impact

#### Scenario: New feature work begins
- **WHEN** a future significant change is proposed
- **THEN** it SHALL use the repository's normal spec-driven workflow rather than the historical-migration schema

### Requirement: Complete and non-duplicative audit accounting
The documentation-governance change SHALL freeze a baseline manifest with a stable identifier and content digest for every governed current document, historical artifact, and retained attachment. Every current document SHALL have exactly one final semantic-audit disposition, and every historical artifact or retained attachment SHALL have exactly one final migration-ledger disposition.

#### Scenario: A baseline item is missing or duplicated
- **WHEN** reconciliation finds a governed baseline identifier with zero or multiple final records in its required registry
- **THEN** `docs:check` SHALL fail with the identifier and conflicting or missing records

#### Scenario: A source changes after it was audited
- **WHEN** a final audit or migration record references a content digest that no longer matches its governed source artifact
- **THEN** the record SHALL become stale
- **AND** cutover SHALL remain blocked until the item is re-audited

#### Scenario: Reconciliation completes
- **WHEN** documentation cutover is proposed
- **THEN** baseline, audit registry, and migration ledger SHALL reconcile with zero missing, duplicate, stale, or unresolved required records

### Requirement: No duplicate current authority after migration
After a document is migrated, the repository SHALL retain at most one current authority for each governed behavior or workflow.

#### Scenario: Durable facts are extracted
- **WHEN** a historical artifact's current behavior has been incorporated into maintained docs or living specs
- **THEN** the original artifact SHALL be historical-only, moved as approved, or removed as approved
- **AND** current entrypoints SHALL route to the maintained authority

### Requirement: Documentation-impact enforcement
Repository changes SHALL declare and satisfy their documentation impact based on affected modules, contracts, workflows, or operational behavior.

#### Scenario: Code changes a documented contract
- **WHEN** a change affects a mapped API, schema, module boundary, workflow, runbook, or user-visible behavior
- **THEN** the owning documentation or spec delta SHALL be updated in the same change

#### Scenario: A change has no documentation impact
- **WHEN** an affected-area rule normally expects documentation work but the change does not alter documented behavior
- **THEN** the change SHALL record an explicit, reviewable no-documentation-impact rationale

### Requirement: Blocking documentation CI after cleanup
Documentation checks SHALL become blocking only after all existing violations in the approved documentation scope are resolved, and SHALL then run without permanent legacy exceptions.

#### Scenario: Migration still has unresolved documentation violations
- **WHEN** any governed document fails deterministic checks or required semantic decisions remain unresolved
- **THEN** documentation-specific blocking CI SHALL NOT be declared complete

#### Scenario: Documentation baseline is clean
- **WHEN** the approved structure is implemented, migration is complete, audits are resolved, and all documentation checks pass
- **THEN** documentation-specific CI SHALL run the same non-writing `docs:check` in a clean checkout
- **AND** the check SHALL be required on every protected merge path before the gate is called blocking

#### Scenario: CI gate behavior is proven
- **WHEN** documentation-specific blocking CI is proposed for acceptance
- **THEN** evidence SHALL include a successful clean-checkout run, a controlled negative case that fails the job, and a restored successful run

#### Scenario: Required-check configuration cannot be changed
- **WHEN** repository settings or external permissions prevent the documentation check from becoming required
- **THEN** the cutover SHALL remain incomplete
- **AND** the missing external or user action SHALL be reported explicitly

### Requirement: Governance checks are tested against counterexamples
The documentation governance tooling SHALL include positive and negative fixtures for every critical rule family.

#### Scenario: A regression weakens a gate
- **WHEN** a gate stops detecting broken links, orphan current docs, wrong classification, generated drift, duplicate authority, contract drift, invalid living-spec promotion, stale approval, or missing audit evidence
- **THEN** a negative fixture SHALL fail the test suite
