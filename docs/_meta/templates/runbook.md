---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: <stable-owner-id>
  authority:
    subject: <normalized-operational-subject>
    kind: operational
  readWhen:
    - <operation that requires this procedure>
  sources:
    - <repository/path/to/runtime-contract>
  verifiedBy:
    - <non-writing command or test>
  environment:
    - <local-windows-or-target-environment>
  risk: <state boundary and action that must not be broadened>
  recovery: "#failure-handling-and-recovery"
  lastVerified: <YYYY-MM-DD>
---

# <Runbook title>

## Use when

State the exact trigger and explicitly excluded operations.

## Preconditions

- <Required state, authority, lock, credential, or safety check>

## Procedure

1. Run `<exact command or action>`.
2. Confirm `<observable expected result>` before continuing.

## Expected result

State the observable success condition.

## Failure handling and recovery

Describe how to stop safely, preserve unrelated state, and restore only this operation's changes.

## Verification

Record the non-writing proof path and update `lastVerified` only after the procedure is exercised in the declared environment.

## Parent route

- [Back to the owning runbook area](./README.md)
