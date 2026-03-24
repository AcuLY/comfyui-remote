import { RunStatus } from "@/lib/db-enums";
import { assertEnv } from "@/lib/env";
import {
  ComfyPromptExecutionError,
  executeComfyPromptDraft,
} from "@/server/services/comfyui-service";
import {
  persistComfyOutputImages,
  removeManagedRunOutput,
} from "@/server/services/image-result-service";
import { audit } from "@/server/services/audit-service";
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

    audit("PositionRun", run.runId, "worker.claim", {
      jobId: run.job.id,
      positionName: run.position.name,
    });

    let resolvedConfig: NormalizedResolvedConfigSnapshot | null = null;
    let promptDraft: ComfyPromptDraft | null = null;
    let comfyPromptId: string | null = null;

    try {
      resolvedConfig = normalizeResolvedConfigSnapshot(run.resolvedConfigSnapshot);
      promptDraft = buildComfyPromptDraft(run);
      const processResult = await executeComfyPromptDraft(run.comfyApiUrl, promptDraft);
      comfyPromptId = processResult.comfyPromptId;
      const persistedOutput = await persistComfyOutputImages(
        run,
        run.comfyApiUrl,
        processResult.outputImages,
      );
      const completedRun = await completeWorkerRun(run.runId, {
        status: RunStatus.done,
        comfyPromptId,
        outputDir: persistedOutput.outputDir,
        images: persistedOutput.images,
      });

      audit("PositionRun", run.runId, "worker.done", {
        comfyPromptId,
        imageCount: persistedOutput.images.length,
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
    } catch (error) {
      if (!comfyPromptId) {
        comfyPromptId = extractFailedComfyPromptId(error);
      }

      let errorMessage = formatWorkerError(error);

      try {
        await removeManagedRunOutput(run);
      } catch (cleanupError) {
        errorMessage = `${errorMessage} | cleanup: ${formatWorkerError(cleanupError)}`;
      }

      const failedRun = await completeWorkerRun(run.runId, {
        status: RunStatus.failed,
        errorMessage,
        comfyPromptId,
        outputDir: null,
      });

      audit("PositionRun", run.runId, "worker.failed", {
        errorMessage,
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
    }
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
