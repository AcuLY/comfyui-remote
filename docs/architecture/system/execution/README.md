---
schemaVersion: 1
document:
  type: router
  status: current
  owner: queue-runtime
  authority:
    subject: execution-architecture
    kind: router
  readWhen:
    - 需要变更队列、工作进程、调度器、暂停、恢复或故障恢复行为时
    - 需要判断哪个执行状态具有权威性时
  sources:
    - src/server/services/run-executor.ts
    - src/server/worker/training/task-api.ts
    - src/server/services/censoring-executor.ts
  verifiedBy:
    - npm run docs:check
---

# 执行架构

本目录负责跨领域执行机制。业务专属的运行记录与结果语义仍归对应领域维护。

## 导航

| 任务 | 阅读 | 负责的细节 |
| --- | --- | --- |
| 变更 Generation 执行、Training 工作进程、内容审查或恢复行为 | [队列与工作进程执行](queue-worker.md) | 状态权威、进程部署位置、生命周期限制与故障恢复 |

部署运维流程归运行手册维护；本目录只描述结构与不变量。

## 上级导航

- [系统架构](../README.md)
