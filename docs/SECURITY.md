---
schemaVersion: 1
document:
  type: placeholder
  status: deferred
  owner: security-governance
  authority:
    subject: repository-security
    kind: placeholder
  readWhen:
    - 查找延期的仓库安全入口时
  sources:
    - openspec/changes/establish-agent-harness/specs/agent-harness/spec.md
    - openspec/changes/rebuild-documentation-governance/design.md
  verifiedBy:
    - npm run docs:check
  activation:
    stage: future-approved-security-governance
    owner: security-governance
    condition: 仅当获批 OpenSpec 变更定义了仓库安全模型、证据和维护负责人后才能激活。
  authorityBoundary: 本占位文档不拥有任何威胁模型、控制集、风险等级、发现、例外或待办决定权。
---

# 安全（延期占位）

本文件只保留稳定入口。当前文档治理变更没有批准安全模型，也没有批准安全治理阶段。

激活阶段为 `future-approved-security-governance`，负责人为 `security-governance`，并且必须满足元数据中的激活条件。

在激活变更获批前，本文件不定义当前威胁、控制、评级、发现、例外或工作项，也不授权据此创建或排序待办。任何提议内容都必须由届时获批的 OpenSpec 变更承载。
