/**
 * Run Executor
 *
 * Processes queued Runs by submitting them directly to ComfyUI.
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
/** Flag set when a new run is enqueued while executor is busy. */
let pendingRerun = false;

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
async function markRunning(runId: string, projectId: string) {
  const startedAt = new Date();
  await db.run.update({
    where: { id: runId },
    data: {
      status: RunStatus.running,
      startedAt,
      finishedAt: null,
      errorMessage: null,
    },
  });
  await db.project.update({
    where: { id: projectId },
    data: { status: JobStatus.running },
  });
  return startedAt;
}

/**
 * Process all queued Runs sequentially.
 *
 * - Acquires a module-level lock so only one execution loop runs at a time.
 * - Each run is processed independently — one failure won't block others.
 * - Reuses the existing ComfyUI service and image persistence pipeline.
 */
export async function executeQueuedRuns(): Promise<void> {
  if (running) {
    // Signal that we need to re-check after current execution finishes
    pendingRerun = true;
    log.debug("Execution already in progress, will re-check when done");
    return;
  }

  running = true;
  pendingRerun = false;

  try {
    assertEnv();

    const queuedRuns = await listQueuedWorkerRuns(100);

    if (queuedRuns.length === 0) {
      log.debug("No queued runs to process");
      return;
    }

    log.info("Processing queued runs", { count: queuedRuns.length });

    for (const run of queuedRuns) {
      // Check if this run was cancelled while waiting in queue
      const currentRun = await db.run.findUnique({
        where: { id: run.runId },
        select: { status: true },
      });
      if (!currentRun || currentRun.status === "cancelled") {
        log.info("Run was cancelled, skipping", { runId: run.runId });
        continue;
      }
      const runLog = log.child({ runId: run.runId, projectId: run.project.id });
      const runTimer = runLog.startTimer("process-run");
      let comfyPromptId: string | null = null;

      try {
        await markRunning(run.runId, run.project.id);

        runLog.info("Run started", { section: run.section.name });

        audit("Run", run.runId, "executor.start", {
          projectId: run.project.id,
          sectionName: run.section.name,
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
          executionMeta: processResult.executionMeta,
          outputDir: persistedOutput.outputDir,
          images: persistedOutput.images,
        });

        audit("Run", run.runId, "executor.done", {
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

        audit("Run", run.runId, "executor.failed", {
          errorMessage,
          comfyPromptId,
        });

        runTimer.done({ status: "failed", error: errorMessage });
      }
    }
  } finally {
    running = false;
    // If new runs were enqueued while we were busy, process them
    if (pendingRerun) {
      pendingRerun = false;
      log.debug("Re-checking queue after pending signal");
      // Use setImmediate-style defer to avoid deep recursion
      setTimeout(() => executeQueuedRuns().catch(() => {}), 0);
    }
  }
}
