---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: data-architecture
  authority:
    subject: application-data-model
    kind: reference
  readWhen:
    - 需要变更 Prisma 模型、关系、数据库提供方映射或事务边界时
    - 需要变更 Generation 快照或 Training 数据集版本与产物时
  sources:
    - prisma/schema.prisma
    - prisma/schema.sqlite.prisma
    - prisma.config.ts
    - src/lib/prisma.ts
    - scripts/docs/generate-prisma-schema-compatibility.ts
  verifiedBy:
    - npm run docs:check
    - npx tsx scripts/docs/generate-prisma-schema-compatibility.ts --check
    - node --import tsx --test tests/test-prisma-schema-domain-comments.test.ts tests/test-zero-redundancy-schema-shape.test.ts
---

# 应用数据模型

## 数据库提供方契约

应用通过独立的 Prisma schema、迁移目录、生成的客户端与驱动适配器支持 PostgreSQL 和 SQLite。数据库提供方检测会在运行时选择一个客户端。PostgreSQL 原生枚举在 SQLite schema 中表示为字符串，因此共享应用枚举常量会保留与数据库提供方无关的值。

生成的 [Prisma schema 兼容性检查表](../../prisma-schema-compatibility.md) 是数据库提供方差异的精确权威来源。本文档负责关系与架构边界，不重复维护 schema 清单。

## Generation 模型

`Project` 负责有序的 `ProjectSection` 记录和持久化 `Run` 记录。每个运行记录在外部执行前保存解析后的配置快照；`ImageResult` 记录受管输出与审核状态。

项目与模板分区的提示词和 LoRA 配置会规范化为绑定记录、有序提示词块记录与手动 LoRA 记录。`ProjectSection` 和 `ProjectTemplateSection` 不再保存旧版提示词或 LoRA JSON 数据块。剩余 JSON 字段承载结构化运行时参数与快照，而不是这些已规范化的关系。

Generation 入队与完成路径使用事务处理多记录状态变更。数据库记录持久化意图与结果，ComfyUI prompt ID 和受管文件则把这些记录与外部执行关联起来。

## Training 模型

Training 拥有独立的 `TrainingProject`、角色档案、分区、模板、场景预设、产物、生成任务、图片结果、数据集版本与训练运行记录系列。这些并不是 Generation 资源的别名。

主数据集冻结路径同步写入 JSONL 清单，创建状态为 `ready` 的版本与条目记录，并对说明文字和文件路径生成快照。每个条目当前都通过 `snapshotArtifactId` 指向既有源产物；它不会把图片字节复制到版本专属产物中。缺失的说明文字会被计数，并可写为空快照，而不会阻止版本创建。

另一条 `dataset_freeze` 工作进程路径可以将既有草稿版本从 `freezing` 推进到 `ready`。该工作进程生命周期不是主同步冻结操作的实现。

## 共享记录与运维记录

模型元数据、审计记录、回收站记录与内容审查任务支持多个用户流程，但其文件或外部进程仍是独立的权威来源。关系型级联/限制规则保护核心引用；部分互斥规则仍由服务而非数据库约束强制执行。

系统没有持久化的 Training 工作进程租约记录。类似租约的响应字段根据领域目标合成，不能视为已经持久化的并发模型。

## 相关文档

- [系统架构](README.md)
- [Generation 架构](../domains/generation/README.md)
- [Training 架构](../domains/training/README.md)
