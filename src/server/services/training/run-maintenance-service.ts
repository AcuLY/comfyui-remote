import { getTrainingRun, mapTrainingReadError } from "@/server/services/training/read-service";

export class TrainingRunMaintenanceServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingRunMaintenanceServiceError";
    this.status = status;
    this.details = details;
  }
}

export async function cleanupTrainingRun(trainingRunId: string) {
  const run = await getTrainingRun(trainingRunId, "training").catch((error) => {
    const mapped = mapTrainingReadError(error);
    throw new TrainingRunMaintenanceServiceError(mapped.message, mapped.status, mapped.details);
  });

  if (run.status === "queued" || run.status === "running") {
    throw new TrainingRunMaintenanceServiceError("Training run is still active and cannot be cleaned up", 409, {
      status: run.status,
      trainingRunId,
    });
  }

  return {
    trainingRunId,
    cleaned: false,
    cleanedArtifacts: [] as string[],
    reason: "No cleanup targets are registered for this training run yet.",
  };
}

export function mapTrainingRunMaintenanceError(error: unknown) {
  if (error instanceof TrainingRunMaintenanceServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training run maintenance error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
