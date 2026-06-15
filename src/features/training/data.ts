import type { LoraTrainingDemoData, TrainingImage } from "./types";

export type TrainingModelOption = {
  modelType: string;
  name: string;
  relativePath: string;
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
  loras: never[];
  models: never[];
  auditLogs: never[];
  images: never[];
  loraTraining?: LoraTrainingDemoData;
};

export type TrainingAppData = {
  images: TrainingImage[];
  loraTraining?: LoraTrainingDemoData;
  models: TrainingModelOption[];
  shellData?: TrainingShellData;
};

export function resolveTrainingShellData(data: TrainingAppData): TrainingShellData | null {
  return data.shellData ?? null;
}

export function buildTrainingShellData(loraTraining: LoraTrainingDemoData): TrainingShellData {
  const sectionCount = loraTraining.projects.reduce((sum, project) => sum + project.sections.length, 0);
  const pendingImages = loraTraining.projects.reduce(
    (sum, project) => sum + project.resultPool.filter((result) => result.reviewStatus === "pending").length,
    0,
  );

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
      loras: 0,
    },
    projectFolders: [],
    projects: [],
    runs: [],
    categories: [],
    templates: [],
    loras: [],
    models: [],
    auditLogs: [],
    images: [],
    loraTraining,
  };
}
