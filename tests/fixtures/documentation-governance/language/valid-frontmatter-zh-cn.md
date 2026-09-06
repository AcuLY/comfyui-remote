---
schemaVersion: 1
description: 使用 GFM AST 检查 docs:check 语言契约。
document:
  type: runbook
  status: current
  owner: documentation-governance
  authority:
    subject: language-fixture
    kind: operational
  readWhen:
    - 修改 API、OpenSpec 或 GFM AST 技术契约时
  sources:
    - scripts/docs/check/language.ts
  verifiedBy:
    - node --import tsx --test tests/test-docs-check-language.test.ts
  environment:
    - 本地 Windows PowerShell 环境
  risk: 错误配置可能让 docs:check 漏报英文正文。
  recovery: docs/runbooks/README.md#恢复
  verificationState: not-exercised
  lastVerified: null
  activation:
    stage: future-stage
    owner: documentation-governance
    condition: 仅在 OpenSpec 变更获批后激活。
  authorityBoundary: 本 fixture 不拥有生产策略决定权。
---

# Frontmatter 中文正例

正文使用中文并保留 API、OpenSpec 和 AST 技术词。
