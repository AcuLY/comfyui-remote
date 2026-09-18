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
    - <需要进入本文档区域的任务触发条件>
  sources:
    - <repository/path/to/root-contract>
  verifiedBy:
    - npm run docs:check
---

# <文档区域名称>

## 目的与权威性

说明本区域的目的、下级文档可以负责哪些内容，以及哪个根契约或上级契约仍具权威性。

## 何时阅读本区域

- <具体任务触发条件>

## 导航

| 任务 | 阅读 | 原因 |
| --- | --- | --- |
| <任务> | `<child-document-path>` | <该文档负责的细节> |

## 上级导航

- [返回文档治理控制面](../README.md)
