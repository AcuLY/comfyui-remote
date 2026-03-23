import { RunStatus } from "@/generated/prisma";
import { assertEnv } from "@/lib/env";
import {
  ComfyPromptExecutionError,
  executeComfyPromptDraft,
} from "@/server/services/comfyui-service";
import { buildComfyPromptDraft, normalizeResolvedConfigSnapshot } from "@/server/worker/payload-builder";
import {
  claimQueuedWorkerRun,
  completeWorkerRun,
  listQueuedWorkerRuns,
} from "@/server/worker/repository";
import {
  ComfyPromptDraft,
  NormalizedResolvedConfigSnapshot,
  WorkerPassReport,
  WorkerRunDraft,
} from "@/server/worker/types";

function formatWorkerError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function extractFailedComfyPromptId(error: unknown) {
  if (error instanceof ComfyPromptExecutionError) {
    return error.comfyPromptId;
  }

  return null;
}

export async function runWorkerPass(limit = 10): Promise<WorkerPassReport> {
  assertEnv();

  const queuedRuns = await listQueuedWorkerRuns(limit);
  const drafts: WorkerRunDraft[] = [];
  let skippedRunCount = 0;

  for (const run of queuedRuns) {
    const claim = await claimQueuedWorkerRun(run.runId);

    if (!claim) {
      skippedRunCount += 1;
      continue;
    }

    let resolvedConfig: NormalizedResolvedConfigSnapshot | null = null;
    let promptDraft: ComfyPromptDraft | null = null;
    let comfyPromptId: string | null = null;
    let processError: unknown = null;
    let processResult: Awaited<ReturnType<typeof executeComfyPromptDraft>> | null = null;

    try {
      resolvedConfig = normalizeResolvedConfigSnapshot(run.resolvedConfigSnapshot);
      promptDraft = buildComfyPromptDraft(run);
      processResult = await executeComfyPromptDraft(run.comfyApiUrl, promptDraft);
      comfyPromptId = processResult.comfyPromptId;
    } catch (error) {
      comfyPromptId = extractFailedComfyPromptId(error);
      processError = error;
    }

    if (processError) {
      const failedRun = await completeWorkerRun(run.runId, {
        status: RunStatus.failed,
        errorMessage: formatWorkerError(processError),
        comfyPromptId,
      });

      drafts.push({
        runId: run.runId,
        status: failedRun.status,
        comfyApiUrl: run.comfyApiUrl,
        comfyPromptId: failedRun.comfyPromptId,
        outputDir: failedRun.outputDir,
        resolvedConfig,
        promptDraft,
        startedAt: failedRun.startedAt,
        finishedAt: failedRun.finishedAt,
        errorMessage: failedRun.errorMessage,
      });

      continue;
    }

    if (!processResult) {
      throw new Error("Worker processing step did not return a result");
    }

    const completedRun = await completeWorkerRun(run.runId, {
      status: RunStatus.done,
      comfyPromptId: processResult.comfyPromptId,
      outputDir: processResult.outputDir,
    });

    drafts.push({
      runId: run.runId,
      status: completedRun.status,
      comfyApiUrl: run.comfyApiUrl,
      comfyPromptId: completedRun.comfyPromptId,
      outputDir: completedRun.outputDir,
      resolvedConfig,
      promptDraft,
      startedAt: completedRun.startedAt,
      finishedAt: completedRun.finishedAt,
      errorMessage: completedRun.errorMessage,
    });
  }

  const failedRunCount = drafts.filter((draft) => draft.status === RunStatus.failed).length;

  return {
    scannedAt: new Date().toISOString(),
    queuedRunCount: queuedRuns.length,
    claimedRunCount: drafts.length,
    skippedRunCount,
    failedRunCount,
    drafts,
  };
}
