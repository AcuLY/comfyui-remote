/**
 * Run Executor — Submit-then-Poll Model
 *
 * Submission happens synchronously in the server action (runProject/runSection).
 * This module handles:
 * - submitRunToComfyUI(): validates and submits a single run to ComfyUI
 * - pollRunCompletion(): polls ComfyUI for a submitted run's execution and completion
 * - recoverStaleRuns(): recovers runs left in queued/running state after server restart
 *
 * Cancellation is handled externally via deleteComfyQueueItems / interruptComfyPrompt.
 */

import { RunStatus } from "@/lib/db-enums";
import { assertEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import {
  ComfyPromptExecutionError,
  validateComfyPromptDraft,
  submitComfyPrompt,
  pollComfyPromptHistory,
  extractOutputImages,
  extractExecutionMeta,
  getComfyQueuePosition,
  type ValidatedComfyPromptDraft,
} from "@/server/services/comfyui-service";
import {
  persistComfyOutputImages,
  removeManagedRunOutput,
} from "@/server/services/image-result-service";
import { audit } from "@/server/services/audit-service";
import { buildComfyPromptDraft } from "@/server/worker/payload-builder";
import {
  completeWorkerRun,
} from "@/server/worker/repository";
import { db } from "@/lib/db";
import type { WorkerRunSnapshot, ComfyPromptDraft } from "@/server/worker/types";
import { waitForPromptToStart } from "@/server/services/comfyui-service";

const log = createLogger({ module: "run-executor" });
const FINALIZING_OUTPUT_DIR_PREFIX = "__finalizing__:";
const FINALIZING_CLAIM_TTL_MS = 30 * 60 * 1000;

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function createFinalizingMarker() {
  return `${FINALIZING_OUTPUT_DIR_PREFIX}${Date.now()}`;
}

function parseFinalizingMarker(outputDir: string | null) {
  if (!outputDir?.startsWith(FINALIZING_OUTPUT_DIR_PREFIX)) {
    return null;
  }

  const timestamp = Number(outputDir.slice(FINALIZING_OUTPUT_DIR_PREFIX.length));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function claimRunFinalization(
  runId: string,
  currentOutputDir: string | null,
): Promise<boolean> {
  const markerTimestamp = parseFinalizingMarker(currentOutputDir);
  if (markerTimestamp !== null && Date.now() - markerTimestamp < FINALIZING_CLAIM_TTL_MS) {
    return false;
  }

  const claim = await db.run.updateMany({
    where: {
      id: runId,
      status: { in: [RunStatus.queued, RunStatus.running] },
      outputDir: currentOutputDir,
    },
    data: {
      outputDir: createFinalizingMarker(),
    },
  });

  return claim.count === 1;
}

// ─── Submit ────────────────────────────────────────────────────────────────

export type SubmitResult = {
  comfyPromptId: string;
  validatedDraft: ValidatedComfyPromptDraft;
  promptDraft: ComfyPromptDraft;
};

/**
 * Validate and submit a single run to ComfyUI.
 * Called synchronously from the server action before creating the Run record.
 * Throws on failure — caller should NOT create a Run record if this fails.
 */
export async function submitRunToComfyUI(run: WorkerRunSnapshot): Promise<SubmitResult> {
  assertEnv();

  const promptDraft = buildComfyPromptDraft(run);
  const validatedDraft = await validateComfyPromptDraft(
    run.comfyApiUrl,
    promptDraft,
  );
  const comfyPromptId = await submitComfyPrompt(validatedDraft, promptDraft);

  const runLog = log.child({ runId: run.runId, projectId: run.project.id });
  runLog.info("Submitted to ComfyUI queue", {
    comfyPromptId,
    section: run.section.name,
  });

  audit("Run", run.runId, "executor.submitted", {
    projectId: run.project.id,
    sectionName: run.section.name,
    comfyPromptId,
  });

  return { comfyPromptId, validatedDraft, promptDraft };
}

// ─── Poll ──────────────────────────────────────────────────────────────────

/** Track active polling loops to prevent duplicates for the same run. */
const activePolls = new Set<string>();

/**
 * Poll a submitted run until it completes.
 * The Run must already exist in DB with status="queued" and a comfyPromptId.
 * Fire-and-forget from the server action after creating the Run record.
 */
export async function pollRunCompletion(runId: string): Promise<void> {
  if (activePolls.has(runId)) {
    log.debug("Poll already active for run", { runId });
    return;
  }
  activePolls.add(runId);

  try {
    const runRecord = await db.run.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        comfyPromptId: true,
        resolvedConfigSnapshot: true,
        outputDir: true,
        runIndex: true,
        project: {
          select: { id: true, title: true, slug: true },
        },
        projectSection: {
          select: { id: true, name: true, sortOrder: true },
        },
      },
    });

    if (!runRecord || !runRecord.comfyPromptId) {
      log.warn("Run not found or missing comfyPromptId, skipping poll", { runId });
      return;
    }

    if (runRecord.status !== RunStatus.queued && runRecord.status !== RunStatus.running) {
      log.debug("Run is no longer active, skipping poll", { runId, status: runRecord.status });
      return;
    }

    // Reconstruct WorkerRunSnapshot for the helper functions
    const run: WorkerRunSnapshot = {
      runId: runRecord.id,
      runIndex: runRecord.runIndex,
      status: runRecord.status as RunStatus,
      workflowId: runRecord.project.slug,
      comfyApiUrl: process.env.COMFY_API_URL ?? "http://127.0.0.1:8188",
      outputDir: runRecord.outputDir,
      resolvedConfigSnapshot: runRecord.resolvedConfigSnapshot,
      project: {
        id: runRecord.project.id,
        title: runRecord.project.title,
        slug: runRecord.project.slug,
      },
      section: {
        id: runRecord.projectSection.id,
        name: runRecord.projectSection.name ?? `section_${runRecord.projectSection.sortOrder + 1}`,
        slug: `section_${runRecord.projectSection.sortOrder + 1}`,
      },
    };

    const comfyPromptId = runRecord.comfyPromptId;
    const runLog = log.child({ runId, comfyPromptId });
    const runTimer = runLog.startTimer("process-run");

    // We need the validatedDraft for extractExecutionMeta — rebuild it
    const promptDraft = buildComfyPromptDraft(run);
    const validatedDraft = await validateComfyPromptDraft(
      run.comfyApiUrl,
      promptDraft,
    );

    try {
      // Keep DB status aligned with ComfyUI's real queue state. A submitted
      // prompt is still "queued" until ComfyUI moves it into queue_running.
      if (runRecord.status === RunStatus.running) {
        const position = await getComfyQueuePosition(validatedDraft.apiUrl, comfyPromptId);
        if (position === "pending") {
          await db.run.updateMany({
            where: { id: runId, status: RunStatus.running },
            data: { status: RunStatus.queued, startedAt: null },
          });
          runRecord.status = RunStatus.queued;
        }
      }

      if (runRecord.status === RunStatus.queued) {
        const started = await waitForPromptToStart(
          validatedDraft.apiUrl,
          comfyPromptId,
          { pollIntervalMs: 2000 },
        );

        if (started) {
          const transitionResult = await db.run.updateMany({
            where: { id: runId, status: RunStatus.queued },
            data: { status: RunStatus.running, startedAt: new Date() },
          });

          if (transitionResult.count === 0) {
            const currentRun = await db.run.findUnique({
              where: { id: runId },
              select: { status: true },
            });
            if (currentRun?.status !== RunStatus.running) {
              runLog.info("Run changed state before execution started, skipping poll", {
                status: currentRun?.status,
              });
              runTimer.done({ status: currentRun?.status ?? "missing" });
              return;
            }
          }

          runLog.info("ComfyUI started executing prompt");
        } else {
          runLog.info("ComfyUI prompt completed before running state was observed");
        }
      }

      const historyEntry = await pollComfyPromptHistory(
        validatedDraft.apiUrl,
        comfyPromptId,
      );

      runLog.debug("ComfyUI prompt completed", {
        imageCount: extractOutputImages(historyEntry).length,
      });

      const outputImages = extractOutputImages(historyEntry);
      const executionMeta = extractExecutionMeta(validatedDraft.apiPrompt, promptDraft);
      const claimedFinalization = await claimRunFinalization(runId, runRecord.outputDir);

      if (!claimedFinalization) {
        runLog.info("Run finalization is already claimed elsewhere, skipping duplicate poll");
        runTimer.done({ status: "duplicate-finalizer" });
        return;
      }

      const persistedOutput = await persistComfyOutputImages(
        run,
        run.comfyApiUrl,
        outputImages,
      );

      // Save workflow JSON alongside images
      if (persistedOutput.outputDir && validatedDraft) {
        const fs = await import("fs/promises");
        const path = await import("path");
        const workflowPath = path.join(persistedOutput.outputDir, "workflow.json");
        await fs.writeFile(workflowPath, JSON.stringify(validatedDraft.apiPrompt, null, 2), "utf-8");
      }

      await completeWorkerRun(runId, {
        status: RunStatus.done,
        comfyPromptId,
        executionMeta,
        submittedPrompt: validatedDraft.apiPrompt,
        outputDir: persistedOutput.outputDir,
        images: persistedOutput.images,
      });

      audit("Run", runId, "executor.done", {
        comfyPromptId,
        imageCount: persistedOutput.images.length,
      });

      runTimer.done({ status: "done", imageCount: persistedOutput.images.length });
    } catch (error) {
      const errorMessage = formatError(error);
      runLog.error("Run failed", error, { comfyPromptId });

      // Check if the run was already completed (e.g. completeWorkerRun succeeded
      // but a later step like audit threw). If so, do NOT delete images.
      const currentRun = await db.run.findUnique({
        where: { id: runId },
        select: { status: true },
      });

      if (currentRun?.status === "done") {
        runLog.warn("Error after run was already marked done — keeping images", {
          error: errorMessage,
        });
        runTimer.done({ status: "done" });
        return;
      }

      try {
        await removeManagedRunOutput(run);
      } catch (cleanupError) {
        runLog.warn("Cleanup failed", { error: formatError(cleanupError) });
      }

      if (currentRun?.status === "cancelled") {
        runLog.info("Run was cancelled during execution");
        runTimer.done({ status: "cancelled" });
        return;
      }

      await completeWorkerRun(runId, {
        status: RunStatus.failed,
        errorMessage,
        comfyPromptId,
        outputDir: null,
      });

      audit("Run", runId, "executor.failed", {
        errorMessage,
        comfyPromptId,
        phase: "execution",
      });

      runTimer.done({ status: "failed", error: errorMessage });
    }
  } finally {
    activePolls.delete(runId);
  }
}

// ─── Recovery ──────────────────────────────────────────────────────────────

/** Track if recovery is already in progress to prevent concurrent execution. */
let recoveryInProgress = false;

/**
 * Recover runs that are in ComfyUI's queue or currently executing but not
 * being polled (e.g. after server restart).
 *
 * Called from /api/queue-data and instrumentation.ts.
 */
export async function recoverStaleRuns(): Promise<void> {
  // Prevent concurrent recovery attempts
  if (recoveryInProgress) {
    log.debug("Recovery already in progress, skipping");
    return;
  }
  recoveryInProgress = true;

  try {
    try {
      assertEnv();
    } catch {
      return; // env not configured, skip
    }

    const staleRuns = await db.run.findMany({
      where: {
        status: { in: [RunStatus.queued, RunStatus.running] },
        comfyPromptId: { not: null },
      },
      select: { id: true },
    });

    if (staleRuns.length === 0) return;

    // Filter out runs that already have an active polling loop
    const needsRecovery = staleRuns.filter((r) => !activePolls.has(r.id));

    if (needsRecovery.length === 0) return;

    log.info("Recovering stale runs", { count: needsRecovery.length });

    for (const run of needsRecovery) {
      pollRunCompletion(run.id).catch(() => {});
    }
  } finally {
    recoveryInProgress = false;
  }
}
