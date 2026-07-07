export const FIXTURE_TIMESTAMP = "2026-01-01T00:00:00.000Z";

export interface ProjectFixture {
  id: string;
  title: string;
  slug: string;
  status: string;
  folderId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSectionFixture {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  sortOrder: number;
  enabled: boolean;
  aspectRatio: string;
  batchSize: number;
}

export interface PresetCategoryFixture {
  id: string;
  name: string;
  sortOrder: number;
  slotTemplate: string | null;
}

export interface PresetFixture {
  id: string;
  categoryId: string;
  folderId: string | null;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  sortOrder: number;
}

export interface PresetGroupFixture {
  id: string;
  categoryId: string;
  folderId: string | null;
  name: string;
  memberPresetIds: string[];
  sortOrder: number;
}

export interface TemplateFixture {
  id: string;
  title: string;
  slug: string;
  sectionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RunFixture {
  id: string;
  projectId: string;
  projectSectionId: string;
  status: string;
  runIndex: number;
  outputDir: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageResultFixture {
  id: string;
  runId: string;
  filePath: string;
  thumbPath: string | null;
  reviewStatus: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingProjectFixture {
  id: string;
  title: string;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSectionFixture {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
}

export interface TrainingGenerationTaskFixture {
  id: string;
  projectId: string;
  sectionId: string;
  status: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingDatasetRevisionFixture {
  id: string;
  projectId: string;
  status: string;
  imageIds: string[];
  frozenAt: string;
  createdAt: string;
}

export interface TrainingRunFixture {
  id: string;
  projectId: string;
  datasetRevisionId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function buildProjectFixture(overrides: Partial<ProjectFixture> = {}): ProjectFixture {
  return withOverrides(
    {
      id: "project-fixture",
      title: "Project Fixture",
      slug: "project-fixture",
      status: "draft",
      folderId: null,
      archivedAt: null,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

export function buildProjectSectionFixture(
  overrides: Partial<ProjectSectionFixture> = {},
): ProjectSectionFixture {
  return withOverrides(
    {
      id: "project-section-fixture",
      projectId: "project-fixture",
      folderId: null,
      name: "Section Fixture",
      sortOrder: 1,
      enabled: true,
      aspectRatio: "1:1",
      batchSize: 1,
    },
    overrides,
  );
}

export function buildPresetCategoryFixture(
  overrides: Partial<PresetCategoryFixture> = {},
): PresetCategoryFixture {
  return withOverrides(
    {
      id: "preset-category-fixture",
      name: "Preset Category Fixture",
      sortOrder: 1,
      slotTemplate: null,
    },
    overrides,
  );
}

export function buildPresetFixture(overrides: Partial<PresetFixture> = {}): PresetFixture {
  return withOverrides(
    {
      id: "preset-fixture",
      categoryId: "preset-category-fixture",
      folderId: null,
      name: "Preset Fixture",
      positivePrompt: "positive fixture prompt",
      negativePrompt: "",
      sortOrder: 1,
    },
    overrides,
  );
}

export function buildPresetGroupFixture(
  overrides: Partial<PresetGroupFixture> = {},
): PresetGroupFixture {
  return withOverrides(
    {
      id: "preset-group-fixture",
      categoryId: "preset-category-fixture",
      folderId: null,
      name: "Preset Group Fixture",
      memberPresetIds: ["preset-fixture"],
      sortOrder: 1,
    },
    overrides,
  );
}

export function buildTemplateFixture(overrides: Partial<TemplateFixture> = {}): TemplateFixture {
  return withOverrides(
    {
      id: "template-fixture",
      title: "Template Fixture",
      slug: "template-fixture",
      sectionIds: ["project-section-fixture"],
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

export function buildRunFixture(overrides: Partial<RunFixture> = {}): RunFixture {
  return withOverrides(
    {
      id: "run-fixture",
      projectId: "project-fixture",
      projectSectionId: "project-section-fixture",
      status: "queued",
      runIndex: 1,
      outputDir: null,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

export function buildImageResultFixture(
  overrides: Partial<ImageResultFixture> = {},
): ImageResultFixture {
  return withOverrides(
    {
      id: "image-result-fixture",
      runId: "run-fixture",
      filePath: "/tmp/comfyui-remote/fixture.png",
      thumbPath: "/tmp/comfyui-remote/fixture.webp",
      reviewStatus: "pending",
      featured: false,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

export function buildTrainingProjectFixture(
  overrides: Partial<TrainingProjectFixture> = {},
): TrainingProjectFixture {
  return withOverrides(
    {
      id: "training-project-fixture",
      title: "Training Project Fixture",
      status: "draft",
      archivedAt: null,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

export function buildTrainingSectionFixture(
  overrides: Partial<TrainingSectionFixture> = {},
): TrainingSectionFixture {
  return withOverrides(
    {
      id: "training-section-fixture",
      projectId: "training-project-fixture",
      name: "Training Section Fixture",
      sortOrder: 1,
      enabled: true,
    },
    overrides,
  );
}

export function buildTrainingGenerationTaskFixture(
  overrides: Partial<TrainingGenerationTaskFixture> = {},
): TrainingGenerationTaskFixture {
  return withOverrides(
    {
      id: "training-generation-task-fixture",
      projectId: "training-project-fixture",
      sectionId: "training-section-fixture",
      status: "draft",
      prompt: "training generation fixture prompt",
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

export function buildTrainingDatasetRevisionFixture(
  overrides: Partial<TrainingDatasetRevisionFixture> = {},
): TrainingDatasetRevisionFixture {
  return withOverrides(
    {
      id: "training-dataset-revision-fixture",
      projectId: "training-project-fixture",
      status: "ready",
      imageIds: ["image-result-fixture"],
      frozenAt: FIXTURE_TIMESTAMP,
      createdAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

export function buildTrainingRunFixture(
  overrides: Partial<TrainingRunFixture> = {},
): TrainingRunFixture {
  return withOverrides(
    {
      id: "training-run-fixture",
      projectId: "training-project-fixture",
      datasetRevisionId: "training-dataset-revision-fixture",
      status: "queued",
      startedAt: null,
      completedAt: null,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    },
    overrides,
  );
}

function withOverrides<T>(base: T, overrides: Partial<T>): T {
  return { ...base, ...overrides };
}
