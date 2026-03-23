import { RunStatus } from "@/generated/prisma";
import { assertEnv } from "@/lib/env";
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

function performWorkerProcessingStep(promptDraft: ComfyPromptDraft) {
  if (!promptDraft.workflowId.trim()) {
    throw new Error("Resolved workflow id is empty");
  }

  if (!promptDraft.prompt.positive.trim()) {
    throw new Error("Resolved positive prompt is empty");
  }

  return {
    comfyPromptId: null,
    outputDir: null,
  };
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
    let processError: unknown = null;
    let processResult: ReturnType<typeof performWorkerProcessingStep> | null = null;

    try {
      resolvedConfig = normalizeResolvedConfigSnapshot(run.resolvedConfigSnapshot);
      promptDraft = buildComfyPromptDraft(run);
      processResult = performWorkerProcessingStep(promptDraft);
    } catch (error) {
      processError = error;
    }

    if (processError) {
      const failedRun = await completeWorkerRun(run.runId, {
        status: RunStatus.failed,
        errorMessage: formatWorkerError(processError),
      });

      drafts.push({
        runId: run.runId,
        status: failedRun.status,
        comfyApiUrl: run.comfyApiUrl,
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
