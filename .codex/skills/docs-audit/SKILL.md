---
name: docs-audit
description: Explicitly audit repository documentation against current source, schemas, tests, required runtime evidence, approved OpenSpec targets, and history. Use only when the user or an approved OpenSpec task explicitly invokes $docs-audit for changed, paths, change, or full scope in report, record, or fix mode; never trigger it automatically for ordinary documentation or source edits.
---

# Documentation Audit

Audit documentation semantics that deterministic checks cannot prove: stale claims, missing
coverage, duplicate authority, partial implementation, unsafe runbook steps, and confusion
between current behavior, an approved target, and historical intent.

Read [references/evidence-contract.md](references/evidence-contract.md) before every audit. Use
its evidence categories, finding schema, dispositions, escalation rules, and report shape.

## Parse the explicit invocation

Require an explicit `$docs-audit` invocation from the user or an approved OpenSpec task. Do not
infer invocation from ordinary source edits, documentation edits, `docs:check` warnings, or this
Skill's presence in the repository. Do not schedule or recur.

Accept one scope:

- `changed`: audit changed governed documents and their complete policy-defined impact closure
  from a safe merge base. Escalate to `full` if the base or closure is unsafe.
- `paths <repo-relative paths...>`: audit only the named files/directories and the evidence
  needed to validate their claims. Treat a named directory as authorization to read its
  descendants, not as authorization to edit them.
- `change <openspec-id>`: audit an active OpenSpec change, its declared affected documentation,
  and the current evidence needed to distinguish target behavior from implementation.
- `full`: audit the complete governed documentation scope.

If the explicit invocation omits scope, choose `changed` only when a safe merge base and complete
impact closure are available; otherwise use `full` and state why.

Accept one operation:

- `report` is the default and writes nothing.
- `record <repo-relative-evidence-path>` writes only the explicitly named evidence report for an
  approved OpenSpec task. It never edits audited documents.
- `fix <explicitly-user-authorized-paths...>` may edit only paths the user explicitly authorized
  in the current task. An OpenSpec task alone does not broaden fix authorization.

Reject an ambiguous scope, operation, output path, or authorization instead of guessing.

## Enforce path containment

1. Resolve the repository root with Git.
2. Normalize every requested, output, and writable path relative to that root.
3. Reject absolute paths, traversal, paths whose resolved existing ancestor escapes the root,
   and aliases or links that would write outside the root.
4. For `record`, require the exact named path to be under
   `openspec/changes/<current-change-id>/evidence/docs-audit/`. Require the change ID to match the
   approved task. Reject a directory-only output, a different change, or any second write.
5. For `fix`, freeze the exact user-authorized writable set before editing. A directory authorizes
   descendants only when the user explicitly authorized that directory as the fix scope.

Capture the complete pre-existing tracked, staged, and untracked worktree state. Preserve every
path outside the allowed write set. Never use broad restore, reset, clean, or add commands.

## Execute the audit

1. **Resolve scope.** Enumerate the selected documents, owners, source relationships, navigation
   neighbors, relevant OpenSpec artifacts, and required verification entrypoints. Record the
   merge base or the reason for full escalation.
2. **Run the deterministic gate.** Run `npm run docs:check` through its documented full or safe
   fast mode before semantic review. Stop on checker/configuration failure. Keep ordinary rule
   violations in the audit report and continue semantic analysis where evidence remains usable.
3. **Classify evidence.** Separate verified current implementation, approved-but-unimplemented
   target behavior, historical intent, and unresolved claims. Never use newer prose as proof by
   itself.
4. **Audit meaning.** Check factual freshness, owner coverage, duplicate authority, partial
   implementation, executable operational steps, source/test/document conflicts, and historical
   material presented as current. Obtain runtime evidence when the claim cannot be established
   statically; preserve uncertainty when it is unavailable.
5. **Produce findings.** Use the evidence contract. Give every finding an action and resolution,
   cite repository-relative evidence with a precise locator, and name its owner and verification.
6. **Apply the selected operation.** Follow the write rules below and compare the resulting
   worktree state with the captured baseline.
7. **Rerun verification after a fix.** Run the owning checks, the deterministic documentation
   gate, and the same semantic audit scope. Do not widen scope merely to make a finding pass.
8. **Require independent review after a fix.** Hand the same scope and evidence contract to a
   separate agent or human reviewer. Never sign off your own semantic correction. If independent
   review is unavailable, leave the result `review-required` and do not claim a passing audit.

## Apply operation boundaries

### Report

Return the report in the invoking task. Write no repository file, cache, ledger, or evidence
artifact. Verify the complete worktree state is unchanged from the captured baseline.

### Record

Require an approved OpenSpec task to name the exact contained evidence path. Write only the
report at that path. Leave audited documents and every other path unchanged. Do not create a
permanent cross-change ledger.

### Fix

Edit only explicitly user-authorized paths and only when static or required runtime evidence
supports one high-confidence correction. Do not decide product direction, authority ownership,
partial-implementation policy, deletion of potentially current knowledge, or a conflict with
multiple reasonable interpretations. Escalate those findings.

Do not write an audit record during `fix` unless the invocation separately names and authorizes
the contained evidence path. Report all writes, reruns, and the independent-review state.

## Refuse unsupported completion

Do not report a semantic pass when deterministic failures remain in scope, findings lack an
explicit resolution, required evidence is missing, writes escaped authorization, a fix has not
been rerun, or the fixer has not received independent review.
