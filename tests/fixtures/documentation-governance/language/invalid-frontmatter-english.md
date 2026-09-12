---
schemaVersion: 1
document:
  type: runbook
  status: current
  owner: documentation-governance
  authority:
    subject: language-fixture
    kind: operational
  readWhen:
    - changing the documentation language gate
  sources:
    - scripts/docs/check/language.ts
  verifiedBy:
    - node --import tsx --test tests/test-docs-check-language.test.ts
  environment:
    - local Windows test environment
  risk: This operation can hide documentation defects.
  recovery: docs/runbooks/README.md#recovery
  verificationState: not-exercised
  lastVerified: null
  generator: scripts/docs/generator.ts
  inputs:
    - docs/**/*.md
  regenerate: npm run generate
  check: npm run check
  activation:
    stage: future-stage
    owner: documentation-governance
    condition: Activate after the English policy is approved.
  authorityBoundary: This fixture owns no production decisions.
---

# Frontmatter 英文反例

正文保持中文，因此诊断只能来自受检查的人类元数据字段。
