import { prisma } from "@/lib/prisma";
import { trainingSceneDescriptionPresetCategoryTypeWhere } from "@/lib/actions/preset-resource-scope";
import { createTrainingSceneDescriptionPreset } from "@/server/services/training/preset-service";
import { getTrainingRun, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  mapTrainingRunPresetStateError,
  recordTrainingRunPresetCreation,
} from "@/server/services/training/run-preset-state-service";

type CreateTrainingRunPresetInput = {
  category?: string;
  categoryId?: string;
  folder?: string;
  presetName?: string;
  title?: string;
};

export class TrainingRunPresetServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingRunPresetServiceError";
    this.status = status;
    this.details = details;
  }
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function resolvePresetCategory(input: CreateTrainingRunPresetInput) {
  if (input.category?.trim()) return input.category.trim();
  if (input.categoryId?.trim()) {
    try {
      const category = await prisma.presetCategory.findFirst({
        where: {
          id: input.categoryId.trim(),
          type: trainingSceneDescriptionPresetCategoryTypeWhere(),
        },
        select: { name: true },
      });
      if (category?.name?.trim()) return category.name.trim();
    } catch {
      // Fall through to the default training category when the shared DB is unavailable.
    }
  }
  return "训练产物";
}

function derivePresetTitle(run: Awaited<ReturnType<typeof getTrainingRun>>, input: CreateTrainingRunPresetInput) {
  return input.presetName?.trim()
    || input.title?.trim()
    || `${run.projectTitle} 训练预制`;
}

function buildPresetSceneDescription(run: Awaited<ReturnType<typeof getTrainingRun>>) {
  const artifactLabel = run.artifactName ?? run.finalLoraArtifactId ?? "最终 LoRA";
  return `从 ${run.projectTitle} 的训练产物 ${artifactLabel} 创建，补充后作为可复用场景描述导入训练小节。`;
}

export async function createTrainingPresetFromRun(trainingRunId: string, input: unknown) {
  const parsed = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as CreateTrainingRunPresetInput;
  const run = await getTrainingRun(trainingRunId, "training").catch((error) => {
    const mapped = mapTrainingReadError(error);
    throw new TrainingRunPresetServiceError(mapped.message, mapped.status, mapped.details);
  });

  if (run.kind !== "training") {
    throw new TrainingRunPresetServiceError("Training run preset can only be created from training runs", 409, { trainingRunId });
  }
  if (run.status !== "completed") {
    throw new TrainingRunPresetServiceError("Only completed training runs can create presets", 409, { status: run.status, trainingRunId });
  }
  if (!run.finalLoraArtifactId) {
    throw new TrainingRunPresetServiceError("Training run is missing the final LoRA artifact", 409, { trainingRunId });
  }
  if (run.presetCreatedAt) {
    throw new TrainingRunPresetServiceError("Training run preset already exists", 409, {
      presetCreatedAt: run.presetCreatedAt,
      trainingRunId,
    });
  }

  const category = await resolvePresetCategory(parsed);
  const title = derivePresetTitle(run, parsed);
  const folder = parsed.folder?.trim() || "LoRA 产物";

  const preset = await createTrainingSceneDescriptionPreset({
    title,
    category,
    folder,
    sceneDescriptionText: buildPresetSceneDescription(run),
  }).catch((error) => {
    if (error instanceof TrainingRunPresetServiceError) throw error;
    throw error;
  });

  const presetState = await recordTrainingRunPresetCreation(trainingRunId, preset.id).catch((error) => {
    const mapped = mapTrainingRunPresetStateError(error);
    throw new TrainingRunPresetServiceError(mapped.message, mapped.status, mapped.details);
  });

  return {
    ...preset,
    presetCreatedAt: formatCreatedAt(presetState.createdAt),
  };
}

export function mapTrainingRunPresetError(error: unknown) {
  if (error instanceof TrainingRunPresetServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  const presetState = mapTrainingRunPresetStateError(error);
  if (presetState.status !== 500 || presetState.message !== "Unexpected training run preset state error") {
    return presetState;
  }

  const read = mapTrainingReadError(error);
  if (read.status !== 500 || read.message !== "Unexpected training read error") {
    return read;
  }

  return {
    message: "Unexpected training run preset error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
