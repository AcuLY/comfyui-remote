import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import type { prisma as PrismaClientSingleton } from "../src/lib/prisma";
import type * as PresetVariantCrudActions from "../src/lib/actions/preset-variant-crud";
import type * as PresetSyncActions from "../src/lib/actions/preset-sync";
import type * as SectionResolver from "../src/server/prompt-config/section-resolver";
import type * as PromotionRepository from "../src/server/repositories/character-lora-training/promotion-repository";

process.env.DB_PROVIDER = "sqlite";

const tempDir = mkdtempSync(path.join(tmpdir(), "zero-redundancy-preset-update-"));
const dbPath = path.join(tempDir, "preset-update.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const setupDb = new Database(dbPath);
setupDb.exec(`
  CREATE TABLE "PresetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "icon" TEXT,
    "color" TEXT,
    "positivePromptOrder" INTEGER NOT NULL DEFAULT 0,
    "negativePromptOrder" INTEGER NOT NULL DEFAULT 0,
    "lora1Order" INTEGER NOT NULL DEFAULT 0,
    "lora2Order" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'preset',
    "slotTemplate" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "Preset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "notes" TEXT,
    "civitaiLinks" JSONB,
    "folderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "Preset_categoryId_slug_key" ON "Preset"("categoryId", "slug");
  CREATE UNIQUE INDEX "Preset_categoryId_id_key" ON "Preset"("categoryId", "id");
  CREATE TABLE "PresetVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "lora1" JSONB,
    "lora2" JSONB,
    "linkedVariants" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "PresetVariant_presetId_slug_key" ON "PresetVariant"("presetId", "slug");
  CREATE UNIQUE INDEX "PresetVariant_presetId_id_key" ON "PresetVariant"("presetId", "id");
  CREATE TABLE "PresetVariantLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceVariantId" TEXT NOT NULL,
    "linkedVariantId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "PresetVariantLink_sourceVariantId_linkedVariantId_key" ON "PresetVariantLink"("sourceVariantId", "linkedVariantId");
  CREATE INDEX "PresetVariantLink_sourceVariantId_sortOrder_idx" ON "PresetVariantLink"("sourceVariantId", "sortOrder");
  CREATE INDEX "PresetVariantLink_linkedVariantId_idx" ON "PresetVariantLink"("linkedVariantId");
  CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "coverImageId" TEXT,
    "folderId" TEXT,
    "presetBindings" JSONB,
    "checkpointName" TEXT,
    "projectLevelOverrides" JSONB,
    "notes" TEXT,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ProjectSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "positivePrompt" TEXT,
    "negativePrompt" TEXT,
    "aspectRatio" TEXT,
    "shortSidePx" INTEGER,
    "batchSize" INTEGER,
    "seedPolicy1" TEXT,
    "seedPolicy2" TEXT,
    "ksampler1" JSONB,
    "ksampler2" JSONB,
    "upscaleFactor" REAL,
    "checkpointName" TEXT,
    "loraConfig" JSONB,
    "extraParams" JSONB,
    "latestRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "SectionPresetBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "bindingKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "variantId" TEXT,
    "groupBindingKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "SectionPresetBinding_projectSectionId_bindingKey_key" ON "SectionPresetBinding"("projectSectionId", "bindingKey");
  CREATE UNIQUE INDEX "SectionPresetBinding_projectSectionId_id_key" ON "SectionPresetBinding"("projectSectionId", "id");
  CREATE TABLE "SectionPromptBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "sectionBindingId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "customLabel" TEXT,
    "customPositive" TEXT,
    "customNegative" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "SectionPromptBlock_projectSectionId_sectionBindingId_key" ON "SectionPromptBlock"("projectSectionId", "sectionBindingId");
  CREATE TABLE "SectionManualLoraEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "sectionBindingId" TEXT,
    "stage" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "detachedFromBindingKey" TEXT,
    "detachedFromPresetId" TEXT,
    "detachedFromVariantId" TEXT,
    "detachedFromPath" TEXT,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "PromptBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceId" TEXT,
    "variantId" TEXT,
    "categoryId" TEXT,
    "bindingId" TEXT,
    "groupBindingId" TEXT,
    "label" TEXT NOT NULL,
    "positive" TEXT NOT NULL,
    "negative" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "presetBindings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ProjectTemplatePresetBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "variantId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ProjectTemplateSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateId" TEXT NOT NULL,
    "folderId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "notes" TEXT,
    "aspectRatio" TEXT,
    "shortSidePx" INTEGER,
    "batchSize" INTEGER,
    "seedPolicy1" TEXT,
    "seedPolicy2" TEXT,
    "ksampler1" JSONB,
    "ksampler2" JSONB,
    "upscaleFactor" REAL,
    "checkpointName" TEXT,
    "loraConfig" JSONB,
    "extraParams" JSONB,
    "promptBlocks" JSONB
  );
  CREATE TABLE "TemplateSectionPresetBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateSectionId" TEXT NOT NULL,
    "bindingKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "variantId" TEXT,
    "groupBindingKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "TemplateSectionPresetBinding_projectTemplateSectionId_bindingKey_key" ON "TemplateSectionPresetBinding"("projectTemplateSectionId", "bindingKey");
  CREATE TABLE "TemplateSectionPromptBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateSectionId" TEXT NOT NULL,
    "templateSectionBindingId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "customLabel" TEXT,
    "customPositive" TEXT,
    "customNegative" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "TemplateSectionPromptBlock_projectTemplateSectionId_templateSectionBindingId_key" ON "TemplateSectionPromptBlock"("projectTemplateSectionId", "templateSectionBindingId");
  CREATE TABLE "TemplateSectionManualLoraEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateSectionId" TEXT NOT NULL,
    "templateSectionBindingId" TEXT,
    "stage" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "detachedFromBindingKey" TEXT,
    "detachedFromPresetId" TEXT,
    "detachedFromVariantId" TEXT,
    "detachedFromPath" TEXT,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ProjectPresetBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "variantId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "ProjectPresetBinding_projectId_categoryId_key" ON "ProjectPresetBinding"("projectId", "categoryId");
  CREATE TABLE "SectionChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "PresetChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "LoraAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "modelType" TEXT NOT NULL DEFAULT 'lora',
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "absolutePath" TEXT NOT NULL UNIQUE,
    "relativePath" TEXT NOT NULL,
    "size" BIGINT,
    "source" TEXT,
    "notes" TEXT,
    "triggerWords" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "CharacterLoraTrainingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL UNIQUE,
    "characterName" TEXT NOT NULL,
    "triggerToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "phase" TEXT,
    "trainingScope" JSONB NOT NULL,
    "captionStrategy" TEXT NOT NULL DEFAULT 'controllable_identity',
    "baseCheckpointName" TEXT,
    "baseCheckpointPath" TEXT,
    "baseCheckpointHash" TEXT,
    "baseFamily" TEXT,
    "artifactRoot" TEXT NOT NULL,
    "currentCanonicalVersionId" TEXT,
    "currentPromptCardVersionId" TEXT,
    "selectedDatasetRevisionId" TEXT,
    "promotedPresetId" TEXT,
    "trainingTemplateId" TEXT,
    "trainingTemplateSnapshot" JSONB,
    "createdBy" TEXT,
    "failureSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "CharacterLoraBenchmarkRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "trainingRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "loraAssetId" TEXT,
    "testPresetId" TEXT,
    "testProjectId" TEXT,
    "templateId" TEXT,
    "checkpointMatrix" JSONB NOT NULL,
    "weightMatrix" JSONB NOT NULL,
    "reportArtifactId" TEXT,
    "recommendedWeight" REAL,
    "resultSummary" JSONB,
    "testPresetCleanedAt" DATETIME,
    "testProjectCleanedAt" DATETIME,
    "cleanupSummary" JSONB,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "CharacterLoraPromotionDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "benchmarkRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "selectedLoraAssetId" TEXT NOT NULL,
    "selectedCheckpoint" TEXT,
    "defaultRecommendedWeight" REAL NOT NULL,
    "perVariantWeightOverrides" JSONB,
    "variantPromptDrafts" JSONB NOT NULL,
    "decisionReason" TEXT,
    "rejectedReturnPoint" TEXT,
    "promotedCategoryId" TEXT,
    "promotedPresetId" TEXT,
    "reportArtifactId" TEXT,
    "decidedAt" DATETIME,
    "promotedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "CharacterLoraArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "absolutePath" TEXT,
    "sha256" TEXT,
    "byteSize" BIGINT,
    "mimeType" TEXT,
    "redactionLevel" TEXT NOT NULL DEFAULT 'path_only',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "CharacterLoraArtifact_jobId_relativePath_key" ON "CharacterLoraArtifact"("jobId", "relativePath");
`);
setupDb.close();

let prisma: typeof PrismaClientSingleton;
let updatePreset: typeof PresetVariantCrudActions.updatePreset;
let updatePresetVariant: typeof PresetVariantCrudActions.updatePresetVariant;
let createPresetVariant: typeof PresetVariantCrudActions.createPresetVariant;
let upsertPresetVariantBySlug: typeof PresetVariantCrudActions.upsertPresetVariantBySlug;
let copyPreset: typeof PresetVariantCrudActions.copyPreset;
let getPresetUsage: typeof PresetSyncActions.getPresetUsage;
let deletePresetCascade: typeof PresetSyncActions.deletePresetCascade;
let resolveSectionConfig: typeof SectionResolver.resolveSectionConfig;
let promoteCharacterLoraDecisionInRepository: typeof PromotionRepository.promoteCharacterLoraDecisionInRepository;

let sequence = 0;

type SeedResult = Awaited<ReturnType<typeof seedPresetSection>>;

test.before(async () => {
  const prismaModule = await import("../src/lib/prisma");
  const presetVariantCrudActions = await import("../src/lib/actions/preset-variant-crud");
  const presetSyncActions = await import("../src/lib/actions/preset-sync");
  const sectionResolver = await import("../src/server/prompt-config/section-resolver");
  const promotionRepository = await import("../src/server/repositories/character-lora-training/promotion-repository");

  prisma = prismaModule.prisma;
  updatePreset = presetVariantCrudActions.updatePreset;
  updatePresetVariant = presetVariantCrudActions.updatePresetVariant;
  createPresetVariant = presetVariantCrudActions.createPresetVariant;
  upsertPresetVariantBySlug = presetVariantCrudActions.upsertPresetVariantBySlug;
  copyPreset = presetVariantCrudActions.copyPreset;
  getPresetUsage = presetSyncActions.getPresetUsage;
  deletePresetCascade = presetSyncActions.deletePresetCascade;
  resolveSectionConfig = sectionResolver.resolveSectionConfig;
  promoteCharacterLoraDecisionInRepository = promotionRepository.promoteCharacterLoraDecisionInRepository;
});

test.after(async () => {
  await prisma.$disconnect();
  await rm(tempDir, { recursive: true, force: true });
});

async function ignoreStaticRevalidateError<T>(callback: () => Promise<T>): Promise<T | undefined> {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof Error && error.message.includes("static generation store missing")) {
      return undefined;
    }
    throw error;
  }
}

async function seedPresetSection() {
  sequence += 1;
  const key = `zru-${sequence}`;
  const category = await prisma.presetCategory.create({
    data: {
      id: `${key}-category`,
      name: `${key} Category`,
      slug: `${key}-category`,
      color: "#778899",
      positivePromptOrder: 10,
      lora1Order: 20,
      lora2Order: 30,
    },
  });
  const otherCategory = await prisma.presetCategory.create({
    data: {
      id: `${key}-other-category`,
      name: `${key} Other Category`,
      slug: `${key}-other-category`,
      color: "#112233",
      positivePromptOrder: 1,
      lora1Order: 2,
      lora2Order: 3,
    },
  });
  const preset = await prisma.preset.create({
    data: {
      id: `${key}-preset`,
      categoryId: category.id,
      name: `${key} Preset`,
      slug: `${key}-preset`,
      sortOrder: 0,
    },
  });
  const variantA = await prisma.presetVariant.create({
    data: {
      id: `${key}-variant-a`,
      presetId: preset.id,
      name: "A",
      slug: `${key}-variant-a`,
      prompt: `${key} source positive A`,
      negativePrompt: `${key} source negative A`,
      lora1: [{ path: `/${key}-a.safetensors`, weight: 0.7, enabled: true }],
      lora2: [{ path: `/${key}-upscale-a.safetensors`, weight: 0.4, enabled: true }],
      sortOrder: 0,
    },
  });
  const variantB = await prisma.presetVariant.create({
    data: {
      id: `${key}-variant-b`,
      presetId: preset.id,
      name: "B",
      slug: `${key}-variant-b`,
      prompt: `${key} source positive B`,
      negativePrompt: `${key} source negative B`,
      lora1: [{ path: `/${key}-b.safetensors`, weight: 0.8, enabled: true }],
      lora2: [],
      sortOrder: 1,
    },
  });
  const linkedPreset = await prisma.preset.create({
    data: {
      id: `${key}-linked-preset`,
      categoryId: category.id,
      name: `${key} Linked Preset`,
      slug: `${key}-linked-preset`,
      sortOrder: 1,
    },
  });
  const linkedVariant = await prisma.presetVariant.create({
    data: {
      id: `${key}-linked-variant`,
      presetId: linkedPreset.id,
      name: "Linked",
      slug: `${key}-linked-variant`,
      prompt: `${key} linked positive`,
      negativePrompt: `${key} linked negative`,
      lora1: [{ path: `/${key}-linked.safetensors`, weight: 0.5, enabled: true }],
      lora2: [],
      sortOrder: 0,
    },
  });
  const project = await prisma.project.create({
    data: {
      id: `${key}-project`,
      title: `${key} Project`,
      slug: `${key}-project`,
      status: "draft",
      checkpointName: `${key}.ckpt`,
    },
  });
  const section = await prisma.projectSection.create({
    data: {
      id: `${key}-section`,
      projectId: project.id,
      name: `${key} Section`,
      sortOrder: 0,
    },
  });
  const binding = await prisma.sectionPresetBinding.create({
    data: {
      id: `${key}-section-binding`,
      projectSectionId: section.id,
      bindingKey: `${key}-binding`,
      categoryId: category.id,
      presetId: preset.id,
      variantId: variantA.id,
      sortOrder: 0,
    },
  });
  const sectionPromptBlock = await prisma.sectionPromptBlock.create({
    data: {
      id: `${key}-section-prompt-block`,
      projectSectionId: section.id,
      sectionBindingId: binding.id,
      type: "preset",
      sortOrder: 0,
    },
  });
  const template = await prisma.projectTemplate.create({
    data: {
      id: `${key}-template`,
      name: `${key} Template`,
    },
  });
  const templateSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${key}-template-section`,
      projectTemplateId: template.id,
      name: `${key} Template Section`,
    },
  });

  return {
    key,
    category,
    otherCategory,
    preset,
    variantA,
    variantB,
    linkedPreset,
    linkedVariant,
    project,
    section,
    binding,
    sectionPromptBlock,
    template,
    templateSection,
  };
}

async function sectionRelationSnapshots(seed: SeedResult) {
  return {
    bindings: await prisma.sectionPresetBinding.findMany({
      where: { projectSectionId: seed.section.id },
      orderBy: { sortOrder: "asc" },
    }),
    promptRows: await prisma.sectionPromptBlock.findMany({
      where: { projectSectionId: seed.section.id },
      orderBy: { sortOrder: "asc" },
    }),
  };
}

test("updating variant content is resolved lazily without writing downstream caches", async () => {
  const seed = await seedPresetSection();
  const beforeRelations = await sectionRelationSnapshots(seed);

  await ignoreStaticRevalidateError(() =>
    updatePresetVariant(seed.variantA.id, {
      prompt: `${seed.key} updated positive A`,
      negativePrompt: `${seed.key} updated negative A`,
      lora1: [{ path: `/${seed.key}-updated-a.safetensors`, weight: 0.9, enabled: true }],
      lora2: [{ path: `/${seed.key}-updated-upscale-a.safetensors`, weight: 0.6, enabled: true }],
    })
  );

  const resolved = await resolveSectionConfig(seed.section.id);
  assert.ok(resolved);
  assert.equal(resolved.prompt.positive, `${seed.key} updated positive A`);
  assert.equal(resolved.prompt.negative, `${seed.key} updated negative A`);
  assert.deepEqual(resolved.loraConfig.lora1.map((entry) => entry.path), [
    `/${seed.key}-updated-a.safetensors`,
  ]);
  assert.deepEqual(resolved.loraConfig.lora2.map((entry) => entry.path), [
    `/${seed.key}-updated-upscale-a.safetensors`,
  ]);

  await prisma.projectSection.findUniqueOrThrow({ where: { id: seed.section.id } });
  assert.deepEqual(await sectionRelationSnapshots(seed), beforeRelations);
});

test("updating preset metadata does not bulk rewrite downstream relation rows", async () => {
  const seed = await seedPresetSection();
  const beforeRelations = await sectionRelationSnapshots(seed);
  const beforeTemplatePromptRows = await prisma.templateSectionPromptBlock.findMany({
    where: { projectTemplateSectionId: seed.templateSection.id },
  });

  await ignoreStaticRevalidateError(() =>
    updatePreset(seed.preset.id, {
      name: `${seed.key} Renamed Preset`,
      categoryId: seed.otherCategory.id,
    })
  );

  assert.deepEqual(await sectionRelationSnapshots(seed), beforeRelations);
  assert.deepEqual(
    await prisma.templateSectionPromptBlock.findMany({
      where: { projectTemplateSectionId: seed.templateSection.id },
    }),
    beforeTemplatePromptRows,
  );
});

test("variant link writes use PresetVariantLink rows and section resolver follows relation rows", async () => {
  const seed = await seedPresetSection();

  const created = await ignoreStaticRevalidateError(() =>
    createPresetVariant({
      presetId: seed.preset.id,
      name: "Created Linked",
      slug: `${seed.key}-created-linked`,
      prompt: `${seed.key} created root`,
      negativePrompt: null,
      lora1: [],
      lora2: [],
      linkedVariants: [{ presetId: seed.linkedPreset.id, variantId: seed.linkedVariant.id }],
    })
  ) ?? await prisma.presetVariant.findFirstOrThrow({
    where: { presetId: seed.preset.id, slug: `${seed.key}-created-linked` },
  });

  assert.deepEqual(
    (await prisma.presetVariantLink.findMany({ where: { sourceVariantId: created.id } }))
      .map((row) => [row.linkedVariantId, row.sortOrder]),
    [[seed.linkedVariant.id, 0]],
  );

  await ignoreStaticRevalidateError(() =>
    updatePresetVariant(created.id, {
      linkedVariants: [{ presetId: seed.preset.id, variantId: seed.variantB.id }],
    })
  );
  assert.deepEqual(
    (await prisma.presetVariantLink.findMany({ where: { sourceVariantId: created.id } }))
      .map((row) => row.linkedVariantId),
    [seed.variantB.id],
  );

  await ignoreStaticRevalidateError(() =>
    upsertPresetVariantBySlug({
      presetId: seed.preset.id,
      name: "Created Linked",
      slug: `${seed.key}-created-linked`,
      prompt: `${seed.key} upserted root`,
      negativePrompt: null,
      lora1: [],
      lora2: [],
      linkedVariants: [{ presetId: seed.linkedPreset.id, variantId: seed.linkedVariant.id }],
    })
  );
  const updated = await prisma.presetVariant.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(updated.prompt, `${seed.key} upserted root`);

  const binding = await prisma.sectionPresetBinding.update({
    where: { id: seed.binding.id },
    data: { variantId: created.id },
  });
  await prisma.sectionPromptBlock.update({
    where: { id: seed.sectionPromptBlock.id },
    data: { sectionBindingId: binding.id },
  });

  const resolved = await resolveSectionConfig(seed.section.id);
  assert.ok(resolved);
  assert.equal(resolved.prompt.positive, `${seed.key} upserted root, ${seed.key} linked positive`);
  assert.deepEqual(
    resolved.loraConfig.lora1.map((entry) => entry.path),
    [`/${seed.key}-linked.safetensors`],
  );
});

test("copyPreset copies and remaps PresetVariantLink rows", async () => {
  const seed = await seedPresetSection();
  await prisma.presetVariantLink.create({
    data: {
      id: `${seed.key}-variant-link`,
      sourceVariantId: seed.variantA.id,
      linkedVariantId: seed.variantB.id,
      sortOrder: 0,
    },
  });

  const copiedPreset = await ignoreStaticRevalidateError(() => copyPreset(seed.preset.id)) ??
    await prisma.preset.findFirstOrThrow({
      where: { slug: `${seed.preset.slug}-copy` },
    });
  const copiedVariants = await prisma.presetVariant.findMany({
    where: { presetId: copiedPreset.id },
    orderBy: { sortOrder: "asc" },
  });
  const copiedA = copiedVariants.find((variant) => variant.slug === seed.variantA.slug);
  const copiedB = copiedVariants.find((variant) => variant.slug === seed.variantB.slug);
  assert.ok(copiedA);
  assert.ok(copiedB);
  assert.deepEqual(
    (await prisma.presetVariantLink.findMany({ where: { sourceVariantId: copiedA.id } }))
      .map((row) => [row.linkedVariantId, row.sortOrder]),
    [[copiedB.id, 0]],
  );
});

test("getPresetUsage reports normalized project, section, template, and template-section references", async () => {
  const seed = await seedPresetSection();
  await prisma.projectPresetBinding.create({
    data: {
      id: `${seed.key}-project-preset-binding`,
      projectId: seed.project.id,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });
  await prisma.projectTemplatePresetBinding.create({
    data: {
      id: `${seed.key}-project-template-preset-binding`,
      projectTemplateId: seed.template.id,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });
  await prisma.templateSectionPresetBinding.create({
    data: {
      id: `${seed.key}-template-section-binding`,
      projectTemplateSectionId: seed.templateSection.id,
      bindingKey: `${seed.key}-template-binding`,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });

  const usage = await getPresetUsage(seed.preset.id);
  const usageById = new Map(usage.sections.map((entry) => [entry.sectionId, entry]));

  assert.equal(usage.totalBlocks, 4);
  assert.equal(usageById.get(seed.section.id)?.blockCount, 1);
  assert.equal(usageById.get(`project:${seed.project.id}`)?.projectTitle, seed.project.title);
  assert.equal(usageById.get(`project-template:${seed.template.id}`)?.projectTitle, `模板：${seed.template.name}`);
  assert.equal(
    usageById.get(`template-section:${seed.templateSection.id}`)?.sectionName,
    seed.templateSection.name,
  );
});

test("deletePresetCascade removes normalized bindings and variant links tied to the preset", async () => {
  const seed = await seedPresetSection();
  await prisma.projectPresetBinding.create({
    data: {
      id: `${seed.key}-project-preset-binding`,
      projectId: seed.project.id,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });
  await prisma.projectTemplatePresetBinding.create({
    data: {
      id: `${seed.key}-project-template-preset-binding`,
      projectTemplateId: seed.template.id,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantB.id,
      sortOrder: 0,
    },
  });
  await prisma.templateSectionPresetBinding.create({
    data: {
      id: `${seed.key}-template-section-binding`,
      projectTemplateSectionId: seed.templateSection.id,
      bindingKey: `${seed.key}-template-binding`,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });
  await prisma.presetVariantLink.createMany({
    data: [
      {
        id: `${seed.key}-outgoing-link`,
        sourceVariantId: seed.variantA.id,
        linkedVariantId: seed.linkedVariant.id,
        sortOrder: 0,
      },
      {
        id: `${seed.key}-incoming-link`,
        sourceVariantId: seed.linkedVariant.id,
        linkedVariantId: seed.variantB.id,
        sortOrder: 1,
      },
    ],
  });

  await ignoreStaticRevalidateError(() => deletePresetCascade(seed.preset.id));

  assert.equal(await prisma.sectionPresetBinding.count({ where: { presetId: seed.preset.id } }), 0);
  assert.equal(await prisma.templateSectionPresetBinding.count({ where: { presetId: seed.preset.id } }), 0);
  assert.equal(await prisma.projectPresetBinding.count({ where: { presetId: seed.preset.id } }), 0);
  assert.equal(await prisma.projectTemplatePresetBinding.count({ where: { presetId: seed.preset.id } }), 0);
  assert.equal(
    await prisma.presetVariantLink.count({
      where: {
        OR: [
          { sourceVariantId: { in: [seed.variantA.id, seed.variantB.id] } },
          { linkedVariantId: { in: [seed.variantA.id, seed.variantB.id] } },
        ],
      },
    }),
    0,
  );
});

test("deletePresetCascade keeps unrelated normalized custom prompt rows", async () => {
  const seed = await seedPresetSection();
  const unrelatedBlock = await prisma.sectionPromptBlock.create({
    data: {
      id: `${seed.key}-unrelated-custom-block`,
      projectSectionId: seed.section.id,
      sectionBindingId: null,
      type: "custom",
      customLabel: `${seed.key} unrelated label`,
      customPositive: `${seed.key} unrelated positive`,
      customNegative: null,
      sortOrder: 10,
    },
  });

  await ignoreStaticRevalidateError(() => deletePresetCascade(seed.preset.id));

  assert.equal(await prisma.sectionPromptBlock.count({ where: { id: seed.sectionPromptBlock.id } }), 0);
  assert.equal(await prisma.sectionPromptBlock.count({ where: { id: unrelatedBlock.id } }), 1);
});

test("character LoRA promotion writes relation links and leaves legacy linkedVariants empty", async () => {
  const seed = await seedPresetSection();
  await prisma.characterLoraTrainingJob.create({
    data: {
      id: `${seed.key}-job`,
      slug: `${seed.key}-job`,
      characterName: `${seed.key} Character`,
      triggerToken: `${seed.key}_token`,
      status: "promotion_ready",
      phase: "promotion",
      trainingScope: {},
      artifactRoot: `/tmp/${seed.key}`,
    },
  });
  await prisma.characterLoraBenchmarkRun.create({
    data: {
      id: `${seed.key}-benchmark`,
      jobId: `${seed.key}-job`,
      trainingRunId: `${seed.key}-training-run`,
      status: "done",
      checkpointMatrix: [],
      weightMatrix: [],
    },
  });
  await prisma.characterLoraPromotionDecision.create({
    data: {
      id: `${seed.key}-decision`,
      jobId: `${seed.key}-job`,
      benchmarkRunId: `${seed.key}-benchmark`,
      status: "approved",
      selectedLoraAssetId: `${seed.key}-asset`,
      defaultRecommendedWeight: 0.75,
      variantPromptDrafts: [],
    },
  });

  const promoted = await promoteCharacterLoraDecisionInRepository({
    decisionId: `${seed.key}-decision`,
    categoryName: `${seed.key} Promotion Category`,
    categorySlug: `${seed.key}-promotion-category`,
    presetName: `${seed.key} Promoted`,
    presetSlug: `${seed.key}-promoted`,
    presetNotes: "promotion test",
    variants: [
      {
        name: "Promoted A",
        slug: `${seed.key}-promoted-a`,
        prompt: `${seed.key} promoted prompt A`,
        negativePrompt: null,
        lora1: [],
        lora2: [],
        linkedVariants: [
          { presetId: seed.linkedPreset.id, variantId: seed.linkedVariant.id },
          { presetId: seed.preset.id, variantId: seed.variantB.id },
        ],
        sortOrder: 0,
      },
      {
        name: "Promoted B",
        slug: `${seed.key}-promoted-b`,
        prompt: `${seed.key} promoted prompt B`,
        lora1: [],
        lora2: [],
        linkedVariants: null,
        sortOrder: 1,
      },
    ],
    reportArtifact: {
      relativePath: `${seed.key}/promotion-report.json`,
      absolutePath: `/tmp/${seed.key}/promotion-report.json`,
      sha256: `${seed.key}-sha`,
      byteSize: 12,
    },
  });
  assert.ok(promoted);
  assert.ok(promoted.presetId);

  const variants = await prisma.presetVariant.findMany({
    where: { presetId: promoted.presetId },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(variants.length, 2);
  assert.deepEqual(
    await prisma.presetVariantLink.findMany({
      where: { sourceVariantId: variants[0].id },
      orderBy: { sortOrder: "asc" },
    }).then((rows) => rows.map((row) => [row.linkedVariantId, row.sortOrder])),
    [
      [seed.linkedVariant.id, 0],
      [seed.variantB.id, 1],
    ],
  );
});
