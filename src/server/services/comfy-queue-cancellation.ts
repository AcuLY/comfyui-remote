import {
  clearComfyQueueSnapshotCache,
  deleteComfyQueueItems,
  getComfyQueuePosition,
  interruptComfyPrompt,
  type ComfyQueuePosition,
} from "@/server/services/comfyui-service";
import { getActiveComfyApiUrl } from "@/server/services/comfy-target";

export type ComfyPromptCancellationRun = {
  status?: string | null;
  comfyPromptId: string | null;
};

export type ComfyQueueCancellationDependencies = {
  apiUrl: string;
  clearQueueSnapshotCache: () => void;
  getQueuePosition: (apiUrl: string, promptId: string) => Promise<ComfyQueuePosition>;
  deleteQueueItems: (apiUrl: string, promptIds: string[]) => Promise<void>;
  interruptPrompt: (apiUrl: string) => Promise<void>;
};

export type ComfyPromptCancellationResult = {
  deletedPromptIds: string[];
  interrupted: boolean;
};

export function createComfyQueueCancellationDependencies(
  apiUrl = getActiveComfyApiUrl(),
): ComfyQueueCancellationDependencies {
  return {
    apiUrl,
    clearQueueSnapshotCache: clearComfyQueueSnapshotCache,
    getQueuePosition: getComfyQueuePosition,
    deleteQueueItems: deleteComfyQueueItems,
    interruptPrompt: interruptComfyPrompt,
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

export async function cancelComfyPromptsForRuns(
  runs: ComfyPromptCancellationRun[],
  deps = createComfyQueueCancellationDependencies(),
): Promise<ComfyPromptCancellationResult> {
  const promptIds = collectUniquePromptIds(runs);
  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  if (promptIds.length === 0) {
    return { deletedPromptIds: [], interrupted: false };
  }

  deps.clearQueueSnapshotCache();
  try {
    const promptPositions = await Promise.all(
      promptIds.map(async (promptId) => ({
        promptId,
        position: await deps.getQueuePosition(deps.apiUrl, promptId),
      })),
    );

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

    return {
      deletedPromptIds: promptIdsToDelete,
      interrupted: shouldInterrupt,
    };
  } finally {
    deps.clearQueueSnapshotCache();
  }
}
