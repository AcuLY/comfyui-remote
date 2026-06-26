export type QueueControlStage =
  | "reading_queue"
  | "syncing_comfy"
  | "confirming_remote"
  | "updating_local"
  | "refreshing"
  | "done"
  | "failed";

export type QueueControlProgressEvent = {
  stage: QueueControlStage;
  processedRuns: number;
  totalRuns: number;
  batchIndex?: number;
  batchSize?: number;
  elapsedMs?: number;
  message?: string;
  error?: string;
};

export type QueueControlProgressReporter = (
  event: QueueControlProgressEvent,
) => void | Promise<void>;
