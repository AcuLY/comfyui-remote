import { prisma } from "@/lib/prisma";
import { trainingWorkerTaskHeartbeatRequestSchema } from "@/lib/training/schemas";
import { TrainingWorkerTaskError } from "@/server/worker/training/task-errors";
import { normalizeWorkerTaskJson } from "@/server/worker/training/task-json";
import { serializeWorkerTask } from "@/server/worker/training/task-serialization";
import { findWorkerTargetByTaskId } from "@/server/worker/training/target-discovery";

export async function heartbeatTrainingWorkerTask(taskId: string, input: unknown = {}) {
  const parsed = trainingWorkerTaskHeartbeatRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingWorkerTaskError("Invalid training worker heartbeat request", 400, {
      issues: parsed.error.issues,
    });
  }
  const target = await findWorkerTargetByTaskId(taskId);
  if (!target) return null;

  if (target.workerType === "image_generation") {
    const current = await prisma.trainingGenerationTask.findUnique({
      where: { id: target.id },
      select: { paramsJson: true },
    });
    const existingParams = current?.paramsJson
      && typeof current.paramsJson === "object"
      && !Array.isArray(current.paramsJson)
      ? current.paramsJson as Record<string, unknown>
      : {};
    await prisma.trainingGenerationTask.update({
      where: { id: target.id },
      data: {
        paramsJson: normalizeWorkerTaskJson({
          ...existingParams,
          heartbeatAt: new Date().toISOString(),
          leaseOwner: parsed.data.leaseOwner ?? null,
          progressJson: parsed.data.progressJson ?? null,
        }),
      },
    });
  } else if (target.workerType === "training") {
    await prisma.trainingRun.update({
      where: { id: target.id },
      data: {
        currentStep: typeof parsed.data.progressJson?.currentStep === "number" ? parsed.data.progressJson.currentStep : undefined,
        progressJson: normalizeWorkerTaskJson(parsed.data.progressJson ?? {}),
        schedulerMessage: typeof parsed.data.progressJson?.phase === "string" ? parsed.data.progressJson.phase : undefined,
        totalSteps: typeof parsed.data.progressJson?.targetSteps === "number" ? parsed.data.progressJson.targetSteps : undefined,
      },
    });
  }

  return serializeWorkerTask(target, {
    leaseOwner: parsed.data.leaseOwner ?? null,
    progressJson: parsed.data.progressJson ?? null,
  });
}
