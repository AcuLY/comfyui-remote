import type { LoraTrainingData, TrainingImage } from "./types";

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
  loras: TrainingModelOption[];
  models: TrainingModelOption[];
  auditLogs: never[];
  images: never[];
  loraTraining?: LoraTrainingData;
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

export function buildTrainingShellData(loraTraining: LoraTrainingData, models: TrainingModelOption[]): TrainingShellData {
  const sectionCount = loraTraining.projects.reduce((sum, project) => sum + project.sections.length, 0);
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
    loraTraining,
  };
}
