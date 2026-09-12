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
    - <需要阅读本文档的任务触发条件>
  sources:
    - <repository/path/to/evidence>
  verifiedBy:
    - <非写入命令或测试>
---

# <文档标题>

## 目的

说明本文档支持的任务，以及最小的有效范围。

## 权威性与边界

说明本文件负责哪些内容、只导航到哪些内容，以及发生冲突时以哪个上级契约为准。

## 当前契约

只描述已经验证的当前行为。拟议变更归 OpenSpec 管理；历史意图保留在 Git 或已归档的 OpenSpec 变更中。

## 验证

说明 frontmatter 中的验证能够证明什么，以及证据存在哪些限制。

## 相关文档

- [返回所属文档区域](../README.md)
