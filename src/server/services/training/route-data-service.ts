import type { ModelKind } from "@/lib/model-constants";
import {
  listModelAssets,
  ModelAssetError,
} from "@/server/services/model-asset-service";
import {
  loadTrainingProjectCreationRouteData,
  loadTrainingProjectRouteData,
  loadTrainingProjectsRouteData,
  loadTrainingPresetsRouteData,
  loadTrainingRunsRouteData,
  loadTrainingTemplatesRouteData,
} from "@/server/services/training/snapshot-service";
import { buildTrainingShellData } from "@/features/training/data";
import type { TrainingAppData, TrainingModelOption } from "@/features/training/data";
import { matchRoute } from "@/features/training/routes";

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

function routeSegmentsToPath(route: readonly string[]) {
  return route.length > 0 ? `/training/${route.join("/")}` : "/training";
}

async function loadLoraTrainingForRoute(route: readonly string[]) {
  const match = matchRoute(routeSegmentsToPath(route));

  switch (match.key) {
    case "training-projects":
      return loadTrainingProjectsRouteData();
    case "training-project-new":
      return loadTrainingProjectCreationRouteData();
    case "training-project-detail":
    case "training-project-profile":
    case "training-project-sections":
    case "training-project-section-detail":
    case "training-generation-compose":
    case "training-project-results":
    case "training-project-dataset":
    case "training-project-dataset-revision":
    case "training-project-training-runs":
    case "training-project-generation-tasks":
      return loadTrainingProjectRouteData(match.params.trainingProjectId);
    case "training-presets":
    case "training-preset-new":
    case "training-preset-detail":
    case "training-preset-sort-rules":
      return loadTrainingPresetsRouteData();
    case "training-templates":
    case "training-template-new":
    case "training-template-edit":
    case "training-template-section":
      return loadTrainingTemplatesRouteData();
    case "training-runs":
    case "training-generation-run-detail":
    case "training-training-run-detail":
      return loadTrainingRunsRouteData();
    case "not-found":
      return { projects: [], runs: [], presets: [], templates: [] };
  }
}

export async function loadTrainingRouteData(route: readonly string[] = []): Promise<TrainingAppData> {
  const [loraTraining, checkpointModels, loraModels] = await Promise.all([
    loadLoraTrainingForRoute(route),
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
