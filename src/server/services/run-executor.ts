/**
 * Run Executor
 *
 * Processes queued PositionRuns by submitting them directly to ComfyUI.
 * Replaces the old worker mechanism — since ComfyUI only runs one prompt
 * at a time and our backend is single-instance, we don't need a separate
 * worker process or claim-based concurrency control.
 *
 * Usage:
 *   import { executeQueuedRuns } from "@/server/services/run-executor";
 *   executeQueuedRuns().catch(() => {}); // fire-and-forget
 */

import { RunStatus, JobStatus } from "@/lib/db-enums";
import { assertEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import {
  ComfyPromptExecutionError,
  executeComfyPromptDraft,
} from "@/server/services/comfyui-service";
import {
  persistComfyOutputImages,
  removeManagedRunOutput,
} from "@/server/services/image-result-service";
import { audit } from "@/server/services/audit-service";
import { buildComfyPromptDraft } from "@/server/worker/payload-builder";
import {
  listQueuedWorkerRuns,
  completeWorkerRun,
} from "@/server/worker/repository";
import { db } from "@/lib/db";

const log = createLogger({ module: "run-executor" });

/** Module-level lock to prevent concurrent executions. */
let running = false;

function formatError(error: unknown) {
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

/**
 * Transition a queued run to running status.
 * Simple update — no atomic claim needed since we're single-instance.
 */
async function markRunning(runId: string, jobId: string) {
  const startedAt = new Date();
  await db.positionRun.update({
    where: { id: runId },
    data: {
      status: RunStatus.running,
      startedAt,
      finishedAt: null,
      errorMessage: null,
    },
  });
  await db.completeJob.update({
    where: { id: jobId },
    data: { status: JobStatus.running },
  });
  return startedAt;
}

/**
 * Process all queued PositionRuns sequentially.
 *
 * - Acquires a module-level lock so only one execution loop runs at a time.
 * - Each run is processed independently — one failure won't block others.
 * - Reuses the existing ComfyUI service and image persistence pipeline.
 */
export async function executeQueuedRuns(): Promise<void> {
  if (running) {
    log.debug("Execution already in progress, skipping");
    return;
  }

  running = true;

  try {
    assertEnv();

    const queuedRuns = await listQueuedWorkerRuns(100);

    if (queuedRuns.length === 0) {
      log.debug("No queued runs to process");
      return;
    }

    log.info("Processing queued runs", { count: queuedRuns.length });

    for (const run of queuedRuns) {
      const runLog = log.child({ runId: run.runId, jobId: run.job.id });
      const runTimer = runLog.startTimer("process-run");
      let comfyPromptId: string | null = null;

      try {
        await markRunning(run.runId, run.job.id);

        runLog.info("Run started", { position: run.position.name });

        audit("PositionRun", run.runId, "executor.start", {
          jobId: run.job.id,
          positionName: run.position.name,
        });

        const promptDraft = buildComfyPromptDraft(run);

        runLog.debug("Executing ComfyUI prompt", {
          workflowId: promptDraft.workflowId,
          batchSize: promptDraft.parameters.batchSize,
        });

        const processResult = await executeComfyPromptDraft(run.comfyApiUrl, promptDraft);
        comfyPromptId = processResult.comfyPromptId;

        runLog.debug("ComfyUI prompt completed", {
          comfyPromptId,
          imageCount: processResult.outputImages.length,
        });

        const persistedOutput = await persistComfyOutputImages(
          run,
          run.comfyApiUrl,
          processResult.outputImages,
        );

        await completeWorkerRun(run.runId, {
          status: RunStatus.done,
          comfyPromptId,
          outputDir: persistedOutput.outputDir,
          images: persistedOutput.images,
        });

        audit("PositionRun", run.runId, "executor.done", {
          comfyPromptId,
          imageCount: persistedOutput.images.length,
        });

        runTimer.done({ status: "done", imageCount: persistedOutput.images.length });
      } catch (error) {
        if (!comfyPromptId) {
          comfyPromptId = extractFailedComfyPromptId(error);
        }

        let errorMessage = formatError(error);
        runLog.error("Run failed", error, { comfyPromptId });

        try {
          await removeManagedRunOutput(run);
        } catch (cleanupError) {
          runLog.warn("Cleanup failed", { error: formatError(cleanupError) });
          errorMessage = `${errorMessage} | cleanup: ${formatError(cleanupError)}`;
        }

        await completeWorkerRun(run.runId, {
          status: RunStatus.failed,
          errorMessage,
          comfyPromptId,
          outputDir: null,
        });

        audit("PositionRun", run.runId, "executor.failed", {
          errorMessage,
          comfyPromptId,
        });

        runTimer.done({ status: "failed", error: errorMessage });
      }
    }
  } finally {
    running = false;
  }
}
