import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import type { prisma as PrismaClientSingleton } from "../src/lib/prisma";
import type * as BenchmarkRepository from "../src/server/repositories/character-lora-training/benchmark-repository";

process.env.DB_PROVIDER = "sqlite";

const tempDir = mkdtempSync(path.join(tmpdir(), "zero-redundancy-character-lora-benchmark-"));
const dbPath = path.join(tempDir, "benchmark.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const setupDb = new Database(dbPath);
setupDb.exec(`
  CREATE TABLE "PresetCategory" ("id" TEXT NOT NULL PRIMARY KEY,"name" TEXT NOT NULL,"slug" TEXT NOT NULL UNIQUE,"icon" TEXT,"color" TEXT,"positivePromptOrder" INTEGER NOT NULL DEFAULT 0,"negativePromptOrder" INTEGER NOT NULL DEFAULT 0,"lora1Order" INTEGER NOT NULL DEFAULT 0,"lora2Order" INTEGER NOT NULL DEFAULT 0,"sortOrder" INTEGER NOT NULL DEFAULT 0,"type" TEXT NOT NULL DEFAULT 'preset',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "Preset" ("id" TEXT NOT NULL PRIMARY KEY,"categoryId" TEXT NOT NULL,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"notes" TEXT,"civitaiLinks" JSONB,"folderId" TEXT,"isActive" BOOLEAN NOT NULL DEFAULT true,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE UNIQUE INDEX "Preset_categoryId_slug_key" ON "Preset"("categoryId","slug");
  CREATE UNIQUE INDEX "Preset_categoryId_id_key" ON "Preset"("categoryId","id");
  CREATE TABLE "PresetVariant" ("id" TEXT NOT NULL PRIMARY KEY,"presetId" TEXT NOT NULL,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"prompt" TEXT NOT NULL,"negativePrompt" TEXT,"lora1" JSONB,"lora2" JSONB,"sortOrder" INTEGER NOT NULL DEFAULT 0,"isActive" BOOLEAN NOT NULL DEFAULT true,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE UNIQUE INDEX "PresetVariant_presetId_slug_key" ON "PresetVariant"("presetId","slug");
  CREATE UNIQUE INDEX "PresetVariant_presetId_id_key" ON "PresetVariant"("presetId","id");
  CREATE TABLE "Project" ("id" TEXT NOT NULL PRIMARY KEY,"title" TEXT NOT NULL,"slug" TEXT NOT NULL UNIQUE,"status" TEXT NOT NULL DEFAULT 'draft',"coverImageId" TEXT,"folderId" TEXT,"checkpointName" TEXT,"projectLevelOverrides" JSONB,"notes" TEXT,"publishedAt" DATETIME,"archivedAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "ProjectPresetBinding" ("id" TEXT NOT NULL PRIMARY KEY,"projectId" TEXT NOT NULL,"categoryId" TEXT NOT NULL,"presetId" TEXT NOT NULL,"variantId" TEXT,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE UNIQUE INDEX "ProjectPresetBinding_projectId_categoryId_key" ON "ProjectPresetBinding"("projectId","categoryId");
  CREATE TABLE "ProjectSection" ("id" TEXT NOT NULL PRIMARY KEY,"projectId" TEXT NOT NULL,"folderId" TEXT,"name" TEXT,"sortOrder" INTEGER NOT NULL DEFAULT 0,"enabled" BOOLEAN NOT NULL DEFAULT true,"aspectRatio" TEXT,"shortSidePx" INTEGER,"batchSize" INTEGER,"seedPolicy1" TEXT,"seedPolicy2" TEXT,"ksampler1" JSONB,"ksampler2" JSONB,"upscaleFactor" REAL,"checkpointName" TEXT,"extraParams" JSONB,"latestRunId" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "SectionPromptBlock" ("id" TEXT NOT NULL PRIMARY KEY,"projectSectionId" TEXT NOT NULL,"sectionBindingId" TEXT,"type" TEXT NOT NULL DEFAULT 'custom',"customLabel" TEXT,"customPositive" TEXT,"customNegative" TEXT,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE UNIQUE INDEX "SectionPromptBlock_projectSectionId_sectionBindingId_key" ON "SectionPromptBlock"("projectSectionId","sectionBindingId");
  CREATE TABLE "SectionManualLoraEntry" ("id" TEXT NOT NULL PRIMARY KEY,"projectSectionId" TEXT NOT NULL,"sectionBindingId" TEXT,"stage" TEXT NOT NULL,"path" TEXT NOT NULL,"weight" REAL NOT NULL DEFAULT 1,"enabled" BOOLEAN NOT NULL DEFAULT true,"detachedFromBindingKey" TEXT,"detachedFromPresetId" TEXT,"detachedFromVariantId" TEXT,"detachedFromPath" TEXT,"metadata" JSONB,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "CharacterLoraTrainingJob" ("id" TEXT NOT NULL PRIMARY KEY,"slug" TEXT NOT NULL UNIQUE,"characterName" TEXT NOT NULL,"triggerToken" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'draft',"phase" TEXT,"trainingScope" JSONB NOT NULL,"captionStrategy" TEXT NOT NULL DEFAULT 'controllable_identity',"baseCheckpointName" TEXT,"baseCheckpointPath" TEXT,"baseCheckpointHash" TEXT,"baseFamily" TEXT,"artifactRoot" TEXT NOT NULL,"currentCanonicalVersionId" TEXT,"currentPromptCardVersionId" TEXT,"selectedDatasetRevisionId" TEXT,"promotedPresetId" TEXT,"trainingTemplateId" TEXT,"trainingTemplateSnapshot" JSONB,"createdBy" TEXT,"failureSummary" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "CharacterLoraBenchmarkRun" ("id" TEXT NOT NULL PRIMARY KEY,"jobId" TEXT NOT NULL,"trainingRunId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'queued',"loraAssetId" TEXT,"testPresetId" TEXT,"testProjectId" TEXT,"templateId" TEXT,"checkpointMatrix" JSONB NOT NULL,"weightMatrix" JSONB NOT NULL,"reportArtifactId" TEXT,"recommendedWeight" REAL,"resultSummary" JSONB,"testPresetCleanedAt" DATETIME,"testProjectCleanedAt" DATETIME,"cleanupSummary" JSONB,"startedAt" DATETIME,"finishedAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "CharacterLoraPromotionDecision" ("id" TEXT NOT NULL PRIMARY KEY,"jobId" TEXT NOT NULL,"benchmarkRunId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'draft',"selectedLoraAssetId" TEXT NOT NULL,"selectedCheckpoint" TEXT,"defaultRecommendedWeight" REAL NOT NULL,"perVariantWeightOverrides" JSONB,"variantPromptDrafts" JSONB NOT NULL,"decisionReason" TEXT,"rejectedReturnPoint" TEXT,"promotedCategoryId" TEXT,"promotedPresetId" TEXT,"reportArtifactId" TEXT,"decidedAt" DATETIME,"promotedAt" DATETIME,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "CharacterLoraWorkerTask" ("id" TEXT NOT NULL PRIMARY KEY,"jobId" TEXT NOT NULL,"workerType" TEXT NOT NULL,"targetType" TEXT NOT NULL,"targetId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'queued',"payload" JSONB NOT NULL,"leaseOwner" TEXT,"leaseExpiresAt" DATETIME,"attemptCount" INTEGER NOT NULL DEFAULT 0,"progressJson" JSONB,"startedAt" DATETIME,"heartbeatAt" DATETIME,"finishedAt" DATETIME,"errorSummary" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "GpuTaskLock" ("id" TEXT NOT NULL PRIMARY KEY,"taskType" TEXT NOT NULL,"ownerType" TEXT NOT NULL,"ownerId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"releasedAt" DATETIME,"metadata" JSONB);
`);
setupDb.close();

let prisma: typeof PrismaClientSingleton;
let createCharacterLoraBenchmarkRunWithTask: typeof BenchmarkRepository.createCharacterLoraBenchmarkRunWithTask;
let getCharacterLoraBenchmarkMatrixExpansionSummary: typeof BenchmarkRepository.getCharacterLoraBenchmarkMatrixExpansionSummary;

test.before(async () => {
  const prismaModule = await import("../src/lib/prisma");
  const benchmarkRepository = await import("../src/server/repositories/character-lora-training/benchmark-repository");
  prisma = prismaModule.prisma;
  createCharacterLoraBenchmarkRunWithTask = benchmarkRepository.createCharacterLoraBenchmarkRunWithTask;
  getCharacterLoraBenchmarkMatrixExpansionSummary = benchmarkRepository.getCharacterLoraBenchmarkMatrixExpansionSummary;
});

test.after(async () => {
  await prisma.$disconnect();
  await rm(tempDir, { recursive: true, force: true });
});

test("character lora benchmark temp projects write relation rows instead of editable redundancy", async () => {
  const benchmarkRunId = "benchmark-zero-redundancy-run";
  const loraPath = "character/test.safetensors";
  await prisma.characterLoraTrainingJob.create({
    data: { id: "job-zero-redundancy", slug: "job-zero-redundancy", characterName: "Test Character", triggerToken: "zrtoken", trainingScope: {}, artifactRoot: "artifacts/job-zero-redundancy" },
  });

  const created = await createCharacterLoraBenchmarkRunWithTask({
    benchmarkRunId,
    jobId: "job-zero-redundancy",
    trainingRunId: "training-zero-redundancy",
    checkpointMatrix: ["ckpt-a.safetensors"],
    weightMatrix: [0.65],
    taskPayload: null,
    tempPreset: { categoryName: "Temp Character", categorySlug: "temp-character", presetName: "Temp Preset", presetSlug: "temp-preset", variantName: "Temp Variant", variantSlug: "temp-variant", prompt: "temp preset prompt", negativePrompt: "temp preset negative", lora1: [], lora2: [], notes: "temporary benchmark preset" },
    tempProject: {
      title: "Zero Redundancy Benchmark",
      notes: "temporary benchmark project",
      checkpointName: "ckpt-a.safetensors",
      checkpointMatrix: ["ckpt-a.safetensors"],
      weightMatrix: [0.65],
      loraPath,
      promptBlock: { label: "Benchmark Prompt", positive: "custom benchmark positive", negative: "custom benchmark negative" },
      fallbackSections: [{ name: "Fallback Section", promptBlock: { label: "Benchmark Prompt", positive: "custom benchmark positive", negative: "custom benchmark negative" } }],
    },
  });

  const project = await prisma.project.findUniqueOrThrow({ where: { id: created.testProjectId } });
  assert.equal("presetBindings" in project, false);
  const binding = await prisma.projectPresetBinding.findFirstOrThrow({ where: { projectId: project.id } });
  const variant = await prisma.presetVariant.findFirstOrThrow({ where: { presetId: created.testPresetId } });
  assert.equal(binding.presetId, created.testPresetId);
  assert.equal(binding.variantId, variant.id);

  const section = await prisma.projectSection.findFirstOrThrow({ where: { projectId: project.id } });
  assert.equal("positivePrompt" in section, false);
  assert.equal("negativePrompt" in section, false);
  assert.equal("loraConfig" in section, false);

  const promptBlock = await prisma.sectionPromptBlock.findFirstOrThrow({ where: { projectSectionId: section.id } });
  assert.equal(promptBlock.type, "custom");
  assert.equal(promptBlock.customPositive, "custom benchmark positive");
  assert.match(promptBlock.customLabel ?? "", /Benchmark Prompt/);

  const loraEntries = await prisma.sectionManualLoraEntry.findMany({ where: { projectSectionId: section.id }, orderBy: { stage: "asc" } });
  assert.deepEqual(loraEntries.map((entry) => [entry.stage, entry.path, entry.weight]), [["lora1", loraPath, 0.65], ["lora2", loraPath, 0.65]]);
  for (const entry of loraEntries) {
    const metadata = entry.metadata as { characterLoraBenchmark?: Record<string, unknown> } | null;
    assert.equal(metadata?.characterLoraBenchmark?.benchmarkRunId, benchmarkRunId);
    assert.equal(metadata?.characterLoraBenchmark?.matrixIndex, 0);
    assert.equal(metadata?.characterLoraBenchmark?.weight, 0.65);
    assert.equal(metadata?.characterLoraBenchmark?.checkpointName, "ckpt-a.safetensors");
  }

  const summary = await getCharacterLoraBenchmarkMatrixExpansionSummary(benchmarkRunId);
  assert.equal(summary?.expectedSectionCount, 1);
  assert.equal(summary?.actualSectionCount, 1);
  assert.equal(summary?.sections[0]?.weight, 0.65);
  assert.equal(summary?.sections[0]?.checkpointName, "ckpt-a.safetensors");
});
