/**
 * Run Executor — Parallel Submission Model
 *
 * Submits all queued runs to ComfyUI at once, letting ComfyUI's native queue
 * handle ordering. Then waits for all submitted prompts in parallel.
 *
 * - Phase 1: Validate + submit each run via POST /prompt → store comfyPromptId
 * - Phase 2: Poll /history for all submitted prompts concurrently
 * - Each prompt that completes gets its images persisted + DB status updated
 *
 * Cancellation is handled externally via deleteComfyQueueItems / interruptComfyPrompt.
 */

import { RunStatus, JobStatus } from "@/lib/db-enums";
import { assertEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import {
  ComfyPromptExecutionError,
  validateComfyPromptDraft,
  submitComfyPrompt,
  pollComfyPromptHistory,
  extractOutputImages,
  extractExecutionMeta,
  extractOutputDir,
  type ValidatedComfyPromptDraft,
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
import type { WorkerRunSnapshot } from "@/server/worker/types";

const log = createLogger({ module: "run-executor" });

/** Module-level lock to prevent concurrent execution loops. */
let running = false;
/** Flag set when a new run is enqueued while executor is busy. */
let pendingRerun = false;

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractFailedComfyPromptId(error: unknown) {
  if (error instanceof ComfyPromptExecutionError) return error.comfyPromptId;
  return null;
}

/**
 * Transition a queued run to running status.
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

type SubmittedRun = {
  run: WorkerRunSnapshot;
  comfyPromptId: string;
  validatedDraft: ValidatedComfyPromptDraft;
};

/**
 * Process all queued Runs: batch-submit to ComfyUI, then wait in parallel.
 */
export async function executeQueuedRuns(): Promise<void> {
  if (running) {
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

    // ── Phase 1: Submit all to ComfyUI ──
    const submitted: SubmittedRun[] = [];

    for (const run of queuedRuns) {
      const runLog = log.child({ runId: run.runId, projectId: run.project.id });

      // Check if cancelled while waiting
      const currentRun = await db.run.findUnique({
        where: { id: run.runId },
        select: { status: true },
      });
      if (!currentRun || currentRun.status === "cancelled") {
        runLog.info("Run was cancelled, skipping");
        continue;
      }

      try {
        await markRunning(run.runId, run.project.id);

        const promptDraft = buildComfyPromptDraft(run);
        const validatedDraft = await validateComfyPromptDraft(
          run.comfyApiUrl,
          promptDraft,
        );
        const comfyPromptId = await submitComfyPrompt(validatedDraft, promptDraft);

        // Store comfyPromptId immediately so cancellation can find it
        await db.run.update({
          where: { id: run.runId },
          data: { comfyPromptId },
        });

        runLog.info("Submitted to ComfyUI queue", {
          comfyPromptId,
          section: run.section.name,
        });

        audit("Run", run.runId, "executor.submitted", {
          projectId: run.project.id,
          sectionName: run.section.name,
          comfyPromptId,
        });

        submitted.push({ run, comfyPromptId, validatedDraft });
      } catch (error) {
        // Submit failed — mark this run as failed, continue with others
        const comfyPromptId = extractFailedComfyPromptId(error);
        const errorMessage = formatError(error);
        runLog.error("Submit failed", error, { comfyPromptId });

        await completeWorkerRun(run.runId, {
          status: RunStatus.failed,
          errorMessage,
          comfyPromptId,
          outputDir: null,
        });

        audit("Run", run.runId, "executor.failed", {
          errorMessage,
          comfyPromptId,
          phase: "submit",
        });
      }
    }

    if (submitted.length === 0) {
      log.debug("No runs submitted successfully");
      return;
    }

    log.info("All runs submitted, waiting for completion", {
      count: submitted.length,
    });

    // ── Phase 2: Wait for all in parallel ──
    await Promise.allSettled(
      submitted.map(async ({ run, comfyPromptId, validatedDraft }) => {
        const runLog = log.child({ runId: run.runId, comfyPromptId });
        const runTimer = runLog.startTimer("process-run");

        try {
          const historyEntry = await pollComfyPromptHistory(
            validatedDraft.apiUrl,
            comfyPromptId,
          );

          runLog.debug("ComfyUI prompt completed", {
            imageCount: extractOutputImages(historyEntry).length,
          });

          const outputImages = extractOutputImages(historyEntry);
          const executionMeta = extractExecutionMeta(validatedDraft.apiPrompt);

          const persistedOutput = await persistComfyOutputImages(
            run,
            run.comfyApiUrl,
            outputImages,
          );

          await completeWorkerRun(run.runId, {
            status: RunStatus.done,
            comfyPromptId,
            executionMeta,
            outputDir: persistedOutput.outputDir,
            images: persistedOutput.images,
          });

          audit("Run", run.runId, "executor.done", {
            comfyPromptId,
            imageCount: persistedOutput.images.length,
          });

          runTimer.done({ status: "done", imageCount: persistedOutput.images.length });
        } catch (error) {
          const errorMessage = formatError(error);
          runLog.error("Run failed", error, { comfyPromptId });

          try {
            await removeManagedRunOutput(run);
          } catch (cleanupError) {
            runLog.warn("Cleanup failed", { error: formatError(cleanupError) });
          }

          // Check if it was cancelled (interrupt → execution_interrupted)
          const currentRun = await db.run.findUnique({
            where: { id: run.runId },
            select: { status: true },
          });
          if (currentRun?.status === "cancelled") {
            runLog.info("Run was cancelled during execution");
            runTimer.done({ status: "cancelled" });
            return;
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
            phase: "execution",
          });

          runTimer.done({ status: "failed", error: errorMessage });
        }
      }),
    );
  } finally {
    running = false;
    if (pendingRerun) {
      pendingRerun = false;
      log.debug("Re-checking queue after pending signal");
      setTimeout(() => executeQueuedRuns().catch(() => {}), 0);
    }
  }
}
