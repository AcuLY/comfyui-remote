---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: <stable-owner-id>
  authority:
    subject: <normalized-subject-id>
    kind: reference
  readWhen:
    - <task trigger that makes this document relevant>
  sources:
    - <repository/path/to/evidence>
  verifiedBy:
    - <non-writing command or test>
---

# <Document title>

## Purpose

State the task this document supports and the smallest useful scope.

## Authority and boundaries

State what this file owns, what it only routes to, and which higher-level contract wins on conflict.

## Current contract

Describe only verified current behavior. Proposed changes belong to OpenSpec; historical intent remains in Git or archived OpenSpec changes.

## Verification

Explain what the frontmatter verification proves and any evidence limitation.

## Related documentation

- [Owning landing page](./README.md)
