import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import type { prisma as PrismaClientSingleton } from "../src/lib/prisma";
import type * as PresetCategoryActions from "../src/lib/actions/preset-category";
import type * as PresetFolderActions from "../src/lib/actions/preset-folder";
import type * as PresetGroupActions from "../src/lib/actions/preset-group";
import type * as PresetVariantCrudActions from "../src/lib/actions/preset-variant-crud";
import type * as TrainingPresetService from "../src/server/services/training/preset-service";

process.env.DB_PROVIDER = "sqlite";

const tempDir = mkdtempSync(path.join(tmpdir(), "preset-resource-scope-"));
const dbPath = path.join(tempDir, "preset-resource-scope.db");
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
  CREATE TABLE "PresetFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "PresetCategorySlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "slotCategoryId" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
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
  CREATE TABLE "PresetVariantLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceVariantId" TEXT NOT NULL,
    "linkedVariantId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
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
  CREATE TABLE "PresetGroupChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetGroupId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

let prisma: typeof PrismaClientSingleton;
let createPresetCategory: typeof PresetCategoryActions.createPresetCategory;
let updatePresetCategory: typeof PresetCategoryActions.updatePresetCategory;
let createPresetFolder: typeof PresetFolderActions.createPresetFolder;
let renamePresetFolder: typeof PresetFolderActions.renamePresetFolder;
let createPresetGroup: typeof PresetGroupActions.createPresetGroup;
let createPreset: typeof PresetVariantCrudActions.createPreset;
let updatePreset: typeof PresetVariantCrudActions.updatePreset;
let deletePreset: typeof PresetVariantCrudActions.deletePreset;
let createTrainingSceneDescriptionPreset: typeof TrainingPresetService.createTrainingSceneDescriptionPreset;

test.before(async () => {
  const prismaModule = await import("../src/lib/prisma");
  const presetCategoryActions = await import("../src/lib/actions/preset-category");
  const presetFolderActions = await import("../src/lib/actions/preset-folder");
  const presetGroupActions = await import("../src/lib/actions/preset-group");
  const presetVariantCrudActions = await import("../src/lib/actions/preset-variant-crud");
  const trainingPresetService = await import("../src/server/services/training/preset-service");

  prisma = prismaModule.prisma;
  createPresetCategory = presetCategoryActions.createPresetCategory;
  updatePresetCategory = presetCategoryActions.updatePresetCategory;
  createPresetFolder = presetFolderActions.createPresetFolder;
  renamePresetFolder = presetFolderActions.renamePresetFolder;
  createPresetGroup = presetGroupActions.createPresetGroup;
  createPreset = presetVariantCrudActions.createPreset;
  updatePreset = presetVariantCrudActions.updatePreset;
  deletePreset = presetVariantCrudActions.deletePreset;
  createTrainingSceneDescriptionPreset = trainingPresetService.createTrainingSceneDescriptionPreset;
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

test("ordinary preset writes cannot create or mutate LoRA training preset resources", async () => {
  await ignoreStaticRevalidateError(() =>
    createPresetCategory({
      name: "普通入口分类",
      slug: "ordinary-entry-category",
      type: "training_scene_description",
    }),
  );
  assert.equal(
    (await prisma.presetCategory.findUniqueOrThrow({ where: { slug: "ordinary-entry-category" } })).type,
    "preset",
    "ordinary preset category creation must stay ordinary even if the request asks for a training type",
  );

  await prisma.presetCategory.create({
    data: {
      id: "ordinary-updatable-category",
      name: "Ordinary Updatable",
      slug: "ordinary-updatable",
      type: "preset",
    },
  });
  await ignoreStaticRevalidateError(() =>
    updatePresetCategory("ordinary-updatable-category", { type: "training_scene_description" }),
  );
  assert.equal(
    (await prisma.presetCategory.findUniqueOrThrow({ where: { id: "ordinary-updatable-category" } })).type,
    "preset",
    "ordinary preset category updates must not be able to move the category into the training resource space",
  );

  await prisma.presetCategory.create({
    data: {
      id: "training-owned-category",
      name: "Training Owned",
      slug: "training-owned",
      type: "training_scene_description",
    },
  });
  const trainingPreset = await prisma.preset.create({
    data: {
      id: "training-owned-preset",
      categoryId: "training-owned-category",
      name: "Training Owned Preset",
      slug: "training-owned-preset",
    },
  });

  await assert.rejects(
    () => ignoreStaticRevalidateError(() =>
      createPreset({
        categoryId: "training-owned-category",
        name: "Leaked Ordinary Preset",
        slug: "leaked-ordinary-preset",
      }),
    ),
    /ordinary preset category/i,
  );
  assert.equal(await prisma.preset.count({ where: { slug: "leaked-ordinary-preset" } }), 0);

  await assert.rejects(
    () => ignoreStaticRevalidateError(() => updatePreset(trainingPreset.id, { name: "Mutated From Ordinary UI" })),
    /ordinary preset/i,
  );
  await assert.rejects(
    () => ignoreStaticRevalidateError(() => deletePreset(trainingPreset.id)),
    /ordinary preset/i,
  );
  assert.deepEqual(
    await prisma.preset.findUnique({ where: { id: trainingPreset.id }, select: { isActive: true, name: true } }),
    { isActive: true, name: "Training Owned Preset" },
  );
});

test("ordinary preset folder and group writes cannot use LoRA training categories", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "training-folder-group-category",
      name: "Training Folder Group",
      slug: "training-folder-group",
      type: "training_scene_description",
    },
  });
  const trainingFolder = await prisma.presetFolder.create({
    data: {
      id: "training-owned-folder",
      categoryId: "training-folder-group-category",
      name: "Training Folder",
    },
  });

  await assert.rejects(
    () => ignoreStaticRevalidateError(() => createPresetFolder("training-folder-group-category", null, "Leaked Folder")),
    /ordinary preset category/i,
  );
  assert.equal(await prisma.presetFolder.count({ where: { name: "Leaked Folder" } }), 0);

  await assert.rejects(
    () => ignoreStaticRevalidateError(() => renamePresetFolder(trainingFolder.id, "Renamed From Ordinary UI")),
    /ordinary preset folder/i,
  );
  assert.equal(
    (await prisma.presetFolder.findUniqueOrThrow({ where: { id: trainingFolder.id } })).name,
    "Training Folder",
  );

  await assert.rejects(
    () => ignoreStaticRevalidateError(() =>
      createPresetGroup({
        categoryId: "training-folder-group-category",
        name: "Leaked Group",
        slug: "leaked-group",
      }),
    ),
    /ordinary preset category/i,
  );
  assert.equal(await prisma.presetGroup.count({ where: { slug: "leaked-group" } }), 0);
});

test("training preset creation never reuses ordinary generation preset categories", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "shared-name-ordinary-category",
      name: "Shared Scene",
      slug: "shared-scene",
      type: "preset",
    },
  });

  const created = await createTrainingSceneDescriptionPreset({
    category: "Shared Scene",
    folder: "Training Folder",
    sceneDescriptionText: "训练场景描述。",
    title: "Training Scene Preset",
  });
  const createdRow = await prisma.preset.findUniqueOrThrow({
    where: { id: created.id },
    include: { category: true },
  });

  assert.notEqual(createdRow.categoryId, "shared-name-ordinary-category");
  assert.equal(createdRow.category.type, "training_scene_description");
  assert.equal(
    (await prisma.presetCategory.findUniqueOrThrow({ where: { id: "shared-name-ordinary-category" } })).type,
    "preset",
  );
});
