import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
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
`);
setupDb.close();

let prisma: typeof PrismaClientSingleton;
let syncPresetVariantFlow: typeof FlowService.syncPresetVariantFlow;

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
