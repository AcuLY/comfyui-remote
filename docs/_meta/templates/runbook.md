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
    - <需要本流程的操作>
  sources:
    - <repository/path/to/runtime-contract>
  verifiedBy:
    - <非写入命令或测试>
  environment:
    - <执行环境>
  risk: <不得扩大的状态边界与操作>
  recovery: "#故障处理与恢复"
  verificationState: not-exercised
  lastVerified: null
---

# <运行手册标题>

## 适用场景

说明精确触发条件，并明确排除的操作。

## 前置条件

- <所需状态、授权、锁、凭据或安全检查>

## 操作步骤

1. 运行 `<精确命令或操作>`。
2. 继续前确认 `<可观察的预期结果>`。

## 预期结果

说明可观察的成功条件。

## 故障处理与恢复

说明如何安全停止、保留无关状态，并且只恢复本次操作造成的变更。

## 验证状态

精确记录在所声明环境中实际演练过哪些步骤。证据仅来自静态审查或非写入合同测试时，必须保留 `verificationState: not-exercised` 和 `lastVerified: null`。只有流程本身经过实际演练后，才能设置 `verificationState: exercised` 与 `YYYY-MM-DD` 日期；未演练的变体必须在本节明确标注。

## 上级导航

- [返回文档治理控制面](../README.md)
