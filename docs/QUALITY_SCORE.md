---
schemaVersion: 1
document:
  type: placeholder
  status: deferred
  owner: engineering-standards
  authority:
    subject: repository-quality-score
    kind: placeholder
  readWhen:
    - 查找延期的仓库质量评分入口时
  sources:
    - openspec/changes/establish-agent-harness/specs/agent-harness/spec.md
    - openspec/changes/rebuild-documentation-governance/design.md
  verifiedBy:
    - npm run docs:check
  activation:
    stage: enforce-engineering-standards
    owner: engineering-standards
    condition: 仅当可观测性阶段已验收，且获批 OpenSpec 变更定义了有证据支持的评分语义后才能激活。
  authorityBoundary: 本占位文档不拥有任何分数、阈值、发现、豁免或待办决定权。
---

# 质量评分（延期占位）

本文件只保留稳定入口。文档治理阶段尚未批准仓库质量分数、评分模型或相关执行规则。

激活阶段为 `enforce-engineering-standards`，负责人为 `engineering-standards`，并且必须满足元数据中的激活条件。

在激活变更获批前，本文件不定义当前指标、阈值、发现、例外或工作项，也不授权据此创建或排序待办。任何提议内容都必须由届时获批的 OpenSpec 变更承载。
