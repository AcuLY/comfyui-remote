import type { DemoData } from "@/app/design-demos/data/types";
import { loadTrainingSnapshot } from "@/server/services/training/snapshot-service";
import type { LoraTrainingDemoData, TrainingImage } from "./types";

export type TrainingModelOption = Pick<DemoData["models"][number], "modelType" | "name" | "relativePath">;

export type TrainingAppData = Pick<DemoData, "images" | "models"> & {
  images: TrainingImage[];
  loraTraining?: LoraTrainingDemoData;
  models: TrainingModelOption[];
  shellData?: DemoData;
};

export function resolveTrainingShellData(data: TrainingAppData): DemoData | null {
  return data.shellData ?? null;
}

function buildTrainingShellData(loraTraining: LoraTrainingDemoData): DemoData {
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

export async function loadTrainingRouteData(): Promise<TrainingAppData> {
  const loraTraining = await loadTrainingSnapshot();

  return {
    images: [],
    loraTraining,
    models: [],
    shellData: buildTrainingShellData(loraTraining),
  };
}
