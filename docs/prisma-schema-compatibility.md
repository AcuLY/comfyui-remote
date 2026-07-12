---
schemaVersion: 1
document:
  type: architecture
  status: current
  owner: data-architecture
  authority:
    subject: prisma-schema-compatibility
    kind: reference
  readWhen:
    - 变更 Prisma 模型或数据库提供方兼容性时
  sources:
    - prisma/schema.prisma
    - prisma/schema.sqlite.prisma
    - scripts/docs/generate-prisma-schema-compatibility.ts
  verifiedBy:
    - npx tsx scripts/docs/generate-prisma-schema-compatibility.ts --check
  generator: scripts/docs/generate-prisma-schema-compatibility.ts
  inputs:
    - prisma/schema.prisma
    - prisma/schema.sqlite.prisma
  regenerate: npx tsx scripts/docs/generate-prisma-schema-compatibility.ts
  check: npx tsx scripts/docs/generate-prisma-schema-compatibility.ts --check
---

# Prisma Schema 兼容性检查表

本文件由 `scripts/docs/generate-prisma-schema-compatibility.ts` 生成。新增、删除或重命名 Prisma 模型后，请重新运行该脚本。

## 共享模型

| 模型 | 责任领域 | PostgreSQL schema | SQLite schema | 兼容状态 | 操作 |
| --- | --- | --- | --- | --- | --- |
| `AuditLog` | `operations` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `CensoringTask` | `review-images` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `GpuTaskLock` | `operations` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ImageResult` | `review-images` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `LoraAsset` | `asset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `Preset` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetCategory` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetCategorySlot` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetChangeLog` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetFolder` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetGroup` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetGroupChangeLog` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetGroupMember` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetVariant` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `PresetVariantLink` | `preset-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `Project` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectFolder` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectPresetBinding` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectSection` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectSectionFolder` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectTemplate` | `template-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectTemplatePresetBinding` | `template-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectTemplateSection` | `template-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `ProjectTemplateSectionFolder` | `template-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `Run` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `SectionChangeLog` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `SectionManualLoraEntry` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `SectionPresetBinding` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `SectionPromptBlock` | `generation-projects` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TemplateSectionManualLoraEntry` | `template-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TemplateSectionPresetBinding` | `template-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TemplateSectionPromptBlock` | `template-library` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingArtifact` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingCharacterImage` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingCharacterProfile` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingDatasetRevision` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingDatasetRevisionItem` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingGenerationInputReference` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingGenerationTask` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingGenerationTaskOutput` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingImageResult` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingProject` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingRun` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingSceneDescriptionBlock` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingSceneDescriptionPreset` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingSceneDescriptionPresetCategory` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingSceneDescriptionPresetFolder` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingSection` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingSectionRun` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingTemplate` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingTemplateSection` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingTemplateSectionSceneDescriptionBlock` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrainingTextRevision` | `training` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |
| `TrashRecord` | `review-images` | `prisma/schema.prisma` | `prisma/schema.sqlite.prisma` | PostgreSQL 与 SQLite 共享 | 保持兼容；同时更新两个 schema，或记录提供方专属差异 |

## 数据库提供方枚举映射

| 枚举 | PostgreSQL 值 | PostgreSQL 字段 | SQLite 字段 | 兼容操作 |
| --- | --- | --- | --- | --- |
| `JobStatus` | `draft`, `queued`, `running`, `partial_done`, `done`, `failed` | `Project.status` | `Project.status: String @default("draft")` | PostgreSQL 使用 Prisma 枚举列；SQLite 存储等价字符串，并且必须同步值与默认值。 |
| `RunStatus` | `queued`, `running`, `done`, `failed`, `cancelled`, `paused` | `Run.status` | `Run.status: String @default("queued")` | PostgreSQL 使用 Prisma 枚举列；SQLite 存储等价字符串，并且必须同步值与默认值。 |
| `ReviewStatus` | `pending`, `kept`, `trashed` | `ImageResult.reviewStatus` | `ImageResult.reviewStatus: String @default("pending")` | PostgreSQL 使用 Prisma 枚举列；SQLite 存储等价字符串，并且必须同步值与默认值。 |
| `ActorType` | `user`, `system`, `agent` | `TrashRecord.actorType`, `AuditLog.actorType` | `TrashRecord.actorType: String @default("user")`, `AuditLog.actorType: String @default("system")` | PostgreSQL 使用 Prisma 枚举列；SQLite 存储等价字符串，并且必须同步值与默认值。 |
| `PromptBlockType` | `custom`, `preset` | `TemplateSectionPromptBlock.type`, `SectionPromptBlock.type` | `TemplateSectionPromptBlock.type: String @default("custom")`, `SectionPromptBlock.type: String @default("custom")` | PostgreSQL 使用 Prisma 枚举列；SQLite 存储等价字符串，并且必须同步值与默认值。 |

## 关系范围与唯一性

| 关系模型 | 作用 | 父级范围 | PostgreSQL 约束 | SQLite 约束 | 兼容操作 |
| --- | --- | --- | --- | --- | --- |
| `PresetVariantLink` | 关联预设变体边 | `sourceVariantId` | `@@unique([sourceVariantId, linkedVariantId])`, `@@index([sourceVariantId, sortOrder])`, `@@index([linkedVariantId])` | `@@unique([sourceVariantId, linkedVariantId])`, `@@index([sourceVariantId, sortOrder])`, `@@index([linkedVariantId])` | 在各数据库提供方之间同步父级范围唯一性与查询索引。 |
| `ProjectPresetBinding` | 项目级预设绑定 | `projectId` | `@@unique([projectId, categoryId])`, `@@index([projectId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])` | `@@unique([projectId, categoryId])`, `@@index([projectId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])` | 在各数据库提供方之间同步父级范围唯一性与查询索引。 |
| `ProjectTemplatePresetBinding` | 模板级预设绑定 | `projectTemplateId` | `@@unique([projectTemplateId, categoryId])`, `@@index([projectTemplateId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])` | `@@unique([projectTemplateId, categoryId])`, `@@index([projectTemplateId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])` | 在各数据库提供方之间同步父级范围唯一性与查询索引。 |
| `SectionPresetBinding` | 分区预设绑定 | `projectSectionId` | `@@unique([projectSectionId, bindingKey])`, `@@unique([projectSectionId, id])`, `@@index([projectSectionId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])`, `@@index([presetGroupId])`, `@@index([groupBindingKey])` | `@@unique([projectSectionId, bindingKey])`, `@@unique([projectSectionId, id])`, `@@index([projectSectionId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])`, `@@index([presetGroupId])`, `@@index([groupBindingKey])` | 在各数据库提供方之间同步父级范围唯一性与查询索引。 |
| `TemplateSectionPresetBinding` | 模板分区预设绑定 | `projectTemplateSectionId` | `@@unique([projectTemplateSectionId, bindingKey])`, `@@unique([projectTemplateSectionId, id])`, `@@index([projectTemplateSectionId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])`, `@@index([presetGroupId])`, `@@index([groupBindingKey])` | `@@unique([projectTemplateSectionId, bindingKey])`, `@@unique([projectTemplateSectionId, id])`, `@@index([projectTemplateSectionId, sortOrder])`, `@@index([categoryId])`, `@@index([presetId])`, `@@index([variantId])`, `@@index([presetGroupId])`, `@@index([groupBindingKey])` | 在各数据库提供方之间同步父级范围唯一性与查询索引。 |
| `SectionManualLoraEntry` | 分区手动 LoRA 条目 | `projectSectionId` | `@@index([projectSectionId, stage, sortOrder])`, `@@index([sectionBindingId])`, `@@index([detachedFromBindingKey])` | `@@index([projectSectionId, stage, sortOrder])`, `@@index([sectionBindingId])`, `@@index([detachedFromBindingKey])` | 在各数据库提供方之间同步父级范围唯一性与查询索引。 |
| `TemplateSectionManualLoraEntry` | 模板分区手动 LoRA 条目 | `projectTemplateSectionId` | `@@index([projectTemplateSectionId, stage, sortOrder])`, `@@index([templateSectionBindingId])`, `@@index([detachedFromBindingKey])` | `@@index([projectTemplateSectionId, stage, sortOrder])`, `@@index([templateSectionBindingId])`, `@@index([detachedFromBindingKey])` | 在各数据库提供方之间同步父级范围唯一性与查询索引。 |

## 旧版兼容字段审计

| 表面 | 原有字段 | 替代项或当前责任方 | 决策 | 防回退测试 |
| --- | --- | --- | --- | --- |
| 关联变体 JSON | `PresetVariant.linkedVariants` | `PresetVariantLink` 关系记录 | 已移除 schema 存储 | `tests/test-zero-redundancy-preset-resolver.test.ts` 忽略旧版 JSON，并以关系记录为准 |
| 旧版项目分区提示词字段 | `ProjectSection.positivePrompt`, `ProjectSection.negativePrompt`, `ProjectSection.promptBlocks`, `ProjectSection.loraConfig` | `SectionPromptBlock`、`SectionPresetBinding`、`SectionManualLoraEntry` 与不可变运行快照 | 已移除 schema 存储 | `tests/test-zero-redundancy-no-legacy-fields.test.ts` 阻止在 schema 与运行时源码中重新引入这些字段 |
| 旧版模板分区提示词字段 | `ProjectTemplateSection.promptBlocks`, `ProjectTemplateSection.loraConfig` | `TemplateSectionPromptBlock`、`TemplateSectionPresetBinding` 与 `TemplateSectionManualLoraEntry` | 已移除 schema 存储 | `tests/test-zero-redundancy-template-resolver.test.ts` 确保模板保存由关系记录支撑 |
| 已弃用的种子策略载荷 | 解析器/快照兼容载荷中的单数 `seedPolicy` | `seedPolicy1`, `seedPolicy2` | 只读兼容输入 | `tests/test-zero-redundancy-section-resolver.test.ts` 保留两阶段种子策略输出 |
| 旧版角色 LoRA 提示词值 | `TrainingCharacterProfile.loraUsagePrompt`, `TrainingCharacterProfile.characterDetailPrompt`, `TrainingGenerationTaskOutput.loraUsagePromptSnapshot` | `loraUsagePromptGenerationTaskId`、`characterDetailPromptGenerationTaskId` 与任务输出快照 | 保留的活动训练数据 | 在后续批次拆分训练数据模型前，Training schema 字段保持跨提供方兼容 |

## 数据库提供方专属模型

- PostgreSQL 专属模型：无
- SQLite 专属模型：无

## 检查规则

- 变更共享模型时，必须在同一批次更新 `prisma/schema.prisma` 与 `prisma/schema.sqlite.prisma`。
- 合并前，必须确认本文件的“数据库提供方专属模型”章节已由生成器更新，并在对应 OpenSpec 变更或批次说明中记录无法由 schema 自动表达的差异。
- schema 变更后，使用 `npm run prisma:generate:all` 重新生成两个客户端。
