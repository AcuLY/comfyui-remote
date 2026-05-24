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
import type { Prisma } from "@/generated/prisma";
import { assertEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import {
  validateComfyPromptDraft,
  submitComfyPrompt,
  pollComfyPromptHistory,
  extractOutputImages,
  extractExecutionMeta,
  getComfyQueuePosition,
  ComfyPromptPollAbortedError,
  type SubmitComfyPromptOptions,
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

function isRunRecoveryDisabled() {
  if (process.env.COMFY_MANAGER_DISABLE_RUN_RECOVERY === "true") {
    return true;
  }

  return (
    process.env.NODE_ENV === "development" &&
    process.env.COMFY_MANAGER_ENABLE_RUN_RECOVERY !== "true"
  );
}

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
  comfyPromptId: string,
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
      comfyPromptId,
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

type JsonRecord = Record<string, unknown>;

function asJsonRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function normalizeComfyApiUrl(apiUrl: string) {
  const normalizedApiUrl = apiUrl.trim().replace(/\/+$/, "");

  if (!normalizedApiUrl) {
    throw new Error("ComfyUI API URL is empty");
  }

  return normalizedApiUrl;
}

export function buildSubmittedRunData(result: SubmitResult) {
  return {
    comfyPromptId: result.comfyPromptId,
    submittedPrompt: result.validatedDraft.apiPrompt as Prisma.InputJsonObject,
    executionMeta: extractExecutionMeta(
      result.validatedDraft.apiPrompt,
      result.promptDraft,
    ) as Prisma.InputJsonObject,
  };
}

/**
 * Validate and submit a single run to ComfyUI.
 * Called synchronously from the server action before creating the Run record.
 * Throws on failure — caller should NOT create a Run record if this fails.
 */
export async function submitRunToComfyUI(
  run: WorkerRunSnapshot,
  options: SubmitComfyPromptOptions = {},
): Promise<SubmitResult> {
  assertEnv();

  const promptDraft = buildComfyPromptDraft(run);
  const validatedDraft = await validateComfyPromptDraft(
    run.comfyApiUrl,
    promptDraft,
  );
  const comfyPromptId = await submitComfyPrompt(validatedDraft, promptDraft, options);

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

/** Track active polling loops by run and prompt to prevent stale poll ownership. */
const activePolls = new Map<string, string>();

async function isRunStillPollingPrompt(runId: string, comfyPromptId: string) {
  const currentRun = await db.run.findUnique({
    where: { id: runId },
    select: { status: true, comfyPromptId: true },
  });

  return (
    currentRun?.comfyPromptId === comfyPromptId &&
    (currentRun.status === RunStatus.queued || currentRun.status === RunStatus.running) &&
    activePolls.get(runId) === comfyPromptId
  );
}

/**
 * Poll a submitted run until it completes.
 * The Run must already exist in DB with status="queued" and a comfyPromptId.
 * Fire-and-forget from the server action after creating the Run record.
 */
export async function pollRunCompletion(runId: string): Promise<void> {
  let comfyPromptId: string | null = null;

  try {
    const runRecord = await db.run.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        comfyPromptId: true,
        submittedPrompt: true,
        executionMeta: true,
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

    comfyPromptId = runRecord.comfyPromptId;
    const existingPromptId = activePolls.get(runId);
    if (existingPromptId === comfyPromptId) {
      log.debug("Poll already active for run prompt", { runId, comfyPromptId });
      return;
    }
    if (existingPromptId) {
      log.info("Replacing stale poll for run prompt", {
        runId,
        previousComfyPromptId: existingPromptId,
        comfyPromptId,
      });
    }
    activePolls.set(runId, comfyPromptId);

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

    const runLog = log.child({ runId, comfyPromptId });
    const runTimer = runLog.startTimer("process-run");

    const promptDraft = buildComfyPromptDraft(run);
    const storedSubmittedPrompt = asJsonRecord(runRecord.submittedPrompt);
    const apiUrl = normalizeComfyApiUrl(run.comfyApiUrl);
    let apiPrompt = storedSubmittedPrompt;

    if (!apiPrompt) {
      const validatedDraft = await validateComfyPromptDraft(
        run.comfyApiUrl,
        promptDraft,
      );
      apiPrompt = validatedDraft.apiPrompt;
    }

    try {
      // Keep DB status aligned with ComfyUI's real queue state. A submitted
      // prompt is still "queued" until ComfyUI moves it into queue_running.
      if (runRecord.status === RunStatus.running) {
        const position = await getComfyQueuePosition(apiUrl, comfyPromptId);
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
          apiUrl,
          comfyPromptId,
          { pollIntervalMs: 2000 },
        );

        if (started) {
          if (!(await isRunStillPollingPrompt(runId, comfyPromptId))) {
            runLog.info("Run prompt changed before execution state transition, stopping stale poll");
            runTimer.done({ status: "superseded" });
            return;
          }

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

      const pollingComfyPromptId = comfyPromptId;
      const historyEntry = await pollComfyPromptHistory(
        apiUrl,
        pollingComfyPromptId,
        { shouldContinue: () => isRunStillPollingPrompt(runId, pollingComfyPromptId) },
      );

      runLog.debug("ComfyUI prompt completed", {
        imageCount: extractOutputImages(historyEntry).length,
      });

      const outputImages = extractOutputImages(historyEntry);
      const executionMeta =
        asJsonRecord(runRecord.executionMeta) ??
        extractExecutionMeta(apiPrompt, promptDraft);
      const claimedFinalization = await claimRunFinalization(runId, runRecord.outputDir, comfyPromptId);

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
      if (persistedOutput.outputDir) {
        const fs = await import("fs/promises");
        const path = await import("path");
        const workflowPath = path.join(persistedOutput.outputDir, "workflow.json");
        await fs.writeFile(workflowPath, JSON.stringify(apiPrompt, null, 2), "utf-8");
      }

      await completeWorkerRun(runId, {
        status: RunStatus.done,
        comfyPromptId,
        executionMeta,
        submittedPrompt: apiPrompt,
        outputDir: persistedOutput.outputDir,
        images: persistedOutput.images,
      });

      audit("Run", runId, "executor.done", {
        comfyPromptId,
        imageCount: persistedOutput.images.length,
      });

      runTimer.done({ status: "done", imageCount: persistedOutput.images.length });
    } catch (error) {
      if (error instanceof ComfyPromptPollAbortedError) {
        runLog.info("Run prompt changed before polling completed, stopping stale poll");
        runTimer.done({ status: "superseded" });
        return;
      }

      const errorMessage = formatError(error);

      // Check if the run was already completed (e.g. completeWorkerRun succeeded
      // but a later step like audit threw). If so, do NOT delete images.
      const currentRun = await db.run.findUnique({
        where: { id: runId },
        select: { status: true, comfyPromptId: true },
      });

      if (currentRun?.status === "done") {
        runLog.warn("Error after run was already marked done — keeping images", {
          error: errorMessage,
        });
        runTimer.done({ status: "done" });
        return;
      }

      if (currentRun && currentRun.comfyPromptId !== comfyPromptId) {
        runLog.info("Run prompt changed before failure handling, skipping stale poll failure", {
          currentComfyPromptId: currentRun.comfyPromptId,
        });
        runTimer.done({ status: "superseded" });
        return;
      }

      if (currentRun?.status === RunStatus.paused) {
        runLog.info("Run was paused during execution");
        runTimer.done({ status: RunStatus.paused });
        return;
      }

      runLog.error("Run failed", error, { comfyPromptId });

      try {
        await removeManagedRunOutput(run);
      } catch (cleanupError) {
        runLog.warn("Cleanup failed", { error: formatError(cleanupError) });
      }

      if (currentRun?.status === RunStatus.cancelled) {
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
    if (comfyPromptId && activePolls.get(runId) === comfyPromptId) {
      activePolls.delete(runId);
    }
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
  if (isRunRecoveryDisabled()) {
    log.debug("Run recovery disabled for this process", {
      nodeEnv: process.env.NODE_ENV,
    });
    return;
  }

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
      select: { id: true, comfyPromptId: true },
    });

    if (staleRuns.length === 0) return;

    // Filter out runs that already have an active polling loop
    const needsRecovery = staleRuns.filter((r) => r.comfyPromptId && activePolls.get(r.id) !== r.comfyPromptId);

    if (needsRecovery.length === 0) return;

    log.info("Recovering stale runs", { count: needsRecovery.length });

    for (const run of needsRecovery) {
      pollRunCompletion(run.id).catch((err) => {
        log.error("pollRunCompletion failed", err instanceof Error ? err : new Error(String(err)), { runId: run.id });
      });
    }
  } finally {
    recoveryInProgress = false;
  }
}
