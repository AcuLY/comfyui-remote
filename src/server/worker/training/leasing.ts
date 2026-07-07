import { prisma } from "@/lib/prisma";
import { trainingWorkerTaskLeaseRequestSchema } from "@/lib/training/schemas";
import { TrainingWorkerTaskError } from "@/server/worker/training/task-errors";
import { serializeWorkerTask } from "@/server/worker/training/task-serialization";
import {
  countWorkerTargets,
  findQueuedWorkerTarget,
  findRunningWorkerTarget,
  mapDatasetRevisionToTarget,
  mapGenerationTaskToTarget,
  mapTrainingRunToTarget,
  type WorkerTarget,
} from "@/server/worker/training/target-discovery";

export async function markWorkerTargetRunning(target: WorkerTarget, leaseOwner?: string | null) {
  const now = new Date();
  if (target.workerType === "image_generation") {
    const updated = await prisma.trainingGenerationTask.update({
      where: { id: target.id },
      data: {
        startedAt: now,
        status: "running",
        sectionRuns: {
          updateMany: {
            where: {},
            data: {
              startedAt: now,
              status: "running",
            },
          },
        },
      },
    });
    return mapGenerationTaskToTarget(updated);
  }
  if (target.workerType === "dataset_freeze") {
    const updated = await prisma.trainingDatasetRevision.update({
      where: { id: target.id },
      data: {
        status: "freezing",
      },
    });
    return mapDatasetRevisionToTarget(updated);
  }
  const updated = await prisma.trainingRun.update({
    where: { id: target.id },
    data: {
      progressJson: {
        ...(leaseOwner ? { leaseOwner } : {}),
      },
      startedAt: now,
      status: "running",
    },
  });
  return mapTrainingRunToTarget(updated);
}

export async function leaseNextTrainingWorkerTask(input: unknown) {
  const parsed = trainingWorkerTaskLeaseRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingWorkerTaskError("Invalid training worker lease request", 400, {
      issues: parsed.error.issues,
    });
  }

  const running = await findRunningWorkerTarget(
    parsed.data.workerType,
    parsed.data.targetId,
    parsed.data.targetType,
    parsed.data.projectId,
  );
  if (running) {
    return serializeWorkerTask(running, {
      leaseOwner: parsed.data.leaseOwner ?? null,
    });
  }

  if (await countWorkerTargets(parsed.data.workerType, "running", parsed.data.projectId) > 0) {
    return null;
  }

  const queued = await findQueuedWorkerTarget(
    parsed.data.workerType,
    parsed.data.targetId,
    parsed.data.targetType,
    parsed.data.projectId,
  );
  if (!queued) return null;

  const target = await markWorkerTargetRunning(queued, parsed.data.leaseOwner ?? null);
  return serializeWorkerTask(target, {
    leaseOwner: parsed.data.leaseOwner ?? null,
  });
}
