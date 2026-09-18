---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: system-architecture
  authority:
    subject: architecture-core-beliefs
    kind: reference
  readWhen:
    - 需要评估跨领域架构变更时
    - 需要判断某项资源或执行路径是否真正共享时
  sources:
    - src/lib/work-mode-resources.ts
    - src/server/repositories/generation-resource-boundary.ts
    - src/server/worker/payload-builder.ts
    - src/server/worker/repository.ts
    - prisma/schema.prisma
    - src/instrumentation.node.ts
  verifiedBy:
    - npm run docs:check
    - node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-worker-boundary-governance.test.ts tests/test-instrumentation-boundary.test.ts
---

# 核心原则

## 对等领域具有明确归属

Generation 与 Training 是对等的工作模式。相似的名称或界面操作方式，并不意味着它们的运行记录、项目、预设、模板、API 或持久化可以互换。只有被共享边界明确列出的资源才属于共享资源；当前面向用户的共享资源是模型与设置。

## 当前事实、已批准目标与历史彼此分离

架构文档描述已经存在且具有证据的行为；活跃的 OpenSpec 变更负责拟议或已经批准的未来行为；Git 与已归档的 OpenSpec 变更保留历史意图。这些层次不能相互替代。

## 同时承认持久化事实与外部事实

数据库负责持久化业务状态，受管文件负责产物字节，外部运行时负责其存活进程或队列状态。恢复流程需要协调这些事实来源，不能根据一个本地状态字段推断所有外部副作用都已经完成。

## 边界必须描述真实依赖图

仓库有意分离领域、载荷构造、持久化与外部适配器，但也存在过渡门面和直接使用持久化层的调用方。架构指南会明确列出这些例外，而不会把理想化的“路由—服务—仓储”结构描述成当前事实。

## 失败与恢复边界必须明确

Generation 提交、ComfyUI 执行、Training 工作进程、文件系统写入与数据库状态转换都可能独立失败。架构责任文档应记录状态来源、是否已经实现恢复，以及经过验证的恢复能力上限。部分当前路径只有局部恢复或基于状态的恢复；文档必须保留这一限制，不能暗示始终存在边界明确的恢复路径。

## 相关文档

- [架构文档](README.md)
- [依赖模型](system/dependency-model.md)
- [队列与工作进程执行](system/execution/queue-worker.md)
