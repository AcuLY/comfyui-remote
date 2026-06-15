import { loadTrainingSnapshot } from "@/server/services/training/snapshot-service";
import { buildTrainingShellData } from "./data";
import type { TrainingAppData } from "./data";

export async function loadTrainingRouteData(): Promise<TrainingAppData> {
  const loraTraining = await loadTrainingSnapshot();

  return {
    images: [],
    loraTraining,
    models: [],
    shellData: buildTrainingShellData(loraTraining),
  };
}
