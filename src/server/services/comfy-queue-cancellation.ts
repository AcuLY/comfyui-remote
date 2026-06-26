import {
  checkComfyUIReachability,
  clearComfyQueueSnapshotCache,
  deleteComfyQueueItems,
  getComfyQueuePosition,
  interruptComfyPrompt,
  type ComfyQueuePosition,
} from "@/server/services/comfyui-service";
import { env } from "@/lib/env";
import { getActiveComfyTarget } from "@/server/services/comfy-target";

export type ComfyPromptCancellationRun = {
  id?: string;
  status?: string | null;
  comfyPromptId: string | null;
};

export type ComfyQueueCancellationDependencies = {
  apiUrl: string;
  isRemoteTarget?: boolean;
  requestTimeoutMs?: number;
  clearQueueSnapshotCache: () => void;
  preflight?: (apiUrl: string) => Promise<void>;
  getQueuePosition: (apiUrl: string, promptId: string) => Promise<ComfyQueuePosition>;
  deleteQueueItems: (apiUrl: string, promptIds: string[]) => Promise<void>;
  interruptPrompt: (apiUrl: string) => Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type ComfyPromptCancellationResult = {
  deletedPromptIds: string[];
  interrupted: boolean;
};

export type ComfyPromptCancellationStage =
  | "preflight"
  | "syncing_comfy"
  | "confirming_remote"
  | "updating_local";

export type ComfyPromptCancellationProgress = {
  stage: ComfyPromptCancellationStage;
  processedRuns: number;
  totalRuns: number;
  batchIndex: number;
  batchSize: number;
  elapsedMs?: number;
  message?: string;
};

export type ComfyPromptCancellationBatch = {
  batchIndex: number;
  runs: ComfyPromptCancellationRun[];
  promptIds: string[];
  deletedPromptIds: string[];
  interrupted: boolean;
  elapsedMs: number;
};

export type ComfyPromptCancellationOptions = {
  onProgress?: (progress: ComfyPromptCancellationProgress) => void | Promise<void>;
  onBatchConfirmed?: (batch: ComfyPromptCancellationBatch) => void | Promise<void>;
};

const MAX_COMFY_QUEUE_BATCH_SIZE = 256;
const CONSERVATIVE_COMFY_QUEUE_BATCH_SIZE = 64;
const MIN_COMFY_QUEUE_BATCH_SIZE = 16;
const CONFIRMATION_POLL_INTERVAL_MS = 250;

export function createComfyQueueCancellationDependencies(
  apiUrl?: string,
): ComfyQueueCancellationDependencies {
  const activeTarget = apiUrl ? null : getActiveComfyTarget();
  const resolvedApiUrl = apiUrl ?? activeTarget?.apiUrl;
  if (!resolvedApiUrl) {
    throw new Error("ComfyUI API URL is empty");
  }

  return {
    apiUrl: resolvedApiUrl,
    isRemoteTarget: activeTarget?.mode === "ssh",
    requestTimeoutMs: env.comfyRequestTimeoutMs,
    clearQueueSnapshotCache: clearComfyQueueSnapshotCache,
    preflight: async (url) => {
      const result = await checkComfyUIReachability(url, env.comfyRequestTimeoutMs);
      if (!result.reachable) {
        throw new Error(result.errorMessage);
      }
    },
    getQueuePosition: getComfyQueuePosition,
    deleteQueueItems: deleteComfyQueueItems,
    interruptPrompt: interruptComfyPrompt,
    now: () => Date.now(),
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
  };
}

function collectUniquePromptIds(runs: ComfyPromptCancellationRun[]) {
  const promptIds: string[] = [];
  const seen = new Set<string>();

  for (const run of runs) {
    const promptId = run.comfyPromptId?.trim();
    if (!promptId || seen.has(promptId)) continue;
    seen.add(promptId);
    promptIds.push(promptId);
  }

  return promptIds;
}

function now(deps: ComfyQueueCancellationDependencies) {
  return deps.now?.() ?? Date.now();
}

async function sleep(deps: ComfyQueueCancellationDependencies, ms: number) {
  if (deps.sleep) {
    await deps.sleep(ms);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocalComfyApiUrl(apiUrl: string) {
  try {
    const hostname = new URL(apiUrl).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function chooseInitialBatchSize(input: {
  apiUrl: string;
  totalPrompts: number;
  isRemoteTarget?: boolean;
  preflightElapsedMs: number;
  requestTimeoutMs: number;
}) {
  if (input.totalPrompts <= 0) return 0;

  const fastPreflightThresholdMs = Math.min(1_000, Math.max(250, input.requestTimeoutMs / 10));
  const localOrFast =
    isLocalComfyApiUrl(input.apiUrl) || input.preflightElapsedMs <= fastPreflightThresholdMs;

  if (!input.isRemoteTarget && localOrFast) {
    return Math.min(input.totalPrompts, MAX_COMFY_QUEUE_BATCH_SIZE);
  }

  return Math.min(input.totalPrompts, CONSERVATIVE_COMFY_QUEUE_BATCH_SIZE);
}

function chooseNextBatchSize(currentBatchSize: number, elapsedMs: number, requestTimeoutMs: number) {
  if (elapsedMs > requestTimeoutMs * 0.75 && currentBatchSize > MIN_COMFY_QUEUE_BATCH_SIZE) {
    return Math.max(MIN_COMFY_QUEUE_BATCH_SIZE, Math.floor(currentBatchSize / 2));
  }

  return currentBatchSize;
}

async function measurePreflight(deps: ComfyQueueCancellationDependencies) {
  if (!deps.preflight) return 0;

  const startedAt = now(deps);
  await deps.preflight(deps.apiUrl);
  return now(deps) - startedAt;
}

async function getPromptPositions(
  promptIds: string[],
  deps: ComfyQueueCancellationDependencies,
) {
  return Promise.all(
    promptIds.map(async (promptId) => ({
      promptId,
      position: await deps.getQueuePosition(deps.apiUrl, promptId),
    })),
  );
}

async function confirmPromptsRemoved(
  promptIds: string[],
  deps: ComfyQueueCancellationDependencies,
) {
  const requestTimeoutMs = deps.requestTimeoutMs ?? env.comfyRequestTimeoutMs;
  const confirmationWindowMs = Math.min(requestTimeoutMs * 2, 20_000);
  const startedAt = now(deps);
  let lastRemainingPromptIds = promptIds;

  while (now(deps) - startedAt <= confirmationWindowMs) {
    deps.clearQueueSnapshotCache();
    const positions = await getPromptPositions(promptIds, deps);
    lastRemainingPromptIds = positions
      .filter(({ position }) => position !== "not_found")
      .map(({ promptId }) => promptId);

    if (lastRemainingPromptIds.length === 0) {
      return;
    }

    await sleep(deps, CONFIRMATION_POLL_INTERVAL_MS);
  }

  throw new Error(
    `ComfyUI cancellation confirmation timed out after ${confirmationWindowMs}ms; still queued/running: ${lastRemainingPromptIds.join(", ")}`,
  );
}

async function cancelPromptBatch(
  batchRuns: ComfyPromptCancellationRun[],
  promptIds: string[],
  deps: ComfyQueueCancellationDependencies,
) {
  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  deps.clearQueueSnapshotCache();
  try {
    const promptPositions = await getPromptPositions(promptIds, deps);

    for (const { promptId, position } of promptPositions) {
      if (position === "running") {
        shouldInterrupt = true;
      } else if (position === "pending") {
        promptIdsToDelete.push(promptId);
      }
    }

    if (promptIdsToDelete.length > 0) {
      await deps.deleteQueueItems(deps.apiUrl, promptIdsToDelete);
    }

    if (shouldInterrupt) {
      await deps.interruptPrompt(deps.apiUrl);
    }

    await confirmPromptsRemoved(promptIds, deps);

    return {
      runs: batchRuns,
      promptIds,
      deletedPromptIds: promptIdsToDelete,
      interrupted: shouldInterrupt,
    };
  } finally {
    deps.clearQueueSnapshotCache();
  }
}

function sliceBatchByPromptCount(
  runs: ComfyPromptCancellationRun[],
  startIndex: number,
  batchSize: number,
) {
  const batchRuns: ComfyPromptCancellationRun[] = [];
  const batchPromptIds: string[] = [];
  const seenPromptIds = new Set<string>();
  let nextIndex = startIndex;

  for (; nextIndex < runs.length; nextIndex++) {
    const run = runs[nextIndex];
    const promptId = run.comfyPromptId?.trim();
    if (!promptId) continue;

    const wouldAddPrompt = !seenPromptIds.has(promptId);
    if (wouldAddPrompt && batchPromptIds.length >= batchSize) {
      break;
    }

    batchRuns.push(run);
    if (wouldAddPrompt) {
      seenPromptIds.add(promptId);
      batchPromptIds.push(promptId);
    }
  }

  return { batchRuns, batchPromptIds, nextIndex };
}

export async function cancelComfyPromptsForRuns(
  runs: ComfyPromptCancellationRun[],
  deps = createComfyQueueCancellationDependencies(),
  options: ComfyPromptCancellationOptions = {},
): Promise<ComfyPromptCancellationResult> {
  const runsWithPromptIds = runs.filter((run) => run.comfyPromptId?.trim());
  const promptIds = collectUniquePromptIds(runsWithPromptIds);
  const requestTimeoutMs = deps.requestTimeoutMs ?? env.comfyRequestTimeoutMs;
  const deletedPromptIds: string[] = [];
  let interrupted = false;
  let processedRuns = 0;

  if (promptIds.length === 0) {
    return { deletedPromptIds: [], interrupted: false };
  }

  const preflightElapsedMs = await measurePreflight(deps);
  await options.onProgress?.({
    stage: "preflight",
    processedRuns,
    totalRuns: runsWithPromptIds.length,
    batchIndex: 0,
    batchSize: 0,
    elapsedMs: preflightElapsedMs,
  });

  let batchSize = chooseInitialBatchSize({
    apiUrl: deps.apiUrl,
    totalPrompts: promptIds.length,
    isRemoteTarget: deps.isRemoteTarget,
    preflightElapsedMs,
    requestTimeoutMs,
  });
  let batchIndex = 0;

  for (let runIndex = 0; runIndex < runsWithPromptIds.length;) {
    const { batchRuns, batchPromptIds, nextIndex } = sliceBatchByPromptCount(
      runsWithPromptIds,
      runIndex,
      batchSize,
    );

    if (batchPromptIds.length === 0) {
      runIndex = nextIndex + 1;
      continue;
    }

    batchIndex++;
    await options.onProgress?.({
      stage: "syncing_comfy",
      processedRuns,
      totalRuns: runsWithPromptIds.length,
      batchIndex,
      batchSize: batchRuns.length,
    });

    const startedAt = now(deps);
    const batchResult = await cancelPromptBatch(batchRuns, batchPromptIds, deps);
    const elapsedMs = now(deps) - startedAt;

    await options.onProgress?.({
      stage: "confirming_remote",
      processedRuns,
      totalRuns: runsWithPromptIds.length,
      batchIndex,
      batchSize: batchRuns.length,
      elapsedMs,
    });

    const confirmedBatch: ComfyPromptCancellationBatch = {
      batchIndex,
      runs: batchResult.runs,
      promptIds: batchResult.promptIds,
      deletedPromptIds: batchResult.deletedPromptIds,
      interrupted: batchResult.interrupted,
      elapsedMs,
    };

    await options.onBatchConfirmed?.(confirmedBatch);

    processedRuns += batchRuns.length;
    deletedPromptIds.push(...batchResult.deletedPromptIds);
    interrupted = interrupted || batchResult.interrupted;

    await options.onProgress?.({
      stage: "updating_local",
      processedRuns,
      totalRuns: runsWithPromptIds.length,
      batchIndex,
      batchSize: batchRuns.length,
      elapsedMs,
    });

    batchSize = chooseNextBatchSize(batchSize, elapsedMs, requestTimeoutMs);
    runIndex = nextIndex;
  }

  return {
    deletedPromptIds,
    interrupted,
  };
}
