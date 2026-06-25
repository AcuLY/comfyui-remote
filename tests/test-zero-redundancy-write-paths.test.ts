import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import type { prisma as PrismaClientSingleton } from "../src/lib/prisma";
import type * as PromptBlockActions from "../src/lib/actions/prompt-block";
import type * as SectionActions from "../src/lib/actions/section";
import type * as PromptBlockService from "../src/server/services/prompt-block-service";
import type * as TemplateImportActions from "../src/lib/actions/template-import";
import type * as TemplateCrudActions from "../src/lib/actions/template-crud";
import type * as TemplateSaveActions from "../src/lib/actions/template-save";
import type * as ProjectActions from "../src/lib/actions/project";
import type * as ProjectRepository from "../src/server/repositories/project-repository";
import type * as ProjectService from "../src/server/services/project-service";
import type * as ProjectViewRepository from "../src/server/repositories/project-view-repository";
import type * as QueueDataRepository from "../src/server/repositories/queue-data-repository";
import type * as TemplateViewRepository from "../src/server/repositories/template-view-repository";

process.env.DB_PROVIDER = "sqlite";

const tempDir = mkdtempSync(path.join(tmpdir(), "zero-redundancy-write-paths-"));
const dbPath = path.join(tempDir, "write-paths.db");
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
  CREATE UNIQUE INDEX "ProjectTemplatePresetBinding_projectTemplateId_categoryId_key" ON "ProjectTemplatePresetBinding"("projectTemplateId", "categoryId");
  CREATE TABLE "ProjectTemplateSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateId" TEXT NOT NULL,
    "folderId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "notes" TEXT,
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
    "loraConfig" JSONB,
    "extraParams" JSONB,
    "promptBlocks" JSONB
  );
  CREATE TABLE "ProjectTemplateSectionFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectTemplateId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
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
  CREATE UNIQUE INDEX "TemplateSectionPresetBinding_projectTemplateSectionId_bindingKey_key" ON "TemplateSectionPresetBinding"("projectTemplateSectionId", "bindingKey");
  CREATE UNIQUE INDEX "TemplateSectionPresetBinding_projectTemplateSectionId_id_key" ON "TemplateSectionPresetBinding"("projectTemplateSectionId", "id");
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
  CREATE TABLE "ProjectSectionFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
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
    "loraConfig" JSONB,
    "extraParams" JSONB,
    "latestRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "projectSectionId" TEXT NOT NULL,
    "runIndex" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resolvedConfigSnapshot" JSONB NOT NULL DEFAULT '{}',
    "comfyPromptId" TEXT,
    "executionMeta" JSONB,
    "submittedPrompt" JSONB,
    "outputDir" TEXT,
    "comfyOutputSubfolder" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "ImageResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL UNIQUE,
    "thumbPath" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" BIGINT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featured2" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "censoredFilePath" TEXT,
    "censoredThumbPath" TEXT,
    "censoredAt" DATETIME
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
  CREATE TABLE "SectionChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectSectionId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
setupDb.close();

let prisma: typeof PrismaClientSingleton;
let importPresetToSection: typeof PromptBlockActions.importPresetToSection;
let importPresetGroupToSection: typeof PromptBlockActions.importPresetGroupToSection;
let removeImportedPresetFromSection: typeof PromptBlockActions.removeImportedPresetFromSection;
let switchBindingVariant: typeof PromptBlockActions.switchBindingVariant;
let updateSectionBlock: typeof PromptBlockActions.updateSectionBlock;
let deleteSectionBlock: typeof PromptBlockActions.deleteSectionBlock;
let addSection: typeof SectionActions.addSection;
let copySection: typeof SectionActions.copySection;
let addPromptBlock: typeof PromptBlockService.addPromptBlock;
let editPromptBlock: typeof PromptBlockService.editPromptBlock;
let removePromptBlock: typeof PromptBlockService.removePromptBlock;
let setPromptBlockOrder: typeof PromptBlockService.setPromptBlockOrder;
let importTemplateToProject: typeof TemplateImportActions.importTemplateToProject;
let createProjectTemplate: typeof TemplateCrudActions.createProjectTemplate;
let updateProjectTemplate: typeof TemplateCrudActions.updateProjectTemplate;
let updateProjectTemplateSection: typeof TemplateCrudActions.updateProjectTemplateSection;
let deleteProjectTemplate: typeof TemplateCrudActions.deleteProjectTemplate;
let deleteProjectTemplateSection: typeof TemplateCrudActions.deleteProjectTemplateSection;
let copyProjectTemplateSection: typeof TemplateCrudActions.copyProjectTemplateSection;
let saveProjectAsTemplate: typeof TemplateSaveActions.saveProjectAsTemplate;
let createProject: typeof ProjectActions.createProject;
let updateProject: typeof ProjectActions.updateProject;
let copyProject: typeof ProjectActions.copyProject;
let applyParamToAllSections: typeof ProjectActions.applyParamToAllSections;
let createProjectForApi: typeof ProjectService.createProject;
let updateProjectSectionForApi: typeof ProjectService.updateProjectSection;
let listProjects: typeof ProjectViewRepository.listProjects;
let listProjectsForApi: typeof ProjectRepository.listProjects;
let listProjectTemplates: typeof TemplateViewRepository.listProjectTemplates;
let getProjectTemplateDetail: typeof TemplateViewRepository.getProjectTemplateDetail;
let getReviewGroupIds: typeof QueueDataRepository.getReviewGroupIds;
let getRunningRuns: typeof QueueDataRepository.getRunningRuns;
let getFailedRuns: typeof QueueDataRepository.getFailedRuns;

let sequence = 0;

type SeedOptions = {
  withProjectBinding?: boolean;
};

test.before(async () => {
  const prismaModule = await import("../src/lib/prisma");
  const promptBlockActions = await import("../src/lib/actions/prompt-block");
  const sectionActions = await import("../src/lib/actions/section");
  const promptBlockService = await import("../src/server/services/prompt-block-service");
  const templateImportActions = await import("../src/lib/actions/template-import");
  const templateCrudActions = await import("../src/lib/actions/template-crud");
  const templateSaveActions = await import("../src/lib/actions/template-save");
  const projectActions = await import("../src/lib/actions/project");
  const projectService = await import("../src/server/services/project-service");
  const projectRepository = await import("../src/server/repositories/project-repository");
  const projectViewRepository = await import("../src/server/repositories/project-view-repository");
  const queueDataRepository = await import("../src/server/repositories/queue-data-repository");
  const templateViewRepository = await import("../src/server/repositories/template-view-repository");

  prisma = prismaModule.prisma;
  importPresetToSection = promptBlockActions.importPresetToSection;
  importPresetGroupToSection = promptBlockActions.importPresetGroupToSection;
  removeImportedPresetFromSection = promptBlockActions.removeImportedPresetFromSection;
  switchBindingVariant = promptBlockActions.switchBindingVariant;
  updateSectionBlock = promptBlockActions.updateSectionBlock;
  deleteSectionBlock = promptBlockActions.deleteSectionBlock;
  addSection = sectionActions.addSection;
  copySection = sectionActions.copySection;
  addPromptBlock = promptBlockService.addPromptBlock;
  editPromptBlock = promptBlockService.editPromptBlock;
  removePromptBlock = promptBlockService.removePromptBlock;
  setPromptBlockOrder = promptBlockService.setPromptBlockOrder;
  importTemplateToProject = templateImportActions.importTemplateToProject;
  createProjectTemplate = templateCrudActions.createProjectTemplate;
  updateProjectTemplate = templateCrudActions.updateProjectTemplate;
  updateProjectTemplateSection = templateCrudActions.updateProjectTemplateSection;
  deleteProjectTemplate = templateCrudActions.deleteProjectTemplate;
  deleteProjectTemplateSection = templateCrudActions.deleteProjectTemplateSection;
  copyProjectTemplateSection = templateCrudActions.copyProjectTemplateSection;
  saveProjectAsTemplate = templateSaveActions.saveProjectAsTemplate;
  createProject = projectActions.createProject;
  updateProject = projectActions.updateProject;
  copyProject = projectActions.copyProject;
  applyParamToAllSections = projectActions.applyParamToAllSections;
  createProjectForApi = projectService.createProject;
  updateProjectSectionForApi = projectService.updateProjectSection;
  listProjects = projectViewRepository.listProjects;
  listProjectsForApi = projectRepository.listProjects;
  listProjectTemplates = templateViewRepository.listProjectTemplates;
  getProjectTemplateDetail = templateViewRepository.getProjectTemplateDetail;
  getReviewGroupIds = queueDataRepository.getReviewGroupIds;
  getRunningRuns = queueDataRepository.getRunningRuns;
  getFailedRuns = queueDataRepository.getFailedRuns;
});

async function seedProjectWithPreset(options: SeedOptions = {}) {
  sequence += 1;
  const key = `zrw-${sequence}`;
  const category = await prisma.presetCategory.create({
    data: {
      id: `${key}-category`,
      name: `${key} Category`,
      slug: `${key}-category`,
      positivePromptOrder: 10,
      lora1Order: 20,
      lora2Order: 30,
    },
  });
  const preset = await prisma.preset.create({
    data: {
      id: `${key}-preset`,
      categoryId: category.id,
      name: `${key} Preset`,
      slug: `${key}-preset`,
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
  const project = await prisma.project.create({
    data: {
      id: `${key}-project`,
      title: `${key} Project`,
      slug: `${key}-project`,
      status: "draft",
      checkpointName: `${key}.ckpt`,
      projectLevelOverrides: {
        defaultAspectRatio: "1:1",
        defaultShortSidePx: 512,
        defaultBatchSize: 2,
      },
    },
  });
  if (options.withProjectBinding) {
    await prisma.projectPresetBinding.create({
      data: {
        projectId: project.id,
        categoryId: category.id,
        presetId: preset.id,
        variantId: variantA.id,
        sortOrder: 0,
      },
    });
  }
  const section = await prisma.projectSection.create({
    data: {
      id: `${key}-section`,
      projectId: project.id,
      name: `${key} Section`,
      sortOrder: 1,
      enabled: true,
    },
  });

  return { key, category, preset, variantA, variantB, project, section };
}

test("generation project and template lists hide reserved training temporary resources", async () => {
  const key = `zrw-benchmark-boundary-${++sequence}`;
  const benchmarkNotes = JSON.stringify({
    temporary: true,
    purpose: "training_benchmark",
    benchmarkRunId: `${key}-run`,
  }, null, 2);

  await prisma.project.createMany({
    data: [
      {
        id: `${key}-visible-project`,
        title: `${key} Visible Project`,
        slug: `${key}-visible-project`,
        status: "draft",
      },
      {
        id: `${key}-hidden-project`,
        title: `${key} Hidden Benchmark Project`,
        slug: `${key}-hidden-project`,
        status: "draft",
        notes: benchmarkNotes,
      },
    ],
  });
  await prisma.projectTemplate.createMany({
    data: [
      {
        id: `${key}-visible-template`,
        name: `${key} Visible Template`,
        description: "Ordinary generation project template",
      },
      {
        id: `${key}-hidden-template`,
        name: "训练测试",
        description: "Default ProjectTemplate reserved for training benchmark evidence.",
      },
    ],
  });

  const projectIds = (await listProjects()).map((project) => project.id);
  assert.equal(
    projectIds.includes(`${key}-visible-project`),
    true,
    "generation project list should still include ordinary generation projects",
  );
  assert.equal(
    projectIds.includes(`${key}-hidden-project`),
    false,
    "generation project list must hide reserved training temporary projects",
  );
  const apiProjectIds = (await listProjectsForApi()).map((project) => project.id);
  assert.equal(
    apiProjectIds.includes(`${key}-visible-project`),
    true,
    "generation project API list should still include ordinary generation projects",
  );
  assert.equal(
    apiProjectIds.includes(`${key}-hidden-project`),
    false,
    "generation project API list must hide reserved training temporary projects",
  );

  const templateIds = (await listProjectTemplates()).map((template) => template.id);
  assert.equal(
    templateIds.includes(`${key}-visible-template`),
    true,
    "generation template list should still include ordinary generation templates",
  );
  assert.equal(
    templateIds.includes(`${key}-hidden-template`),
    false,
    "generation template list must hide reserved training templates stored in ProjectTemplate",
  );
  assert.equal(
    await getProjectTemplateDetail(`${key}-hidden-template`),
    null,
    "generation template detail must not expose a reserved training template by direct id",
  );
});

test("generation project and run preset summaries hide training-owned presets", async () => {
  const key = `zrw-summary-boundary-${++sequence}`;

  await prisma.presetCategory.createMany({
    data: [
      {
        id: `${key}-ordinary-category`,
        name: `${key} Ordinary Category`,
        slug: `${key}-ordinary-category`,
        type: "preset",
      },
      {
        id: `${key}-training-category`,
        name: `${key} Training Category`,
        slug: `${key}-training-category`,
        type: "training_scene_description",
      },
    ],
  });
  await prisma.preset.createMany({
    data: [
      {
        id: `${key}-ordinary-preset`,
        categoryId: `${key}-ordinary-category`,
        name: `${key} Ordinary Preset`,
        slug: `${key}-ordinary-preset`,
      },
      {
        id: `${key}-training-preset`,
        categoryId: `${key}-training-category`,
        name: `${key} Training Preset Must Not Leak`,
        slug: `${key}-training-preset`,
      },
    ],
  });
  await prisma.project.create({
    data: {
      id: `${key}-project`,
      title: `${key} Project`,
      slug: `${key}-project`,
      status: "running",
    },
  });
  await prisma.projectSection.create({
    data: {
      id: `${key}-section`,
      projectId: `${key}-project`,
      name: `${key} Section`,
      sortOrder: 0,
    },
  });
  await prisma.projectPresetBinding.createMany({
    data: [
      {
        id: `${key}-ordinary-binding`,
        projectId: `${key}-project`,
        categoryId: `${key}-ordinary-category`,
        presetId: `${key}-ordinary-preset`,
        sortOrder: 0,
      },
      {
        id: `${key}-training-binding`,
        projectId: `${key}-project`,
        categoryId: `${key}-training-category`,
        presetId: `${key}-training-preset`,
        sortOrder: 1,
      },
    ],
  });
  await prisma.run.create({
    data: {
      id: `${key}-running-run`,
      projectId: `${key}-project`,
      projectSectionId: `${key}-section`,
      status: "running",
      resolvedConfigSnapshot: {},
    },
  });

  const projectSummary = (await listProjects()).find((project) => project.id === `${key}-project`);
  assert.deepEqual(
    projectSummary?.presetNames,
    [`${key} Ordinary Preset`],
    "generation project list preset summaries must not expose training-owned preset names",
  );

  const runningSummary = (await getRunningRuns()).find((run) => run.id === `${key}-running-run`);
  assert.deepEqual(
    runningSummary?.presetNames,
    [`${key} Ordinary Preset`],
    "generation run list preset summaries must not expose training-owned preset names",
  );
});

test("generation project writes reject reserved training resource notes", async () => {
  const key = `zrw-benchmark-write-boundary-${++sequence}`;
  const benchmarkNotes = JSON.stringify({
    temporary: true,
    purpose: "training_benchmark",
    benchmarkRunId: `${key}-run`,
  });

  await assert.rejects(
    () => createProjectForApi({
      title: `${key} API Boundary Project`,
      checkpointName: `${key}.ckpt`,
      notes: benchmarkNotes,
    }),
    /reserved training/i,
    "the /api/projects service must not create generation projects carrying reserved training notes",
  );

  await assert.rejects(
    () => createProject({
      title: `${key} Action Boundary Project`,
      checkpointName: `${key}.ckpt`,
      presetBindings: [],
      notes: benchmarkNotes,
    }),
    /reserved training/i,
    "ordinary generation server actions must not create projects carrying reserved training notes",
  );

  assert.equal(
    await prisma.project.count({
      where: {
        title: {
          in: [
            `${key} API Boundary Project`,
            `${key} Action Boundary Project`,
          ],
        },
      },
    }),
    0,
    "rejected generation writes must not leave hidden training-marked projects behind",
  );
});

test("generation template writes reject reserved training identities", async () => {
  const key = `zrw-benchmark-template-write-${++sequence}`;
  const benchmarkDescription =
    "Default ProjectTemplate reserved for training benchmark evidence.";

  await assert.rejects(
    () => createProjectTemplate({
      name: "训练测试",
      description: `${benchmarkDescription} ${key}`,
      sections: [],
    }),
    /reserved training/i,
    "generation template creation must not create hidden reserved training templates",
  );

  await assert.rejects(
    () => createProjectTemplate({
      name: `${key} Ordinary Name`,
      description: `${benchmarkDescription} ${key}`,
      sections: [],
    }),
    /reserved training/i,
    "generation template creation must reject benchmark descriptions even when the name looks ordinary",
  );

  const cleanTemplateId = await ignoreStaticRevalidateError(() => createProjectTemplate({
    name: `${key} Clean Template`,
    description: "Ordinary generation template",
    sections: [],
  })) ?? (await prisma.projectTemplate.findFirstOrThrow({
    where: { name: `${key} Clean Template` },
    select: { id: true },
  })).id;

  await assert.rejects(
    () => updateProjectTemplate({
      id: cleanTemplateId,
      name: "training benchmark",
    }),
    /reserved training/i,
    "generation template updates must not rename ordinary templates into hidden benchmark templates",
  );

  assert.equal(
    await prisma.projectTemplate.count({
      where: {
        description: { contains: key },
      },
    }),
    0,
    "rejected generation template writes must not leave hidden reserved training templates behind",
  );
});

test("generation template direct mutations reject hidden reserved training templates", async () => {
  const seed = await seedProjectWithPreset();
  const key = `zrw-benchmark-template-mutation-${++sequence}`;
  const hiddenTemplate = await prisma.projectTemplate.create({
    data: {
      id: `${key}-hidden-template`,
      name: "训练测试",
      description: `Default ProjectTemplate reserved for training benchmark evidence. ${key}`,
    },
  });
  const hiddenSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${key}-hidden-section`,
      projectTemplateId: hiddenTemplate.id,
      sortOrder: 0,
      name: `${key} Hidden Section`,
    },
  });

  await assert.rejects(
    () => updateProjectTemplate({
      id: hiddenTemplate.id,
      name: `${key} Renamed Through Generation`,
    }),
    /PROJECT_TEMPLATE_NOT_FOUND|not found/i,
    "generation template update must not mutate hidden reserved training templates by id",
  );

  await assert.rejects(
    () => updateProjectTemplateSection({
      templateId: hiddenTemplate.id,
      sectionId: hiddenSection.id,
      section: templateSectionInput(seed, {
        id: hiddenSection.id,
        name: `${key} Mutated Through Generation`,
      }),
    }),
    /TEMPLATE_SECTION_NOT_FOUND|not found/i,
    "generation template section update must not mutate hidden reserved training sections by id",
  );

  assert.equal(
    await copyProjectTemplateSection(hiddenSection.id),
    null,
    "generation template section copy must treat hidden reserved training sections as out of scope",
  );

  await assert.rejects(
    () => deleteProjectTemplateSection({
      templateId: hiddenTemplate.id,
      sectionId: hiddenSection.id,
    }),
    /TEMPLATE_SECTION_NOT_FOUND|not found/i,
    "generation template section delete must not delete hidden reserved training sections by id",
  );

  await assert.rejects(
    () => deleteProjectTemplate(hiddenTemplate.id),
    /PROJECT_TEMPLATE_NOT_FOUND|not found/i,
    "generation template delete must not delete hidden reserved training templates by id",
  );

  const reloadedTemplate = await prisma.projectTemplate.findUniqueOrThrow({
    where: { id: hiddenTemplate.id },
  });
  const reloadedSection = await prisma.projectTemplateSection.findUniqueOrThrow({
    where: { id: hiddenSection.id },
  });
  assert.equal(reloadedTemplate.name, "训练测试");
  assert.equal(reloadedSection.name, `${key} Hidden Section`);
});

test("generation run lists hide runs attached to reserved training temporary projects", async () => {
  const key = `zrw-benchmark-runs-${++sequence}`;
  const benchmarkNotes = JSON.stringify({
    temporary: true,
    purpose: "training_benchmark",
    benchmarkRunId: `${key}-benchmark`,
  }, null, 2);

  await prisma.project.createMany({
    data: [
      {
        id: `${key}-visible-project`,
        title: `${key} Visible Project`,
        slug: `${key}-visible-project`,
        status: "draft",
      },
      {
        id: `${key}-hidden-project`,
        title: `${key} Hidden Benchmark Project`,
        slug: `${key}-hidden-project`,
        status: "draft",
        notes: benchmarkNotes,
      },
    ],
  });
  await prisma.projectSection.createMany({
    data: [
      {
        id: `${key}-visible-section`,
        projectId: `${key}-visible-project`,
        name: `${key} Visible Section`,
        sortOrder: 0,
      },
      {
        id: `${key}-hidden-section`,
        projectId: `${key}-hidden-project`,
        name: `${key} Hidden Section`,
        sortOrder: 0,
      },
    ],
  });
  await prisma.run.createMany({
    data: [
      {
        id: `${key}-visible-done-run`,
        projectId: `${key}-visible-project`,
        projectSectionId: `${key}-visible-section`,
        status: "done",
        resolvedConfigSnapshot: {},
      },
      {
        id: `${key}-hidden-done-run`,
        projectId: `${key}-hidden-project`,
        projectSectionId: `${key}-hidden-section`,
        status: "done",
        resolvedConfigSnapshot: {},
      },
      {
        id: `${key}-visible-running-run`,
        projectId: `${key}-visible-project`,
        projectSectionId: `${key}-visible-section`,
        status: "running",
        resolvedConfigSnapshot: {},
      },
      {
        id: `${key}-hidden-running-run`,
        projectId: `${key}-hidden-project`,
        projectSectionId: `${key}-hidden-section`,
        status: "running",
        resolvedConfigSnapshot: {},
      },
      {
        id: `${key}-visible-failed-run`,
        projectId: `${key}-visible-project`,
        projectSectionId: `${key}-visible-section`,
        status: "failed",
        resolvedConfigSnapshot: {},
      },
      {
        id: `${key}-hidden-failed-run`,
        projectId: `${key}-hidden-project`,
        projectSectionId: `${key}-hidden-section`,
        status: "failed",
        resolvedConfigSnapshot: {},
      },
    ],
  });
  await prisma.imageResult.createMany({
    data: [
      {
        id: `${key}-visible-image`,
        runId: `${key}-visible-done-run`,
        filePath: `${key}/visible.png`,
        reviewStatus: "pending",
      },
      {
        id: `${key}-hidden-image`,
        runId: `${key}-hidden-done-run`,
        filePath: `${key}/hidden.png`,
        reviewStatus: "pending",
      },
    ],
  });

  const reviewGroupIds = await getReviewGroupIds();
  assert.equal(reviewGroupIds.includes(`${key}-visible-done-run`), true);
  assert.equal(
    reviewGroupIds.includes(`${key}-hidden-done-run`),
    false,
    "generation review queue must hide done runs from reserved training temporary projects",
  );

  const runningIds = (await getRunningRuns()).map((run) => run.id);
  assert.equal(runningIds.includes(`${key}-visible-running-run`), true);
  assert.equal(
    runningIds.includes(`${key}-hidden-running-run`),
    false,
    "generation running list must hide active runs from reserved training temporary projects",
  );

  const failedIds = (await getFailedRuns()).map((run) => run.id);
  assert.equal(failedIds.includes(`${key}-visible-failed-run`), true);
  assert.equal(
    failedIds.includes(`${key}-hidden-failed-run`),
    false,
    "generation failed list must hide failed runs from reserved training temporary projects",
  );
});

async function createNormalizedPresetBlock(input: Awaited<ReturnType<typeof seedProjectWithPreset>>) {
  const binding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: input.section.id,
      bindingKey: `${input.key}-binding`,
      categoryId: input.category.id,
      presetId: input.preset.id,
      variantId: input.variantA.id,
      sortOrder: 0,
    },
  });
  const block = await prisma.sectionPromptBlock.create({
    data: {
      projectSectionId: input.section.id,
      sectionBindingId: binding.id,
      type: "preset",
      sortOrder: 0,
    },
  });
  return { binding, block };
}

function legacyPresetPromptBlock(input: Awaited<ReturnType<typeof seedProjectWithPreset>>, bindingId = `${input.key}-legacy-binding`) {
  return {
    type: "preset",
    sourceId: input.preset.id,
    variantId: input.variantA.id,
    categoryId: input.category.id,
    bindingId,
    groupBindingId: null,
    label: `${input.key} expanded label`,
    positive: `${input.key} stale expanded positive`,
    negative: `${input.key} stale expanded negative`,
    sortOrder: 0,
  };
}

function trainingPresetPromptBlock(
  input: Awaited<ReturnType<typeof seedProjectWithPreset>>,
  bindingId = `${input.key}-training-binding`,
) {
  return {
    type: "preset",
    sourceId: `${input.key}-training-preset`,
    variantId: `${input.key}-training-variant`,
    categoryId: `${input.key}-training-category`,
    bindingId,
    groupBindingId: null,
    label: `${input.key} training label`,
    positive: `${input.key} training positive`,
    negative: `${input.key} training negative`,
    sortOrder: 0,
  };
}

async function seedTrainingPresetResource(input: Awaited<ReturnType<typeof seedProjectWithPreset>>) {
  await prisma.presetCategory.create({
    data: {
      id: `${input.key}-training-category`,
      name: `${input.key} Training Category`,
      slug: `${input.key}-training-category`,
      type: "training_scene_description",
    },
  });
  await prisma.preset.create({
    data: {
      id: `${input.key}-training-preset`,
      categoryId: `${input.key}-training-category`,
      name: `${input.key} Training Preset`,
      slug: `${input.key}-training-preset`,
    },
  });
  await prisma.presetVariant.create({
    data: {
      id: `${input.key}-training-variant`,
      presetId: `${input.key}-training-preset`,
      name: "Training",
      slug: `${input.key}-training-variant`,
      prompt: `${input.key} training prompt must not enter generation template bindings`,
    },
  });
}

function legacyCustomPromptBlock(input: Awaited<ReturnType<typeof seedProjectWithPreset>>) {
  return {
    type: "custom",
    sourceId: null,
    variantId: null,
    categoryId: null,
    bindingId: null,
    groupBindingId: null,
    label: `${input.key} Custom`,
    positive: `${input.key} custom positive`,
    negative: `${input.key} custom negative`,
    sortOrder: 1,
  };
}

function templateSectionInput(input: Awaited<ReturnType<typeof seedProjectWithPreset>>, overrides: Record<string, unknown> = {}) {
  return {
    id: "new-section",
    folderId: null,
    sortOrder: 0,
    name: `${input.key} Template Section`,
    notes: null,
    aspectRatio: "1:1",
    aspectRatios: ["1:1"],
    shortSidePx: 512,
    batchSize: 1,
    seedPolicy1: null,
    seedPolicy2: null,
    ksampler1: null,
    ksampler2: null,
    upscaleFactor: null,
    useTwoStageKSampler: true,
    checkpointName: null,
    extraParams: null,
    promptBlocks: [
      legacyPresetPromptBlock(input),
      legacyCustomPromptBlock(input),
    ],
    loraConfig: {
      lora1: [
        {
          id: `${input.key}-preset-expanded-lora`,
          path: `/${input.key}-a.safetensors`,
          weight: 0.7,
          enabled: true,
          source: "preset",
          bindingId: `${input.key}-legacy-binding`,
        },
        {
          id: `${input.key}-manual-lora`,
          path: `/${input.key}-manual.safetensors`,
          weight: 0.25,
          enabled: true,
          source: "manual",
        },
      ],
      lora2: [],
    },
    ...overrides,
  };
}

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

test.after(async () => {
  await prisma.$disconnect();
  await rm(tempDir, { recursive: true, force: true });
});

test("importPresetToSection writes normalized binding rows without legacy expanded caches", async () => {
  const seed = await seedProjectWithPreset();

  const result = await importPresetToSection(seed.section.id, seed.preset.id, seed.variantA.id);

  assert.ok(result);
  const bindings = await prisma.sectionPresetBinding.findMany({ where: { projectSectionId: seed.section.id } });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].presetId, seed.preset.id);
  assert.equal(bindings[0].variantId, seed.variantA.id);

  const promptRows = await prisma.sectionPromptBlock.findMany({ where: { projectSectionId: seed.section.id } });
  assert.equal(promptRows.length, 1);
  assert.equal(promptRows[0].sectionBindingId, bindings[0].id);
  assert.equal(promptRows[0].type, "preset");
  assert.equal(promptRows[0].customLabel, null);
  assert.equal(promptRows[0].customPositive, null);
  assert.equal(promptRows[0].customNegative, null);

  await prisma.projectSection.findUniqueOrThrow({ where: { id: seed.section.id } });
});

test("importPresetGroupToSection stores one group binding and returns resolved member blocks", async () => {
  const seed = await seedProjectWithPreset();
  const earlierCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-earlier-category`,
      name: `${seed.key} Earlier Category`,
      slug: `${seed.key}-earlier-category`,
      positivePromptOrder: 5,
      lora1Order: 5,
      lora2Order: 5,
    },
  });
  const earlierPreset = await prisma.preset.create({
    data: {
      id: `${seed.key}-earlier-preset`,
      categoryId: earlierCategory.id,
      name: `${seed.key} Earlier Preset`,
      slug: `${seed.key}-earlier-preset`,
    },
  });
  const earlierVariant = await prisma.presetVariant.create({
    data: {
      id: `${seed.key}-earlier-variant`,
      presetId: earlierPreset.id,
      name: "Default",
      slug: `${seed.key}-earlier-variant`,
      prompt: `${seed.key} earlier positive`,
      negativePrompt: `${seed.key} earlier negative`,
      lora1: [{ path: `/${seed.key}-earlier.safetensors`, weight: 0.3, enabled: true }],
      lora2: [],
      sortOrder: 0,
    },
  });
  const groupCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-group-category`,
      name: `${seed.key} Group Category`,
      slug: `${seed.key}-group-category`,
      type: "group",
      positivePromptOrder: 99,
    },
  });
  const group = await prisma.presetGroup.create({
    data: {
      id: `${seed.key}-group`,
      categoryId: groupCategory.id,
      name: `${seed.key} Group`,
      slug: `${seed.key}-group`,
    },
  });
  await prisma.presetGroupMember.createMany({
    data: [
      {
        id: `${seed.key}-group-member-later`,
        groupId: group.id,
        presetId: seed.preset.id,
        variantId: seed.variantA.id,
        sortOrder: 0,
      },
      {
        id: `${seed.key}-group-member-earlier`,
        groupId: group.id,
        presetId: earlierPreset.id,
        variantId: earlierVariant.id,
        sortOrder: 1,
      },
    ],
  });

  const result = await importPresetGroupToSection(seed.section.id, group.id);

  assert.ok(result);
  const bindings = await prisma.sectionPresetBinding.findMany({
    where: { projectSectionId: seed.section.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].presetId, null);
  assert.equal(bindings[0].variantId, null);
  assert.equal(bindings[0].categoryId, groupCategory.id);
  assert.equal(bindings[0].presetGroupId, group.id);
  assert.match(bindings[0].groupBindingKey ?? "", new RegExp(`^grp:${group.id}:`));

  const promptRows = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: seed.section.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(promptRows.length, 1);
  assert.equal(promptRows[0].sectionBindingId, bindings[0].id);
  assert.equal(promptRows[0].type, "preset");
  assert.deepEqual(result.blocks.map((block) => block.sourceId), [earlierPreset.id, seed.preset.id]);
  assert.deepEqual(result.blocks.map((block) => block.variantId), [earlierVariant.id, seed.variantA.id]);
  assert.deepEqual(result.blocks.map((block) => block.categoryId), [earlierCategory.id, seed.category.id]);
  assert.deepEqual(result.blocks.map((block) => block.bindingId), [bindings[0].bindingKey, bindings[0].bindingKey]);
  assert.deepEqual(result.blocks.map((block) => block.groupBindingId), [bindings[0].groupBindingKey, bindings[0].groupBindingKey]);
  assert.deepEqual(result.lora1.map((entry) => entry.path), [`/${seed.key}-earlier.safetensors`, `/${seed.key}-a.safetensors`]);
});

test("importPresetGroupToSection ignores LoRA training preset members", async () => {
  const seed = await seedProjectWithPreset();
  const trainingCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-training-category`,
      name: `${seed.key} Training Category`,
      slug: `${seed.key}-training-category`,
      type: "training_scene_description",
      positivePromptOrder: 1,
    },
  });
  const trainingPreset = await prisma.preset.create({
    data: {
      id: `${seed.key}-training-preset`,
      categoryId: trainingCategory.id,
      name: `${seed.key} Training Preset`,
      slug: `${seed.key}-training-preset`,
    },
  });
  const trainingVariant = await prisma.presetVariant.create({
    data: {
      id: `${seed.key}-training-variant`,
      presetId: trainingPreset.id,
      name: "Training",
      slug: `${seed.key}-training-variant`,
      prompt: `${seed.key} training prompt must not leak`,
      negativePrompt: `${seed.key} training negative must not leak`,
      lora1: [{ path: `/${seed.key}-training.safetensors`, weight: 1, enabled: true }],
      lora2: [],
      sortOrder: 0,
    },
  });
  const groupCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-safe-group-category`,
      name: `${seed.key} Safe Group Category`,
      slug: `${seed.key}-safe-group-category`,
      type: "group",
      positivePromptOrder: 99,
    },
  });
  const group = await prisma.presetGroup.create({
    data: {
      id: `${seed.key}-safe-group`,
      categoryId: groupCategory.id,
      name: `${seed.key} Safe Group`,
      slug: `${seed.key}-safe-group`,
    },
  });
  await prisma.presetGroupMember.createMany({
    data: [
      {
        id: `${seed.key}-safe-member-training`,
        groupId: group.id,
        presetId: trainingPreset.id,
        variantId: trainingVariant.id,
        sortOrder: 0,
      },
      {
        id: `${seed.key}-safe-member-ordinary`,
        groupId: group.id,
        presetId: seed.preset.id,
        variantId: seed.variantA.id,
        sortOrder: 1,
      },
    ],
  });

  const result = await importPresetGroupToSection(seed.section.id, group.id);

  assert.ok(result);
  assert.deepEqual(result.blocks.map((block) => block.sourceId), [seed.preset.id]);
  assert.deepEqual(result.blocks.map((block) => block.variantId), [seed.variantA.id]);
  assert.equal(result.blocks.some((block) => block.positive.includes("training prompt")), false);
  assert.deepEqual(result.lora1.map((entry) => entry.path), [`/${seed.key}-a.safetensors`]);
});

test("removeImportedPresetFromSection cascades a group import by group binding key", async () => {
  const seed = await seedProjectWithPreset();
  const groupCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-group-category`,
      name: `${seed.key} Group Category`,
      slug: `${seed.key}-group-category`,
      type: "group",
    },
  });
  const group = await prisma.presetGroup.create({
    data: {
      id: `${seed.key}-group`,
      categoryId: groupCategory.id,
      name: `${seed.key} Group`,
      slug: `${seed.key}-group`,
    },
  });
  const groupBindingKey = `grp:${group.id}:${seed.key}-instance`;
  const firstBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey: `${seed.key}-group-member-a`,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      presetGroupId: group.id,
      groupBindingKey,
      sortOrder: 0,
    },
  });
  const secondBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey: `${seed.key}-group-member-b`,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantB.id,
      presetGroupId: group.id,
      groupBindingKey,
      sortOrder: 1,
    },
  });
  await prisma.sectionPromptBlock.createMany({
    data: [
      { projectSectionId: seed.section.id, sectionBindingId: firstBinding.id, type: "preset", sortOrder: 0 },
      { projectSectionId: seed.section.id, sectionBindingId: secondBinding.id, type: "preset", sortOrder: 1 },
    ],
  });
  await prisma.sectionManualLoraEntry.createMany({
    data: [
      {
        projectSectionId: seed.section.id,
        sectionBindingId: firstBinding.id,
        stage: "lora1",
        path: `/${seed.key}-manual-a.safetensors`,
      },
      {
        projectSectionId: seed.section.id,
        sectionBindingId: secondBinding.id,
        stage: "lora2",
        path: `/${seed.key}-manual-b.safetensors`,
      },
    ],
  });

  const result = await removeImportedPresetFromSection(seed.section.id, firstBinding.bindingKey);

  assert.deepEqual(result, { deletedBlocks: 2, removedLoras: { lora1: 1, lora2: 1 } });
  assert.equal(await prisma.sectionPresetBinding.count({ where: { projectSectionId: seed.section.id, groupBindingKey } }), 0);
  assert.equal(await prisma.sectionPromptBlock.count({ where: { projectSectionId: seed.section.id } }), 0);
  assert.equal(await prisma.sectionManualLoraEntry.count({ where: { projectSectionId: seed.section.id } }), 0);
});

test("switchBindingVariant only updates the SectionPresetBinding variant", async () => {
  const seed = await seedProjectWithPreset();
  const { binding } = await createNormalizedPresetBlock(seed);

  const result = await switchBindingVariant(seed.section.id, binding.bindingKey, seed.variantB.id);

  assert.ok(result);
  const afterBinding = await prisma.sectionPresetBinding.findUniqueOrThrow({ where: { id: binding.id } });
  assert.equal(afterBinding.variantId, seed.variantB.id);
  const promptRow = await prisma.sectionPromptBlock.findFirstOrThrow({ where: { projectSectionId: seed.section.id } });
  assert.equal(promptRow.customPositive, null);
  assert.equal(promptRow.customNegative, null);
});

test("switchBindingVariant allows real preset rows imported from a preset group", async () => {
  const seed = await seedProjectWithPreset();
  const groupCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-group-category`,
      name: `${seed.key} Group Category`,
      slug: `${seed.key}-group-category`,
      type: "group",
    },
  });
  const group = await prisma.presetGroup.create({
    data: {
      id: `${seed.key}-group`,
      categoryId: groupCategory.id,
      name: `${seed.key} Group`,
      slug: `${seed.key}-group`,
    },
  });
  const binding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey: `${seed.key}-group-member`,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      presetGroupId: group.id,
      groupBindingKey: `grp:${group.id}:${seed.key}-instance`,
      sortOrder: 0,
    },
  });
  await prisma.sectionPromptBlock.create({
    data: {
      projectSectionId: seed.section.id,
      sectionBindingId: binding.id,
      type: "preset",
      sortOrder: 0,
    },
  });

  const result = await switchBindingVariant(seed.section.id, binding.bindingKey, seed.variantB.id);

  assert.ok(result);
  const afterBinding = await prisma.sectionPresetBinding.findUniqueOrThrow({ where: { id: binding.id } });
  assert.equal(afterBinding.variantId, seed.variantB.id);
  assert.equal(afterBinding.presetGroupId, group.id);
});

test("addSection prefers ProjectPresetBinding rows and does not expand prompt or LoRA caches", async () => {
  const seed = await seedProjectWithPreset({ withProjectBinding: true });

  const sectionId = await addSection(seed.project.id, "Normalized Section");

  const bindings = await prisma.sectionPresetBinding.findMany({ where: { projectSectionId: sectionId } });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].presetId, seed.preset.id);
  assert.equal(bindings[0].variantId, seed.variantA.id);
  const promptRows = await prisma.sectionPromptBlock.findMany({ where: { projectSectionId: sectionId } });
  assert.equal(promptRows.length, 1);
  assert.equal(promptRows[0].sectionBindingId, bindings[0].id);
  assert.equal(promptRows[0].customPositive, null);
});

test("copySection copies normalized rows without expanding clean preset content", async () => {
  const seed = await seedProjectWithPreset();
  const { binding } = await createNormalizedPresetBlock(seed);
  await prisma.sectionPromptBlock.create({
    data: {
      projectSectionId: seed.section.id,
      type: "custom",
      customLabel: "Local override",
      customPositive: "local positive",
      customNegative: "local negative",
      sortOrder: 1,
    },
  });
  await prisma.sectionManualLoraEntry.create({
    data: {
      projectSectionId: seed.section.id,
      sectionBindingId: null,
      stage: "lora1",
      path: "/local-detached.safetensors",
      weight: 0.6,
      enabled: true,
      detachedFromBindingKey: binding.bindingKey,
      detachedFromPresetId: seed.preset.id,
      detachedFromVariantId: seed.variantA.id,
      detachedFromPath: `/${seed.key}-a.safetensors`,
      sortOrder: 0,
    },
  });
  const copiedSectionId = await copySection(seed.section.id);

  assert.ok(copiedSectionId);
  const copiedBindings = await prisma.sectionPresetBinding.findMany({ where: { projectSectionId: copiedSectionId } });
  assert.equal(copiedBindings.length, 1);
  assert.equal(copiedBindings[0].bindingKey, binding.bindingKey);
  assert.equal(copiedBindings[0].presetId, seed.preset.id);

  const copiedBlocks = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: copiedSectionId },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(copiedBlocks.length, 2);
  assert.equal(copiedBlocks[0].sectionBindingId, copiedBindings[0].id);
  assert.equal(copiedBlocks[0].customPositive, null);
  assert.equal(copiedBlocks[1].sectionBindingId, null);
  assert.equal(copiedBlocks[1].customPositive, "local positive");

  const copiedManualRows = await prisma.sectionManualLoraEntry.findMany({ where: { projectSectionId: copiedSectionId } });
  assert.equal(copiedManualRows.length, 1);
  assert.equal(copiedManualRows[0].path, "/local-detached.safetensors");
  assert.equal(copiedManualRows[0].sectionBindingId, null);
});

test("copySection inserts the copied section immediately after the source section", async () => {
  const seed = await seedProjectWithPreset();
  const laterSection = await prisma.projectSection.create({
    data: {
      id: `${seed.key}-later-section`,
      projectId: seed.project.id,
      name: `${seed.key} Later Section`,
      sortOrder: 2,
      enabled: true,
    },
  });

  const copiedSectionId = await copySection(seed.section.id);

  assert.ok(copiedSectionId);
  const orderedSections = await prisma.projectSection.findMany({
    where: { projectId: seed.project.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  assert.deepEqual(orderedSections.map((section) => section.id), [
    seed.section.id,
    copiedSectionId,
    laterSection.id,
  ]);
  assert.deepEqual(orderedSections.map((section) => section.sortOrder), [1, 2, 3]);
});

test("section two-stage KSampler switch persists through update, copy, template save, import, and template copy", async () => {
  const seed = await seedProjectWithPreset();

  await updateProjectSectionForApi(seed.project.id, seed.section.id, {
    useTwoStageKSampler: false,
  });
  const updatedSection = await prisma.projectSection.findUniqueOrThrow({
    where: { id: seed.section.id },
  });
  assert.equal(updatedSection.useTwoStageKSampler, false);

  const copiedSectionId = await ignoreStaticRevalidateError(() => copySection(seed.section.id)) ??
    (await prisma.projectSection.findFirstOrThrow({
      where: {
        projectId: seed.project.id,
        id: { not: seed.section.id },
      },
      orderBy: { sortOrder: "desc" },
      select: { id: true },
    })).id;
  const copiedSection = await prisma.projectSection.findUniqueOrThrow({
    where: { id: copiedSectionId },
  });
  assert.equal(copiedSection.useTwoStageKSampler, false);

  const templateId = await ignoreStaticRevalidateError(() =>
    saveProjectAsTemplate(seed.project.id, `${seed.key} Two Stage Persistence Template`)
  ) ?? (await prisma.projectTemplate.findFirstOrThrow({
    where: { name: `${seed.key} Two Stage Persistence Template` },
    select: { id: true },
  })).id;
  const templateSection = await prisma.projectTemplateSection.findFirstOrThrow({
    where: {
      projectTemplateId: templateId,
      name: seed.section.name,
    },
  });
  assert.equal(templateSection.useTwoStageKSampler, false);

  const targetProject = await prisma.project.create({
    data: {
      id: `${seed.key}-target-project`,
      title: `${seed.key} Target Project`,
      slug: `${seed.key}-target-project`,
      status: "draft",
    },
  });
  await ignoreStaticRevalidateError(() => importTemplateToProject(targetProject.id, templateId));
  const importedSection = await prisma.projectSection.findFirstOrThrow({
    where: {
      projectId: targetProject.id,
      name: seed.section.name,
    },
  });
  assert.equal(importedSection.useTwoStageKSampler, false);

  const copiedTemplateSectionId = await ignoreStaticRevalidateError(() => copyProjectTemplateSection(templateSection.id)) ??
    (await prisma.projectTemplateSection.findFirstOrThrow({
      where: {
        projectTemplateId: templateId,
        id: { not: templateSection.id },
      },
      orderBy: { sortOrder: "desc" },
      select: { id: true },
    })).id;
  const copiedTemplateSection = await prisma.projectTemplateSection.findUniqueOrThrow({
    where: { id: copiedTemplateSectionId },
  });
  assert.equal(copiedTemplateSection.useTwoStageKSampler, false);
});

test("editing a preset-bound SectionPromptBlock detaches prompt and LoRA rows without loraConfig writes", async () => {
  const seed = await seedProjectWithPreset();
  const { binding, block } = await createNormalizedPresetBlock(seed);

  const result = await updateSectionBlock(block.id, { positive: "user owned positive" });

  assert.equal(result.type, "custom");
  assert.equal(result.bindingId, null);
  assert.equal(result.positive, "user owned positive");
  assert.equal(result.negative, `${seed.key} source negative A`);

  assert.equal(await prisma.sectionPresetBinding.count({ where: { id: binding.id } }), 0);
  const detachedBlock = await prisma.sectionPromptBlock.findUniqueOrThrow({ where: { id: block.id } });
  assert.equal(detachedBlock.sectionBindingId, null);
  assert.equal(detachedBlock.type, "custom");
  assert.equal(detachedBlock.customLabel, `${seed.key} Preset / A`);
  assert.equal(detachedBlock.customPositive, "user owned positive");
  assert.equal(detachedBlock.customNegative, `${seed.key} source negative A`);

  const manualRows = await prisma.sectionManualLoraEntry.findMany({
    where: { projectSectionId: seed.section.id },
    orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
  });
  assert.deepEqual(
    manualRows.map((row) => ({
      stage: row.stage,
      path: row.path,
      detachedFromBindingKey: row.detachedFromBindingKey,
      detachedFromPresetId: row.detachedFromPresetId,
      detachedFromVariantId: row.detachedFromVariantId,
      detachedFromPath: row.detachedFromPath,
      sectionBindingId: row.sectionBindingId,
    })),
    [
      {
        stage: "lora1",
        path: `/${seed.key}-a.safetensors`,
        detachedFromBindingKey: binding.bindingKey,
        detachedFromPresetId: seed.preset.id,
        detachedFromVariantId: seed.variantA.id,
        detachedFromPath: `/${seed.key}-a.safetensors`,
        sectionBindingId: null,
      },
      {
        stage: "lora2",
        path: `/${seed.key}-upscale-a.safetensors`,
        detachedFromBindingKey: binding.bindingKey,
        detachedFromPresetId: seed.preset.id,
        detachedFromVariantId: seed.variantA.id,
        detachedFromPath: `/${seed.key}-upscale-a.safetensors`,
        sectionBindingId: null,
      },
    ],
  );
  await prisma.projectSection.findUniqueOrThrow({ where: { id: seed.section.id } });
});

test("editing a resolver-only project binding uses the current section when binding keys repeat", async () => {
  const seed = await seedProjectWithPreset();
  const bindingKey = `project:${seed.category.id}`;
  const otherSection = await prisma.projectSection.create({
    data: {
      id: `${seed.key}-other-section`,
      projectId: seed.project.id,
      name: `${seed.key} Other Section`,
      sortOrder: 2,
      enabled: true,
    },
  });
  const targetBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });
  const otherBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: otherSection.id,
      bindingKey,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });

  const result = await updateSectionBlock(`resolved:${bindingKey}:0`, {
    positive: "section owned positive",
  }, seed.section.id);

  assert.equal(result.type, "custom");
  assert.equal(result.bindingId, null);
  assert.equal(result.positive, "section owned positive");
  assert.equal(result.negative, `${seed.key} source negative A`);
  assert.equal(await prisma.sectionPresetBinding.count({ where: { id: targetBinding.id } }), 0);
  assert.equal(await prisma.sectionPresetBinding.count({ where: { id: otherBinding.id } }), 1);
  const detachedBlock = await prisma.sectionPromptBlock.findFirstOrThrow({
    where: { projectSectionId: seed.section.id },
  });
  assert.equal(detachedBlock.sectionBindingId, null);
  assert.equal(detachedBlock.type, "custom");
  assert.equal(detachedBlock.customPositive, "section owned positive");
});

test("deleting a resolver-only project binding uses the current section when binding keys repeat", async () => {
  const seed = await seedProjectWithPreset();
  const bindingKey = `project:${seed.category.id}`;
  const otherSection = await prisma.projectSection.create({
    data: {
      id: `${seed.key}-other-section`,
      projectId: seed.project.id,
      name: `${seed.key} Other Section`,
      sortOrder: 2,
      enabled: true,
    },
  });
  const targetBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });
  const otherBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: otherSection.id,
      bindingKey,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });

  await deleteSectionBlock(`resolved:${bindingKey}:0`, seed.section.id);

  assert.equal(await prisma.sectionPresetBinding.count({ where: { id: targetBinding.id } }), 0);
  assert.equal(await prisma.sectionPresetBinding.count({ where: { id: otherBinding.id } }), 1);
  assert.equal(await prisma.sectionPromptBlock.count({ where: { projectSectionId: seed.section.id } }), 0);
});

test("prompt block service CRUD uses normalized SectionPromptBlock rows for custom blocks", async () => {
  const seed = await seedProjectWithPreset();

  const first = await addPromptBlock(seed.section.id, {
    type: "custom",
    label: "First custom",
    positive: "first positive",
    negative: "first negative",
  });
  const second = await addPromptBlock(seed.section.id, {
    type: "custom",
    label: "Second custom",
    positive: "second positive",
    negative: null,
  });

  const rows = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: seed.section.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.deepEqual(rows.map((row) => [row.id, row.type, row.customLabel, row.customPositive]), [
    [first.id, "custom", "First custom", "first positive"],
    [second.id, "custom", "Second custom", "second positive"],
  ]);

  const reordered = await setPromptBlockOrder(seed.section.id, [second.id, first.id]);
  assert.deepEqual(reordered.map((row) => row.id), [second.id, first.id]);
  const afterReorder = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: seed.section.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.deepEqual(afterReorder.map((row) => [row.id, row.sortOrder]), [
    [second.id, 0],
    [first.id, 1],
  ]);

  await removePromptBlock(first.id);
  assert.equal(await prisma.sectionPromptBlock.count({ where: { id: first.id } }), 0);
});

test("prompt block service detaches normalized preset blocks when edited", async () => {
  const seed = await seedProjectWithPreset();
  const { binding, block } = await createNormalizedPresetBlock(seed);

  const result = await editPromptBlock(block.id, { positive: "service owned positive" });

  assert.equal(result.type, "custom");
  assert.equal(result.bindingId, null);
  assert.equal(result.positive, "service owned positive");
  assert.equal(result.negative, `${seed.key} source negative A`);
  assert.equal(await prisma.sectionPresetBinding.count({ where: { id: binding.id } }), 0);
  const updated = await prisma.sectionPromptBlock.findUniqueOrThrow({ where: { id: block.id } });
  assert.equal(updated.sectionBindingId, null);
  assert.equal(updated.type, "custom");
  assert.equal(updated.customPositive, "service owned positive");
  assert.equal(updated.customNegative, `${seed.key} source negative A`);
});

test("importTemplateToProject creates normalized rows from template relation rows without expanded caches", async () => {
  const seed = await seedProjectWithPreset();
  const template = await prisma.projectTemplate.create({
    data: { id: `${seed.key}-template`, name: `${seed.key} Template` },
  });
  const templateSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-template-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Imported Section`,
    },
  });
  const templateBinding = await prisma.templateSectionPresetBinding.create({
    data: {
      projectTemplateSectionId: templateSection.id,
      bindingKey: `${seed.key}-template-binding`,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });
  await prisma.templateSectionPromptBlock.createMany({
    data: [
      {
        projectTemplateSectionId: templateSection.id,
        templateSectionBindingId: templateBinding.id,
        type: "preset",
        sortOrder: 0,
      },
      {
        projectTemplateSectionId: templateSection.id,
        templateSectionBindingId: null,
        type: "custom",
        customLabel: `${seed.key} Custom`,
        customPositive: `${seed.key} custom positive`,
        customNegative: `${seed.key} custom negative`,
        sortOrder: 1,
      },
    ],
  });
  await prisma.templateSectionManualLoraEntry.create({
    data: {
      projectTemplateSectionId: templateSection.id,
      templateSectionBindingId: null,
      stage: "lora1",
      path: `/${seed.key}-manual.safetensors`,
      weight: 0.25,
      enabled: true,
      sortOrder: 0,
    },
  });

  const importedCount = await ignoreStaticRevalidateError(() =>
    importTemplateToProject(seed.project.id, template.id) as Promise<number>
  );

  if (importedCount !== undefined) assert.equal(importedCount, 1);
  const importedSection = await prisma.projectSection.findFirstOrThrow({
    where: { projectId: seed.project.id, name: `${seed.key} Imported Section` },
  });

  const bindings = await prisma.sectionPresetBinding.findMany({ where: { projectSectionId: importedSection.id } });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].presetId, seed.preset.id);
  assert.equal(bindings[0].variantId, seed.variantA.id);

  const promptRows = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: importedSection.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(promptRows.length, 2);
  assert.equal(promptRows[0].sectionBindingId, bindings[0].id);
  assert.equal(promptRows[0].customPositive, null);
  assert.equal(promptRows[1].sectionBindingId, null);
  assert.equal(promptRows[1].customPositive, `${seed.key} custom positive`);

  const manualRows = await prisma.sectionManualLoraEntry.findMany({
    where: { projectSectionId: importedSection.id },
  });
  assert.deepEqual(manualRows.map((row) => [row.stage, row.path, row.sectionBindingId]), [
    ["lora1", `/${seed.key}-manual.safetensors`, null],
  ]);
});

test("saveProjectAsTemplate preserves preset group bindings from project sections", async () => {
  const seed = await seedProjectWithPreset();
  const groupCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-save-group-category`,
      name: `${seed.key} Save Group Category`,
      slug: `${seed.key}-save-group-category`,
      type: "group",
    },
  });
  const group = await prisma.presetGroup.create({
    data: {
      id: `${seed.key}-save-group`,
      categoryId: groupCategory.id,
      name: `${seed.key} Save Group`,
      slug: `${seed.key}-save-group`,
    },
  });
  const groupBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey: `${seed.key}-save-group-binding`,
      categoryId: groupCategory.id,
      presetId: null,
      variantId: null,
      presetGroupId: group.id,
      groupBindingKey: `grp:${group.id}:${seed.key}-save-instance`,
      sortOrder: 0,
    },
  });
  await prisma.sectionPromptBlock.create({
    data: {
      projectSectionId: seed.section.id,
      sectionBindingId: groupBinding.id,
      type: "preset",
      sortOrder: 0,
    },
  });

  const templateId = await ignoreStaticRevalidateError(() =>
    saveProjectAsTemplate(seed.project.id, `${seed.key} Saved Template`)
  ) ?? (await prisma.projectTemplate.findFirstOrThrow({
    where: { name: `${seed.key} Saved Template` },
    select: { id: true },
  })).id;

  const templateSection = await prisma.projectTemplateSection.findFirstOrThrow({
    where: { projectTemplateId: templateId },
  });
  const templateBinding = await prisma.templateSectionPresetBinding.findFirstOrThrow({
    where: { projectTemplateSectionId: templateSection.id },
  });
  assert.equal(templateBinding.presetId, null);
  assert.equal(templateBinding.variantId, null);
  assert.equal(templateBinding.presetGroupId, group.id);
  assert.equal(templateBinding.groupBindingKey, groupBinding.groupBindingKey);
});

test("importTemplateToProject preserves presetGroupId from template section bindings", async () => {
  const seed = await seedProjectWithPreset();
  const groupCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-import-group-category`,
      name: `${seed.key} Import Group Category`,
      slug: `${seed.key}-import-group-category`,
      type: "group",
    },
  });
  const group = await prisma.presetGroup.create({
    data: {
      id: `${seed.key}-import-group`,
      categoryId: groupCategory.id,
      name: `${seed.key} Import Group`,
      slug: `${seed.key}-import-group`,
    },
  });
  const template = await prisma.projectTemplate.create({
    data: { id: `${seed.key}-group-template`, name: `${seed.key} Group Template` },
  });
  const templateSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-group-template-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Imported Group Section`,
    },
  });
  const templateBinding = await prisma.templateSectionPresetBinding.create({
    data: {
      projectTemplateSectionId: templateSection.id,
      bindingKey: `${seed.key}-template-group-binding`,
      categoryId: groupCategory.id,
      presetId: null,
      variantId: null,
      presetGroupId: group.id,
      groupBindingKey: `grp:${group.id}:${seed.key}-import-instance`,
      sortOrder: 0,
    },
  });
  await prisma.templateSectionPromptBlock.create({
    data: {
      projectTemplateSectionId: templateSection.id,
      templateSectionBindingId: templateBinding.id,
      type: "preset",
      sortOrder: 0,
    },
  });

  const importedCount = await ignoreStaticRevalidateError(() =>
    importTemplateToProject(seed.project.id, template.id) as Promise<number>
  );

  if (importedCount !== undefined) assert.equal(importedCount, 1);
  const importedSection = await prisma.projectSection.findFirstOrThrow({
    where: { projectId: seed.project.id, name: `${seed.key} Imported Group Section` },
  });
  const importedBinding = await prisma.sectionPresetBinding.findFirstOrThrow({
    where: { projectSectionId: importedSection.id },
  });
  assert.equal(importedBinding.presetId, null);
  assert.equal(importedBinding.variantId, null);
  assert.equal(importedBinding.presetGroupId, group.id);
  assert.equal(importedBinding.groupBindingKey, templateBinding.groupBindingKey);
});

test("importTemplateToProject imports template project binding sections without duplicate section binding ids", async () => {
  const seed = await seedProjectWithPreset({ withProjectBinding: true });
  const template = await prisma.projectTemplate.create({
    data: { id: `${seed.key}-template`, name: `${seed.key} Template` },
  });
  const templateSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-template-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Imported Project Binding Section`,
    },
  });
  const templateBinding = await prisma.templateSectionPresetBinding.create({
    data: {
      projectTemplateSectionId: templateSection.id,
      bindingKey: `template-project:${seed.category.id}`,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantB.id,
      sortOrder: 0,
    },
  });
  await prisma.templateSectionPromptBlock.create({
    data: {
      projectTemplateSectionId: templateSection.id,
      templateSectionBindingId: templateBinding.id,
      type: "preset",
      sortOrder: 0,
    },
  });

  const importedCount = await ignoreStaticRevalidateError(() =>
    importTemplateToProject(seed.project.id, template.id) as Promise<number>
  );

  if (importedCount !== undefined) assert.equal(importedCount, 1);
  const importedSection = await prisma.projectSection.findFirstOrThrow({
    where: { projectId: seed.project.id, name: `${seed.key} Imported Project Binding Section` },
  });
  const bindings = await prisma.sectionPresetBinding.findMany({
    where: { projectSectionId: importedSection.id },
  });
  assert.deepEqual(bindings.map((binding) => binding.bindingKey), [
    `template-project:${seed.category.id}`,
  ]);
  assert.equal(bindings[0].variantId, seed.variantA.id);

  const promptRow = await prisma.sectionPromptBlock.findFirstOrThrow({
    where: { projectSectionId: importedSection.id },
  });
  assert.equal(promptRow.sectionBindingId, bindings[0].id);
});

test("importTemplateToProject rejects LoRA training preset bindings stored in generation templates", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  const template = await prisma.projectTemplate.create({
    data: { id: `${seed.key}-training-template-import`, name: `${seed.key} Training Import Template` },
  });
  const templateSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-training-template-import-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Training Import Section`,
    },
  });
  await prisma.projectTemplatePresetBinding.create({
    data: {
      projectTemplateId: template.id,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });
  await prisma.templateSectionPresetBinding.create({
    data: {
      projectTemplateSectionId: templateSection.id,
      bindingKey: `${seed.key}-training-template-binding`,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });

  await assert.rejects(
    () => importTemplateToProject(seed.project.id, template.id),
    /ordinary preset/i,
    "generation template imports must reject historical training-owned preset bindings",
  );
  assert.equal(
    await prisma.sectionPresetBinding.count({
      where: { categoryId: `${seed.key}-training-category` },
    }),
    0,
    "failed imports must not write training preset bindings into generation project sections",
  );
});

test("saveProjectAsTemplate rejects LoRA training preset bindings stored in generation projects", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  await prisma.projectPresetBinding.create({
    data: {
      projectId: seed.project.id,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });
  const sectionBinding = await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey: `${seed.key}-training-section-binding`,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });
  await prisma.sectionPromptBlock.create({
    data: {
      projectSectionId: seed.section.id,
      sectionBindingId: sectionBinding.id,
      type: "preset",
      sortOrder: 0,
    },
  });

  await assert.rejects(
    () => ignoreStaticRevalidateError(() =>
      saveProjectAsTemplate(seed.project.id, `${seed.key} Training Save Template`)
    ),
    /ordinary preset/i,
    "saving generation projects as templates must reject historical training-owned preset bindings",
  );
  assert.equal(
    await prisma.projectTemplatePresetBinding.count({
      where: { categoryId: `${seed.key}-training-category` },
    }),
    0,
    "failed saves must not copy training preset bindings into generation templates",
  );
});

test("template CRUD converts submitted prompt and manual lora data into template relation rows", async () => {
  const seed = await seedProjectWithPreset();

  const templateId = await ignoreStaticRevalidateError(() => createProjectTemplate({
    name: `${seed.key} CRUD Template`,
    sections: [templateSectionInput(seed)],
  })) ?? (await prisma.projectTemplate.findFirstOrThrow({
    where: { name: `${seed.key} CRUD Template` },
    select: { id: true },
  })).id;
  const section = await prisma.projectTemplateSection.findFirstOrThrow({
    where: { projectTemplateId: templateId },
  });
  const createdBindings = await prisma.templateSectionPresetBinding.findMany({
    where: { projectTemplateSectionId: section.id },
  });
  assert.deepEqual(createdBindings.map((row) => [row.bindingKey, row.presetId, row.variantId]), [
    [`${seed.key}-legacy-binding`, seed.preset.id, seed.variantA.id],
  ]);
  const createdPromptRows = await prisma.templateSectionPromptBlock.findMany({
    where: { projectTemplateSectionId: section.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(createdPromptRows.length, 2);
  assert.equal(createdPromptRows[0].templateSectionBindingId, createdBindings[0].id);
  assert.equal(createdPromptRows[0].customPositive, null);
  assert.equal(createdPromptRows[1].templateSectionBindingId, null);
  assert.equal(createdPromptRows[1].customPositive, `${seed.key} custom positive`);
  assert.equal(await prisma.templateSectionManualLoraEntry.count({ where: { projectTemplateSectionId: section.id } }), 1);

  await ignoreStaticRevalidateError(() => updateProjectTemplateSection({
    templateId,
    sectionId: section.id,
    section: templateSectionInput(seed, {
      id: section.id,
      name: `${seed.key} Updated Template Section`,
      promptBlocks: [legacyPresetPromptBlock(seed, `${seed.key}-updated-binding`)],
      loraConfig: {
        lora1: [],
        lora2: [
          {
            id: `${seed.key}-manual-lora-2`,
            path: `/${seed.key}-manual-2.safetensors`,
            weight: 0.5,
            enabled: true,
            source: "manual",
          },
        ],
      },
    }),
  }));
  const updatedSection = await prisma.projectTemplateSection.findUniqueOrThrow({ where: { id: section.id } });
  assert.equal(updatedSection.name, `${seed.key} Updated Template Section`);
  const updatedBindings = await prisma.templateSectionPresetBinding.findMany({
    where: { projectTemplateSectionId: section.id },
  });
  assert.deepEqual(updatedBindings.map((row) => [row.bindingKey, row.presetId, row.variantId]), [
    [`${seed.key}-updated-binding`, seed.preset.id, seed.variantA.id],
  ]);
  assert.equal(await prisma.templateSectionPromptBlock.count({ where: { projectTemplateSectionId: section.id } }), 1);
  assert.deepEqual(
    (await prisma.templateSectionManualLoraEntry.findMany({ where: { projectTemplateSectionId: section.id } }))
      .map((row) => [row.stage, row.path]),
    [["lora2", `/${seed.key}-manual-2.safetensors`]],
  );

  const copiedSectionId = await ignoreStaticRevalidateError(() => copyProjectTemplateSection(section.id)) ??
    (await prisma.projectTemplateSection.findFirstOrThrow({
      where: {
        projectTemplateId: templateId,
        id: { not: section.id },
      },
      orderBy: { sortOrder: "desc" },
      select: { id: true },
    })).id;
  assert.ok(copiedSectionId);
  const copied = await prisma.projectTemplateSection.findUniqueOrThrow({ where: { id: copiedSectionId } });
  assert.equal(copied.projectTemplateId, templateId);
  assert.equal(await prisma.templateSectionPresetBinding.count({ where: { projectTemplateSectionId: copiedSectionId } }), 1);
  assert.equal(await prisma.templateSectionPromptBlock.count({ where: { projectTemplateSectionId: copiedSectionId } }), 1);
  assert.equal(await prisma.templateSectionManualLoraEntry.count({ where: { projectTemplateSectionId: copiedSectionId } }), 1);
});

test("template CRUD writes reject LoRA training preset resources", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  const trainingSection = templateSectionInput(seed, {
    promptBlocks: [trainingPresetPromptBlock(seed)],
    loraConfig: { lora1: [], lora2: [] },
  });

  await assert.rejects(
    () => createProjectTemplate({
      name: `${seed.key} Training Template`,
      sections: [trainingSection],
    }),
    /ordinary preset/i,
    "generation template creation must reject training-owned preset bindings",
  );

  const template = await prisma.projectTemplate.create({
    data: { id: `${seed.key}-template-boundary`, name: `${seed.key} Boundary Template` },
  });
  const section = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-template-boundary-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Boundary Section`,
    },
  });

  await assert.rejects(
    () => updateProjectTemplate({
      id: template.id,
      sections: [
        {
          ...trainingSection,
          id: section.id,
        },
      ],
    }),
    /ordinary preset/i,
    "generation template section updates must reject training-owned preset bindings",
  );

  await assert.rejects(
    () => updateProjectTemplateSection({
      templateId: template.id,
      sectionId: section.id,
      section: {
        ...trainingSection,
        id: section.id,
      },
    }),
    /ordinary preset/i,
    "generation template single-section saves must reject training-owned preset bindings",
  );
});

test("copyProjectTemplateSection rejects LoRA training preset bindings stored in generation templates", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  const template = await prisma.projectTemplate.create({
    data: { id: `${seed.key}-copy-training-template`, name: `${seed.key} Copy Training Template` },
  });
  const section = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-copy-training-template-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Copy Training Section`,
    },
  });
  await prisma.templateSectionPresetBinding.create({
    data: {
      projectTemplateSectionId: section.id,
      bindingKey: `${seed.key}-copy-training-binding`,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });

  await assert.rejects(
    () => copyProjectTemplateSection(section.id),
    /ordinary preset/i,
    "copying generation template sections must reject historical training-owned preset bindings",
  );
  assert.equal(
    await prisma.templateSectionPresetBinding.count({
      where: {
        categoryId: `${seed.key}-training-category`,
        projectTemplateSectionId: { not: section.id },
      },
    }),
    0,
    "failed template section copies must not duplicate training preset bindings",
  );
});

test("copyProjectTemplateSection inserts the copy immediately after the source section", async () => {
  const seed = await seedProjectWithPreset();
  const template = await prisma.projectTemplate.create({
    data: {
      id: `${seed.key}-copy-order-template`,
      name: `${seed.key} Copy Order Template`,
    },
  });
  const sourceSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-template-source-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Template Source`,
    },
  });
  const laterSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-template-later-section`,
      projectTemplateId: template.id,
      sortOrder: 1,
      name: `${seed.key} Template Later`,
    },
  });

  const copiedSectionId = await ignoreStaticRevalidateError(() => copyProjectTemplateSection(sourceSection.id)) ??
    (await prisma.projectTemplateSection.findFirstOrThrow({
      where: { projectTemplateId: template.id, id: { notIn: [sourceSection.id, laterSection.id] } },
      select: { id: true },
    })).id;

  const orderedSections = await prisma.projectTemplateSection.findMany({
    where: { projectTemplateId: template.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  assert.deepEqual(orderedSections.map((section) => section.id), [
    sourceSection.id,
    copiedSectionId,
    laterSection.id,
  ]);
  assert.deepEqual(orderedSections.map((section) => section.sortOrder), [0, 1, 2]);
});

test("copyProjectTemplateSection preserves presetGroupId on copied bindings", async () => {
  const seed = await seedProjectWithPreset();
  const groupCategory = await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-copy-group-category`,
      name: `${seed.key} Copy Group Category`,
      slug: `${seed.key}-copy-group-category`,
      type: "group",
    },
  });
  const group = await prisma.presetGroup.create({
    data: {
      id: `${seed.key}-copy-group`,
      categoryId: groupCategory.id,
      name: `${seed.key} Copy Group`,
      slug: `${seed.key}-copy-group`,
    },
  });
  const template = await prisma.projectTemplate.create({
    data: {
      id: `${seed.key}-copy-group-template`,
      name: `${seed.key} Copy Group Template`,
    },
  });
  const sourceSection = await prisma.projectTemplateSection.create({
    data: {
      id: `${seed.key}-copy-group-source-section`,
      projectTemplateId: template.id,
      sortOrder: 0,
      name: `${seed.key} Copy Group Source`,
    },
  });
  const sourceBinding = await prisma.templateSectionPresetBinding.create({
    data: {
      projectTemplateSectionId: sourceSection.id,
      bindingKey: `${seed.key}-copy-group-binding`,
      categoryId: groupCategory.id,
      presetId: null,
      variantId: null,
      presetGroupId: group.id,
      groupBindingKey: `grp:${group.id}:${seed.key}-copy-instance`,
      sortOrder: 0,
    },
  });
  await prisma.templateSectionPromptBlock.create({
    data: {
      projectTemplateSectionId: sourceSection.id,
      templateSectionBindingId: sourceBinding.id,
      type: "preset",
      sortOrder: 0,
    },
  });

  const copiedSectionId = await ignoreStaticRevalidateError(() => copyProjectTemplateSection(sourceSection.id)) ??
    (await prisma.projectTemplateSection.findFirstOrThrow({
      where: { projectTemplateId: template.id, id: { not: sourceSection.id } },
      select: { id: true },
    })).id;

  const copiedBinding = await prisma.templateSectionPresetBinding.findFirstOrThrow({
    where: { projectTemplateSectionId: copiedSectionId },
  });
  assert.equal(copiedBinding.presetId, null);
  assert.equal(copiedBinding.variantId, null);
  assert.equal(copiedBinding.presetGroupId, group.id);
  assert.equal(copiedBinding.groupBindingKey, sourceBinding.groupBindingKey);
});

test("project preset binding writes use ProjectPresetBinding rows without rewriting section caches", async () => {
  const seed = await seedProjectWithPreset();

  const createdProjectId = await ignoreStaticRevalidateError(() => createProject({
    title: `${seed.key} Created Project`,
    checkpointName: `${seed.key}.ckpt`,
    presetBindings: [{ categoryId: seed.category.id, presetId: seed.preset.id, variantId: seed.variantA.id }],
    notes: null,
  })) ?? (await prisma.project.findFirstOrThrow({
    where: { title: `${seed.key} Created Project` },
    select: { id: true },
  })).id;
  assert.equal(await prisma.projectPresetBinding.count({ where: { projectId: createdProjectId } }), 1);
  await prisma.project.findUniqueOrThrow({ where: { id: createdProjectId } });

  await ignoreStaticRevalidateError(() => updateProject({
    projectId: seed.project.id,
    presetBindings: [{ categoryId: seed.category.id, presetId: seed.preset.id, variantId: seed.variantB.id }],
  }));

  const rows = await prisma.projectPresetBinding.findMany({ where: { projectId: seed.project.id } });
  assert.deepEqual(rows.map((row) => [row.categoryId, row.presetId, row.variantId]), [
    [seed.category.id, seed.preset.id, seed.variantB.id],
  ]);
  await prisma.projectSection.findUniqueOrThrow({ where: { id: seed.section.id } });
  assert.equal(await prisma.sectionPromptBlock.count({ where: { projectSectionId: seed.section.id } }), 0);
});

test("project preset binding writes reject LoRA training preset resources", async () => {
  const seed = await seedProjectWithPreset();
  await prisma.presetCategory.create({
    data: {
      id: `${seed.key}-training-category`,
      name: `${seed.key} Training Category`,
      slug: `${seed.key}-training-category`,
      type: "training_scene_description",
    },
  });
  await prisma.preset.create({
    data: {
      id: `${seed.key}-training-preset`,
      categoryId: `${seed.key}-training-category`,
      name: `${seed.key} Training Preset`,
      slug: `${seed.key}-training-preset`,
    },
  });
  await prisma.presetVariant.create({
    data: {
      id: `${seed.key}-training-variant`,
      presetId: `${seed.key}-training-preset`,
      name: "Training",
      slug: `${seed.key}-training-variant`,
      prompt: `${seed.key} training prompt must not enter generation bindings`,
    },
  });

  await assert.rejects(
    () => createProject({
      title: `${seed.key} Training Binding Project`,
      checkpointName: `${seed.key}.ckpt`,
      presetBindings: [
        {
          categoryId: `${seed.key}-training-category`,
          presetId: `${seed.key}-training-preset`,
          variantId: `${seed.key}-training-variant`,
        },
      ],
      notes: null,
    }),
    /ordinary preset/i,
    "generation project creation must reject training-owned preset bindings",
  );

  await assert.rejects(
    () => updateProject({
      projectId: seed.project.id,
      presetBindings: [
        {
          categoryId: `${seed.key}-training-category`,
          presetId: `${seed.key}-training-preset`,
          variantId: `${seed.key}-training-variant`,
        },
      ],
    }),
    /ordinary preset/i,
    "generation project updates must reject training-owned preset bindings",
  );
});

test("addSection rejects LoRA training project preset bindings before creating a generation section", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  await prisma.projectPresetBinding.create({
    data: {
      projectId: seed.project.id,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });
  const sectionCountBefore = await prisma.projectSection.count({ where: { projectId: seed.project.id } });

  await assert.rejects(
    () => addSection(seed.project.id, `${seed.key} Training Section`),
    /ordinary preset/i,
    "adding generation sections must reject historical training-owned project preset bindings",
  );
  assert.equal(
    await prisma.projectSection.count({ where: { projectId: seed.project.id } }),
    sectionCountBefore,
    "failed section creation must not leave a generation section behind",
  );
});

test("applyParamToAllSections rejects LoRA training project preset bindings", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  await prisma.projectPresetBinding.create({
    data: {
      projectId: seed.project.id,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });

  const result = await applyParamToAllSections(seed.project.id, "presets", null);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /ordinary preset/i);
  assert.equal(
    await prisma.sectionPresetBinding.count({
      where: { categoryId: `${seed.key}-training-category` },
    }),
    0,
    "failed preset application must not write training preset bindings into generation sections",
  );
});

test("copySection rejects LoRA training preset bindings stored in generation sections", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey: `${seed.key}-training-copy-section-binding`,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });

  await assert.rejects(
    () => copySection(seed.section.id),
    /ordinary preset/i,
    "copying generation sections must reject historical training-owned preset bindings",
  );
  assert.equal(
    await prisma.sectionPresetBinding.count({
      where: {
        categoryId: `${seed.key}-training-category`,
        projectSectionId: { not: seed.section.id },
      },
    }),
    0,
    "failed section copies must not duplicate training preset bindings",
  );
});

test("copyProject rejects LoRA training preset bindings stored in generation sections", async () => {
  const seed = await seedProjectWithPreset();
  await seedTrainingPresetResource(seed);
  await prisma.sectionPresetBinding.create({
    data: {
      projectSectionId: seed.section.id,
      bindingKey: `${seed.key}-training-copy-project-binding`,
      categoryId: `${seed.key}-training-category`,
      presetId: `${seed.key}-training-preset`,
      variantId: `${seed.key}-training-variant`,
      sortOrder: 0,
    },
  });

  await assert.rejects(
    () => ignoreStaticRevalidateError(() => copyProject(seed.project.id)),
    /ordinary preset/i,
    "copying generation projects must reject historical training-owned section preset bindings",
  );
  assert.equal(
    await prisma.sectionPresetBinding.count({
      where: {
        categoryId: `${seed.key}-training-category`,
        projectSectionId: { not: seed.section.id },
      },
    }),
    0,
    "failed project copies must not duplicate training preset bindings",
  );
});

test("applyParamToAllSections presets applies ProjectPresetBinding rows as section bindings only", async () => {
  const seed = await seedProjectWithPreset();
  await prisma.projectPresetBinding.create({
    data: {
      projectId: seed.project.id,
      categoryId: seed.category.id,
      presetId: seed.preset.id,
      variantId: seed.variantA.id,
      sortOrder: 0,
    },
  });

  const result = await applyParamToAllSections(seed.project.id, "presets", null);

  const bindings = await prisma.sectionPresetBinding.findMany({ where: { projectSectionId: seed.section.id } });
  assert.equal(bindings.length, 1);
  assert.deepEqual(result, { ok: true, count: 1 });
  assert.equal(bindings[0].presetId, seed.preset.id);
  assert.equal(bindings[0].variantId, seed.variantA.id);
  const promptRows = await prisma.sectionPromptBlock.findMany({ where: { projectSectionId: seed.section.id } });
  assert.equal(promptRows.length, 1);
  assert.equal(promptRows[0].sectionBindingId, bindings[0].id);
  await prisma.projectSection.findUniqueOrThrow({ where: { id: seed.section.id } });
});
