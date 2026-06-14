import { loadDesignDemoData } from "@/app/design-demos/data/load-demo-data";
import type { DemoData } from "@/app/design-demos/data/types";
import { loadTrainingSnapshot } from "@/server/services/training/snapshot-service";

export async function loadTrainingRouteData(): Promise<DemoData> {
  const [baseData, loraTraining] = await Promise.all([
    loadDesignDemoData(),
    loadTrainingSnapshot(),
  ]);

  return {
    ...baseData,
    loraTraining,
    metrics: {
      ...baseData.metrics,
      projects: loraTraining.projects.length,
      runs: loraTraining.runs.length,
    },
  };
}
