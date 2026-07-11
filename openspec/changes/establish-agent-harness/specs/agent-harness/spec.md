## ADDED Requirements

### Requirement: Staged harness program
The repository SHALL establish the agent harness through ordered, independently approved stages: documentation governance and verified historical migration, observability, engineering standards, and final documentation/CI convergence.

#### Scenario: Program starts with documentation governance
- **WHEN** the harness program begins implementation
- **THEN** the repository-specific documentation information architecture SHALL be approved before the documentation-governance child is fully specified
- **AND** documentation governance SHALL be the first applied child change
- **AND** observability and engineering-standards implementation SHALL remain out of scope

#### Scenario: A later stage is requested early
- **WHEN** an agent is asked to apply observability, engineering standards, or final convergence before the preceding stage is accepted
- **THEN** the agent SHALL stop before implementation
- **AND** report the unmet stage dependency

### Requirement: Independent stage proposals and approval
Every harness stage, including documentation governance, MUST be represented by its own OpenSpec proposal, specs, design, and tasks based on the current repository baseline, and MUST receive explicit user approval of the exact artifact revision before apply.

The approval SHALL retain raw digests for the exact approved artifact snapshot and a semantic task-plan digest that normalizes only existing Markdown checkbox state. During apply, changing `[ ]` to `[x]` or back at an already approved task position MAY record progress without invalidating the plan; changing task text, order, identity, nesting, or adding/removing a task SHALL invalidate approval.

#### Scenario: Stage approval is recorded
- **WHEN** the user approves a child change for apply
- **THEN** the approval record SHALL identify the change, artifact content digests, approval scope, and decision reference
- **AND** planning approval SHALL NOT be treated as post-implementation acceptance

#### Scenario: An approval candidate is generated
- **WHEN** the repository prepares an exact-revision approval candidate
- **THEN** it SHALL enumerate the sorted proposal, all specification deltas, design, and tasks from one immutable full Git revision
- **AND** hash canonical Git blob bytes rather than line-ending-converted worktree bytes
- **AND** refuse the candidate when any normative artifact differs from that revision

#### Scenario: Stage artifacts are ready but not approved
- **WHEN** a later-stage change has complete planning artifacts but no explicit user approval
- **THEN** apply SHALL remain blocked

#### Scenario: Approved artifacts change
- **WHEN** content in an approved proposal, spec, design, or task plan changes
- **THEN** the previous approval SHALL be considered stale
- **AND** the revised artifacts SHALL require new user approval

#### Scenario: Approved task progress changes
- **WHEN** apply changes only the checkbox state at an existing approved task position
- **THEN** the raw tasks artifact SHALL differ from the approved snapshot
- **BUT** the semantic task-plan digest SHALL remain valid
- **AND** any other tasks content change SHALL still make approval stale

### Requirement: One bounded bootstrap approval establishes the repository gate
Before the repository-specific approval gate exists, parent foundation tasks 1.1 through 1.4 MUST receive explicit user approval bound to one immutable parent artifact revision, the bounded foundation scope, and a durable decision reference. This bootstrap approval SHALL authorize only repository-pinned OpenSpec, the approval/acceptance gate, the static stage manifest, and their tests; it SHALL NOT authorize the documentation child or any later-stage apply.

#### Scenario: The foundation gate does not exist yet
- **WHEN** parent foundation implementation is ready to begin
- **THEN** the exact committed parent artifact revision and tasks 1.1 through 1.4 SHALL be presented for explicit user approval
- **AND** implementation SHALL remain blocked until that decision exists

#### Scenario: The repository gate becomes available
- **WHEN** parent foundation tasks 1.1 through 1.4 are implemented and verified
- **THEN** the bootstrap decision SHALL be written as a durable record and revalidated against its original source revision and decision reference
- **AND** every child or later stage SHALL use the normal repository gate without a bootstrap exception

### Requirement: Stage acceptance is evidence-backed
Every child stage SHALL receive explicit user acceptance only after its approved artifact revision is applied and its required verification evidence passes.

#### Scenario: Implementation is verified but not accepted
- **WHEN** a child change has passing verification but no explicit user acceptance bound to that revision and evidence
- **THEN** the child SHALL NOT be considered accepted for the next stage dependency

#### Scenario: A child is accepted
- **WHEN** the user accepts the applied revision after reviewing its required verification evidence
- **THEN** the acceptance record SHALL identify the change revision, verification evidence, and decision reference
- **AND** upstream OpenSpec archive behavior MAY proceed

### Requirement: Evidence categories remain distinct
The harness SHALL distinguish current implementation facts, approved target behavior, and historical intent, and SHALL prevent evidence from one category from silently replacing another.

#### Scenario: Current code differs from an old design
- **WHEN** a historical design conflicts with current source, schema, tests, or verified runtime behavior
- **THEN** the current behavior and historical intent SHALL be recorded separately
- **AND** the old design SHALL NOT be promoted into living specs without an approved target change

#### Scenario: A target is not implemented yet
- **WHEN** an approved active change describes behavior that is not implemented and verified
- **THEN** that behavior SHALL remain in the active change
- **AND** SHALL NOT appear as current behavior in living specs or current documentation

### Requirement: OpenSpec owns the significant-change lifecycle
The repository SHALL use OpenSpec for significant feature, architecture, performance, and engineering-policy changes, while following the installed OpenSpec artifact, apply, verify, and archive conventions.

#### Scenario: A significant change is proposed
- **WHEN** a change adds a capability, changes architecture, alters performance contracts, or changes repository-wide policy
- **THEN** the work SHALL be represented by an OpenSpec change before implementation

#### Scenario: Generic lifecycle behavior is needed
- **WHEN** the repository needs status, dependency, apply, verification, archive, or standard recovery behavior
- **THEN** it SHALL use the installed OpenSpec conventions
- **AND** SHALL NOT create a competing generic lifecycle

### Requirement: Repository-specific safety constraints extend OpenSpec
The harness SHALL add repository-specific checks only where domain safety is not provided by OpenSpec, including queue safety, deployment locks, approval validity, documentation authority, and telemetry isolation.

#### Scenario: A runtime-affecting stage reaches deployment work
- **WHEN** implementation requires build, restart, target-machine sync, queue interruption, or public verification
- **THEN** the existing repository deployment rules SHALL remain authoritative

#### Scenario: A documentation-only artifact change completes
- **WHEN** a change only creates or revises planning and documentation artifacts
- **THEN** production deployment SHALL NOT be required

### Requirement: Hard-cutover quality gates
Each harness stage SHALL clear all existing violations in its scope before enabling blocking enforcement, without permanent legacy allowlists or warning-only exceptions.

#### Scenario: A child defines its enforcement contract
- **WHEN** a child change is prepared for apply
- **THEN** it SHALL enumerate a finite governed scope, the complete violation inventory for that scope, a non-writing verification command, and the exact local and CI blocking surfaces

#### Scenario: Existing violations remain
- **WHEN** a stage still has unresolved pre-existing violations in the rules it introduces
- **THEN** that stage SHALL NOT be accepted or archived

#### Scenario: Stage violations reach zero
- **WHEN** all existing and newly introduced violations in the stage scope are resolved and verification is green
- **THEN** the stage-specific checks SHALL become required on every protected merge path before stage acceptance

### Requirement: Isomorphic and isolated observability invariant
The future observability stage SHALL be self-hosted and SHALL use the same versioned instrumentation, telemetry schema, stack implementation, and query semantics locally, in CI, and on `mypc`, while isolating local, CI, per-worktree, and production reads, writes, resources, identities, and lifecycles.

#### Scenario: Multiple worktrees are observed concurrently
- **WHEN** two or more worktrees run the application and observability stack
- **THEN** each SHALL use isolated application ports, collectors, telemetry stores, identifiers, and teardown lifecycles

#### Scenario: Local validation compares with production
- **WHEN** an agent validates observability behavior locally
- **THEN** the implementation and query semantics SHALL match production
- **AND** local telemetry SHALL NOT be written to production storage

#### Scenario: CI validates observability
- **WHEN** CI starts instrumentation or queries telemetry
- **THEN** it SHALL use CI-owned identities, ports, endpoints, credentials, and storage
- **AND** any production endpoint, credential, service identity, or storage location SHALL fail closed before access
- **AND** CI teardown SHALL NOT delete local, worktree, or production telemetry

#### Scenario: Environment configuration crosses an isolation boundary
- **WHEN** a local or worktree stack is configured with a production endpoint, credential, storage location, or service identity
- **THEN** telemetry startup and access SHALL fail with an actionable isolation error
- **AND** SHALL NOT fall back to cross-environment reads or writes

#### Scenario: Worktree resources collide
- **WHEN** a worktree's derived ports, identifiers, collector, or storage resources collide with another worktree or production
- **THEN** that worktree's observability startup SHALL fail before using the conflicting resource

#### Scenario: A worktree is torn down
- **WHEN** an agent tears down one worktree's observability stack
- **THEN** deletion SHALL be scoped to that worktree identity
- **AND** telemetry for other worktrees and production SHALL remain intact

#### Scenario: Telemetry from a prior run remains stored
- **WHEN** an agent queries data after a worktree or service restart
- **THEN** environment, worktree, service, and run identity SHALL distinguish stale telemetry from the current run

### Requirement: Child changes are created just in time
The program SHALL create detailed observability, engineering-standards, and final-convergence artifacts only when the preceding stage is accepted and the user has reviewed the new baseline and options.

A narrowly bounded experiment MAY run earlier only when the user explicitly authorizes its exact scope, its outputs remain local and untracked, and the active artifacts record that it neither starts nor satisfies the later stage.

#### Scenario: Documentation structure is not approved
- **WHEN** the repository-specific target documentation tree, ownership, authority, navigation, lifecycle, and OpenSpec boundary remain undecided
- **THEN** `rebuild-documentation-governance` SHALL NOT be created
- **AND** complete documentation-governance specs, design, and tasks SHALL NOT be authored

#### Scenario: Documentation governance is still active
- **WHEN** detailed observability implementation artifacts would otherwise be created
- **THEN** the agent SHALL defer them until documentation governance is accepted
- **AND** retain only the already approved program invariants

#### Scenario: The user authorizes a local path-match experiment early
- **WHEN** the user explicitly requests a service-free, coarse `PreToolUse` repository-path counter while documentation governance remains active
- **THEN** the experiment's runtime components SHALL be limited to the project Hook, standard-library recorder, and ignored local `logs/**` and `metrics/**` outputs
- **AND** the repository MAY add only the focused tests and maintenance documentation required to verify and govern those components
- **AND** the signal SHALL omit operation taxonomy, raw commands, prompts, outputs, file contents, absolute paths, and raw session identifiers
- **AND** the experiment SHALL remain unapproved input to the future observability child rather than completing any observability stage task

#### Scenario: An observability spike exists in an earlier child
- **WHEN** non-normative instrumentation evidence was preserved during documentation governance
- **THEN** the future observability child SHALL revalidate its semantics, platform support, privacy, isolation, retention, and performance against the fresh baseline
- **AND** SHALL NOT treat the earlier spike as approved production code or an acceptance shortcut

### Requirement: Program completion reflects implemented reality
The parent harness change SHALL be verified and archived only after all approved child stages are implemented, accepted, and reflected in current documentation and living specs.

#### Scenario: A child stage is incomplete
- **WHEN** any required child change is active, unaccepted, or not reflected in current documentation
- **THEN** the parent change SHALL remain active

#### Scenario: All stages are complete
- **WHEN** documentation governance, observability, engineering standards, and final convergence are implemented and accepted
- **THEN** the parent change MAY be verified and archived under OpenSpec conventions

### Requirement: The parent delta is synchronized only at program completion
The long-running parent change SHALL NOT be partially synchronized or archived into living specs while it still contains unimplemented stage requirements; accepted child changes SHALL be archived independently as their durable current truth.

#### Scenario: An early child is accepted
- **WHEN** documentation governance or another child stage is complete while later parent requirements remain unimplemented
- **THEN** the child MAY be archived under OpenSpec conventions
- **AND** the parent delta SHALL remain active without partial living-spec promotion
