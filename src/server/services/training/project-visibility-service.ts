import { prisma } from "@/lib/prisma";

export class TrainingProjectVisibilityServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectVisibilityServiceError";
    this.status = status;
    this.details = details;
  }
}

export async function listHiddenTrainingProjectIds(): Promise<string[]> {
  const rows = await prisma.trainingProject.findMany({
    where: {
      hiddenAt: {
        not: null,
      },
    },
    select: {
      id: true,
    },
  });
  return rows.map((row) => row.id);
}

export async function hideTrainingProjects(projectIds: string[]): Promise<{ hiddenProjectIds: string[] }> {
  const normalized = [...new Set(projectIds.map((projectId) => projectId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingProjectVisibilityServiceError("At least one project id is required", 400);
  }

  const rows = await prisma.trainingProject.findMany({
    where: {
      id: {
        in: normalized,
      },
    },
    select: {
      id: true,
    },
  });
  const existingIds = new Set(rows.map((row) => row.id));
  const missingProjectIds = normalized.filter((projectId) => !existingIds.has(projectId));
  if (missingProjectIds.length > 0) {
    throw new TrainingProjectVisibilityServiceError("Training project not found", 404, { projectIds: missingProjectIds });
  }

  await prisma.trainingProject.updateMany({
    where: {
      id: {
        in: normalized,
      },
    },
    data: {
      hiddenAt: new Date(),
    },
  });

  return {
    hiddenProjectIds: normalized,
  };
}

export function mapTrainingProjectVisibilityError(error: unknown) {
  if (error instanceof TrainingProjectVisibilityServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project visibility error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
