---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: system-architecture
  authority:
    subject: repository-architecture
    kind: canonical
  readWhen:
    - 需要跨应用、运行时、数据或领域边界确定工作位置时
    - 需要判断一项变更应由哪个架构责任方评审时
  sources:
    - docs/_meta/policy.yaml
    - src/lib/work-mode-resources.ts
    - src/instrumentation.node.ts
    - prisma/schema.prisma
    - prisma/schema.sqlite.prisma
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-instrumentation-boundary.test.ts tests/test-zero-redundancy-schema-shape.test.ts
---

# 架构

ComfyUI Manager 是一个需要身份验证的 Next.js 应用，负责协调 Generation 与 Training 两个对等工作模式。应用通过 Prisma 持久化业务状态，在文件系统中保存受管产物，将 Generation 任务提交到已配置的 ComfyUI 目标，并为 Training 提供独立工作进程。

## 系统概览

- 浏览器、HTTP 智能体与 MCP 请求都从 Next.js 请求边界进入系统。
- 页面与路由处理器负责协调功能界面、服务器操作、服务、仓储和外部适配器。当前依赖图包含已记录的过渡层，并不是严格的三层结构。
- PostgreSQL 或 SQLite 保存持久化应用状态；受管图片、清单、模型文件与训练产物则同时具有文件系统责任方。
- Generation 执行主要由 Next.js Node 进程驱动，并与本地或 SSH 支持的 ComfyUI 目标进行状态协调。
- Training 拥有独立的 API、数据模型、调度器接口和独立工作进程。
- 模型与设置被有意共享；运行记录、项目、预设与模板仍归各自工作模式所有。

## 架构导航

| 变更内容 | 接下来阅读 |
| --- | --- |
| 跨领域不变量 | [核心原则](docs/architecture/core-beliefs.md) |
| 信任边界、依赖、运行时、数据或智能体接口 | [系统架构](docs/architecture/system/README.md) |
| 队列、工作进程、恢复或执行状态 | [执行架构](docs/architecture/system/execution/README.md) |
| Generation、Training 或共享资源的归属 | [领域架构](docs/architecture/domains/README.md) |
| 完整的受维护架构索引 | [架构文档](docs/architecture/README.md) |

拟议中的架构应写入活跃的 OpenSpec 变更。本页面及其下级文档只描述已经验证的当前行为。

[返回仓库入口](README.md)
