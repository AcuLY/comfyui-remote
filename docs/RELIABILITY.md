---
schemaVersion: 1
document:
  type: placeholder
  status: deferred
  owner: observability
  authority:
    subject: repository-reliability
    kind: placeholder
  readWhen:
    - 查找延期的仓库可靠性入口时
  sources:
    - openspec/changes/establish-agent-harness/specs/agent-harness/spec.md
    - openspec/changes/rebuild-documentation-governance/design.md
  verifiedBy:
    - npm run docs:check
  activation:
    stage: build-agent-observability
    owner: observability
    condition: 仅当文档治理阶段已验收，且获批 OpenSpec 变更定义了已验证的可靠性信号与目标后才能激活。
  authorityBoundary: 本占位文档不拥有任何指标、SLO、事故分类、可靠性发现或待办决定权。
---

# 可靠性（延期占位）

本文件只保留稳定入口。文档治理阶段不选择遥测信号、可靠性目标、预算或事故策略。

激活阶段为 `build-agent-observability`，负责人为 `observability`，并且必须满足元数据中的激活条件。

在激活变更获批前，本文件不定义当前指标、SLO、事故、发现或工作项，也不授权据此创建或排序待办。任何提议内容都必须由届时获批的 OpenSpec 变更承载。
