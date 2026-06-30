import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import type { prisma as PrismaClientSingleton } from "../src/lib/prisma";
import type * as FlowService from "../src/server/services/agent-preset-variant-flow-service";

process.env.DB_PROVIDER = "sqlite";

const tempDir = mkdtempSync(path.join(tmpdir(), "agent-preset-variant-flow-"));
const dbPath = path.join(tempDir, "flow.db");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "Preset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "civitaiLinks" JSONB,
    "folderId" TEXT,
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
  CREATE TABLE "PresetGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "folderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "PresetGroup_categoryId_slug_key" ON "PresetGroup"("categoryId", "slug");
  CREATE INDEX "PresetGroup_categoryId_sortOrder_idx" ON "PresetGroup"("categoryId", "sortOrder");
  CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "coverImageId" TEXT,
    "folderId" TEXT,
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
    "aspectRatio" TEXT,
    "aspectRatios" JSONB,
    "shortSidePx" INTEGER,
    "batchSize" INTEGER,
    "seedPolicy1" TEXT,
    "seedPolicy2" TEXT,
    "ksampler1" JSONB,
    "ksampler2" JSONB,
    "upscaleFactor" REAL,
    "useTwoStageKSampler" BOOLEAN NOT NULL DEFAULT true,
    "checkpointName" TEXT,
    "extraParams" JSONB,
    "latestRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX "ProjectSection_projectId_sortOrder_idx" ON "ProjectSection"("projectId", "sortOrder");
  CREATE TABLE "SectionPresetBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "bindingKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "presetId" TEXT,
    "variantId" TEXT,
    "presetGroupId" TEXT,
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
    "sectionBindingId" TEXT UNIQUE,
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
  CREATE INDEX "SectionManualLoraEntry_projectSectionId_stage_sortOrder_idx" ON "SectionManualLoraEntry"("projectSectionId", "stage", "sortOrder");
  CREATE INDEX "SectionManualLoraEntry_sectionBindingId_idx" ON "SectionManualLoraEntry"("sectionBindingId");
  CREATE INDEX "SectionManualLoraEntry_detachedFromBindingKey_idx" ON "SectionManualLoraEntry"("detachedFromBindingKey");
  CREATE TABLE "SectionChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
    "projectSectionId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX "SectionChangeLog_projectSectionId_dimension_createdAt_idx" ON "SectionChangeLog"("projectSectionId", "dimension", "createdAt");
`);
setupDb.close();

let prisma: typeof PrismaClientSingleton;
let syncPresetVariantFlow: typeof FlowService.syncPresetVariantFlow;

function sourceSlice(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing source end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test.before(async () => {
  const prismaModule = await import("../src/lib/prisma");
  prisma = prismaModule.prisma;
  const flowModule = await import("../src/server/services/agent-preset-variant-flow-service");
  syncPresetVariantFlow = flowModule.syncPresetVariantFlow;
  await seedPresetVariantFlowFixture();
});

test.after(async () => {
  await prisma?.$disconnect();
  await rm(tempDir, { recursive: true, force: true });
});

test("sync preset variant apply uses an explicit transaction wait budget", () => {
  const source = readFileSync("src/server/services/agent-preset-variant-service.ts", "utf8");
  const applySource = sourceSlice(
    source,
    "async function applySyncVariantUpdates",
    "function parseSyncInput",
  );

  assert.match(
    source,
    /const SYNC_VARIANT_TRANSACTION_OPTIONS = \{\s*maxWait: 15_000,\s*timeout: 30_000,\s*\}/,
    "sync variant apply should define a wait budget above Prisma's 2s default",
  );
  assert.match(
    applySource,
    /prisma\.\$transaction\(async \(tx\) =>/,
    "sync variant apply should use an interactive transaction so Prisma can apply the wait budget",
  );
  assert.match(
    applySource,
    /\}\s*,\s*SYNC_VARIANT_TRANSACTION_OPTIONS\s*\)/,
    "sync variant apply should pass the transaction wait budget",
  );
});

async function seedPresetVariantFlowFixture() {
  const characterCategory = await prisma.presetCategory.create({
    data: {
      id: "cat-character",
      name: "角色",
      slug: "character",
      positivePromptOrder: 1,
    },
  });
  const expressionCategory = await prisma.presetCategory.create({
    data: {
      id: "cat-expression",
      name: "表情",
      slug: "expression",
      positivePromptOrder: 5,
    },
  });
  const sourcePreset = await prisma.preset.create({
    data: {
      id: "preset-keqing",
      categoryId: characterCategory.id,
      name: "刻晴-霓裾翩跹",
      slug: "keqing-opulent-splendor",
      sortOrder: 0,
    },
  });
  const targetPreset = await prisma.preset.create({
    data: {
      id: "preset-mami",
      categoryId: characterCategory.id,
      name: "七海麻美",
      slug: "nanami-mami",
      sortOrder: 1,
    },
  });
  const sourceAltPreset = await prisma.preset.create({
    data: {
      id: "preset-keqing-alt",
      categoryId: characterCategory.id,
      name: "刻晴-第二角色预设",
      slug: "keqing-alt",
      sortOrder: 2,
    },
  });
  const targetAltPreset = await prisma.preset.create({
    data: {
      id: "preset-mami-alt",
      categoryId: characterCategory.id,
      name: "七海麻美-第二角色预设",
      slug: "nanami-mami-alt",
      sortOrder: 3,
    },
  });
  const expressionPreset = await prisma.preset.create({
    data: {
      id: "preset-smile",
      categoryId: expressionCategory.id,
      name: "笑",
      slug: "smile",
      sortOrder: 0,
    },
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "keqing-full",
        presetId: sourcePreset.id,
        name: "全身",
        slug: "full-body",
        prompt: "source full",
        sortOrder: 0,
      },
      {
        id: "keqing-half",
        presetId: sourcePreset.id,
        name: "大腿以上",
        slug: "upper-thigh",
        prompt: "source half",
        sortOrder: 1,
      },
      {
        id: "mami-full",
        presetId: targetPreset.id,
        name: "全身",
        slug: "full-body",
        prompt: "target full",
        sortOrder: 0,
      },
      {
        id: "mami-half",
        presetId: targetPreset.id,
        name: "大腿以上",
        slug: "upper-thigh",
        prompt: "target half",
        sortOrder: 1,
      },
      {
        id: "keqing-alt-half",
        presetId: sourceAltPreset.id,
        name: "大腿以上",
        slug: "upper-thigh",
        prompt: "source alt half",
        sortOrder: 0,
      },
      {
        id: "mami-alt-full",
        presetId: targetAltPreset.id,
        name: "全身",
        slug: "full-body",
        prompt: "target alt full",
        sortOrder: 0,
      },
      {
        id: "mami-alt-half",
        presetId: targetAltPreset.id,
        name: "大腿以上",
        slug: "upper-thigh",
        prompt: "target alt half",
        sortOrder: 1,
      },
      {
        id: "smile-default",
        presetId: expressionPreset.id,
        name: "默认",
        slug: "default",
        prompt: "smile",
        sortOrder: 0,
      },
    ],
  });
  await prisma.project.createMany({
    data: [
      { id: "project-keqing", title: "刻晴", slug: "keqing", updatedAt: new Date("2026-06-14T00:00:00Z") },
      { id: "project-mami", title: "七海麻美", slug: "nanami-mami", updatedAt: new Date("2026-06-14T01:00:00Z") },
    ],
  });
  await prisma.projectSection.createMany({
    data: [
      { id: "source-section-1", projectId: "project-keqing", name: "背手站立 · 单人", sortOrder: 1 },
      { id: "source-section-2", projectId: "project-keqing", name: "胸部 · 单人", sortOrder: 2 },
      { id: "target-section-1", projectId: "project-mami", name: "背手站立 · 单人", sortOrder: 1 },
      { id: "target-section-2", projectId: "project-mami", name: "胸部 · 单人", sortOrder: 2 },
    ],
  });
  await prisma.sectionPresetBinding.createMany({
    data: [
      {
        id: "source-role-1",
        projectSectionId: "source-section-1",
        bindingKey: "role",
        categoryId: characterCategory.id,
        presetId: sourcePreset.id,
        variantId: "keqing-full",
        sortOrder: 0,
      },
      {
        id: "source-role-2",
        projectSectionId: "source-section-2",
        bindingKey: "role",
        categoryId: characterCategory.id,
        presetId: sourceAltPreset.id,
        variantId: "keqing-alt-half",
        sortOrder: 0,
      },
      {
        id: "target-role-1",
        projectSectionId: "target-section-1",
        bindingKey: "role",
        categoryId: characterCategory.id,
        presetId: targetPreset.id,
        variantId: "mami-half",
        sortOrder: 0,
      },
      {
        id: "target-role-2",
        projectSectionId: "target-section-2",
        bindingKey: "role",
        categoryId: characterCategory.id,
        presetId: targetAltPreset.id,
        variantId: "mami-alt-full",
        sortOrder: 0,
      },
      {
        id: "target-stale-role",
        projectSectionId: "target-section-1",
        bindingKey: "stale-role",
        categoryId: characterCategory.id,
        presetId: sourcePreset.id,
        variantId: "keqing-full",
        sortOrder: 9,
      },
      {
        id: "target-expression",
        projectSectionId: "target-section-2",
        bindingKey: "expression",
        categoryId: expressionCategory.id,
        presetId: expressionPreset.id,
        variantId: "smile-default",
        sortOrder: 5,
      },
    ],
  });
  await prisma.sectionPromptBlock.createMany({
    data: [
      {
        id: "target-stale-role-block",
        projectSectionId: "target-section-1",
        sectionBindingId: "target-stale-role",
        sortOrder: 9,
      },
      {
        id: "target-expression-block",
        projectSectionId: "target-section-2",
        sectionBindingId: "target-expression",
        sortOrder: 5,
      },
    ],
  });
}

test("syncPresetVariantFlow syncs each matched section's own role binding", async () => {
  const result = await syncPresetVariantFlow({
    sourceProjectTitle: "刻晴",
    targetProjectTitle: "七海麻美",
    dryRun: true,
  });

  assert.equal(result.sourcePresetName, null);
  assert.equal(result.targetPresetName, null);
  assert.equal(result.initialDryRun.plannedUpdateCount, 2);
  assert.deepEqual(
    result.initialDryRun.plan.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        sectionName: row.sectionName,
        action: row.action,
        targetPresetId: row.targetPresetId,
        targetVariantName: row.targetVariantName,
      };
    }),
    [
      { sectionName: "背手站立 · 单人", action: "switch", targetPresetId: "preset-mami", targetVariantName: "全身" },
      { sectionName: "胸部 · 单人", action: "switch", targetPresetId: "preset-mami-alt", targetVariantName: "大腿以上" },
    ],
  );
});

test("syncPresetVariantFlow ignores manual preset names and uses section role bindings", async () => {
  const result = await syncPresetVariantFlow({
    sourceProjectTitle: "刻晴",
    targetProjectTitle: "七海麻美",
    sourcePresetName: "笑",
    targetPresetName: "刻晴-霓裾翩跹",
    dryRun: true,
  });

  assert.equal(result.sourcePresetName, null);
  assert.equal(result.targetPresetName, null);
  assert.equal(result.initialDryRun.plannedUpdateCount, 2);
});

test("syncPresetVariantFlow handles preview and apply for projects with more sections than the database parameter limit", async () => {
  const sectionCount = 1100;
  await prisma.project.createMany({
    data: [
      { id: "project-bulk-source", title: "Bulk Source", slug: "bulk-source", updatedAt: new Date("2026-06-14T02:00:00Z") },
      { id: "project-bulk-target", title: "Bulk Target", slug: "bulk-target", updatedAt: new Date("2026-06-14T03:00:00Z") },
    ],
  });

  const sourceSections = Array.from({ length: sectionCount }, (_, index) => ({
    id: `bulk-source-section-${index}`,
    projectId: "project-bulk-source",
    name: `Bulk Section ${index}`,
    sortOrder: index,
  }));
  const targetSections = Array.from({ length: sectionCount }, (_, index) => ({
    id: `bulk-target-section-${index}`,
    projectId: "project-bulk-target",
    name: `Bulk Section ${index}`,
    sortOrder: index,
  }));
  for (let index = 0; index < sectionCount; index += 100) {
    await prisma.projectSection.createMany({ data: sourceSections.slice(index, index + 100) });
    await prisma.projectSection.createMany({ data: targetSections.slice(index, index + 100) });
  }

  const sourceBindings = sourceSections.map((section, index) => ({
    id: `bulk-source-role-${index}`,
    projectSectionId: section.id,
    bindingKey: "role",
    categoryId: "cat-character",
    presetId: "preset-keqing",
    variantId: "keqing-half",
    sortOrder: 0,
  }));
  const targetBindings = targetSections.map((section, index) => ({
    id: `bulk-target-role-${index}`,
    projectSectionId: section.id,
    bindingKey: "role",
    categoryId: "cat-character",
    presetId: "preset-mami",
    variantId: "mami-full",
    sortOrder: 0,
  }));
  const extraSourceBindings = sourceSections.flatMap((section, sectionIndex) =>
    Array.from({ length: 4 }, (_, bindingIndex) => ({
      id: `bulk-source-expression-${sectionIndex}-${bindingIndex}`,
      projectSectionId: section.id,
      bindingKey: `expression-${bindingIndex}`,
      categoryId: "cat-expression",
      presetId: "preset-smile",
      variantId: "smile-default",
      sortOrder: bindingIndex + 1,
    })),
  );
  const extraTargetBindings = targetSections.flatMap((section, sectionIndex) =>
    Array.from({ length: 4 }, (_, bindingIndex) => ({
      id: `bulk-target-expression-${sectionIndex}-${bindingIndex}`,
      projectSectionId: section.id,
      bindingKey: `expression-${bindingIndex}`,
      categoryId: "cat-expression",
      presetId: "preset-smile",
      variantId: "smile-default",
      sortOrder: bindingIndex + 1,
    })),
  );
  for (let index = 0; index < sectionCount; index += 100) {
    await prisma.sectionPresetBinding.createMany({ data: sourceBindings.slice(index, index + 100) });
    await prisma.sectionPresetBinding.createMany({ data: targetBindings.slice(index, index + 100) });
  }
  for (let index = 0; index < extraSourceBindings.length; index += 100) {
    await prisma.sectionPresetBinding.createMany({ data: extraSourceBindings.slice(index, index + 100) });
    await prisma.sectionPresetBinding.createMany({ data: extraTargetBindings.slice(index, index + 100) });
  }
  const targetPromptBlocks = targetSections.map((section, index) => ({
    id: `bulk-target-role-block-${index}`,
    projectSectionId: section.id,
    sectionBindingId: `bulk-target-role-${index}`,
    sortOrder: 0,
  }));
  const extraTargetPromptBlocks = targetSections.flatMap((section, sectionIndex) =>
    Array.from({ length: 4 }, (_, bindingIndex) => ({
      id: `bulk-target-expression-block-${sectionIndex}-${bindingIndex}`,
      projectSectionId: section.id,
      sectionBindingId: `bulk-target-expression-${sectionIndex}-${bindingIndex}`,
      sortOrder: bindingIndex + 1,
    })),
  );
  const targetLoraEntries = targetSections.map((section, index) => ({
    id: `bulk-target-role-lora-${index}`,
    projectSectionId: section.id,
    sectionBindingId: `bulk-target-role-${index}`,
    stage: "lora1",
    path: "character/bulk-target.safetensors",
    weight: 1,
    enabled: true,
    sortOrder: 0,
  }));
  const extraTargetLoraEntries = targetSections.flatMap((section, sectionIndex) =>
    Array.from({ length: 4 }, (_, bindingIndex) => ({
      id: `bulk-target-expression-lora-${sectionIndex}-${bindingIndex}`,
      projectSectionId: section.id,
      sectionBindingId: `bulk-target-expression-${sectionIndex}-${bindingIndex}`,
      stage: "lora1",
      path: "expression/bulk-target.safetensors",
      weight: 1,
      enabled: true,
      sortOrder: bindingIndex + 1,
    })),
  );
  for (let index = 0; index < sectionCount; index += 100) {
    await prisma.sectionPromptBlock.createMany({ data: targetPromptBlocks.slice(index, index + 100) });
    await prisma.sectionManualLoraEntry.createMany({ data: targetLoraEntries.slice(index, index + 100) });
  }
  for (let index = 0; index < extraTargetPromptBlocks.length; index += 100) {
    await prisma.sectionPromptBlock.createMany({ data: extraTargetPromptBlocks.slice(index, index + 100) });
    await prisma.sectionManualLoraEntry.createMany({ data: extraTargetLoraEntries.slice(index, index + 100) });
  }

  const result = await syncPresetVariantFlow({
    sourceProjectTitle: "Bulk Source",
    targetProjectTitle: "Bulk Target",
    dryRun: true,
  });

  assert.equal(result.initialDryRun.plannedUpdateCount, sectionCount);

  const applied = await syncPresetVariantFlow({
    sourceProjectTitle: "Bulk Source",
    targetProjectTitle: "Bulk Target",
    expectedSourceProjectId: "project-bulk-source",
    expectedTargetProjectId: "project-bulk-target",
    dryRun: false,
  });

  assert.equal(applied.dryRun, false);
  assert.ok(applied.apply?.execution);
  assert.ok(applied.verificationDryRun);
  assert.ok(applied.verification);
  assert.equal(applied.apply.execution.successCount, sectionCount);
  assert.equal(applied.apply.execution.failureCount, 0);
  assert.equal(applied.verificationDryRun.plannedUpdateCount, 0);
  assert.equal(applied.verification.passed, true);
});

test("syncPresetVariantFlow verifies resolved role lora entries without persisted manual lora rows", async () => {
  await prisma.preset.createMany({
    data: [
      {
        id: "preset-resolved-source",
        categoryId: "cat-character",
        name: "Resolved Source Role",
        slug: "resolved-source-role",
        sortOrder: 20,
      },
      {
        id: "preset-resolved-target",
        categoryId: "cat-character",
        name: "Resolved Target Role",
        slug: "resolved-target-role",
        sortOrder: 21,
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "resolved-source-pose",
        presetId: "preset-resolved-source",
        name: "Pose",
        slug: "pose",
        prompt: "source pose",
        lora1: [],
        lora2: [],
        sortOrder: 0,
      },
      {
        id: "resolved-target-pose",
        presetId: "preset-resolved-target",
        name: "Pose",
        slug: "pose",
        prompt: "target pose",
        lora1: [{ path: "character/resolved-target.safetensors", weight: 1, enabled: true }],
        lora2: [],
        sortOrder: 0,
      },
      {
        id: "resolved-target-other",
        presetId: "preset-resolved-target",
        name: "Other",
        slug: "other",
        prompt: "target other",
        lora1: [{ path: "character/resolved-other.safetensors", weight: 1, enabled: true }],
        lora2: [],
        sortOrder: 1,
      },
    ],
  });
  await prisma.project.createMany({
    data: [
      { id: "project-resolved-source", title: "Resolved Source", slug: "resolved-source", updatedAt: new Date("2026-06-14T04:00:00Z") },
      { id: "project-resolved-target", title: "Resolved Target", slug: "resolved-target", updatedAt: new Date("2026-06-14T05:00:00Z") },
    ],
  });
  await prisma.projectSection.createMany({
    data: [
      { id: "resolved-source-section", projectId: "project-resolved-source", name: "Resolved Role Section", sortOrder: 1 },
      { id: "resolved-target-section", projectId: "project-resolved-target", name: "Resolved Role Section", sortOrder: 1 },
    ],
  });
  await prisma.sectionPresetBinding.createMany({
    data: [
      {
        id: "resolved-source-role",
        projectSectionId: "resolved-source-section",
        bindingKey: "role",
        categoryId: "cat-character",
        presetId: "preset-resolved-source",
        variantId: "resolved-source-pose",
        sortOrder: 0,
      },
      {
        id: "resolved-target-role",
        projectSectionId: "resolved-target-section",
        bindingKey: "role",
        categoryId: "cat-character",
        presetId: "preset-resolved-target",
        variantId: "resolved-target-other",
        sortOrder: 0,
      },
    ],
  });

  const applied = await syncPresetVariantFlow({
    sourceProjectTitle: "Resolved Source",
    targetProjectTitle: "Resolved Target",
    expectedSourceProjectId: "project-resolved-source",
    expectedTargetProjectId: "project-resolved-target",
    dryRun: false,
  });

  assert.ok(applied.verificationDryRun);
  assert.ok(applied.verification);
  assert.equal(applied.verificationDryRun.plannedUpdateCount, 0);
  assert.equal(applied.verification.passed, true);
  assert.equal(applied.verification.loraConfig.missingCount, 0);
});

test("syncPresetVariants apply switches variants and records history", async () => {
  const { syncPresetVariants } = await import("../src/server/services/agent-preset-variant-service");
  const result = await syncPresetVariants("project-mami", {
    sourceProjectId: "project-keqing",
    dryRun: false,
  });

  assert.equal(result.dryRun, false);
  assert.ok(result.execution);
  assert.equal(result.execution.successCount, 2);
  assert.equal(result.execution.failureCount, 0);

  const targetBindings = await prisma.sectionPresetBinding.findMany({
    where: { id: { in: ["target-role-1", "target-role-2"] } },
    orderBy: { id: "asc" },
    select: { id: true, variantId: true },
  });
  assert.deepEqual(targetBindings, [
    { id: "target-role-1", variantId: "mami-full" },
    { id: "target-role-2", variantId: "mami-alt-half" },
  ]);

  const historyCount = await prisma.sectionChangeLog.count({
    where: {
      projectSectionId: { in: ["target-section-1", "target-section-2"] },
      dimension: "prompt",
    },
  });
  assert.equal(historyCount, 2);
});
