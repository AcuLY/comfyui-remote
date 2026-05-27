export const RUN_CANCELLABLE_STATUSES = ["queued", "running", "paused"] as const;
export type RunCancellableStatus = (typeof RUN_CANCELLABLE_STATUSES)[number];

export const CENSORING_CANCELLABLE_STATUSES = ["queued", "running", "paused"] as const;
export type CensoringCancellableStatus = (typeof CENSORING_CANCELLABLE_STATUSES)[number];

export function isRunCancellableStatus(status: string): status is RunCancellableStatus {
  return RUN_CANCELLABLE_STATUSES.includes(status as RunCancellableStatus);
}

export function isCensoringCancellableStatus(status: string): status is CensoringCancellableStatus {
  return CENSORING_CANCELLABLE_STATUSES.includes(status as CensoringCancellableStatus);
}

export function extractCensoringPromptId(errorMessage: string | null | undefined): string | null {
  const prefix = "promptId:";
  if (!errorMessage?.startsWith(prefix)) return null;

  const promptId = errorMessage.slice(prefix.length).trim();
  return promptId.length > 0 ? promptId : null;
}

export function selectCensoringPromptIds(
  tasks: Array<{ errorMessage: string | null | undefined }>,
): string[] {
  const promptIds = new Set<string>();
  for (const task of tasks) {
    const promptId = extractCensoringPromptId(task.errorMessage);
    if (promptId) promptIds.add(promptId);
  }
  return Array.from(promptIds);
}
