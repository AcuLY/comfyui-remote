# Documentation Audit Evidence Contract

Apply this contract to every `$docs-audit` report, record, fix, and independent review.

## Evidence precedence

Use evidence in this order while preserving conflicts rather than silently overriding them:

1. **Current implementation:** current source, schemas, focused tests, generated contracts, and
   required runtime evidence. Treat tests as evidence, not authority, when they encode a legacy
   structure or contradict implementation.
2. **Approved target:** the active OpenSpec proposal, spec, design, and tasks authorized for the
   current stage. Describe it as target behavior until implementation and verification prove it
   is current.
3. **Historical intent:** Git history and archived OpenSpec or historical documents. Use history
   to explain intent or locate facts to reverify; never promote it directly to current truth.
4. **Unresolved:** classify a claim as unresolved when evidence conflicts, required runtime proof
   is absent, or more than one interpretation remains reasonable.

Do not expose secrets or copy sensitive runtime values into findings. Cite the owning path,
command, or sanitized result instead.

## Finding schema

Give each finding these fields:

- `id`: stable, scope-local identifier.
- `path` and `location`: repository-relative document path and precise heading/line/claim locator.
- `claim`: concise statement being evaluated.
- `claimCategory`: `current`, `target`, `history`, or `unresolved`.
- `owner`: current owner ID or `user-decision-required` when ownership itself is disputed.
- `evidence`: ordered repository-relative citations or sanitized runtime commands/results, each
  labeled current, target, or history.
- `conflict`: the contradictory or missing evidence, or `none`.
- `confidence`: `high`, `medium`, or `low`, with a reason.
- `action`: one of `keep`, `rewrite`, `move`, `split`, `merge`, `extract-delete`, `delete`, or
  `user-decision-required`.
- `resolution`: one of `open`, `fixed`, `accepted-current`, `historical-only`,
  `duplicate-removed`, `deferred-to-openspec`, `user-decision-required`, or `review-required`.
- `verification`: non-writing command, test, runtime check, or reviewer needed to close it.

Use `high` only when one correction is supported by current evidence. Confidence does not grant
write authorization.

## Escalation boundaries

Use `user-decision-required` and preserve the source when a finding would:

- choose or change product direction;
- assign disputed authority or ownership;
- describe partial implementation as intentionally complete;
- delete material that may contain unextracted current knowledge;
- select between multiple reasonable interpretations;
- rely on unavailable required runtime evidence;
- change a safety-critical operational rule without verified recovery evidence.

Use `deferred-to-openspec` for desired future behavior that is not an approved current target.
Use `review-required` after any fix until a separate agent or human reruns the same scope. The
fixing agent must never change that result to a passing semantic decision by itself.

## Report shape

Return or record these sections in order:

1. **Invocation:** explicit caller, scope, operation, comparison base, and any full escalation.
2. **Write boundary:** allowed writes and captured pre-existing worktree state.
3. **Deterministic check:** command, exit class, diagnostics summary, and tool failures.
4. **Evidence reviewed:** current, target, history, and runtime sources.
5. **Findings:** deterministically ordered by path, location, then ID.
6. **Writes:** exact changed paths, or `none` for report/record aside from the named record.
7. **Verification:** owning checks and same-scope rerun results.
8. **Independent review:** reviewer identity/status and final resolution; use `review-required`
   when unavailable.
9. **Decisions needed:** unresolved questions requiring the user.

A scope passes only when deterministic errors are zero, every finding has a closed resolution,
all writes stayed contained, fix verification passed, and any fix received independent review.
