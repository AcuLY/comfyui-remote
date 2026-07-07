import { prisma } from "@/lib/prisma";
import {
  parseWorkerTaskId,
  type TrainingWorkerType,
  type WorkerTargetType,
} from "@/server/worker/training/task-id";

export type WorkerTarget = {
  id: string;
  projectId: string;
  status: string;
  targetType: WorkerTargetType;
  workerType: TrainingWorkerType;
};

export function mapGenerationTaskToTarget(row: {
  id: string;
  status: string;
  trainingProjectId: string;
}): WorkerTarget {
  return {
    id: row.id,
    projectId: row.trainingProjectId,
    status: row.status,
    targetType: "generationRun",
    workerType: "image_generation",
  };
}

export function mapDatasetRevisionToTarget(row: {
  id: string;
  status: string;
  trainingProjectId: string;
}): WorkerTarget {
  return {
    id: row.id,
    projectId: row.trainingProjectId,
    status: row.status,
    targetType: "datasetRevision",
    workerType: "dataset_freeze",
  };
}

export function mapTrainingRunToTarget(row: {
  id: string;
  status: string;
  trainingProjectId: string;
}): WorkerTarget {
  return {
    id: row.id,
    projectId: row.trainingProjectId,
    status: row.status,
    targetType: "trainingRun",
    workerType: "training",
  };
}

export async function countWorkerTargets(workerType: TrainingWorkerType, status: "queued" | "running", projectId?: string) {
  if (workerType === "image_generation") {
    return prisma.trainingGenerationTask.count({
      where: {
        generationKind: "image_generation",
        ...(projectId ? { trainingProjectId: projectId } : {}),
        status,
      },
    });
  }
  if (workerType === "dataset_freeze") {
    return prisma.trainingDatasetRevision.count({
      where: {
        ...(projectId ? { trainingProjectId: projectId } : {}),
        status: status === "queued" ? "draft" : "freezing",
      },
    });
  }
  return prisma.trainingRun.count({
    where: {
      ...(projectId ? { trainingProjectId: projectId } : {}),
      status,
    },
  });
}

export async function findRunningWorkerTarget(
  workerType: TrainingWorkerType,
  targetId?: string,
  targetType?: string,
  projectId?: string,
) {
  if (workerType === "image_generation") {
    if (targetType && targetType !== "generationRun") return null;
    const row = await prisma.trainingGenerationTask.findFirst({
      where: {
        generationKind: "image_generation",
        id: targetId,
        ...(projectId ? { trainingProjectId: projectId } : {}),
        status: "running",
      },
      orderBy: {
        updatedAt: "asc",
      },
    });
    return row ? mapGenerationTaskToTarget(row) : null;
  }
  if (workerType === "dataset_freeze") {
    if (targetType && targetType !== "datasetRevision") return null;
    const row = await prisma.trainingDatasetRevision.findFirst({
      where: {
        id: targetId,
        ...(projectId ? { trainingProjectId: projectId } : {}),
        status: "freezing",
      },
      orderBy: {
        updatedAt: "asc",
      },
    });
    return row ? mapDatasetRevisionToTarget(row) : null;
  }
  if (targetType && targetType !== "trainingRun") return null;
  const row = await prisma.trainingRun.findFirst({
    where: {
      id: targetId,
      ...(projectId ? { trainingProjectId: projectId } : {}),
      status: "running",
    },
    orderBy: {
      updatedAt: "asc",
    },
  });
  return row ? mapTrainingRunToTarget(row) : null;
}

export async function findQueuedWorkerTarget(
  workerType: TrainingWorkerType,
  targetId?: string,
  targetType?: string,
  projectId?: string,
) {
  if (workerType === "image_generation") {
    if (targetType && targetType !== "generationRun") return null;
    const row = await prisma.trainingGenerationTask.findFirst({
      where: {
        generationKind: "image_generation",
        id: targetId,
        ...(projectId ? { trainingProjectId: projectId } : {}),
        status: "queued",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return row ? mapGenerationTaskToTarget(row) : null;
  }
  if (workerType === "dataset_freeze") {
    if (targetType && targetType !== "datasetRevision") return null;
    const row = await prisma.trainingDatasetRevision.findFirst({
      where: {
        id: targetId,
        ...(projectId ? { trainingProjectId: projectId } : {}),
        status: "draft",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return row ? mapDatasetRevisionToTarget(row) : null;
  }
  if (targetType && targetType !== "trainingRun") return null;
  const row = await prisma.trainingRun.findFirst({
    where: {
      id: targetId,
      ...(projectId ? { trainingProjectId: projectId } : {}),
      status: "queued",
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  return row ? mapTrainingRunToTarget(row) : null;
}

export async function findWorkerTargetByTaskId(taskId: string) {
  const parsed = parseWorkerTaskId(taskId);
  if (!parsed) return null;
  if (parsed.workerType === "image_generation") {
    const row = await prisma.trainingGenerationTask.findUnique({
      where: { id: parsed.targetId },
    });
    return row ? mapGenerationTaskToTarget(row) : null;
  }
  if (parsed.workerType === "dataset_freeze") {
    const row = await prisma.trainingDatasetRevision.findUnique({
      where: { id: parsed.targetId },
    });
    return row ? mapDatasetRevisionToTarget(row) : null;
  }
  const row = await prisma.trainingRun.findUnique({
    where: { id: parsed.targetId },
  });
  return row ? mapTrainingRunToTarget(row) : null;
}
