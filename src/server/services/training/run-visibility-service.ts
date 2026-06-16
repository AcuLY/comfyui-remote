import { prisma } from "@/lib/prisma";

export class TrainingRunVisibilityServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingRunVisibilityServiceError";
    this.status = status;
    this.details = details;
  }
}

export async function listHiddenTrainingRunIds(): Promise<string[]> {
  const [trainingRuns, generationTasks] = await Promise.all([
    prisma.trainingRun.findMany({
      where: {
        hiddenAt: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.trainingGenerationTask.findMany({
      where: {
        hiddenAt: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  return [...trainingRuns, ...generationTasks].map((row) => row.id);
}

export async function hideTrainingRuns(runIds: string[]): Promise<{ hiddenRunIds: string[] }> {
  const normalized = [...new Set(runIds.map((runId) => runId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingRunVisibilityServiceError("At least one run id is required", 400);
  }

  const now = new Date();
  const [trainingRuns, generationTasks] = await Promise.all([
    prisma.trainingRun.findMany({
      where: {
        id: {
          in: normalized,
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.trainingGenerationTask.findMany({
      where: {
        id: {
          in: normalized,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);
  const matchedIds = new Set([...trainingRuns, ...generationTasks].map((row) => row.id));
  const missingRunIds = normalized.filter((runId) => !matchedIds.has(runId));
  if (missingRunIds.length > 0) {
    throw new TrainingRunVisibilityServiceError("Training run not found", 404, { runIds: missingRunIds });
  }

  await prisma.$transaction([
    prisma.trainingRun.updateMany({
      where: {
        id: {
          in: normalized,
        },
      },
      data: {
        hiddenAt: now,
      },
    }),
    prisma.trainingGenerationTask.updateMany({
      where: {
        id: {
          in: normalized,
        },
      },
      data: {
        hiddenAt: now,
      },
    }),
  ]);

  return {
    hiddenRunIds: normalized,
  };
}

export function mapTrainingRunVisibilityError(error: unknown) {
  if (error instanceof TrainingRunVisibilityServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training run visibility error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
