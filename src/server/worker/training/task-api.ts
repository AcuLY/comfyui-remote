import {
  completeLegacyTrainingWorkerTask,
  failLegacyTrainingWorkerTask,
  getLegacyTrainingWorkerQueueStatus,
  heartbeatLegacyTrainingWorkerTask,
  leaseNextLegacyTrainingWorkerTask,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";

export async function getTrainingWorkerQueueStatus() {
  return getLegacyTrainingWorkerQueueStatus();
}

export async function leaseNextTrainingWorkerTask(input: unknown) {
  return leaseNextLegacyTrainingWorkerTask(input);
}

export async function heartbeatTrainingWorkerTask(taskId: string, input: unknown = {}) {
  return heartbeatLegacyTrainingWorkerTask(taskId, input);
}

export async function completeTrainingWorkerTask(taskId: string, input: unknown) {
  return completeLegacyTrainingWorkerTask(taskId, input);
}

export async function failTrainingWorkerTask(taskId: string, input: unknown) {
  return failLegacyTrainingWorkerTask(taskId, input);
}

export const mapTrainingWorkerTaskError = mapLegacyTrainingGenerationError;
