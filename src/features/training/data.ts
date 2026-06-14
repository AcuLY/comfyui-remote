import { loadDesignDemoData } from "@/app/design-demos/data/load-demo-data";
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

export async function loadTrainingRouteData(): Promise<TrainingAppData> {
  const [baseData, loraTraining] = await Promise.all([
    loadDesignDemoData(),
    loadTrainingSnapshot(),
  ]);

  return {
    images: baseData.images,
    loraTraining,
    models: baseData.models.map((model) => ({
      modelType: model.modelType,
      name: model.name,
      relativePath: model.relativePath,
    })),
    shellData: {
      ...baseData,
      loraTraining,
      metrics: {
        ...baseData.metrics,
        projects: loraTraining.projects.length,
        runs: loraTraining.runs.length,
      },
    },
  };
}
