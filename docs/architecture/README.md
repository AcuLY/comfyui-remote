---
schemaVersion: 1
document:
  type: router
  status: current
  owner: system-architecture
  authority:
    subject: architecture-knowledge
    kind: router
  readWhen:
    - 需要定位当前架构问题的受维护责任文档时
    - 需要在变更前审查已经实现的边界时
  sources:
    - ARCHITECTURE.md
    - docs/_meta/policy.yaml
  verifiedBy:
    - npm run docs:check
---

# 架构文档

本目录负责维护经过验证的当前架构细节，不负责实现提案、逐路由 API 清单、运维命令或历史决策记录。请先阅读简明的[根架构图](../../ARCHITECTURE.md)，再进入下表中范围最小的责任文档。

## 导航

| 任务 | 阅读 | 负责的细节 |
| --- | --- | --- |
| 理解跨领域结构 | [核心原则](core-beliefs.md) | 稳定的架构不变量与事实来源规则 |
| 变更跨领域技术边界 | [系统架构](system/README.md) | 上下文、依赖、运行时、数据、agent 与执行 |
| 变更业务能力边界 | [领域架构](domains/README.md) | Generation、Training 与有意共享的资源 |
| 变更队列或 worker 行为 | [执行架构](system/execution/README.md) | 当前执行机制与恢复边界 |

## 权威性

每篇文档列出的源代码、schema 与聚焦测试，是其当前事实陈述的证据。已经批准的未来状态由活跃的 OpenSpec 变更负责，直到实现和验证使其成为当前状态。

[返回根架构图](../../ARCHITECTURE.md)
