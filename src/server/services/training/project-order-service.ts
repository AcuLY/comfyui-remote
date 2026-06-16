import { prisma } from "@/lib/prisma";

export class TrainingProjectOrderServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectOrderServiceError";
    this.status = status;
    this.details = details;
  }
}

export async function listTrainingProjectOrderIds(): Promise<string[]> {
  const rows = await prisma.trainingProject.findMany({
    where: {
      hiddenAt: null,
    },
    orderBy: [
      { sortOrder: "asc" },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
    },
  });
  return rows.map((row) => row.id);
}

export async function saveTrainingProjectOrderIds(projectIds: string[]): Promise<{ orderedProjectIds: string[] }> {
  const normalized = [...new Set(projectIds.map((projectId) => projectId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingProjectOrderServiceError("At least one project id is required", 400);
  }

  const existing = await prisma.trainingProject.findMany({
    where: {
      id: {
        in: normalized,
      },
    },
    select: {
      id: true,
    },
  });
  const existingIds = new Set(existing.map((project) => project.id));
  const missingProjectIds = normalized.filter((projectId) => !existingIds.has(projectId));
  if (missingProjectIds.length > 0) {
    throw new TrainingProjectOrderServiceError("Training project not found", 404, { projectIds: missingProjectIds });
  }

  await prisma.$transaction([
    prisma.trainingProject.updateMany({
      where: {
        hiddenAt: null,
        id: {
          notIn: normalized,
        },
      },
      data: {
        sortOrder: normalized.length,
      },
    }),
    ...normalized.map((projectId, index) => (
      prisma.trainingProject.update({
        where: {
          id: projectId,
        },
        data: {
          sortOrder: index,
        },
      })
    )),
  ]);

  return {
    orderedProjectIds: normalized,
  };
}

export function orderTrainingProjectsByStoredIds<T extends { id: string }>(projects: T[], orderedProjectIds: string[]) {
  if (orderedProjectIds.length === 0) {
    return projects;
  }

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const ordered = orderedProjectIds
    .map((projectId) => projectMap.get(projectId))
    .filter((project): project is T => Boolean(project));
  const missing = projects.filter((project) => !orderedProjectIds.includes(project.id));
  return [...ordered, ...missing];
}

export function mapTrainingProjectOrderError(error: unknown) {
  if (error instanceof TrainingProjectOrderServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project order error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
