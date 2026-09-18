---
schemaVersion: 1
document:
  type: router
  status: current
  owner: system-architecture
  authority:
    subject: architecture-domains
    kind: router
  readWhen:
    - 需要变更工作模式资源或业务生命周期的归属时
    - 需要判断资源属于 Generation、Training 还是共享边界时
  sources:
    - src/lib/work-mode-resources.ts
    - prisma/schema.prisma
  verifiedBy:
    - npm run docs:check
---

# 领域架构

Generation 与 Training 是对等的业务领域。本目录负责它们的技术资源边界、持久化、执行流程、不变量与故障隔离；面向用户的能力说明应写入产品文档。

## 导航

| 领域问题 | 阅读 | 负责的细节 |
| --- | --- | --- |
| Generation 项目、运行记录、审核、预设、模板或 ComfyUI 执行 | [Generation 架构](generation/README.md) | Generation 所属资源与流程 |
| Training 项目、图片任务、数据集、训练运行记录或 Training 工作进程 | [Training 架构](training/README.md) | Training 所属资源与流程 |
| 模型、设置、活动目标或模式导航 | [共享资源架构](shared-resources/README.md) | 有意共享的运行时资源 |

单纯复用代码不会改变领域归属。只有通过明确的架构变更，资源才能进入共享边界。

## 上级导航

- [架构文档](../README.md)
