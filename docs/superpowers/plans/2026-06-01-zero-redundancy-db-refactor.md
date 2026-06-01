# Zero Redundancy DB Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 将项目、模板、预制、Character LoRA 中的编辑态绑定关系改为引用优先的关系模型，彻底删除除 snapshot、审计、不可变运行输入、外部任务 payload、冻结 dataset 之外的派生冗余存储。

**Architecture:** 新增结构化关系表承载 preset/category/variant/section/template 绑定，新增统一 resolver 在读取、展示、入队、模板实例化、benchmark 临时项目创建时按需解析最终 prompt 和 LoRA。迁移期间采用“新表优先、旧字段兼容读、双读对账、切换写路径、删除旧字段”的分阶段策略，保证现有生产数据可验证迁移且不丢失“手动编辑即脱钩”的语义。

**Tech Stack:** Next.js 16 App Router Server Actions, TypeScript, Prisma 7, SQLite/PostgreSQL dual schema, Node `tsx` test/migration scripts

---

## 范围和非目标

本计划只定义后续实现步骤，不在本文件中直接实现 schema、代码或测试。实施时必须同时维护 `prisma/schema.sqlite.prisma` 和 `prisma/schema.prisma`，并遵守项目部署规则。

核心目标是“编辑态数据 0 派生冗余”。运行、审计、外部任务、冻结数据集这类语义上不可变或需要复现历史的记录必须保留快照，不属于本次删除目标。

必须保留现有语义：用户在 section 里手动编辑 preset-sourced prompt block 时，该 block 自动脱钩为 custom；对应 preset LoRA 也脱钩为 manual/detached override。后续 preset 更新不得覆盖已经脱钩的本地内容。

## 冗余定义和豁免标准

需要删除的冗余：

- 编辑态绑定的派生缓存：可以从 preset/category/variant/binding/block 当前状态重新解析出来的 `positive`、`negative`、`positivePrompt`、`negativePrompt`、preset LoRA 展开项。
- JSON 引用数组：本质是实体关系但存成 JSON 的 `presetBindings`、`linkedVariants`、`slotTemplate`。
- 模板里的展开副本：`ProjectTemplateSection.promptBlocks` 和 `loraConfig` 中保存的 preset 展开内容。
- 反向同步产生的缓存：preset 更新时批量写回 section/template 的 block prompt、section lora、section composed prompt。

允许保留的非冗余：

- `Run.resolvedConfigSnapshot`、`Run.submittedPrompt`：每次生成实际使用的不可变快照。
- `SectionChangeLog.before/after`、`PresetChangeLog.before/after`、`AuditLog.payload`：审计历史。
- `Preset.civitaiLinks`、`PresetVariant.lora1/lora2/defaultParams`：预制自身的源数据或外部资源链接，不是上游缓存下游。
- `Project.projectLevelOverrides`、`ProjectSection.ksampler1/ksampler2/extraParams`、`ProjectTemplateSection.ksampler1/ksampler2/extraParams`：用户编辑的运行参数覆盖，resolver 只读取并合并，不删除。
- `CharacterLoraTrainingJob.trainingTemplateSnapshot`：训练项目创建时锁定的模板快照。
- `CharacterLoraGenerationRun.visualPrompt`、`negativePrompt`、`toolParams`、`inputImages`、`responseSummary`：外部 provider 请求/响应输入输出。
- `CharacterLoraTrainingRun.resolvedConfig`、`CharacterLoraWorkerTask.payload`：训练任务和外部 worker 的不可变输入。
- `CharacterLoraDatasetRevision` 和 `CharacterLoraDatasetItem.imageArtifactId/captionArtifactId/captionText/repeatCount/sourceWeight`：冻结 dataset 的 manifest 内容。
- `CharacterLoraArtifact.metadata`、checkpoint metrics、loss/progress summaries：产物或运行历史元数据。

## 当前冗余清单

Schema 证据:

- `prisma/schema.sqlite.prisma` 与 `prisma/schema.prisma` 均存在相同结构；实施时两份 schema 必须同步。
- `PresetCategory.slotTemplate Json?`：group category 的 slot 引用数组，语义应为 `PresetCategorySlot` 关系。
- `PresetVariant.linkedVariants Json?`：variant 链接引用数组，语义应为 `PresetVariantLink` 关系。
- `Project.presetBindings Json?`：项目级 preset 默认绑定数组，语义应为 `ProjectPresetBinding` 关系。
- `ProjectSection.positivePrompt/negativePrompt`：由 prompt blocks 拼接出的 composed prompt，编辑态派生冗余。
- `ProjectSection.loraConfig Json?`：混合保存 manual LoRA、detached LoRA、preset LoRA 展开值；preset 展开项是冗余，manual/detached override 不是。
- `PromptBlock.sourceId/variantId/categoryId/bindingId/groupBindingId + label/positive/negative`：同一行同时保存 preset 引用和展开 prompt。
- `ProjectTemplate.presetBindings Json?`：模板项目级 preset 默认绑定数组，语义应为 `ProjectTemplatePresetBinding` 关系。
- `ProjectTemplateSection.promptBlocks Json?`：模板 section 的 block 引用和展开 prompt 混存。
- `ProjectTemplateSection.loraConfig Json?`：模板 section 的 preset LoRA 展开值和 manual/detached LoRA 混存。

代码证据:

- `src/lib/actions/prompt-block.ts`：`importPresetToSection` 导入 preset 时调用 `resolveVariantContent`，随后写 `PromptBlock.positive/negative` 和 `ProjectSection.loraConfig`。
- `src/lib/actions/prompt-block.ts`：`switchBindingVariant` 切换 variant 时重写 block prompt 和 section lora。
- `src/lib/actions/section.ts`：`addSection` 从 `Project.presetBindings` 批量展开初始 `PromptBlock` 和 `loraConfig`。
- `src/lib/actions/template-save.ts`：保存模板时把 section 的 block 展开值和 LoRA JSON 拷贝到模板。
- `src/lib/actions/template-import.ts`：导入模板时再次解析 project/template preset 并写 composed prompt、block prompt、section lora。
- `src/lib/actions/preset-sync.ts`：preset 更新后反查所有 `PromptBlock.sourceId` 和全部 template section JSON，批量同步 prompt/lora/composed prompt。
- `src/lib/actions/preset-variant-resolve.ts`：`linkedVariants` 从 JSON 读取，并触发 `syncVariantContentToImportedSections`。
- `src/server/services/prompt-block-service.ts` 与 `src/lib/preset-binding-utils.ts`：已经存在“手动编辑 preset block 即脱钩”和 LoRA detach 的语义。
- `src/server/repositories/project-repository/helpers.ts` 与 `src/server/repositories/project-repository/enqueue.ts`：入队 snapshot 当前依赖 section/block 已展开字段，目标应改为依赖 resolver 输出。
- `src/server/repositories/character-lora-training/benchmark-helpers.ts`：benchmark 临时 section 当前也构造 `loraConfig` 展开项，需要接入 resolver 或写入 manual benchmark override。

Character LoRA 分类：

- 保留为 snapshot/不可变输入：`trainingTemplateSnapshot`、generation run request fields、training run `resolvedConfig`、worker `payload`、dataset item caption/image/caption artifact、artifact metadata、benchmark report/result summaries。
- 保留为版本化主数据：`CharacterLoraPromptCardVersion.identityTraits/outfitTraits/negativeTraits/finalPromptDraft`、`CharacterLoraCanonicalVersion.imageArtifactId`、`CharacterLoraSectionTemplate.promptTemplate/negativeTemplate`。
- 需要关系硬化但不一定删除：`currentCanonicalVersionId/currentPromptCardVersionId/selectedDatasetRevisionId/promotedPresetId/testPresetId/testProjectId/templateId` 是指针或外部资源引用；能加 FK 或 resolver 校验时加，但不是展开副本。
- 随主项目模型一起清理：benchmark 临时 `testProjectId` 指向的 project/section/prompt/lora 结构必须使用新的零冗余 section/template 模型。

## 目标 DB 模型草案

命名可在实施时根据 Prisma 生成类型微调，但语义边界不得改变。

Preset 关系：

```prisma
model PresetVariantLink {
  id              String @id @default(cuid())
  parentVariantId String
  linkedPresetId  String
  linkedVariantId String
  sortOrder       Int    @default(0)
  parentVariant   PresetVariant @relation("PresetVariantLinks", fields: [parentVariantId], references: [id], onDelete: Cascade)
  linkedVariant   PresetVariant @relation("PresetVariantLinkedBy", fields: [linkedVariantId], references: [id], onDelete: Restrict)

  @@unique([parentVariantId, linkedVariantId])
  @@index([linkedVariantId])
}

model PresetCategorySlot {
  id              String @id @default(cuid())
  groupCategoryId String
  slotCategoryId  String
  label           String?
  sortOrder       Int    @default(0)
  groupCategory   PresetCategory @relation("PresetGroupSlots", fields: [groupCategoryId], references: [id], onDelete: Cascade)
  slotCategory    PresetCategory @relation("PresetSlotMembers", fields: [slotCategoryId], references: [id], onDelete: Restrict)

  @@unique([groupCategoryId, slotCategoryId])
  @@index([slotCategoryId])
}
```

Project/Template 顶层绑定：

```prisma
model ProjectPresetBinding {
  id         String @id @default(cuid())
  projectId  String
  categoryId String
  presetId   String
  variantId  String?
  sortOrder  Int    @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  project    Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  category   PresetCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  preset     Preset @relation(fields: [presetId], references: [id], onDelete: Restrict)
  variant    PresetVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@unique([projectId, categoryId])
  @@index([presetId])
  @@index([variantId])
}

model ProjectTemplatePresetBinding {
  id                String @id @default(cuid())
  projectTemplateId String
  categoryId         String
  presetId           String
  variantId          String?
  sortOrder          Int    @default(0)
  projectTemplate    ProjectTemplate @relation(fields: [projectTemplateId], references: [id], onDelete: Cascade)
  category           PresetCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  preset             Preset @relation(fields: [presetId], references: [id], onDelete: Restrict)
  variant            PresetVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  @@unique([projectTemplateId, categoryId])
  @@index([presetId])
  @@index([variantId])
}
```

Section/Template Block 与 LoRA Override：

```prisma
model SectionPresetBinding {
  id              String @id @default(cuid())
  projectSectionId String
  categoryId      String
  presetId        String
  variantId       String?
  bindingKey      String
  groupBindingKey String?
  sortOrder       Int    @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  projectSection  ProjectSection @relation(fields: [projectSectionId], references: [id], onDelete: Cascade)
  category        PresetCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  preset          Preset @relation(fields: [presetId], references: [id], onDelete: Restrict)
  variant         PresetVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  promptBlock     SectionPromptBlock?

  @@unique([projectSectionId, bindingKey])
  @@index([presetId])
  @@index([variantId])
}

model SectionPromptBlock {
  id               String @id @default(cuid())
  projectSectionId String
  type             String @default("custom")
  sectionBindingId String? @unique
  label            String
  customPositive   String?
  customNegative   String?
  sortOrder        Int @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  projectSection   ProjectSection @relation(fields: [projectSectionId], references: [id], onDelete: Cascade)
  presetBinding    SectionPresetBinding? @relation(fields: [sectionBindingId], references: [id], onDelete: Cascade)

  @@index([projectSectionId, sortOrder])
}

model SectionManualLoraEntry {
  id                    String @id @default(cuid())
  projectSectionId      String
  stage                 String
  path                  String
  weight                Float  @default(1)
  enabled               Boolean @default(true)
  sortOrder             Int @default(0)
  detachedFromBindingKey String?
  detachedFromPresetId   String?
  detachedFromVariantId  String?
  detachedFromPath       String?
  metadata              Json?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  projectSection        ProjectSection @relation(fields: [projectSectionId], references: [id], onDelete: Cascade)

  @@index([projectSectionId, stage, sortOrder])
  @@index([detachedFromBindingKey])
}
```

Template section 需要同构表：`TemplateSectionPresetBinding`、`TemplateSectionPromptBlock`、`TemplateSectionManualLoraEntry`。字段与 section 版本一致，父级改为 `projectTemplateSectionId`，manual LoRA 同样需要 `metadata Json?`。模板保存/导入时不得再写 `ProjectTemplateSection.promptBlocks/loraConfig`。

旧字段删除目标：

- `PresetCategory.slotTemplate`
- `PresetVariant.linkedVariants`
- `Project.presetBindings`
- `ProjectTemplate.presetBindings`
- `ProjectSection.positivePrompt`
- `ProjectSection.negativePrompt`
- `ProjectSection.loraConfig`
- `PromptBlock.sourceId/variantId/categoryId/bindingId/groupBindingId/positive/negative`，或直接用 `SectionPromptBlock` 替代旧 `PromptBlock`
- `ProjectTemplateSection.promptBlocks`
- `ProjectTemplateSection.loraConfig`

## 目标代码架构

新增 resolver 模块：

- `src/server/prompt-config/types.ts`：定义 `ResolvedSectionConfig`、`ResolvedPromptBlock`、`ResolvedLoraEntry`、`ResolvedPresetBinding`、`ResolverMode`。
- `src/server/prompt-config/preset-resolver.ts`：解析 preset variant、linked variants、LoRA，并从 `PresetVariantLink` 关系表读取链接。
- `src/server/prompt-config/section-resolver.ts`：实现 `resolveSectionConfig(sectionId, options)` 和 `resolveSectionConfigFromRecord(record, options)`。
- `src/server/prompt-config/template-resolver.ts`：实现 `resolveTemplateSectionConfig(templateSectionId, options)`。
- `src/server/prompt-config/order.ts`：按 category 的 `positivePromptOrder/lora1Order/lora2Order` 稳定排序。
- `src/server/prompt-config/diff.ts`：迁移和双读使用，比较旧缓存输出与新 resolver 输出。

Resolver 输出必须包含：

- `prompt.positive` 与 `prompt.negative`
- `promptBlocks[]`：每个 block 的显示 label、resolved prompt、source metadata、是否 detached/custom
- `loraConfig.lora1/lora2`：preset LoRA 与 manual/detached override 合并后的最终配置
- `parameters`：section/project/default overrides 合并后的运行参数
- `presets[]`：snapshot 中需要展示的 preset 引用
- `warnings[]`：缺失 preset/variant、循环 linked variant、迁移异常、legacy fallback 等

代码切换点：

- 页面展示：project/detail/section/form 读取 resolver 输出，不再读 section composed prompt 和 lora JSON。
- 入队：`src/server/repositories/project-repository/enqueue.ts` 调 resolver，再由 `buildResolvedConfigSnapshot` 冻结 resolver 输出。
- 模板实例化：`src/lib/actions/template-import.ts` 使用 template resolver 和新结构表，不再创建展开副本。
- 保存模板：`src/lib/actions/template-save.ts` 保存引用和 manual/detached override，不保存 resolved prompt/lora。
- preset 更新：`src/lib/actions/preset-sync.ts` 中的反向同步逻辑删除；preset action 只 revalidate 相关页面或触发轻量缓存失效。
- variant 链接：`src/lib/actions/preset-variant-resolve.ts` 改读 `PresetVariantLink`，不再解析 JSON。
- benchmark 临时项目：Character LoRA benchmark 只写结构化 binding 和 manual benchmark LoRA override；入队仍由 resolver 生成 snapshot。

## 迁移策略

1. 新增表和兼容读。
   - 两份 Prisma schema 加新模型和 relation。
   - 旧字段先保留。
   - resolver 优先读新表；没有新表数据时读旧字段。

2. 数据迁移。
   - `scripts/db/migrate-zero-redundancy.ts` 同时支持 sqlite/postgres。
   - 迁移 JSON 引用数组到关系表：project bindings、template bindings、linked variants、category slots。
   - 迁移 section/template blocks：preset block 若与当前 resolver 输出一致，迁为 bound 引用；若不一致，按“已手动编辑”迁为 custom block 或 detached override。
   - 迁移 `loraConfig`：preset 展开项若可由 binding+variant 解析得到则不落新表；manual/detached 项写入 `SectionManualLoraEntry` 或 `TemplateSectionManualLoraEntry`。
   - 迁移 composed prompts：从 blocks 重新解析；无法解释的 legacy prompt 创建 custom block，避免丢数据。

3. 双读验证。
   - `scripts/db/verify-zero-redundancy.ts` 对每个 section/template section 同时计算旧输出和新 resolver 输出。
   - 输出 mismatch JSONL，包含 entity id、字段名、旧值摘要、新值摘要、分类原因。
   - 生产只读统计必须先跑，不修改 DB。

4. 切换写路径。
   - import preset、switch variant、add section、copy section、template save/import、project preset binding 编辑全部写新表。
   - preset 更新不再写下游 section/template。
   - 保留旧字段兼容读一个发布周期，写路径不再更新旧字段。

5. 删除旧字段。
   - 验证生产 mismatch 为 0 后，移除旧字段、旧 sync、旧 JSON parser 和旧 UI 依赖。
   - schema 迁移必须包含 sqlite 和 postgres；sqlite 如需重建表，用 Prisma migration 或专用脚本备份后执行。

## 测试和验证计划

TDD 单元测试：

- `tests/test-zero-redundancy-preset-resolver.test.ts`
  - linked variants 递归解析、循环保护、LoRA 去重、category 排序。
- `tests/test-zero-redundancy-section-resolver.test.ts`
  - section preset binding 现场解析 prompt/lora。
  - manual block 与 preset block 排序。
  - 手动编辑 preset block 后转 custom，不再跟随 preset。
  - detached LoRA 覆盖同 binding 的 preset LoRA。
- `tests/test-zero-redundancy-template-resolver.test.ts`
  - template section 引用解析。
  - project-level binding 与 section-level binding 去重。
- `tests/test-zero-redundancy-migration.test.ts`
  - 旧 JSON 数据迁移为新关系。
  - 存量展开值和 resolver 一致时不保留冗余。
  - 存量展开值不一致时保留为 custom/detached override。

迁移验证：

- `node --import tsx --test tests/test-zero-redundancy-migration.test.ts`
- `DB_PROVIDER=sqlite npx prisma generate`
- `npx prisma generate`
- `DB_PROVIDER=sqlite DATABASE_URL=file:./prisma/data/comfyui.db npx tsx scripts/db/verify-zero-redundancy.ts --read-only --format summary`
- `DATABASE_URL=$POSTGRES_URL npx tsx scripts/db/verify-zero-redundancy.ts --read-only --format summary`

生产只读统计：

- `npx tsx scripts/db/zero-redundancy-production-stats.ts --read-only`
- 统计必须包括：section 数、prompt block 数、preset block 数、manual/detached lora 数、template section 数、JSON 字段坏数据数、旧新 resolver mismatch 数、不可迁移 legacy prompt 数。

UI 和入队验证：

- preset 编辑保存应只写 preset 表，耗时不随引用数量线性增长。
- section 页面展示的 prompt/lora 与迁移前一致。
- template 保存/导入后展示一致。
- 单 section 入队与整 project 入队创建的 `Run.resolvedConfigSnapshot` 与 resolver 输出一致。
- Character LoRA benchmark 创建的临时 project 可入队并生成正确 LoRA 权重矩阵。

回滚：

- 每个迁移脚本执行前写 DB 备份路径到日志。
- 切换写路径前，旧字段仍在；可通过 feature flag `ZERO_REDUNDANCY_WRITE_PATH=legacy` 回退写旧路径。
- 删除旧字段必须单独提交，且只能在生产只读验证 mismatch 为 0 后执行。
- 删除字段后回滚依赖 DB 备份，不承诺自动恢复冗余缓存。

## 阶段 0：基线统计和 Fixture

**目标：** 建立可重复的统计、fixture 和对账口径，不改业务行为。

**涉及文件：**

- 创建：`scripts/db/zero-redundancy-production-stats.ts`
- 创建：`tests/fixtures/zero-redundancy-legacy.ts`
- 创建：`tests/test-zero-redundancy-inventory.test.ts`

- [ ] **步骤 1：编写失败的统计测试**

运行：`node --import tsx --test tests/test-zero-redundancy-inventory.test.ts`

预期：失败，原因是统计 helper 尚不存在。

- [ ] **步骤 2：实现只读统计脚本**

脚本必须统计旧 JSON 字段，并把允许保留的 snapshot 与需要删除的编辑态冗余分开分类。脚本不得更新 DB。

- [ ] **步骤 3：运行本地验证**

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-inventory.test.ts
npm test
```

预期：测试通过。

- [ ] **步骤 4：提交**

```bash
git add scripts/db/zero-redundancy-production-stats.ts tests/fixtures/zero-redundancy-legacy.ts tests/test-zero-redundancy-inventory.test.ts
git commit -m "test: add zero redundancy inventory baseline"
```

## 阶段 1：在旧字段旁新增关系模型

**目标：** 新增关系表，不删除旧字段，不改变运行时行为。

**涉及文件：**

- 修改：`prisma/schema.sqlite.prisma`
- 修改：`prisma/schema.prisma`
- 修改：`src/generated/*`，由 Prisma generate 生成
- 创建：`tests/test-zero-redundancy-schema-shape.test.ts`

- [ ] **步骤 1：编写失败的 schema shape 测试**

测试生成后的 Prisma client 暴露 `projectPresetBinding`、`projectTemplatePresetBinding`、`sectionPresetBinding`、`sectionPromptBlock`、`sectionManualLoraEntry`、`templateSectionPresetBinding`、`templateSectionPromptBlock`、`templateSectionManualLoraEntry`、`presetVariantLink` 和 `presetCategorySlot`。

运行：`node --import tsx --test tests/test-zero-redundancy-schema-shape.test.ts`

预期：schema 修改前失败。

- [ ] **步骤 2：添加 schema 模型**

把本计划里的目标模型加入两份 Prisma schema。保留旧字段用于兼容读。

- [ ] **步骤 3：生成 Prisma clients**

运行：

```bash
DB_PROVIDER=sqlite npx prisma generate
npx prisma generate
```

预期：两份 generated client 都生成成功。

- [ ] **步骤 4：运行测试**

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-schema-shape.test.ts
npm test
```

预期：测试通过。

- [ ] **步骤 5：提交**

```bash
git add prisma/schema.sqlite.prisma prisma/schema.prisma src/generated tests/test-zero-redundancy-schema-shape.test.ts
git commit -m "feat: add zero redundancy relationship tables"
```

## 阶段 2：构建 Preset 和 Section Resolver

**目标：** 用统一 resolver 现场解析 section prompt/lora，输出与旧缓存一致。

**涉及文件：**

- 创建：`src/server/prompt-config/types.ts`
- 创建：`src/server/prompt-config/order.ts`
- 创建：`src/server/prompt-config/preset-resolver.ts`
- 创建：`src/server/prompt-config/section-resolver.ts`
- 创建：`src/server/prompt-config/diff.ts`
- 创建：`tests/test-zero-redundancy-preset-resolver.test.ts`
- 创建：`tests/test-zero-redundancy-section-resolver.test.ts`

- [ ] **步骤 1：编写失败的 resolver 测试**

覆盖 linked variants、category order、section binding 解析、detached LoRA 和 custom block fallback。

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-preset-resolver.test.ts
node --import tsx --test tests/test-zero-redundancy-section-resolver.test.ts
```

预期：失败，原因是 resolver 模块尚不存在。

- [ ] **步骤 2：实现 preset resolver**

`resolvePresetVariantContent(variantId)` 必须优先读取 `PresetVariantLink`，只在没有关系行时读取 legacy `linkedVariants`。它必须用 visited variant id 避免循环。

- [ ] **步骤 3：实现 section resolver**

`resolveSectionConfig(sectionId)` 必须优先读取新 section 表；没有新行时才 fallback 到 legacy `PromptBlock`/`ProjectSection.loraConfig`。输出的 `loraConfig` shape 必须兼容现有 workflow builder。

- [ ] **步骤 4：实现 diff helper**

`diffResolvedSectionConfig(oldSnapshotLike, resolved)` 必须把 mismatch 分类为 prompt、lora、params、missingReference 或 legacyOnly。

- [ ] **步骤 5：运行测试**

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-preset-resolver.test.ts
node --import tsx --test tests/test-zero-redundancy-section-resolver.test.ts
npm test
```

预期：测试通过。

- [ ] **步骤 6：提交**

```bash
git add src/server/prompt-config tests/test-zero-redundancy-preset-resolver.test.ts tests/test-zero-redundancy-section-resolver.test.ts
git commit -m "feat: resolve section config from normalized bindings"
```

## 阶段 3：迁移数据并加入双读验证

**目标：** 将旧 JSON/展开缓存迁移到新表，并证明 resolver 输出不丢数据。

**涉及文件：**

- 创建：`scripts/db/migrate-zero-redundancy.ts`
- 创建：`scripts/db/verify-zero-redundancy.ts`
- 创建：`tests/test-zero-redundancy-migration.test.ts`
- 修改：`src/server/prompt-config/diff.ts`

- [ ] **步骤 1：编写失败的 migration 测试**

Fixture 必须包括：clean preset block、edited preset block、detached LoRA、manual LoRA、template section preset block、linked variant JSON、slotTemplate JSON。

运行：`node --import tsx --test tests/test-zero-redundancy-migration.test.ts`

预期：失败，原因是 migration script 尚不存在。

- [ ] **步骤 2：实现 migration script**

规则：

- JSON 引用变成关系行。
- clean preset prompt/lora 展开值在关系行存在后丢弃。
- 已偏离的 preset prompt 变成 custom block。
- 已偏离的 preset LoRA 变成 manual/detached lora 行，并带 `detachedFrom*` 元数据。
- 无法解释的 `positivePrompt/negativePrompt` 变成 label 为 `Legacy section prompt` 的 custom block。
- 脚本支持 `--dry-run`、`--read-only`、`--batch-size` 和 `--write`。

- [ ] **步骤 3：实现 verification script**

验证脚本必须比较 legacy output 和 resolver output；除非传入 `--allow-mismatch`，存在 mismatch 时必须以非零状态退出。

- [ ] **步骤 4：运行本地测试和 dry-run**

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-migration.test.ts
DB_PROVIDER=sqlite DATABASE_URL=file:./prisma/data/comfyui.db npx tsx scripts/db/migrate-zero-redundancy.ts --dry-run
DB_PROVIDER=sqlite DATABASE_URL=file:./prisma/data/comfyui.db npx tsx scripts/db/verify-zero-redundancy.ts --read-only --format summary
```

预期：测试通过；dry-run 不写入；verifier 打印统计。

- [ ] **步骤 5：提交**

```bash
git add scripts/db/migrate-zero-redundancy.ts scripts/db/verify-zero-redundancy.ts tests/test-zero-redundancy-migration.test.ts src/server/prompt-config/diff.ts
git commit -m "feat: migrate legacy prompt bindings to normalized tables"
```

## 阶段 4：把读取路径切到 Resolver

**目标：** UI 展示和入队 snapshot 使用 resolver，不再依赖编辑态冗余字段。

**涉及文件：**

- 修改：`src/server/repositories/project-view-repository/detail-view.ts`
- 修改：`src/server/repositories/project-view-repository/form-view.ts`
- 修改：`src/server/repositories/project-view-repository/list-view.ts`
- 修改：`src/server/repositories/project-repository/helpers.ts`
- 修改：`src/server/repositories/project-repository/enqueue.ts`
- 修改：`src/server/services/section-workflow-service.ts`
- 创建：`tests/test-zero-redundancy-enqueue.test.ts`

- [ ] **步骤 1：编写失败的 enqueue 测试**

断言 queued run snapshot 等于 `resolveSectionConfig` 输出，并且不依赖 `ProjectSection.positivePrompt/negativePrompt/loraConfig`。

运行：`node --import tsx --test tests/test-zero-redundancy-enqueue.test.ts`

预期：enqueue 使用 resolver 前失败。

- [ ] **步骤 2：更新 project view repositories**

用 resolver 输出替换对 section composed prompt/lora 的直接读取。迁移期间只把 legacy fields 用作 fallback warning 来源。

- [ ] **步骤 3：更新 enqueue helpers**

把 `buildResolvedConfigSnapshot` 改为接收 `ResolvedSectionConfig`，不再接收 raw expanded section fields。

- [ ] **步骤 4：更新 workflow service**

确保 workflow prompt builder 从 snapshot 或 resolver 接收 resolved prompt/lora，而不是 stale section fields。

- [ ] **步骤 5：运行测试**

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-enqueue.test.ts
npm test
npm run lint
```

预期：测试和 lint 通过。

- [ ] **步骤 6：提交**

```bash
git add src/server/repositories/project-view-repository src/server/repositories/project-repository src/server/services/section-workflow-service.ts tests/test-zero-redundancy-enqueue.test.ts
git commit -m "feat: read project prompt config through resolver"
```

## 阶段 5：切换 Section 和 Template 写路径

**目标：** 所有编辑态写入只写结构化引用和 manual/detached override，不再写展开缓存。

**涉及文件：**

- 修改：`src/lib/actions/prompt-block.ts`
- 修改：`src/lib/actions/section.ts`
- 修改：`src/lib/actions/template-save.ts`
- 修改：`src/lib/actions/template-import.ts`
- 修改：`src/server/services/prompt-block-service.ts`
- 修改：`src/server/services/preset-binding-service.ts`
- 修改：`src/lib/preset-binding-utils.ts`
- 创建：`tests/test-zero-redundancy-write-paths.test.ts`
- 创建：`tests/test-zero-redundancy-template-resolver.test.ts`

- [ ] **步骤 1：编写失败的 write-path 测试**

断言导入 preset 会创建 `SectionPresetBinding` 和 `SectionPromptBlock`，但不会复制 prompt text。断言编辑该 block 会把它转为 custom 并移除 binding。

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-write-paths.test.ts
node --import tsx --test tests/test-zero-redundancy-template-resolver.test.ts
```

预期：写路径切换前失败。

- [ ] **步骤 2：更新 preset import and variant switch**

`importPresetToSection` 写 binding rows；`switchBindingVariant` 更新 `SectionPresetBinding.variantId`。两者都不得写 resolved prompt 或 preset LoRA expansion。

- [ ] **步骤 3：更新 manual edit detach**

`editPromptBlock` 和 server action update 必须把 preset-bound block 转为 custom，并把当前 resolved prompt 复制一次成为用户拥有的内容，然后删除或断开 `SectionPresetBinding`。这保留“手动编辑即脱钩”语义。

- [ ] **步骤 4：更新 section creation/copy**

`addSection` 从 `ProjectPresetBinding` 创建 section-level binding rows；`copySection` 只有在旧 section 已有 detached content 时才复制为 custom，否则应明确复制引用。

- [ ] **步骤 5：更新 template save/import**

保存模板时写入 `TemplateSection*` 表。导入模板时从 template binding/manual rows 和 project-level bindings 创建 section binding/manual rows，不写 composed prompt/lora。

- [ ] **步骤 6：运行测试**

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-write-paths.test.ts
node --import tsx --test tests/test-zero-redundancy-template-resolver.test.ts
npm test
npm run lint
```

预期：测试和 lint 通过。

- [ ] **步骤 7：提交**

```bash
git add src/lib/actions/prompt-block.ts src/lib/actions/section.ts src/lib/actions/template-save.ts src/lib/actions/template-import.ts src/server/services/prompt-block-service.ts src/server/services/preset-binding-service.ts src/lib/preset-binding-utils.ts tests/test-zero-redundancy-write-paths.test.ts tests/test-zero-redundancy-template-resolver.test.ts
git commit -m "feat: write prompt bindings without expanded caches"
```

## 阶段 6：移除反向 Preset Sync

**目标：** preset 更新不再批量同步所有下游实体。

**涉及文件：**

- 修改：`src/lib/actions/preset-sync.ts`
- 修改：`src/lib/actions/preset-variant-resolve.ts`
- 修改：`src/lib/actions/preset-variant-crud.ts`
- 修改：`src/server/services/preset-query-service.ts`
- 修改：展示 usage/sync status 的 preset editor UI 文件
- 创建：`tests/test-zero-redundancy-preset-update.test.ts`

- [ ] **步骤 1：编写失败的 preset update 测试**

断言更新 preset variant 会改变 bound sections 的 resolver 输出，但不会更新任何 section/template rows。

运行：`node --import tsx --test tests/test-zero-redundancy-preset-update.test.ts`

预期：旧 sync 仍写下游 rows 时失败。

- [ ] **步骤 2：移除 content sync calls**

从 preset CRUD paths 删除对 `syncVariantContentToImportedSections` 和 `syncPresetMetadataToImportedSections` 的调用。如果 UI 需要展示受影响引用，可以保留 usage query。

- [ ] **步骤 3：替换 linked variant JSON logic**

读写 `PresetVariantLink` rows。legacy JSON fallback 只保留到旧字段删除阶段。

- [ ] **步骤 4：运行 performance check**

使用包含数千个 section bindings 的 fixture。更新一个 preset 应只执行 O(1) preset writes 加 cache invalidation，而不是 O(section 数量)。

- [ ] **步骤 5：运行测试**

运行：

```bash
node --import tsx --test tests/test-zero-redundancy-preset-update.test.ts
npm test
npm run lint
```

预期：测试和 lint 通过。

- [ ] **步骤 6：提交**

```bash
git add src/lib/actions/preset-sync.ts src/lib/actions/preset-variant-resolve.ts src/lib/actions/preset-variant-crud.ts src/server/services/preset-query-service.ts tests/test-zero-redundancy-preset-update.test.ts
git commit -m "feat: resolve preset changes lazily"
```

## Stage 7: Integrate Character LoRA Benchmark And Temporary Projects

**目标：** Character LoRA 临时 project/benchmark 路径不再生成编辑态冗余。

**涉及文件：**

- Modify: `src/server/repositories/character-lora-training/benchmark-helpers.ts`
- Modify: `src/server/repositories/character-lora-training/benchmark-repository.ts`
- Modify: `src/server/services/character-lora-training/benchmark-service.ts`
- Modify: `src/server/services/character-lora-training/benchmark-promotion-service.ts`
- Create: `tests/test-zero-redundancy-character-lora-benchmark.test.ts`

- [ ] **步骤 1：编写失败的 benchmark test**

Assert benchmark matrix expansion writes section binding/manual LoRA rows and run snapshot resolves correct checkpoint/weight.

运行：`node --import tsx --test tests/test-zero-redundancy-character-lora-benchmark.test.ts`

预期：fail while benchmark writes legacy `loraConfig`.

- [ ] **步骤 2：更新 benchmark section creation**

Benchmark-specific LoRA weight is a manual runtime input, so write it as `SectionManualLoraEntry` with benchmark metadata in `metadata`, not as preset-expanded `loraConfig`.

- [ ] **步骤 3：保留 Character LoRA snapshots**

Do not remove `trainingTemplateSnapshot`, `GenerationRun.*Prompt/toolParams/inputImages`, `TrainingRun.resolvedConfig`, `WorkerTask.payload`, frozen dataset item fields, or artifact metadata.

- [ ] **步骤 4：运行 tests**

Run:

```bash
node --import tsx --test tests/test-zero-redundancy-character-lora-benchmark.test.ts
npm test
```

预期：tests pass.

- [ ] **步骤 5：提交**

```bash
git add src/server/repositories/character-lora-training/benchmark-helpers.ts src/server/repositories/character-lora-training/benchmark-repository.ts src/server/services/character-lora-training/benchmark-service.ts src/server/services/character-lora-training/benchmark-promotion-service.ts tests/test-zero-redundancy-character-lora-benchmark.test.ts
git commit -m "feat: normalize character lora benchmark prompt bindings"
```

## Stage 8: Delete Legacy Fields And Cleanup

**目标：** 移除所有已迁移的编辑态冗余字段、旧 JSON parser、旧 sync fallback。

**涉及文件：**

- Modify: `prisma/schema.sqlite.prisma`
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/actions/preset-sync.ts`
- Modify: `src/lib/actions/preset-variant-resolve.ts`
- Modify: `src/lib/actions/project.ts`
- Modify: `src/server/repositories/*` files still reading old fields
- Modify: `src/server/services/*` files still reading old fields
- Modify: `tests/*zero-redundancy*.test.ts`
- Create: `tests/test-zero-redundancy-no-legacy-fields.test.ts`

- [ ] **步骤 1：运行 production readonly verifier**

Run on the target production DB before deleting fields:

```bash
npx tsx scripts/db/verify-zero-redundancy.ts --read-only --format summary
```

预期：`mismatchCount: 0`, `legacyFallbackCount: 0`, `badJsonCount: 0`.

- [ ] **步骤 2：编写失败的 no-legacy-fields test**

Assert no code path references `ProjectSection.positivePrompt`, `ProjectSection.negativePrompt`, `ProjectSection.loraConfig`, `PromptBlock.positive`, `PromptBlock.negative`, `Project.presetBindings`, `ProjectTemplate.presetBindings`, `ProjectTemplateSection.promptBlocks`, `ProjectTemplateSection.loraConfig`, `PresetVariant.linkedVariants`, or `PresetCategory.slotTemplate`.

运行：`node --import tsx --test tests/test-zero-redundancy-no-legacy-fields.test.ts`

预期：fail until schema/code cleanup is complete.

- [ ] **步骤 3：移除 schema fields**

Delete old fields from both Prisma schemas. Generate clients for sqlite and postgres.

- [ ] **步骤 4：移除 legacy code**

Delete legacy fallback readers, JSON parsers used only for old fields, and reverse sync functions that mutate downstream caches.

- [ ] **步骤 5：运行 full verification**

Run:

```bash
DB_PROVIDER=sqlite npx prisma generate
npx prisma generate
node --import tsx --test tests/test-zero-redundancy-no-legacy-fields.test.ts
npm test
npm run lint
npm run build
```

预期：all pass.

- [ ] **步骤 6：提交**

```bash
git add prisma/schema.sqlite.prisma prisma/schema.prisma src tests
git commit -m "refactor: remove legacy prompt redundancy fields"
```

## Stage 9: Production Rollout

**目标：** 安全迁移生产数据，验证 UI、入队、preset 编辑性能和回滚路径。

**涉及文件：**

- Modify only if verification exposes bugs in prior stages.

- [ ] **步骤 1：预检**

Run:

```bash
git status --short --branch
npm test
npm run lint
npm run build
npx tsx scripts/db/zero-redundancy-production-stats.ts --read-only
npx tsx scripts/db/verify-zero-redundancy.ts --read-only --format summary
```

预期：clean branch except intended changes; tests/build pass; verifier reports zero mismatches or an explicitly reviewed migration report before write migration.

- [ ] **步骤 2：备份 DB**

Create timestamped DB backup before write migration. Record the absolute backup path in deployment notes.

- [ ] **步骤 3：运行 migration**

Run:

```bash
npx tsx scripts/db/migrate-zero-redundancy.ts --write --batch-size 500
npx tsx scripts/db/verify-zero-redundancy.ts --read-only --format summary
```

预期：migration completes; verifier reports `mismatchCount: 0`.

- [ ] **步骤 4：部署 following repo rules**

Follow AGENTS deployment flow: commit/push, detect local/mypc service, check queue before build/restart, avoid killing unrelated node processes, build, restart only target `next start` when required, verify public site.

- [ ] **步骤 5：UI 验证**

Verify:

- Edit preset prompt with many downstream references completes quickly.
- Open affected project section and confirm prompt/lora render.
- Import preset to section, edit the block, confirm it detaches and future preset edits do not change it.
- Save template and import template into another project.
- Queue one section and inspect `Run.resolvedConfigSnapshot`.
- Run Character LoRA benchmark dry path or mock worker path.

- [ ] **步骤 6：提交 cleanup if needed**

If rollout exposes small fixes:

```bash
git add <fixed files>
git commit -m "fix: stabilize zero redundancy rollout"
```

## 完成标准

The refactor is complete only when all items are true:

- Both Prisma schemas have no editing-state redundant fields listed in this plan.
- Project/template/preset/category JSON reference arrays are replaced with relation tables.
- Section/template preset bindings are structure rows, not expanded prompt/lora JSON.
- `Run.resolvedConfigSnapshot` and all listed Character LoRA snapshots remain intact.
- Preset update does not write downstream section/template rows.
- Resolver is the only source for current prompt/lora display and queue-time snapshot creation.
- “手动编辑即脱钩” is covered by tests and verified in UI.
- Migration verifier passes on production data with zero mismatches.
- `npm test`, `npm run lint`, and `npm run build` pass after legacy field deletion.
