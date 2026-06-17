import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import Database from "better-sqlite3";

process.env.DB_PROVIDER = "sqlite";

const tempDir = mkdtempSync(path.join(tmpdir(), "training-preset-prisma-runtime-"));
const dbPath = path.join(tempDir, "training-preset-prisma-runtime.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const setupDb = new Database(dbPath);
setupDb.exec(`
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
setupDb.close();

after(async () => {
  const { prisma } = await import("../src/lib/prisma");
  await prisma.$disconnect();
  await rm(tempDir, { force: true, recursive: true });
});

test("training scene preset CRUD, cascade, sort, categories, and folders use Prisma tables", async () => {
  const {
    cascadeDeleteTrainingSceneDescriptionPreset,
    createTrainingSceneDescriptionCategory,
    createTrainingSceneDescriptionFolder,
    createTrainingSceneDescriptionPreset,
    deleteTrainingSceneDescriptionCategory,
    deleteTrainingSceneDescriptionFolder,
    getTrainingSceneDescriptionPreset,
    listTrainingSceneDescriptionPresets,
    listTrainingSceneDescriptionTree,
    saveTrainingSceneDescriptionPresetSortRules,
    updateTrainingSceneDescriptionCategory,
    updateTrainingSceneDescriptionFolder,
    updateTrainingSceneDescriptionPreset,
  } = await import("../src/server/services/training/preset-service");

  const seededPresets = await listTrainingSceneDescriptionPresets();
  assert.ok(
    seededPresets.some((preset) => preset.id === "rainy-street"),
    "default training presets should be seeded into TrainingSceneDescriptionPreset rows",
  );

  const suffix = Date.now();
  const category = await createTrainingSceneDescriptionCategory({
    name: `Runtime Category ${suffix}`,
    slug: `runtime-category-${suffix}`,
    sortOrder: 101,
    sceneDescriptionOrder: 41,
  });
  const updatedCategory = await updateTrainingSceneDescriptionCategory(category.id, {
    name: `Runtime Category Updated ${suffix}`,
    sceneDescriptionOrder: 42,
  });
  assert.equal(updatedCategory.sceneDescriptionOrder, 42);

  const folder = await createTrainingSceneDescriptionFolder({
    categoryId: category.id,
    name: `Runtime Folder ${suffix}`,
    sortOrder: 5,
  });
  const updatedFolder = await updateTrainingSceneDescriptionFolder(folder.id, {
    name: `Runtime Folder Updated ${suffix}`,
    sortOrder: 6,
  });
  assert.equal(updatedFolder.sortOrder, 6);

  const createdPreset = await createTrainingSceneDescriptionPreset({
    category: updatedCategory.name,
    folder: updatedFolder.name,
    sceneDescriptionText: "Runtime scene description from Prisma.",
    title: `Runtime Preset ${suffix}`,
  });
  assert.equal(createdPreset.category, updatedCategory.name);
  assert.equal(createdPreset.folder, updatedFolder.name);

  const listedPresets = await listTrainingSceneDescriptionPresets();
  assert.ok(listedPresets.some((preset) => preset.id === createdPreset.id));

  const tree = await listTrainingSceneDescriptionTree({ includeInactive: true });
  assert.ok(tree.categories.some((treeCategory) =>
    treeCategory.id === category.id
    && treeCategory.folders.some((treeFolder) =>
      treeFolder.id === folder.id
      && treeFolder.presets.some((preset) => preset.id === createdPreset.id),
    ),
  ));

  const fetchedPreset = await getTrainingSceneDescriptionPreset(createdPreset.id);
  assert.equal(fetchedPreset.sceneDescriptionText, "Runtime scene description from Prisma.");

  const updatedPreset = await updateTrainingSceneDescriptionPreset(createdPreset.id, {
    category: updatedCategory.name,
    folder: updatedFolder.name,
    sceneDescriptionText: "Runtime scene description updated through Prisma.",
    title: `Runtime Preset Updated ${suffix}`,
  });
  assert.equal(updatedPreset.title, `Runtime Preset Updated ${suffix}`);
  assert.equal(updatedPreset.sceneDescriptionText, "Runtime scene description updated through Prisma.");

  const sortResult = await saveTrainingSceneDescriptionPresetSortRules({
    categoryOrder: [updatedCategory.name],
    presetOrder: [createdPreset.id],
  });
  assert.deepEqual(sortResult, {
    categoryOrder: [updatedCategory.name],
    presetOrder: [createdPreset.id],
  });

  const cascadeResult = await cascadeDeleteTrainingSceneDescriptionPreset(createdPreset.id, {
    confirm: true,
  });
  assert.equal(cascadeResult.success, true);
  assert.equal(cascadeResult.presetId, createdPreset.id);

  assert.deepEqual(await deleteTrainingSceneDescriptionFolder(folder.id), { success: true });
  assert.deepEqual(await deleteTrainingSceneDescriptionCategory(category.id), { success: true });
});
