---
schemaVersion: 1
document:
  type: router
  status: current
  owner: <stable-owner-id>
  authority:
    subject: <normalized-area-id>
    kind: router
  readWhen:
    - <task trigger for this documentation area>
  sources:
    - <root contract or source path>
  verifiedBy:
    - npm run docs:check
---

# <Area name>

## Purpose and authority

State the area's purpose, what its children may own, and which root or parent contract remains authoritative.

## Read this area when

- <Concrete task trigger>

## Routes

| Task | Read | Why |
| --- | --- | --- |
| <Task> | [<Child title>](./<child>.md) | <Owned detail> |

## Parent route

- [Back to the owning documentation area](../README.md)
