# `$docs-audit` pre-Skill control baseline

Captured: 2026-07-12

Scope: repository state at `HEAD` before `.codex/skills/docs-audit/**` existed

Method: read-only tracked-file and reference inspection

This is a control baseline for the semantic-audit workflow. It records concrete repository
scenarios and the absence of a contained execution contract; it does not claim that historical
documents are currently correct. No fresh-agent behavioral result is claimed in this baseline.

## Control absence

`git cat-file -e HEAD:.codex/skills/docs-audit/SKILL.md` exited `128` with
`.codex/skills/docs-audit/SKILL.md` present only in the working tree and not in `HEAD`. Before the
new package, the repository had no single explicit Skill contract for scope selection,
report/record/fix writes, evidence precedence, finding dispositions, or independent review.

## Baseline scenarios

| ID | Repository evidence | Uncontrolled pre-Skill failure |
| --- | --- | --- |
| `B1-current-target-history` | `docs/index.md` routes Training through both `docs/prototypes/README.md` prototype intent and production source; `tests/test-asset-page-boundaries.test.ts` and `tests/test-work-mode-resource-boundary.test.ts` read an archived roadmap. | No semantic workflow forced current implementation, approved target, and historical intent to be classified separately before making a claim. |
| `B2-missing-runtime-proof` | `docs/local-verification.md` and `agent-rules/deploy/**` contain environment-, service-, queue-, database-, and recovery-sensitive instructions. | No semantic workflow required runtime-dependent claims to stay unresolved when fresh runtime evidence was unavailable. |
| `B3-duplicate-authority` | `docs/index.md`, `docs/documentation-map.md`, and `docs/repo-inventory.md` overlap as navigation/classification surfaces. | No finding schema required an owner, conflict, merge/delete disposition, and verification before treating one surface as authoritative. |
| `B4-unsafe-operations` | Deployment and local-verification documents contain executable build, process, database, and queue operations. | Deterministic path/link checks alone could not prove that an operational sequence, failure stop, and recovery path were safe and current. |
| `B5-fix-authorization` | No tracked `$docs-audit` package existed in `HEAD`. | There was no repository Skill boundary separating write-free report, one-path OpenSpec evidence record, and explicitly user-authorized fixes. |
| `B6-self-review` | No tracked `$docs-audit` package existed in `HEAD`. | There was no repository Skill rule preventing the fixing agent from signing its own semantic pass or requiring `review-required` when independent review was unavailable. |

## Adoption comparison

The new Skill is expected to be checked against the same six scenarios. Package validation and
contract tests prove that the workflow is present; a later forward test with fresh agents is
still required to demonstrate behavior on real migration batches. This baseline must not be
rewritten as a passing forward-test result.
