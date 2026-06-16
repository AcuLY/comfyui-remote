import { prisma } from "@/lib/prisma";

type TrainingRunPresetState = {
  createdAt: string;
  presetId: string;
};

export class TrainingRunPresetStateServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingRunPresetStateServiceError";
    this.status = status;
    this.details = details;
  }
}

export async function listTrainingRunPresetStates() {
  const rows = await prisma.trainingRun.findMany({
    where: {
      createdPresetId: {
        not: null,
      },
      presetCreatedAt: {
        not: null,
      },
    },
    select: {
      createdPresetId: true,
      id: true,
      presetCreatedAt: true,
    },
  });

  return Object.fromEntries(rows.flatMap((row) => {
    if (!row.createdPresetId || !row.presetCreatedAt) return [];
    return [[row.id, {
      createdAt: row.presetCreatedAt.toISOString(),
      presetId: row.createdPresetId,
    } satisfies TrainingRunPresetState]];
  }));
}

export async function recordTrainingRunPresetCreation(runId: string, presetId: string) {
  const normalizedRunId = runId.trim();
  const normalizedPresetId = presetId.trim();
  if (!normalizedRunId || !normalizedPresetId) {
    throw new TrainingRunPresetStateServiceError("runId and presetId are required", 400);
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.trainingRun.findUnique({
      where: {
        id: normalizedRunId,
      },
      select: {
        createdPresetId: true,
        presetCreatedAt: true,
      },
    });
    if (!current) {
      throw new TrainingRunPresetStateServiceError("Training run not found", 404, { runId: normalizedRunId });
    }
    if (current.createdPresetId || current.presetCreatedAt) {
      throw new TrainingRunPresetStateServiceError("Training run preset already exists", 409, {
        presetCreatedAt: current.presetCreatedAt?.toISOString() ?? null,
        presetId: current.createdPresetId,
        runId: normalizedRunId,
      });
    }

    const createdAt = new Date();
    await tx.trainingRun.update({
      where: {
        id: normalizedRunId,
      },
      data: {
        createdPresetId: normalizedPresetId,
        presetCreatedAt: createdAt,
      },
    });

    return {
      createdAt: createdAt.toISOString(),
      presetId: normalizedPresetId,
    };
  });
}

export function mapTrainingRunPresetStateError(error: unknown) {
  if (error instanceof TrainingRunPresetStateServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training run preset state error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
