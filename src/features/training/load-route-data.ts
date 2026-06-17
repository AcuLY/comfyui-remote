import type { ModelKind } from "@/lib/model-constants";
import {
  listModelAssets,
  ModelAssetError,
} from "@/server/services/model-asset-service";
import { loadTrainingSnapshot } from "@/server/services/training/snapshot-service";
import { buildTrainingShellData } from "./data";
import type { TrainingAppData, TrainingModelOption } from "./data";

function shouldReturnEmptyModelList(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Database .* does not exist|Can't reach database server|ECONNREFUSED|P1001|P1003/i.test(message);
}

async function loadSharedModelAssets(kind: ModelKind): Promise<TrainingModelOption[]> {
  try {
    const models = kind === "checkpoint"
      ? await listModelAssets("checkpoint")
      : await listModelAssets("lora");
    return models.map((model) => ({
      modelType: model.modelType,
      name: model.name,
      relativePath: model.relativePath,
    }));
  } catch (error) {
    if (error instanceof ModelAssetError || shouldReturnEmptyModelList(error)) {
      return [];
    }
    throw error;
  }
}

export async function loadTrainingRouteData(): Promise<TrainingAppData> {
  const [loraTraining, checkpointModels, loraModels] = await Promise.all([
    loadTrainingSnapshot(),
    loadSharedModelAssets("checkpoint"),
    loadSharedModelAssets("lora"),
  ]);
  const models = [...checkpointModels, ...loraModels];

  return {
    images: [],
    loraTraining,
    models,
    shellData: buildTrainingShellData(loraTraining, models),
  };
}
