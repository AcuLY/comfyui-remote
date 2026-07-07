import { TRAINING_WORKER_TYPES } from "@/lib/training/schemas";

export type TrainingWorkerType = (typeof TRAINING_WORKER_TYPES)[number];
export type WorkerTargetType = "generationRun" | "datasetRevision" | "trainingRun";

export type WorkerTaskIdTarget = {
  id: string;
  workerType: TrainingWorkerType;
};

export type ParsedWorkerTaskId = {
  targetId: string;
  targetType: WorkerTargetType;
  workerType: TrainingWorkerType;
};

const GENERATION_WORKER_TASK_PREFIX = "training-generation-worker-task-";
const DATASET_WORKER_TASK_PREFIX = "training-dataset-worker-task-";
const TRAINING_WORKER_TASK_PREFIX = "training-run-worker-task-";

export function getWorkerTaskPrefix(workerType: TrainingWorkerType) {
  if (workerType === "training") return TRAINING_WORKER_TASK_PREFIX;
  if (workerType === "dataset_freeze") return DATASET_WORKER_TASK_PREFIX;
  return GENERATION_WORKER_TASK_PREFIX;
}

export function getWorkerTaskId(target: WorkerTaskIdTarget) {
  return `${getWorkerTaskPrefix(target.workerType)}${target.id}`;
}

export function parseWorkerTaskId(taskId: string): ParsedWorkerTaskId | null {
  if (taskId.startsWith(GENERATION_WORKER_TASK_PREFIX)) {
    return {
      targetId: taskId.slice(GENERATION_WORKER_TASK_PREFIX.length),
      targetType: "generationRun",
      workerType: "image_generation",
    };
  }
  if (taskId.startsWith(DATASET_WORKER_TASK_PREFIX)) {
    return {
      targetId: taskId.slice(DATASET_WORKER_TASK_PREFIX.length),
      targetType: "datasetRevision",
      workerType: "dataset_freeze",
    };
  }
  if (taskId.startsWith(TRAINING_WORKER_TASK_PREFIX)) {
    return {
      targetId: taskId.slice(TRAINING_WORKER_TASK_PREFIX.length),
      targetType: "trainingRun",
      workerType: "training",
    };
  }
  return null;
}

export function getGenerationWorkerTaskId(taskId: string) {
  return `${GENERATION_WORKER_TASK_PREFIX}${taskId}`;
}

export function getTrainingRunWorkerTaskId(trainingRunId: string) {
  return `${TRAINING_WORKER_TASK_PREFIX}${trainingRunId}`;
}

export function workerTypeForTargetType(targetType: string): TrainingWorkerType | null {
  if (targetType === "generationRun") return "image_generation";
  if (targetType === "datasetRevision") return "dataset_freeze";
  if (targetType === "trainingRun") return "training";
  return null;
}
