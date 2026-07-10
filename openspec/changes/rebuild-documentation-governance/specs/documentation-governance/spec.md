## ADDED Requirements

### Requirement: Approved documentation architecture
The repository SHALL implement the user-approved documentation architecture with root `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `PRODUCT.md`, and `DESIGN.md` entrypoints; current product, architecture, detailed design, and runbook layers under `docs/**`; a minimal `docs/_meta/**` governance control plane; and honest `QUALITY_SCORE.md`, `RELIABILITY.md`, and `SECURITY.md` placeholders.

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

Per-document metadata SHALL be authoritative at the document instance. The `_meta` schema and policy SHALL define valid profiles and constraints without duplicating every document's instance values.

#### Scenario: A governed document is added or changed
- **WHEN** documentation validation reads the document
- **THEN** its applicable profile, owner, authority, status, read/update triggers, evidence, and verification contract SHALL resolve without path-guessing ambiguity

#### Scenario: A runbook is validated
- **WHEN** a document uses the runbook profile
- **THEN** its metadata SHALL additionally identify the applicable environment, risk boundary, last verification state, and recovery path

#### Scenario: A generated artifact already exists
- **WHEN** an existing document is owned by a generator
- **THEN** its metadata SHALL identify the generator, source inputs, regeneration command, and non-writing check
- **AND** this SHALL NOT require moving it into a generated directory

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
`AGENTS.md` SHALL be the only authority for mandatory agent workflow policy, including triggers, default behavior, prohibitions, and safety boundaries. `docs/runbooks/**` SHALL be the only authority for executable operational procedures, commands, expected results, failure handling, and recovery.

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

### Requirement: Agent-executable semantic documentation audit
The repository SHALL provide a runbook that an agent can execute to detect semantic defects not provable by deterministic tooling, including stale claims, missing coverage, duplicate authority, partial implementation, invalid runbook steps, and current-versus-target confusion.

The audit SHALL examine source, schemas, tests, Git history, and required runtime evidence; categorize claims as current implementation, approved target, or historical intent; and produce one of `keep`, `rewrite`, `move`, `split`, `merge`, `extract-delete`, `delete`, or `user-decision-required` for the audited scope.

#### Scenario: Static evidence proves one current correction
- **WHEN** source, schema, tests, or unambiguous Git history support exactly one current-behavior correction
- **THEN** the agent SHALL apply or propose that correction with cited evidence and run the owning verification

#### Scenario: Evidence is conflicting or incomplete
- **WHEN** more than one interpretation remains reasonable, required runtime evidence is unavailable, or the decision changes product direction or authority
- **THEN** the agent SHALL preserve the uncertainty
- **AND** request user judgment before rewriting current truth

#### Scenario: Structural checks pass but meaning is stale
- **WHEN** a document has valid metadata and links but contradicts verified behavior or contains an unsafe operational sequence
- **THEN** semantic audit SHALL fail that scope and identify the conflicting claim and evidence

### Requirement: Current documentation is reconstructed from evidence
Every retained current document SHALL be reviewed at section level against its owning implementation, schemas, tests, and required runtime behavior. Content SHALL be moved by knowledge ownership rather than by mechanical directory rename, and duplicate current authority SHALL be eliminated.

Code or configuration changes that match a governed document's declared update trigger SHALL update and reverify that document in the same change, or record an explicit reviewable no-content-change verification according to the documentation policy.

#### Scenario: A mixed legacy document is migrated
- **WHEN** one file contains product intent, architecture, operational commands, and obsolete implementation notes
- **THEN** each verified section SHALL move to the corresponding product, architecture, or runbook owner
- **AND** obsolete or unverified sections SHALL not be copied as current truth

#### Scenario: An owning source changes
- **WHEN** a changed path matches a document's machine-readable update trigger
- **THEN** local and CI validation SHALL require the owning documentation verification disposition
- **AND** report the unmatched trigger if it is absent

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

Training SHALL remain documented as a production work mode peer to Generation, and production source SHALL not depend on deleted prototype assets.

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

### Requirement: Deterministic non-writing documentation gate
The repository SHALL expose one stable documentation-check command used locally and in CI. It SHALL run without network access, produce deterministic results, and leave tracked files unchanged.

The gate SHALL validate applicable metadata profiles, allowed structure, required landing pages, relative links and anchors, root-to-owner reachability, required reverse links, forbidden legacy paths, OpenSpec structure, changed-source documentation triggers, source-derived contract synchronization, and freshness of existing generator-owned artifacts.

#### Scenario: Documentation is valid
- **WHEN** the local documentation check runs on a compliant checkout
- **THEN** it SHALL exit successfully
- **AND** `git diff` SHALL show no writes caused by the check

#### Scenario: A document violates a deterministic rule
- **WHEN** metadata, structure, navigation, links, anchors, trigger coverage, OpenSpec validity, or generated freshness is invalid
- **THEN** the command SHALL fail with the file, rule identifier, reason, and remediation

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
- **WHEN** metadata, broken-link, orphan, forbidden-path, trigger, or generated-drift validation is weakened
- **THEN** the corresponding negative fixture SHALL fail the test suite

### Requirement: Documentation-specific CI hard cutover
After all in-scope legacy violations are cleared, a checked-in documentation CI job SHALL run the exact local non-writing gate in a clean checkout and SHALL become required on every protected merge path. The stage SHALL NOT retain permanent legacy allowlists or call a warning-only job complete.

This documentation-specific gate SHALL not preselect the later unified repository CI design.

#### Scenario: Cleanup is incomplete
- **WHEN** deterministic violations, required semantic decisions, forbidden paths, or migration references remain
- **THEN** the documentation stage SHALL not be accepted or archived

#### Scenario: Blocking CI is enabled
- **WHEN** the documentation gate is proposed for acceptance
- **THEN** evidence SHALL include a successful clean-checkout run, a controlled counterexample failure, a restored successful run, and required-check configuration

#### Scenario: Required-check permission is unavailable
- **WHEN** repository settings cannot be changed with available authority
- **THEN** the missing external action SHALL be reported
- **AND** the blocking-gate task SHALL remain incomplete

### Requirement: Deferred placeholders and future integrations remain honest
`docs/QUALITY_SCORE.md`, `docs/RELIABILITY.md`, and `docs/SECURITY.md` SHALL initially contain only purpose, deferred status, owner, activation stage, and authority boundaries. They SHALL NOT claim unverified scores, SLOs, security models, or backlog authority.

Impeccable installation, root `DESIGN.md` schema conversion, sidecar generation, hooks, detectors, critique reports, and CI integration SHALL remain outside this change and require a separate approved OpenSpec change. Observability and engineering-standard content SHALL likewise remain deferred to their approved stages.

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
