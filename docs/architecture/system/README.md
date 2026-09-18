---
schemaVersion: 1
document:
  type: router
  status: current
  owner: system-architecture
  authority:
    subject: system-architecture
    kind: router
  readWhen:
    - 需要变更多个工作模式共享的技术边界时
    - 需要跨系统追踪请求、进程、记录、产物或智能体交互时
  sources:
    - src/proxy.ts
    - src/instrumentation.node.ts
    - src/lib/prisma.ts
  verifiedBy:
    - npm run docs:check
---

# 系统架构

本目录负责跨领域结构。领域专属的用户能力与状态机仍归[领域架构](../domains/README.md)维护。

## 导航

| 任务 | 阅读 | 负责的细节 |
| --- | --- | --- |
| 识别参与方、外部系统或信任边界 | [系统上下文](context.md) | 请求、进程、数据库、文件系统与外部运行时边界 |
| 变更导入关系或分层归属 | [依赖模型](dependency-model.md) | 当前依赖方向与过渡层 |
| 变更进程、启动工作或目标部署位置 | [运行时拓扑](runtime-topology.md) | Next.js、ComfyUI、工作进程、子工具与工作树身份 |
| 变更实体、数据库提供方支持或持久化不变量 | [应用数据模型](data-model.md) | Generation、Training、产物与数据库提供方兼容性 |
| 变更智能体、REST、身份验证或 MCP 结构 | [智能体接口](agent-interfaces.md) | 接口表面与架构封装范围 |
| 变更队列、工作进程、暂停或恢复行为 | [执行架构](execution/README.md) | 当前执行系统及其状态权威 |

## 上级导航

- [架构文档](../README.md)
