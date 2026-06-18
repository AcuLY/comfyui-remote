import type {
  LoraTrainingData,
  LoraTrainingProject,
  LoraTrainingReviewStatus,
  LoraTrainingTaskKind,
  LoraTrainingTaskStatus,
  TrainingImage,
} from "./types";

export type TrainingModelOption = {
  modelType: string;
  name: string;
  relativePath: string;
};

export type TrainingShellProject = {
  id: string;
  title: string;
  status: LoraTrainingProject["status"];
  sectionCount: number;
  keptCount: number;
  captionMissingCount: number;
  profileSummary: string;
  datasetVersion: string;
  readiness: "完整" | "待补";
  resultCount: number;
  datasetRevisionCount: number;
  sections: Array<{
    id: string;
    title: string;
    blockCount: number;
    imageCount: number;
    resolvedScene: string;
    resultStatus: LoraTrainingReviewStatus;
  }>;
  datasetRevisions: Array<{
    id: string;
    version: string;
    status: "ready" | "training" | "draft";
    itemCount: number;
    captionMissingCount: number;
  }>;
};

export type TrainingShellRun = {
  id: string;
  kind: LoraTrainingTaskKind;
  projectId: string;
  projectTitle: string;
  status: LoraTrainingTaskStatus;
  summary: string;
  timestamp: string;
  title: string;
};

export type TrainingShellPreset = {
  id: string;
  title: string;
  category: string;
  folder: string;
  status: "active" | "inactive";
  sceneDescriptionText: string;
  projectUsage: string[];
  templateUsage: string[];
};

export type TrainingShellTemplate = {
  id: string;
  title: string;
  status: "active" | "archived";
  description: string;
  sectionCount: number;
  sections: Array<{
    title: string;
    enabled: boolean;
    blockCount: number;
    scenePreview: string;
  }>;
};

export type TrainingShellData = {
  source: {
    loadedFromSqlite: boolean;
    databaseLabel: string;
    imageSourceLabel: string;
    modelBaseLabel: string;
    comfyApiLabel: string;
    warning: string | null;
  };
  metrics: {
    projects: number;
    sections: number;
    runs: number;
    pendingImages: number;
    presets: number;
    templates: number;
    loras: number;
  };
  projectFolders: never[];
  projects: never[];
  runs: never[];
  categories: never[];
  templates: never[];
  loras: TrainingModelOption[];
  models: TrainingModelOption[];
  auditLogs: never[];
  images: never[];
  training: {
    projects: TrainingShellProject[];
    runs: TrainingShellRun[];
    presets: TrainingShellPreset[];
    templates: TrainingShellTemplate[];
  };
};

export type TrainingAppData = {
  images: TrainingImage[];
  loraTraining?: LoraTrainingData;
  models: TrainingModelOption[];
  shellData?: TrainingShellData;
};

export function resolveTrainingShellData(data: TrainingAppData): TrainingShellData | null {
  return data.shellData ?? null;
}

function buildTrainingShellProject(project: LoraTrainingProject): TrainingShellProject {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    sectionCount: project.sectionCount,
    keptCount: project.keptCount,
    captionMissingCount: project.captionMissingCount,
    profileSummary: project.profileSummary,
    datasetVersion: project.datasetVersion,
    readiness: project.readiness,
    resultCount: project.resultPool.length,
    datasetRevisionCount: project.datasetRevisions.length,
    sections: project.sections.map((section) => ({
      id: section.id,
      title: section.title,
      blockCount: section.blocks.length,
      imageCount: section.images.length,
      resolvedScene: section.resolvedScene,
      resultStatus: section.resultStatus,
    })),
    datasetRevisions: project.datasetRevisions.map((revision) => ({
      id: revision.id,
      version: revision.version,
      status: revision.status,
      itemCount: revision.itemCount,
      captionMissingCount: revision.captionMissingCount,
    })),
  };
}

export function buildTrainingShellData(loraTraining: LoraTrainingData, models: TrainingModelOption[]): TrainingShellData {
  const sectionCount = loraTraining.projects.reduce((sum, project) => sum + project.sectionCount, 0);
  const pendingImages = loraTraining.projects.reduce(
    (sum, project) => sum + project.resultPool.filter((result) => result.reviewStatus === "pending").length,
    0,
  );
  const loras = models.filter((model) => model.modelType === "lora");

  return {
    source: {
      loadedFromSqlite: true,
      databaseLabel: "Training Snapshot",
      imageSourceLabel: "Training Snapshot",
      modelBaseLabel: "Training Model Discovery",
      comfyApiLabel: "Training Scheduler",
      warning: null,
    },
    metrics: {
      projects: loraTraining.projects.length,
      sections: sectionCount,
      runs: loraTraining.runs.length,
      pendingImages,
      presets: loraTraining.presets.length,
      templates: loraTraining.templates.length,
      loras: loras.length,
    },
    projectFolders: [],
    projects: [],
    runs: [],
    categories: [],
    templates: [],
    loras,
    models: models.map((model) => ({ ...model })),
    auditLogs: [],
    images: [],
    training: {
      projects: loraTraining.projects.map(buildTrainingShellProject),
      runs: loraTraining.runs.map((run) => ({
        id: run.id,
        kind: run.kind,
        projectId: run.projectId,
        projectTitle: run.projectTitle,
        status: run.status,
        summary: run.summary,
        timestamp: run.timestamp,
        title: run.title,
      })),
      presets: loraTraining.presets.map((preset) => ({
        id: preset.id,
        title: preset.title,
        category: preset.category,
        folder: preset.folder,
        status: preset.status,
        sceneDescriptionText: preset.sceneDescriptionText,
        projectUsage: [...preset.projectUsage],
        templateUsage: [...preset.templateUsage],
      })),
      templates: loraTraining.templates.map((template) => ({
        id: template.id,
        title: template.title,
        status: template.status,
        description: template.description,
        sectionCount: template.sectionCount,
        sections: template.sections.map((section) => ({
          title: section.title,
          enabled: section.enabled,
          blockCount: section.blockCount,
          scenePreview: section.scenePreview,
        })),
      })),
    },
  };
}
