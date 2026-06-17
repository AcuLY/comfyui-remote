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
import type * as PresetVariantResolveActions from "../src/lib/actions/preset-variant-resolve";
import type * as PresetSyncActions from "../src/lib/actions/preset-sync";
import type * as ServerData from "../src/lib/server-data";
import type * as PresetQueryService from "../src/server/services/preset-query-service";
import type * as PresetGroupResolver from "../src/server/prompt-config/preset-group-resolver";
import type * as TemplateCrudActions from "../src/lib/actions/template-crud";
import type * as TrainingPresetService from "../src/server/services/training/preset-service";

process.env.DB_PROVIDER = "sqlite";

const tempDir = mkdtempSync(path.join(tmpdir(), "preset-resource-scope-"));
const dbPath = path.join(tempDir, "preset-resource-scope.db");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.TRAINING_PRESET_FALLBACK_DIR = path.join(tempDir, "training-fallback");

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
  CREATE TABLE "PresetGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "presetId" TEXT,
    "variantId" TEXT,
    "subGroupId" TEXT,
    "slotCategoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
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
  CREATE TABLE "PresetGroupChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "presetGroupId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ProjectSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
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
  CREATE TABLE "SectionPromptBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "sectionBindingId" TEXT UNIQUE,
    "type" TEXT NOT NULL DEFAULT 'preset',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "SectionManualLoraEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "sectionBindingId" TEXT,
    "stage" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
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
  CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ProjectTemplateSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "TemplateSectionPresetBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateSectionId" TEXT NOT NULL,
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
  CREATE TABLE "TemplateSectionPromptBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateSectionId" TEXT NOT NULL,
    "templateSectionBindingId" TEXT UNIQUE,
    "type" TEXT NOT NULL DEFAULT 'preset',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "TemplateSectionManualLoraEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateSectionId" TEXT NOT NULL,
    "templateSectionBindingId" TEXT,
    "stage" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
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
  CREATE TABLE "TrainingSceneDescriptionPresetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sceneDescriptionOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX "TrainingSceneDescriptionPresetCategory_sortOrder_idx" ON "TrainingSceneDescriptionPresetCategory"("sortOrder");
  CREATE INDEX "TrainingSceneDescriptionPresetCategory_sceneDescriptionOrder_idx" ON "TrainingSceneDescriptionPresetCategory"("sceneDescriptionOrder");
  CREATE TABLE "TrainingSceneDescriptionPresetFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX "TrainingSceneDescriptionPresetFolder_categoryId_parentId_sortOrder_idx" ON "TrainingSceneDescriptionPresetFolder"("categoryId", "parentId", "sortOrder");
  CREATE TABLE "TrainingSceneDescriptionPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sceneDescriptionText" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX "TrainingSceneDescriptionPreset_categoryId_slug_key" ON "TrainingSceneDescriptionPreset"("categoryId", "slug");
  CREATE UNIQUE INDEX "TrainingSceneDescriptionPreset_categoryId_id_key" ON "TrainingSceneDescriptionPreset"("categoryId", "id");
  CREATE INDEX "TrainingSceneDescriptionPreset_categoryId_folderId_sortOrder_idx" ON "TrainingSceneDescriptionPreset"("categoryId", "folderId", "sortOrder");
  CREATE INDEX "TrainingSceneDescriptionPreset_isActive_sortOrder_idx" ON "TrainingSceneDescriptionPreset"("isActive", "sortOrder");
`);

let prisma: typeof PrismaClientSingleton;
let createPresetCategory: typeof PresetCategoryActions.createPresetCategory;
let updatePresetCategory: typeof PresetCategoryActions.updatePresetCategory;
let createPresetFolder: typeof PresetFolderActions.createPresetFolder;
let renamePresetFolder: typeof PresetFolderActions.renamePresetFolder;
let createPresetGroup: typeof PresetGroupActions.createPresetGroup;
let copyPresetGroup: typeof PresetGroupActions.copyPresetGroup;
let flattenGroup: typeof PresetGroupActions.flattenGroup;
let removeGroupMember: typeof PresetGroupActions.removeGroupMember;
let updateGroupMember: typeof PresetGroupActions.updateGroupMember;
let createPreset: typeof PresetVariantCrudActions.createPreset;
let copyPreset: typeof PresetVariantCrudActions.copyPreset;
let updatePreset: typeof PresetVariantCrudActions.updatePreset;
let deletePreset: typeof PresetVariantCrudActions.deletePreset;
let resolveVariantContent: typeof PresetVariantResolveActions.resolveVariantContent;
let syncPresetToSections: typeof PresetSyncActions.syncPresetToSections;
let getPresetUsage: typeof PresetSyncActions.getPresetUsage;
let deletePresetCascade: typeof PresetSyncActions.deletePresetCascade;
let getPresetFolders: typeof ServerData.getPresetFolders;
let getPresetFolder: typeof ServerData.getPresetFolder;
let getPresetCategoriesWithPresets: typeof ServerData.getPresetCategoriesWithPresets;
let getPresetLibraryV2: typeof ServerData.getPresetLibraryV2;
let getPresetGroups: typeof ServerData.getPresetGroups;
let getPresetGroup: typeof ServerData.getPresetGroup;
let listPresets: typeof PresetQueryService.listPresets;
let getPresetById: typeof PresetQueryService.getPresetById;
let resolvePresetGroupContent: typeof PresetGroupResolver.resolvePresetGroupContent;
let resolveTemplatePresetImports: typeof TemplateCrudActions.resolveTemplatePresetImports;
let createTrainingSceneDescriptionPreset: typeof TrainingPresetService.createTrainingSceneDescriptionPreset;

test.before(async () => {
  const prismaModule = await import("../src/lib/prisma");
  const serverData = await import("../src/lib/server-data");
  const presetCategoryActions = await import("../src/lib/actions/preset-category");
  const presetFolderActions = await import("../src/lib/actions/preset-folder");
  const presetGroupActions = await import("../src/lib/actions/preset-group");
  const presetVariantCrudActions = await import("../src/lib/actions/preset-variant-crud");
  const presetVariantResolveActions = await import("../src/lib/actions/preset-variant-resolve");
  const presetSyncActions = await import("../src/lib/actions/preset-sync");
  const presetQueryService = await import("../src/server/services/preset-query-service");
  const presetGroupResolver = await import("../src/server/prompt-config/preset-group-resolver");
  const templateCrudActions = await import("../src/lib/actions/template-crud");
  const trainingPresetService = await import("../src/server/services/training/preset-service");

  prisma = prismaModule.prisma;
  createPresetCategory = presetCategoryActions.createPresetCategory;
  updatePresetCategory = presetCategoryActions.updatePresetCategory;
  createPresetFolder = presetFolderActions.createPresetFolder;
  renamePresetFolder = presetFolderActions.renamePresetFolder;
  createPresetGroup = presetGroupActions.createPresetGroup;
  copyPresetGroup = presetGroupActions.copyPresetGroup;
  flattenGroup = presetGroupActions.flattenGroup;
  removeGroupMember = presetGroupActions.removeGroupMember;
  updateGroupMember = presetGroupActions.updateGroupMember;
  createPreset = presetVariantCrudActions.createPreset;
  copyPreset = presetVariantCrudActions.copyPreset;
  updatePreset = presetVariantCrudActions.updatePreset;
  deletePreset = presetVariantCrudActions.deletePreset;
  resolveVariantContent = presetVariantResolveActions.resolveVariantContent;
  syncPresetToSections = presetSyncActions.syncPresetToSections;
  getPresetUsage = presetSyncActions.getPresetUsage;
  deletePresetCascade = presetSyncActions.deletePresetCascade;
  getPresetFolders = serverData.getPresetFolders;
  getPresetFolder = serverData.getPresetFolder;
  getPresetCategoriesWithPresets = serverData.getPresetCategoriesWithPresets;
  getPresetLibraryV2 = serverData.getPresetLibraryV2;
  getPresetGroups = serverData.getPresetGroups;
  getPresetGroup = serverData.getPresetGroup;
  listPresets = presetQueryService.listPresets;
  getPresetById = presetQueryService.getPresetById;
  resolvePresetGroupContent = presetGroupResolver.resolvePresetGroupContent;
  resolveTemplatePresetImports = templateCrudActions.resolveTemplatePresetImports;
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
  await ignoreStaticRevalidateError(() =>
    createPresetCategory({
      name: "普通预制组分类",
      slug: "ordinary-group-entry-category",
      type: "group",
    }),
  );
  assert.equal(
    (await prisma.presetCategory.findUniqueOrThrow({ where: { slug: "ordinary-group-entry-category" } })).type,
    "group",
    "ordinary preset category creation must preserve generation group categories",
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

test("ordinary preset category and list reads do not expose LoRA training presets", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-list-readable-category",
        name: "Ordinary List Readable",
        slug: "ordinary-list-readable",
        type: "preset",
      },
      {
        id: "training-list-readable-category",
        name: "Training List Readable",
        slug: "training-list-readable",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-list-readable-preset",
        categoryId: "ordinary-list-readable-category",
        name: "Ordinary List Readable Preset",
        slug: "ordinary-list-readable-preset",
      },
      {
        id: "training-list-hidden-preset",
        categoryId: "training-list-readable-category",
        name: "Training List Hidden Preset",
        slug: "training-list-hidden-preset",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-list-readable-variant",
        presetId: "ordinary-list-readable-preset",
        name: "Ordinary List Variant",
        slug: "ordinary-list-variant",
        prompt: "ordinary list prompt",
      },
      {
        id: "training-list-hidden-variant",
        presetId: "training-list-hidden-preset",
        name: "Training List Variant",
        slug: "training-list-variant",
        prompt: "training list prompt must not leak",
      },
    ],
  });

  const ordinaryPagePresetIds = (await getPresetCategoriesWithPresets())
    .flatMap((category) => category.presets.map((preset) => preset.id));
  assert.equal(
    ordinaryPagePresetIds.includes("ordinary-list-readable-preset"),
    true,
    "ordinary preset page data should still include generation-owned presets",
  );
  assert.equal(
    ordinaryPagePresetIds.includes("training-list-hidden-preset"),
    false,
    "ordinary preset page data must hide training-owned presets stored in the same tables",
  );

  const ordinaryApiPresetIds = (await listPresets({ includeInactive: true })).map((preset) => preset.id);
  assert.equal(
    ordinaryApiPresetIds.includes("ordinary-list-readable-preset"),
    true,
    "ordinary preset API should still include generation-owned presets",
  );
  assert.equal(
    ordinaryApiPresetIds.includes("training-list-hidden-preset"),
    false,
    "ordinary preset API must hide training-owned presets stored in the same tables",
  );
  assert.deepEqual(
    await listPresets({ categoryId: "training-list-readable-category", includeInactive: true }),
    [],
    "ordinary preset API must not expose training presets even when called with a training category id",
  );
  assert.equal(
    await getPresetById("training-list-hidden-preset", true),
    null,
    "ordinary preset detail API must not expose a LoRA training preset by direct id",
  );
});

test("ordinary preset operations reject LoRA training preset ids before touching usage or cascade state", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "training-operation-hidden-category",
      name: "Training Operation Hidden",
      slug: "training-operation-hidden",
      type: "training_scene_description",
    },
  });
  await prisma.preset.create({
    data: {
      id: "training-operation-hidden-preset",
      categoryId: "training-operation-hidden-category",
      name: "Training Operation Hidden Preset",
      slug: "training-operation-hidden-preset",
    },
  });

  await assert.rejects(
    () => getPresetUsage("training-operation-hidden-preset"),
    /Ordinary preset not found/i,
    "ordinary preset usage must reject training-owned preset ids instead of reporting usage",
  );
  await assert.rejects(
    () => ignoreStaticRevalidateError(() => deletePresetCascade("training-operation-hidden-preset")),
    /Ordinary preset not found/i,
    "ordinary preset cascade delete must reject training-owned preset ids before mutating rows",
  );
  assert.deepEqual(
    await prisma.preset.findUnique({
      where: { id: "training-operation-hidden-preset" },
      select: { isActive: true },
    }),
    { isActive: true },
    "failed ordinary cascade attempts must leave the training-owned preset active",
  );
});

test("ordinary preset category and list reads do not expose reserved training temporary presets", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "ordinary-benchmark-temp-category",
      name: "Ordinary Benchmark Temp",
      slug: "ordinary-benchmark-temp",
      type: "preset",
    },
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-benchmark-visible-preset",
        categoryId: "ordinary-benchmark-temp-category",
        name: "Ordinary Benchmark Visible Preset",
        slug: "ordinary-benchmark-visible-preset",
      },
      {
        id: "reserved-training-benchmark-hidden-preset",
        categoryId: "ordinary-benchmark-temp-category",
        name: "Reserved Training Benchmark Hidden Preset",
        slug: "reserved-training-benchmark-hidden-preset",
        notes: JSON.stringify({
          temporary: true,
          purpose: "training_benchmark",
          benchmarkRunId: "benchmark-temp-hidden",
        }, null, 2),
      },
    ],
  });

  const ordinaryPagePresetIds = (await getPresetCategoriesWithPresets())
    .flatMap((category) => category.presets.map((preset) => preset.id));
  assert.equal(
    ordinaryPagePresetIds.includes("ordinary-benchmark-visible-preset"),
    true,
    "ordinary preset page data should still include ordinary presets without training benchmark notes",
  );
  assert.equal(
    ordinaryPagePresetIds.includes("reserved-training-benchmark-hidden-preset"),
    false,
    "ordinary preset page data must hide reserved training temporary presets stored in ordinary preset tables",
  );

  const ordinaryApiPresetIds = (await listPresets({ includeInactive: true })).map((preset) => preset.id);
  assert.equal(
    ordinaryApiPresetIds.includes("ordinary-benchmark-visible-preset"),
    true,
    "ordinary preset API should still include ordinary presets without training benchmark notes",
  );
  assert.equal(
    ordinaryApiPresetIds.includes("reserved-training-benchmark-hidden-preset"),
    false,
    "ordinary preset API must hide reserved training temporary presets stored in ordinary preset tables",
  );
  assert.equal(
    await getPresetById("reserved-training-benchmark-hidden-preset", true),
    null,
    "ordinary preset detail API must not expose a reserved training temporary preset by direct id",
  );
});

test("ordinary preset operational reads do not expose reserved training temporary presets", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "ordinary-benchmark-operation-category",
      name: "Ordinary Benchmark Operation",
      slug: "ordinary-benchmark-operation",
      color: "190 50% 55%",
      type: "preset",
    },
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-benchmark-operation-visible-preset",
        categoryId: "ordinary-benchmark-operation-category",
        name: "Ordinary Benchmark Operation Visible",
        slug: "ordinary-benchmark-operation-visible",
      },
      {
        id: "reserved-training-operation-hidden-preset",
        categoryId: "ordinary-benchmark-operation-category",
        name: "Reserved Training Operation Hidden",
        slug: "reserved-training-operation-hidden",
        notes: JSON.stringify({
          temporary: true,
          purpose: "training_benchmark",
          benchmarkRunId: "benchmark-operation-hidden",
        }),
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-benchmark-operation-visible-variant",
        presetId: "ordinary-benchmark-operation-visible-preset",
        name: "Ordinary Operation Visible",
        slug: "ordinary-operation-visible",
        prompt: "ordinary operation prompt",
      },
      {
        id: "reserved-training-operation-hidden-variant",
        presetId: "reserved-training-operation-hidden-preset",
        name: "Reserved Training Operation Hidden",
        slug: "reserved-training-operation-hidden",
        prompt: "reserved training operation prompt must not leak",
      },
    ],
  });

  assert.equal(
    (await resolveVariantContent("ordinary-benchmark-operation-visible-variant")).prompt,
    "ordinary operation prompt",
    "ordinary variant resolution should still resolve generation-owned variants",
  );
  assert.deepEqual(
    await resolveVariantContent("reserved-training-operation-hidden-variant"),
    { prompt: "", negativePrompt: null, lora1: [], lora2: [] },
    "ordinary variant resolution must treat reserved training variants as out of scope",
  );

  const imports = await resolveTemplatePresetImports([
    {
      presetId: "ordinary-benchmark-operation-visible-preset",
      variantId: "ordinary-benchmark-operation-visible-variant",
    },
    {
      presetId: "reserved-training-operation-hidden-preset",
      variantId: "reserved-training-operation-hidden-variant",
    },
  ]);
  assert.deepEqual(
    imports.map((item) => ({ presetId: item.presetId, prompt: item.prompt })),
    [{ presetId: "ordinary-benchmark-operation-visible-preset", prompt: "ordinary operation prompt" }],
    "ordinary template imports must ignore reserved training presets even when called by id",
  );
});

test("ordinary preset reads do not expose LoRA training resources through linked variants or slots", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-linked-source-category",
        name: "Ordinary Linked Source",
        slug: "ordinary-linked-source",
        type: "preset",
      },
      {
        id: "ordinary-linked-target-category",
        name: "Ordinary Linked Target",
        slug: "ordinary-linked-target",
        type: "preset",
      },
      {
        id: "training-linked-hidden-category",
        name: "Training Linked Hidden",
        slug: "training-linked-hidden",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.presetCategorySlot.createMany({
    data: [
      {
        id: "ordinary-slot-to-ordinary",
        categoryId: "ordinary-linked-source-category",
        slotKey: "ordinary-target",
        slotCategoryId: "ordinary-linked-target-category",
        label: "Ordinary Target",
        sortOrder: 0,
      },
      {
        id: "ordinary-slot-to-training",
        categoryId: "ordinary-linked-source-category",
        slotKey: "training-target",
        slotCategoryId: "training-linked-hidden-category",
        label: "Training Target",
        sortOrder: 1,
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-linked-source-preset",
        categoryId: "ordinary-linked-source-category",
        name: "Ordinary Linked Source Preset",
        slug: "ordinary-linked-source-preset",
      },
      {
        id: "ordinary-linked-target-preset",
        categoryId: "ordinary-linked-target-category",
        name: "Ordinary Linked Target Preset",
        slug: "ordinary-linked-target-preset",
      },
      {
        id: "training-linked-hidden-preset",
        categoryId: "training-linked-hidden-category",
        name: "Training Linked Hidden Preset",
        slug: "training-linked-hidden-preset",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-linked-source-variant",
        presetId: "ordinary-linked-source-preset",
        name: "Ordinary Source Variant",
        slug: "ordinary-source-variant",
        prompt: "ordinary source prompt",
      },
      {
        id: "ordinary-linked-target-variant",
        presetId: "ordinary-linked-target-preset",
        name: "Ordinary Target Variant",
        slug: "ordinary-target-variant",
        prompt: "ordinary target prompt",
      },
      {
        id: "training-linked-hidden-variant",
        presetId: "training-linked-hidden-preset",
        name: "Training Hidden Variant",
        slug: "training-hidden-variant",
        prompt: "training linked prompt must not leak",
      },
    ],
  });
  await prisma.presetVariantLink.createMany({
    data: [
      {
        id: "ordinary-link-to-ordinary",
        sourceVariantId: "ordinary-linked-source-variant",
        linkedVariantId: "ordinary-linked-target-variant",
        sortOrder: 0,
      },
      {
        id: "ordinary-link-to-training",
        sourceVariantId: "ordinary-linked-source-variant",
        linkedVariantId: "training-linked-hidden-variant",
        sortOrder: 1,
      },
    ],
  });

  const categories = await getPresetCategoriesWithPresets();
  const sourceCategory = categories.find((category) => category.id === "ordinary-linked-source-category");
  const sourcePreset = sourceCategory?.presets.find((preset) => preset.id === "ordinary-linked-source-preset");

  assert.deepEqual(
    sourceCategory?.slotTemplate.map((slot) => slot.categoryId),
    ["ordinary-linked-target-category"],
    "ordinary preset category slot templates must not expose training-owned categories",
  );
  assert.deepEqual(
    sourcePreset?.variants[0]?.linkedVariants,
    [{ presetId: "ordinary-linked-target-preset", variantId: "ordinary-linked-target-variant" }],
    "ordinary preset page data must not expose linked variants owned by training presets",
  );

  const apiPreset = (await listPresets({ categoryId: "ordinary-linked-source-category", includeInactive: true }))[0];
  assert.deepEqual(
    apiPreset?.variants[0]?.linkedVariants,
    [{ presetId: "ordinary-linked-target-preset", variantId: "ordinary-linked-target-variant" }],
    "ordinary preset API list must not expose linked variants owned by training presets",
  );
  const detailPreset = await getPresetById("ordinary-linked-source-preset", true);
  assert.deepEqual(
    detailPreset?.variants[0]?.linkedVariants,
    [{ presetId: "ordinary-linked-target-preset", variantId: "ordinary-linked-target-variant" }],
    "ordinary preset API detail must not expose linked variants owned by training presets",
  );

  const libraryV2Category = (await getPresetLibraryV2()).categories.find(
    (category) => category.id === "ordinary-linked-source-category",
  );
  assert.deepEqual(
    libraryV2Category?.slotTemplate.map((slot) => slot.categoryId),
    ["ordinary-linked-target-category"],
    "ordinary block-editor preset library must not expose training-owned slot categories",
  );
  assert.deepEqual(
    libraryV2Category?.presets[0]?.variants[0]?.linkedVariants,
    [{ presetId: "ordinary-linked-target-preset", variantId: "ordinary-linked-target-variant" }],
    "ordinary block-editor preset library must not expose linked variants owned by training presets",
  );
});

test("ordinary preset folder and group reads do not expose LoRA training resources", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-readable-category",
        name: "Ordinary Readable",
        slug: "ordinary-readable",
        type: "preset",
      },
      {
        id: "ordinary-readable-group-category",
        name: "Ordinary Readable Groups",
        slug: "ordinary-readable-groups",
        type: "group",
      },
      {
        id: "training-readable-category",
        name: "Training Readable",
        slug: "training-readable",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.presetFolder.createMany({
    data: [
      {
        id: "ordinary-readable-folder",
        categoryId: "ordinary-readable-category",
        name: "Ordinary Folder",
      },
      {
        id: "ordinary-readable-group-folder",
        categoryId: "ordinary-readable-group-category",
        name: "Ordinary Group Folder",
      },
      {
        id: "training-readable-folder",
        categoryId: "training-readable-category",
        name: "Training Folder",
      },
      {
        id: "training-readable-child-under-ordinary-folder",
        categoryId: "training-readable-category",
        parentId: "ordinary-readable-folder",
        name: "Training Child Under Ordinary Folder",
      },
    ],
  });
  await prisma.presetGroup.createMany({
    data: [
      {
        id: "ordinary-readable-group",
        categoryId: "ordinary-readable-group-category",
        name: "Ordinary Group",
        slug: "ordinary-readable-group",
      },
      {
        id: "training-readable-group",
        categoryId: "training-readable-category",
        name: "Training Group",
        slug: "training-readable-group",
      },
      {
        id: "training-readable-group-in-ordinary-folder",
        categoryId: "training-readable-category",
        name: "Training Group In Ordinary Folder",
        slug: "training-readable-group-in-ordinary-folder",
        folderId: "ordinary-readable-folder",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-readable-preset",
        categoryId: "ordinary-readable-category",
        name: "Ordinary Readable Preset",
        slug: "ordinary-readable-preset",
      },
      {
        id: "training-readable-preset",
        categoryId: "training-readable-category",
        name: "Training Readable Preset",
        slug: "training-readable-preset",
      },
      {
        id: "training-readable-preset-in-ordinary-folder",
        categoryId: "training-readable-category",
        name: "Training Readable Preset In Ordinary Folder",
        slug: "training-readable-preset-in-ordinary-folder",
        folderId: "ordinary-readable-folder",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-readable-variant",
        presetId: "ordinary-readable-preset",
        name: "Ordinary Readable Variant",
        slug: "ordinary-readable-variant",
        prompt: "ordinary readable prompt",
      },
      {
        id: "training-readable-variant",
        presetId: "training-readable-preset",
        name: "Training Readable Variant",
        slug: "training-readable-variant",
        prompt: "training readable prompt",
      },
    ],
  });
  await prisma.presetGroupMember.createMany({
    data: [
      {
        id: "ordinary-member-ordinary-preset",
        groupId: "ordinary-readable-group",
        presetId: "ordinary-readable-preset",
        variantId: "ordinary-readable-variant",
        slotCategoryId: "ordinary-readable-category",
        sortOrder: 0,
      },
      {
        id: "ordinary-member-training-preset",
        groupId: "ordinary-readable-group",
        presetId: "training-readable-preset",
        variantId: "training-readable-variant",
        sortOrder: 1,
      },
      {
        id: "ordinary-member-training-subgroup",
        groupId: "ordinary-readable-group",
        subGroupId: "training-readable-group",
        sortOrder: 2,
      },
    ],
  });

  assert.deepEqual(
    (await getPresetFolders()).map((folder) => folder.id),
    ["ordinary-readable-folder", "ordinary-readable-group-folder"],
    "ordinary preset folder lists must include generation preset/group folders and hide training-owned folders",
  );
  assert.deepEqual(
    await getPresetFolders({ categoryId: "training-readable-category" }),
    [],
    "ordinary preset folder APIs must not leak training folders when called with a training category id",
  );
  assert.deepEqual(
    (await getPresetFolder("ordinary-readable-folder")),
    {
      id: "ordinary-readable-folder",
      categoryId: "ordinary-readable-category",
      name: "Ordinary Folder",
      parentId: null,
      sortOrder: 0,
      presetCount: 0,
      groupCount: 0,
      childCount: 0,
    },
    "ordinary preset folder counts must not include training-owned presets, groups, or child folders",
  );
  assert.equal(await getPresetFolder("training-readable-folder"), null);
  const ordinaryGroups = await getPresetGroups();
  assert.deepEqual(
    ordinaryGroups.map((group) => group.id),
    ["ordinary-readable-group"],
    "ordinary preset group lists must hide training-owned groups",
  );
  assert.deepEqual(
    ordinaryGroups[0]?.members.map((member) => member.id),
    ["ordinary-member-ordinary-preset"],
    "ordinary preset group lists must omit members that point at training-owned presets or groups",
  );
  assert.deepEqual(
    ordinaryGroups[0]?.members.map((member) => ({
      presetId: member.presetId,
      variantId: member.variantId,
      subGroupId: member.subGroupId,
      slotCategoryId: member.slotCategoryId,
      presetName: member.presetName,
      variantName: member.variantName,
      subGroupName: member.subGroupName,
    })),
    [
      {
        presetId: "ordinary-readable-preset",
        variantId: "ordinary-readable-variant",
        subGroupId: null,
        slotCategoryId: "ordinary-readable-category",
        presetName: "Ordinary Readable Preset",
        variantName: "Ordinary Readable Variant",
        subGroupName: undefined,
      },
    ],
    "ordinary preset group member summaries must not expose training-owned resource identities",
  );
  const ordinaryPresetPageGroup = (await getPresetCategoriesWithPresets())
    .flatMap((category) => category.groups)
    .find((group) => group.id === "ordinary-readable-group");
  assert.deepEqual(
    ordinaryPresetPageGroup?.members.map((member) => member.id),
    ["ordinary-member-ordinary-preset"],
    "ordinary preset page data must omit members that point at training-owned presets or groups",
  );
  const ordinaryLibraryGroup = (await getPresetLibraryV2()).categories
    .flatMap((category) => category.groups)
    .find((group) => group.id === "ordinary-readable-group");
  assert.deepEqual(
    ordinaryLibraryGroup?.members.map((member) => member.id),
    ["ordinary-member-ordinary-preset"],
    "ordinary block-editor preset library must omit members that point at training-owned presets or groups",
  );
  assert.equal(await getPresetGroup("training-readable-group"), null);
});

test("ordinary preset variant resolution ignores LoRA training variants", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-resolvable-category",
        name: "Ordinary Resolvable",
        slug: "ordinary-resolvable",
        type: "preset",
      },
      {
        id: "training-resolvable-category",
        name: "Training Resolvable",
        slug: "training-resolvable",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-resolvable-preset",
        categoryId: "ordinary-resolvable-category",
        name: "Ordinary Resolvable Preset",
        slug: "ordinary-resolvable-preset",
      },
      {
        id: "training-resolvable-preset",
        categoryId: "training-resolvable-category",
        name: "Training Resolvable Preset",
        slug: "training-resolvable-preset",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-resolvable-variant",
        presetId: "ordinary-resolvable-preset",
        name: "Ordinary Variant",
        slug: "ordinary-variant",
        prompt: "ordinary prompt",
      },
      {
        id: "training-resolvable-variant",
        presetId: "training-resolvable-preset",
        name: "Training Variant",
        slug: "training-variant",
        prompt: "training prompt must not leak",
      },
    ],
  });

  assert.equal((await resolveVariantContent("ordinary-resolvable-variant")).prompt, "ordinary prompt");
  assert.deepEqual(
    await resolveVariantContent("training-resolvable-variant"),
    { prompt: "", negativePrompt: null, lora1: [], lora2: [] },
    "ordinary preset variant resolution must treat training-owned variants as out of scope",
  );
});

test("ordinary template preset imports do not resolve LoRA training presets", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-template-import-category",
        name: "Ordinary Template Import",
        slug: "ordinary-template-import",
        color: "160 50% 55%",
        type: "preset",
      },
      {
        id: "training-template-import-category",
        name: "Training Template Import",
        slug: "training-template-import",
        color: "210 50% 55%",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-template-import-preset",
        categoryId: "ordinary-template-import-category",
        name: "Ordinary Template Import Preset",
        slug: "ordinary-template-import-preset",
      },
      {
        id: "training-template-import-preset",
        categoryId: "training-template-import-category",
        name: "Training Template Import Preset",
        slug: "training-template-import-preset",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-template-import-variant",
        presetId: "ordinary-template-import-preset",
        name: "Ordinary Import Variant",
        slug: "ordinary-import-variant",
        prompt: "ordinary template prompt",
      },
      {
        id: "training-template-import-variant",
        presetId: "training-template-import-preset",
        name: "Training Import Variant",
        slug: "training-import-variant",
        prompt: "training template prompt must not leak",
      },
    ],
  });

  const imports = await resolveTemplatePresetImports([
    { presetId: "ordinary-template-import-preset", variantId: "ordinary-template-import-variant" },
    { presetId: "training-template-import-preset", variantId: "training-template-import-variant" },
  ]);

  assert.deepEqual(
    imports.map((item) => ({ presetId: item.presetId, prompt: item.prompt })),
    [{ presetId: "ordinary-template-import-preset", prompt: "ordinary template prompt" }],
    "ordinary template preset imports must ignore training-owned presets even when called by id",
  );
});

test("ordinary preset copies do not preserve LoRA training linked variants", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-copy-source-category",
        name: "Ordinary Copy Source",
        slug: "ordinary-copy-source",
        type: "preset",
      },
      {
        id: "training-copy-hidden-category",
        name: "Training Copy Hidden",
        slug: "training-copy-hidden",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-copy-source-preset",
        categoryId: "ordinary-copy-source-category",
        name: "Ordinary Copy Source Preset",
        slug: "ordinary-copy-source-preset",
        sortOrder: 0,
      },
      {
        id: "ordinary-copy-target-preset",
        categoryId: "ordinary-copy-source-category",
        name: "Ordinary Copy Target Preset",
        slug: "ordinary-copy-target-preset",
        sortOrder: 1,
      },
      {
        id: "training-copy-hidden-preset",
        categoryId: "training-copy-hidden-category",
        name: "Training Copy Hidden Preset",
        slug: "training-copy-hidden-preset",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-copy-source-variant",
        presetId: "ordinary-copy-source-preset",
        name: "Ordinary Copy Source Variant",
        slug: "ordinary-copy-source-variant",
        prompt: "ordinary copy source prompt",
      },
      {
        id: "ordinary-copy-target-variant",
        presetId: "ordinary-copy-target-preset",
        name: "Ordinary Copy Target Variant",
        slug: "ordinary-copy-target-variant",
        prompt: "ordinary copy target prompt",
      },
      {
        id: "training-copy-hidden-variant",
        presetId: "training-copy-hidden-preset",
        name: "Training Copy Hidden Variant",
        slug: "training-copy-hidden-variant",
        prompt: "training linked prompt must not be copied",
      },
    ],
  });
  await prisma.presetVariantLink.createMany({
    data: [
      {
        id: "ordinary-copy-link-to-ordinary",
        sourceVariantId: "ordinary-copy-source-variant",
        linkedVariantId: "ordinary-copy-target-variant",
        sortOrder: 0,
      },
      {
        id: "ordinary-copy-link-to-training",
        sourceVariantId: "ordinary-copy-source-variant",
        linkedVariantId: "training-copy-hidden-variant",
        sortOrder: 1,
      },
    ],
  });

  const copiedPreset = await ignoreStaticRevalidateError(() => copyPreset("ordinary-copy-source-preset")) ??
    await prisma.preset.findFirstOrThrow({ where: { slug: "ordinary-copy-source-preset-copy" } });
  const copiedVariant = await prisma.presetVariant.findFirstOrThrow({
    where: { presetId: copiedPreset.id, slug: "ordinary-copy-source-variant" },
  });
  const copiedLinks = await prisma.presetVariantLink.findMany({
    where: { sourceVariantId: copiedVariant.id },
    orderBy: { sortOrder: "asc" },
  });

  assert.deepEqual(
    copiedLinks.map((link) => link.linkedVariantId),
    ["ordinary-copy-target-variant"],
    "ordinary preset copies must drop linked variants owned by the training module",
  );
});

test("ordinary preset copies do not preserve reserved training linked variants", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "reserved-training-copy-linked-category",
      name: "Reserved Training Copy Linked",
      slug: "reserved-training-copy-linked",
      type: "preset",
    },
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "reserved-training-copy-source-preset",
        categoryId: "reserved-training-copy-linked-category",
        name: "Reserved Training Copy Source Preset",
        slug: "reserved-training-copy-source-preset",
        sortOrder: 0,
      },
      {
        id: "reserved-training-copy-visible-preset",
        categoryId: "reserved-training-copy-linked-category",
        name: "Reserved Training Copy Visible Preset",
        slug: "reserved-training-copy-visible-preset",
        sortOrder: 1,
      },
      {
        id: "reserved-training-copy-hidden-preset",
        categoryId: "reserved-training-copy-linked-category",
        name: "Reserved Training Copy Hidden Preset",
        slug: "reserved-training-copy-hidden-preset",
        notes: JSON.stringify({
          temporary: true,
          purpose: "training_benchmark",
          benchmarkRunId: "benchmark-copy-hidden",
        }),
        sortOrder: 2,
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "reserved-training-copy-source-variant",
        presetId: "reserved-training-copy-source-preset",
        name: "Reserved Training Copy Source Variant",
        slug: "reserved-training-copy-source-variant",
        prompt: "ordinary source prompt",
      },
      {
        id: "reserved-training-copy-visible-variant",
        presetId: "reserved-training-copy-visible-preset",
        name: "Reserved Training Copy Visible Variant",
        slug: "reserved-training-copy-visible-variant",
        prompt: "ordinary visible linked prompt",
      },
      {
        id: "reserved-training-copy-hidden-variant",
        presetId: "reserved-training-copy-hidden-preset",
        name: "Reserved Training Copy Hidden Variant",
        slug: "reserved-training-copy-hidden-variant",
        prompt: "reserved training linked prompt must not be copied",
      },
    ],
  });
  await prisma.presetVariantLink.createMany({
    data: [
      {
        id: "reserved-training-copy-link-to-visible",
        sourceVariantId: "reserved-training-copy-source-variant",
        linkedVariantId: "reserved-training-copy-visible-variant",
        sortOrder: 0,
      },
      {
        id: "reserved-training-copy-link-to-hidden",
        sourceVariantId: "reserved-training-copy-source-variant",
        linkedVariantId: "reserved-training-copy-hidden-variant",
        sortOrder: 1,
      },
    ],
  });

  const copiedPreset = await ignoreStaticRevalidateError(() => copyPreset("reserved-training-copy-source-preset")) ??
    await prisma.preset.findFirstOrThrow({ where: { slug: "reserved-training-copy-source-preset-copy" } });
  const copiedVariant = await prisma.presetVariant.findFirstOrThrow({
    where: { presetId: copiedPreset.id, slug: "reserved-training-copy-source-variant" },
  });
  const copiedLinks = await prisma.presetVariantLink.findMany({
    where: { sourceVariantId: copiedVariant.id },
    orderBy: { sortOrder: "asc" },
  });

  assert.deepEqual(
    copiedLinks.map((link) => link.linkedVariantId),
    ["reserved-training-copy-visible-variant"],
    "ordinary preset copies must drop linked variants owned by reserved training resources",
  );
});

test("ordinary preset group copies do not preserve LoRA training members", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-group-copy-preset-category",
        name: "Ordinary Group Copy Presets",
        slug: "ordinary-group-copy-presets",
        type: "preset",
      },
      {
        id: "ordinary-group-copy-group-category",
        name: "Ordinary Group Copy Groups",
        slug: "ordinary-group-copy-groups",
        type: "group",
      },
      {
        id: "training-group-copy-hidden-category",
        name: "Training Group Copy Hidden",
        slug: "training-group-copy-hidden",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-group-copy-preset",
        categoryId: "ordinary-group-copy-preset-category",
        name: "Ordinary Group Copy Preset",
        slug: "ordinary-group-copy-preset",
      },
      {
        id: "training-group-copy-hidden-preset",
        categoryId: "training-group-copy-hidden-category",
        name: "Training Group Copy Hidden Preset",
        slug: "training-group-copy-hidden-preset",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-group-copy-variant",
        presetId: "ordinary-group-copy-preset",
        name: "Ordinary Group Copy Variant",
        slug: "ordinary-group-copy-variant",
        prompt: "ordinary group copy prompt",
      },
      {
        id: "training-group-copy-hidden-variant",
        presetId: "training-group-copy-hidden-preset",
        name: "Training Group Copy Hidden Variant",
        slug: "training-group-copy-hidden-variant",
        prompt: "training group member prompt must not be copied",
      },
    ],
  });
  await prisma.presetGroup.createMany({
    data: [
      {
        id: "ordinary-group-copy-source-group",
        categoryId: "ordinary-group-copy-group-category",
        name: "Ordinary Group Copy Source",
        slug: "ordinary-group-copy-source",
      },
      {
        id: "training-group-copy-hidden-subgroup",
        categoryId: "training-group-copy-hidden-category",
        name: "Training Group Copy Hidden Subgroup",
        slug: "training-group-copy-hidden-subgroup",
      },
    ],
  });
  await prisma.presetGroupMember.createMany({
    data: [
      {
        id: "ordinary-group-copy-member",
        groupId: "ordinary-group-copy-source-group",
        presetId: "ordinary-group-copy-preset",
        variantId: "ordinary-group-copy-variant",
        slotCategoryId: "ordinary-group-copy-preset-category",
        sortOrder: 0,
      },
      {
        id: "training-group-copy-hidden-preset-member",
        groupId: "ordinary-group-copy-source-group",
        presetId: "training-group-copy-hidden-preset",
        variantId: "training-group-copy-hidden-variant",
        slotCategoryId: "training-group-copy-hidden-category",
        sortOrder: 1,
      },
      {
        id: "training-group-copy-hidden-subgroup-member",
        groupId: "ordinary-group-copy-source-group",
        subGroupId: "training-group-copy-hidden-subgroup",
        sortOrder: 2,
      },
    ],
  });

  const copiedGroup = await ignoreStaticRevalidateError(() => copyPresetGroup("ordinary-group-copy-source-group")) ??
    await prisma.presetGroup.findFirstOrThrow({ where: { slug: "ordinary-group-copy-source-copy" } });
  const copiedMembers = await prisma.presetGroupMember.findMany({
    where: { groupId: copiedGroup.id },
    orderBy: { sortOrder: "asc" },
  });

  assert.deepEqual(
    copiedMembers.map((member) => ({
      presetId: member.presetId,
      variantId: member.variantId,
      subGroupId: member.subGroupId,
      slotCategoryId: member.slotCategoryId,
    })),
    [
      {
        presetId: "ordinary-group-copy-preset",
        variantId: "ordinary-group-copy-variant",
        subGroupId: null,
        slotCategoryId: "ordinary-group-copy-preset-category",
      },
    ],
    "ordinary preset group copies must drop training-owned preset and subgroup members",
  );
});

test("ordinary preset group flattening filters LoRA training members", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "ordinary-group-flatten-preset-category",
        name: "Ordinary Group Flatten Presets",
        slug: "ordinary-group-flatten-presets",
        type: "preset",
      },
      {
        id: "ordinary-group-flatten-group-category",
        name: "Ordinary Group Flatten Groups",
        slug: "ordinary-group-flatten-groups",
        type: "group",
      },
      {
        id: "training-group-flatten-hidden-category",
        name: "Training Group Flatten Hidden",
        slug: "training-group-flatten-hidden",
        type: "training_scene_description",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "ordinary-group-flatten-preset",
        categoryId: "ordinary-group-flatten-preset-category",
        name: "Ordinary Group Flatten Preset",
        slug: "ordinary-group-flatten-preset",
      },
      {
        id: "training-group-flatten-hidden-preset",
        categoryId: "training-group-flatten-hidden-category",
        name: "Training Group Flatten Hidden Preset",
        slug: "training-group-flatten-hidden-preset",
      },
      {
        id: "training-group-flatten-subgroup-preset",
        categoryId: "training-group-flatten-hidden-category",
        name: "Training Group Flatten Subgroup Preset",
        slug: "training-group-flatten-subgroup-preset",
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "ordinary-group-flatten-variant",
        presetId: "ordinary-group-flatten-preset",
        name: "Ordinary Flatten Variant",
        slug: "ordinary-flatten-variant",
        prompt: "ordinary group flatten prompt",
      },
      {
        id: "training-group-flatten-hidden-variant",
        presetId: "training-group-flatten-hidden-preset",
        name: "Training Flatten Hidden Variant",
        slug: "training-flatten-hidden-variant",
        prompt: "training group flatten prompt must not leak",
      },
      {
        id: "training-group-flatten-subgroup-variant",
        presetId: "training-group-flatten-subgroup-preset",
        name: "Training Flatten Subgroup Variant",
        slug: "training-flatten-subgroup-variant",
        prompt: "training subgroup prompt must not leak",
      },
    ],
  });
  await prisma.presetGroup.createMany({
    data: [
      {
        id: "ordinary-group-flatten-source-group",
        categoryId: "ordinary-group-flatten-group-category",
        name: "Ordinary Group Flatten Source",
        slug: "ordinary-group-flatten-source",
      },
      {
        id: "training-group-flatten-hidden-subgroup",
        categoryId: "training-group-flatten-hidden-category",
        name: "Training Group Flatten Hidden Subgroup",
        slug: "training-group-flatten-hidden-subgroup",
      },
    ],
  });
  await prisma.presetGroupMember.createMany({
    data: [
      {
        id: "ordinary-group-flatten-member",
        groupId: "ordinary-group-flatten-source-group",
        presetId: "ordinary-group-flatten-preset",
        variantId: "ordinary-group-flatten-variant",
        slotCategoryId: "ordinary-group-flatten-preset-category",
        sortOrder: 0,
      },
      {
        id: "training-group-flatten-hidden-preset-member",
        groupId: "ordinary-group-flatten-source-group",
        presetId: "training-group-flatten-hidden-preset",
        variantId: "training-group-flatten-hidden-variant",
        slotCategoryId: "training-group-flatten-hidden-category",
        sortOrder: 1,
      },
      {
        id: "training-group-flatten-hidden-subgroup-member",
        groupId: "ordinary-group-flatten-source-group",
        subGroupId: "training-group-flatten-hidden-subgroup",
        sortOrder: 2,
      },
      {
        id: "training-group-flatten-subgroup-preset-member",
        groupId: "training-group-flatten-hidden-subgroup",
        presetId: "training-group-flatten-subgroup-preset",
        variantId: "training-group-flatten-subgroup-variant",
        slotCategoryId: "training-group-flatten-hidden-category",
      },
    ],
  });

  const flattened = await flattenGroup("ordinary-group-flatten-source-group");

  assert.deepEqual(
    flattened,
    [{ presetId: "ordinary-group-flatten-preset", variantId: "ordinary-group-flatten-variant" }],
    "ordinary preset group flatten API must not expose training-owned preset or subgroup members",
  );
});

test("ordinary preset group copies do not preserve reserved training temporary members", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "reserved-training-group-copy-preset-category",
        name: "Reserved Training Group Copy Presets",
        slug: "reserved-training-group-copy-presets",
        type: "preset",
      },
      {
        id: "reserved-training-group-copy-group-category",
        name: "Reserved Training Group Copy Groups",
        slug: "reserved-training-group-copy-groups",
        type: "group",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "reserved-training-group-copy-ordinary-preset",
        categoryId: "reserved-training-group-copy-preset-category",
        name: "Reserved Training Group Copy Ordinary Preset",
        slug: "reserved-training-group-copy-ordinary-preset",
      },
      {
        id: "reserved-training-group-copy-hidden-preset",
        categoryId: "reserved-training-group-copy-preset-category",
        name: "Reserved Training Group Copy Hidden Preset",
        slug: "reserved-training-group-copy-hidden-preset",
        notes: JSON.stringify({
          temporary: true,
          purpose: "training_benchmark",
          benchmarkRunId: "benchmark-group-copy-hidden",
        }),
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "reserved-training-group-copy-ordinary-variant",
        presetId: "reserved-training-group-copy-ordinary-preset",
        name: "Ordinary Variant",
        slug: "ordinary-variant",
        prompt: "ordinary group copy prompt",
      },
      {
        id: "reserved-training-group-copy-hidden-variant",
        presetId: "reserved-training-group-copy-hidden-preset",
        name: "Hidden Variant",
        slug: "hidden-variant",
        prompt: "reserved training group copy prompt must not be copied",
      },
    ],
  });
  await prisma.presetGroup.create({
    data: {
      id: "reserved-training-group-copy-source-group",
      categoryId: "reserved-training-group-copy-group-category",
      name: "Reserved Training Group Copy Source",
      slug: "reserved-training-group-copy-source",
    },
  });
  await prisma.presetGroupMember.createMany({
    data: [
      {
        id: "reserved-training-group-copy-ordinary-member",
        groupId: "reserved-training-group-copy-source-group",
        presetId: "reserved-training-group-copy-ordinary-preset",
        variantId: "reserved-training-group-copy-ordinary-variant",
        slotCategoryId: "reserved-training-group-copy-preset-category",
        sortOrder: 0,
      },
      {
        id: "reserved-training-group-copy-hidden-member",
        groupId: "reserved-training-group-copy-source-group",
        presetId: "reserved-training-group-copy-hidden-preset",
        variantId: "reserved-training-group-copy-hidden-variant",
        slotCategoryId: "reserved-training-group-copy-preset-category",
        sortOrder: 1,
      },
    ],
  });

  const copiedGroup = await ignoreStaticRevalidateError(() => copyPresetGroup("reserved-training-group-copy-source-group")) ??
    await prisma.presetGroup.findFirstOrThrow({ where: { slug: "reserved-training-group-copy-source-copy" } });
  const copiedMembers = await prisma.presetGroupMember.findMany({
    where: { groupId: copiedGroup.id },
    orderBy: { sortOrder: "asc" },
  });

  assert.deepEqual(
    copiedMembers.map((member) => ({
      presetId: member.presetId,
      variantId: member.variantId,
    })),
    [
      {
        presetId: "reserved-training-group-copy-ordinary-preset",
        variantId: "reserved-training-group-copy-ordinary-variant",
      },
    ],
    "ordinary preset group copies must drop reserved training temporary preset members",
  );
});

test("ordinary preset group member mutations reject reserved training temporary members", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "reserved-training-group-member-mutation-preset-category",
        name: "Reserved Training Group Member Mutation Presets",
        slug: "reserved-training-group-member-mutation-presets",
        type: "preset",
      },
      {
        id: "reserved-training-group-member-mutation-group-category",
        name: "Reserved Training Group Member Mutation Groups",
        slug: "reserved-training-group-member-mutation-groups",
        type: "group",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: "reserved-training-group-member-mutation-ordinary-preset",
        categoryId: "reserved-training-group-member-mutation-preset-category",
        name: "Ordinary Mutation Preset",
        slug: "ordinary-mutation-preset",
      },
      {
        id: "reserved-training-group-member-mutation-hidden-preset",
        categoryId: "reserved-training-group-member-mutation-preset-category",
        name: "Hidden Training Mutation Preset",
        slug: "hidden-training-mutation-preset",
        notes: JSON.stringify({
          temporary: true,
          purpose: "training_benchmark",
          benchmarkRunId: "benchmark-member-mutation-hidden",
        }),
      },
    ],
  });
  await prisma.presetVariant.createMany({
    data: [
      {
        id: "reserved-training-group-member-mutation-ordinary-variant",
        presetId: "reserved-training-group-member-mutation-ordinary-preset",
        name: "Ordinary Mutation Variant",
        slug: "ordinary-mutation-variant",
        prompt: "ordinary member mutation prompt",
      },
      {
        id: "reserved-training-group-member-mutation-hidden-variant",
        presetId: "reserved-training-group-member-mutation-hidden-preset",
        name: "Hidden Training Mutation Variant",
        slug: "hidden-training-mutation-variant",
        prompt: "hidden training member mutation prompt must not be mutable",
      },
    ],
  });
  await prisma.presetGroup.create({
    data: {
      id: "reserved-training-group-member-mutation-group",
      categoryId: "reserved-training-group-member-mutation-group-category",
      name: "Reserved Training Member Mutation Group",
      slug: "reserved-training-member-mutation-group",
    },
  });
  await prisma.presetGroupMember.createMany({
    data: [
      {
        id: "reserved-training-group-member-mutation-update-member",
        groupId: "reserved-training-group-member-mutation-group",
        presetId: "reserved-training-group-member-mutation-hidden-preset",
        variantId: "reserved-training-group-member-mutation-hidden-variant",
        slotCategoryId: "reserved-training-group-member-mutation-preset-category",
        sortOrder: 0,
      },
      {
        id: "reserved-training-group-member-mutation-remove-member",
        groupId: "reserved-training-group-member-mutation-group",
        presetId: "reserved-training-group-member-mutation-hidden-preset",
        variantId: "reserved-training-group-member-mutation-hidden-variant",
        slotCategoryId: "reserved-training-group-member-mutation-preset-category",
        sortOrder: 1,
      },
    ],
  });

  let updateError: unknown;
  try {
    await ignoreStaticRevalidateError(() =>
      updateGroupMember("reserved-training-group-member-mutation-update-member", {
        presetId: "reserved-training-group-member-mutation-ordinary-preset",
        variantId: "reserved-training-group-member-mutation-ordinary-variant",
      }),
    );
  } catch (error) {
    updateError = error;
  }
  assert.deepEqual(
    await prisma.presetGroupMember.findUnique({
      where: { id: "reserved-training-group-member-mutation-update-member" },
      select: { presetId: true, variantId: true },
    }),
    {
      presetId: "reserved-training-group-member-mutation-hidden-preset",
      variantId: "reserved-training-group-member-mutation-hidden-variant",
    },
    "ordinary preset group member replacement must leave hidden training members unchanged",
  );
  assert.match(String(updateError), /ordinary preset group member/i);

  let removeError: unknown;
  try {
    await ignoreStaticRevalidateError(() =>
      removeGroupMember("reserved-training-group-member-mutation-remove-member"),
    );
  } catch (error) {
    removeError = error;
  }
  assert.notEqual(
    await prisma.presetGroupMember.findUnique({
      where: { id: "reserved-training-group-member-mutation-remove-member" },
      select: { id: true },
    }),
    null,
    "ordinary preset group member deletion must not remove hidden training members",
  );
  assert.match(String(removeError), /ordinary preset group member/i);
});

test("training preset creation never writes through ordinary generation preset tables", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "shared-name-ordinary-category",
      name: "Shared Scene",
      slug: "shared-scene",
      type: "preset",
    },
  });
  const ordinaryPresetCountBefore = await prisma.preset.count();
  const ordinaryCategoryCountBefore = await prisma.presetCategory.count();

  const created = await createTrainingSceneDescriptionPreset({
    category: "Shared Scene",
    folder: "Training Folder",
    sceneDescriptionText: "训练场景描述。",
    title: "Training Scene Preset",
  });

  assert.equal(created.category, "Shared Scene");
  assert.equal(created.sceneDescriptionText, "训练场景描述。");
  assert.equal(
    await prisma.preset.findUnique({ where: { id: created.id } }),
    null,
    "training scene-description preset creation must not write into ordinary generation Preset rows",
  );
  assert.equal(
    await prisma.preset.count(),
    ordinaryPresetCountBefore,
    "training scene-description preset creation must not add ordinary generation presets",
  );
  assert.equal(
    await prisma.presetCategory.count(),
    ordinaryCategoryCountBefore,
    "training scene-description preset creation must not add ordinary generation categories",
  );
  assert.equal(
    (await prisma.presetCategory.findUniqueOrThrow({ where: { id: "shared-name-ordinary-category" } })).type,
    "preset",
  );
});

test("ordinary preset usage hides LoRA training-owned project and template bindings", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "ordinary-usage-boundary-category",
      name: "Ordinary Usage Boundary",
      slug: "ordinary-usage-boundary",
      type: "preset",
    },
  });
  await prisma.preset.create({
    data: {
      id: "ordinary-usage-boundary-preset",
      categoryId: "ordinary-usage-boundary-category",
      name: "Ordinary Usage Boundary Preset",
      slug: "ordinary-usage-boundary-preset",
    },
  });
  await prisma.project.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-project",
        title: "Ordinary Usage Project",
        slug: "ordinary-usage-boundary-project",
      },
      {
        id: "training-usage-boundary-project",
        title: "Training Usage Project",
        slug: "training-usage-boundary-project",
        notes: JSON.stringify({ temporary: true, purpose: "training_benchmark" }),
      },
    ],
  });
  await prisma.projectSection.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-section",
        projectId: "ordinary-usage-boundary-project",
        name: "Ordinary Section",
      },
      {
        id: "training-usage-boundary-section",
        projectId: "training-usage-boundary-project",
        name: "Training Section",
      },
    ],
  });
  await prisma.projectTemplate.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-template",
        name: "Ordinary Usage Template",
      },
      {
        id: "training-usage-boundary-template",
        name: "训练测试 Usage Template",
        description: "Default ProjectTemplate reserved for training benchmark evidence. Usage template",
      },
    ],
  });
  await prisma.projectTemplateSection.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-template-section",
        projectTemplateId: "ordinary-usage-boundary-template",
        name: "Ordinary Template Section",
      },
      {
        id: "training-usage-boundary-template-section",
        projectTemplateId: "training-usage-boundary-template",
        name: "Training Template Section",
      },
    ],
  });
  await prisma.sectionPresetBinding.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-section-binding",
        projectSectionId: "ordinary-usage-boundary-section",
        bindingKey: "ordinary-section",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
      {
        id: "training-usage-boundary-section-binding",
        projectSectionId: "training-usage-boundary-section",
        bindingKey: "training-section",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
    ],
  });
  await prisma.templateSectionPresetBinding.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-template-section-binding",
        projectTemplateSectionId: "ordinary-usage-boundary-template-section",
        bindingKey: "ordinary-template-section",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
      {
        id: "training-usage-boundary-template-section-binding",
        projectTemplateSectionId: "training-usage-boundary-template-section",
        bindingKey: "training-template-section",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
    ],
  });
  await prisma.projectPresetBinding.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-project-binding",
        projectId: "ordinary-usage-boundary-project",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
      {
        id: "training-usage-boundary-project-binding",
        projectId: "training-usage-boundary-project",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
    ],
  });
  await prisma.projectTemplatePresetBinding.createMany({
    data: [
      {
        id: "ordinary-usage-boundary-project-template-binding",
        projectTemplateId: "ordinary-usage-boundary-template",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
      {
        id: "training-usage-boundary-project-template-binding",
        projectTemplateId: "training-usage-boundary-template",
        categoryId: "ordinary-usage-boundary-category",
        presetId: "ordinary-usage-boundary-preset",
      },
    ],
  });

  const usage = await getPresetUsage("ordinary-usage-boundary-preset");

  assert.deepEqual(
    usage.sections
      .map((section) => ({ id: section.sectionId, title: section.projectTitle }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    [
      { id: "ordinary-usage-boundary-section", title: "Ordinary Usage Project" },
      { id: "project-template:ordinary-usage-boundary-template", title: "模板：Ordinary Usage Template" },
      { id: "project:ordinary-usage-boundary-project", title: "Ordinary Usage Project" },
      {
        id: "template-section:ordinary-usage-boundary-template-section",
        title: "模板：Ordinary Usage Template",
      },
    ].sort((a, b) => a.id.localeCompare(b.id)),
    "ordinary preset usage must not expose training-owned projects or templates that share the same preset id",
  );
  assert.equal(usage.totalBlocks, 4);
});

test("ordinary preset cascade delete leaves LoRA training-owned bindings intact", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "ordinary-cascade-boundary-category",
      name: "Ordinary Cascade Boundary",
      slug: "ordinary-cascade-boundary",
      type: "preset",
    },
  });
  await prisma.preset.create({
    data: {
      id: "ordinary-cascade-boundary-preset",
      categoryId: "ordinary-cascade-boundary-category",
      name: "Ordinary Cascade Boundary Preset",
      slug: "ordinary-cascade-boundary-preset",
    },
  });
  await prisma.project.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-project",
        title: "Ordinary Cascade Project",
        slug: "ordinary-cascade-boundary-project",
      },
      {
        id: "training-cascade-boundary-project",
        title: "Training Cascade Project",
        slug: "training-cascade-boundary-project",
        notes: JSON.stringify({ temporary: true, purpose: "training_benchmark" }),
      },
    ],
  });
  await prisma.projectSection.createMany({
    data: [
      { id: "ordinary-cascade-boundary-section", projectId: "ordinary-cascade-boundary-project" },
      { id: "training-cascade-boundary-section", projectId: "training-cascade-boundary-project" },
    ],
  });
  await prisma.projectTemplate.createMany({
    data: [
      { id: "ordinary-cascade-boundary-template", name: "Ordinary Cascade Template" },
      {
        id: "training-cascade-boundary-template",
        name: "训练测试 Cascade Template",
        description: "Default ProjectTemplate reserved for training benchmark evidence. Cascade template",
      },
    ],
  });
  await prisma.projectTemplateSection.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-template-section",
        projectTemplateId: "ordinary-cascade-boundary-template",
      },
      {
        id: "training-cascade-boundary-template-section",
        projectTemplateId: "training-cascade-boundary-template",
      },
    ],
  });
  await prisma.sectionPresetBinding.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-section-binding",
        projectSectionId: "ordinary-cascade-boundary-section",
        bindingKey: "ordinary-section",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
      {
        id: "training-cascade-boundary-section-binding",
        projectSectionId: "training-cascade-boundary-section",
        bindingKey: "training-section",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
    ],
  });
  await prisma.templateSectionPresetBinding.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-template-section-binding",
        projectTemplateSectionId: "ordinary-cascade-boundary-template-section",
        bindingKey: "ordinary-template-section",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
      {
        id: "training-cascade-boundary-template-section-binding",
        projectTemplateSectionId: "training-cascade-boundary-template-section",
        bindingKey: "training-template-section",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
    ],
  });
  await prisma.sectionPromptBlock.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-section-block",
        projectSectionId: "ordinary-cascade-boundary-section",
        sectionBindingId: "ordinary-cascade-boundary-section-binding",
      },
      {
        id: "training-cascade-boundary-section-block",
        projectSectionId: "training-cascade-boundary-section",
        sectionBindingId: "training-cascade-boundary-section-binding",
      },
    ],
  });
  await prisma.templateSectionPromptBlock.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-template-section-block",
        projectTemplateSectionId: "ordinary-cascade-boundary-template-section",
        templateSectionBindingId: "ordinary-cascade-boundary-template-section-binding",
      },
      {
        id: "training-cascade-boundary-template-section-block",
        projectTemplateSectionId: "training-cascade-boundary-template-section",
        templateSectionBindingId: "training-cascade-boundary-template-section-binding",
      },
    ],
  });
  await prisma.projectPresetBinding.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-project-binding",
        projectId: "ordinary-cascade-boundary-project",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
      {
        id: "training-cascade-boundary-project-binding",
        projectId: "training-cascade-boundary-project",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
    ],
  });
  await prisma.projectTemplatePresetBinding.createMany({
    data: [
      {
        id: "ordinary-cascade-boundary-project-template-binding",
        projectTemplateId: "ordinary-cascade-boundary-template",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
      {
        id: "training-cascade-boundary-project-template-binding",
        projectTemplateId: "training-cascade-boundary-template",
        categoryId: "ordinary-cascade-boundary-category",
        presetId: "ordinary-cascade-boundary-preset",
      },
    ],
  });

  await ignoreStaticRevalidateError(() => deletePresetCascade("ordinary-cascade-boundary-preset"));

  assert.equal(
    await prisma.sectionPresetBinding.count({ where: { id: "ordinary-cascade-boundary-section-binding" } }),
    0,
  );
  assert.equal(
    await prisma.templateSectionPresetBinding.count({
      where: { id: "ordinary-cascade-boundary-template-section-binding" },
    }),
    0,
  );
  assert.equal(
    await prisma.projectPresetBinding.count({ where: { id: "ordinary-cascade-boundary-project-binding" } }),
    0,
  );
  assert.equal(
    await prisma.projectTemplatePresetBinding.count({
      where: { id: "ordinary-cascade-boundary-project-template-binding" },
    }),
    0,
  );
  assert.equal(
    await prisma.sectionPresetBinding.count({ where: { id: "training-cascade-boundary-section-binding" } }),
    1,
    "ordinary preset cascade must not delete section bindings from training-owned projects",
  );
  assert.equal(
    await prisma.templateSectionPresetBinding.count({
      where: { id: "training-cascade-boundary-template-section-binding" },
    }),
    1,
    "ordinary preset cascade must not delete section bindings from training-owned templates",
  );
  assert.equal(
    await prisma.projectPresetBinding.count({ where: { id: "training-cascade-boundary-project-binding" } }),
    1,
    "ordinary preset cascade must not delete project-level bindings from training-owned projects",
  );
  assert.equal(
    await prisma.projectTemplatePresetBinding.count({
      where: { id: "training-cascade-boundary-project-template-binding" },
    }),
    1,
    "ordinary preset cascade must not delete template-level bindings from training-owned templates",
  );
  assert.equal(
    await prisma.sectionPromptBlock.count({ where: { id: "training-cascade-boundary-section-block" } }),
    1,
    "ordinary preset cascade must leave training-owned section prompt blocks intact",
  );
  assert.equal(
    await prisma.templateSectionPromptBlock.count({
      where: { id: "training-cascade-boundary-template-section-block" },
    }),
    1,
    "ordinary preset cascade must leave training-owned template prompt blocks intact",
  );
});

test("ordinary preset sync rejects LoRA training preset ids", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "training-sync-hidden-category",
      name: "Training Sync Hidden",
      slug: "training-sync-hidden",
      type: "training_scene_description",
    },
  });
  await prisma.preset.create({
    data: {
      id: "training-sync-hidden-preset",
      categoryId: "training-sync-hidden-category",
      name: "Training Sync Hidden Preset",
      slug: "training-sync-hidden-preset",
    },
  });

  await assert.rejects(
    () => ignoreStaticRevalidateError(() => syncPresetToSections("training-sync-hidden-preset")),
    /Ordinary preset not found/i,
    "ordinary preset sync must reject training-owned preset ids instead of returning success",
  );
});

test("ordinary preset sync rejects reserved training temporary preset ids", async () => {
  await prisma.presetCategory.create({
    data: {
      id: "reserved-training-sync-category",
      name: "Reserved Training Sync",
      slug: "reserved-training-sync",
      type: "preset",
    },
  });
  await prisma.preset.create({
    data: {
      id: "reserved-training-sync-hidden-preset",
      categoryId: "reserved-training-sync-category",
      name: "Reserved Training Sync Hidden Preset",
      slug: "reserved-training-sync-hidden-preset",
      notes: JSON.stringify({
        temporary: true,
        purpose: "training_benchmark",
        benchmarkRunId: "benchmark-sync-hidden",
      }),
    },
  });

  await assert.rejects(
    () => ignoreStaticRevalidateError(() => syncPresetToSections("reserved-training-sync-hidden-preset")),
    /Ordinary preset not found/i,
    "ordinary preset sync must reject reserved training temporary preset ids instead of returning success",
  );
});

test("ordinary preset group resolver treats reserved training temporary members as out of scope", async () => {
  await prisma.presetCategory.createMany({
    data: [
      {
        id: "reserved-training-group-resolver-category",
        name: "Reserved Training Resolver Groups",
        slug: "reserved-training-resolver-groups",
        type: "group",
      },
      {
        id: "reserved-training-group-resolver-preset-category",
        name: "Reserved Training Resolver Presets",
        slug: "reserved-training-resolver-presets",
        type: "preset",
      },
    ],
  });
  await prisma.presetGroup.create({
    data: {
      id: "reserved-training-group-resolver-source-group",
      categoryId: "reserved-training-group-resolver-category",
      name: "Reserved Training Resolver Source Group",
      slug: "reserved-training-resolver-source-group",
    },
  });
  await prisma.preset.create({
    data: {
      id: "reserved-training-group-resolver-hidden-preset",
      categoryId: "reserved-training-group-resolver-preset-category",
      name: "Reserved Training Resolver Hidden Preset",
      slug: "reserved-training-resolver-hidden-preset",
      notes: JSON.stringify({
        temporary: true,
        purpose: "training_benchmark",
        benchmarkRunId: "benchmark-group-resolver-hidden",
      }),
    },
  });
  await prisma.presetVariant.create({
    data: {
      id: "reserved-training-group-resolver-hidden-variant",
      presetId: "reserved-training-group-resolver-hidden-preset",
      name: "Hidden Variant",
      slug: "hidden-variant",
      prompt: "reserved training group resolver prompt must not leak",
    },
  });
  await prisma.presetGroupMember.create({
    data: {
      id: "reserved-training-group-resolver-hidden-member",
      groupId: "reserved-training-group-resolver-source-group",
      presetId: "reserved-training-group-resolver-hidden-preset",
      variantId: "reserved-training-group-resolver-hidden-variant",
      slotCategoryId: "reserved-training-group-resolver-preset-category",
    },
  });

  const resolved = await resolvePresetGroupContent(
    "reserved-training-group-resolver-source-group",
    prisma as unknown as PresetGroupResolver.PresetGroupResolverDbClient,
  );

  assert.deepEqual(
    resolved?.members.map((member) => member.presetId),
    [],
    "ordinary preset group resolver must not expose reserved training temporary preset members",
  );
  assert.equal(resolved?.prompt, "");
  assert.deepEqual(
    resolved?.missingReferences.map((reference) => ({ kind: reference.kind, id: reference.id })),
    [{ kind: "preset", id: "reserved-training-group-resolver-hidden-preset" }],
  );
});
