"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { pollRunCompletion } from "@/server/services/run-executor";
import {
  submitRawComfyPrompt,
} from "@/server/services/comfyui-service";
import { cancelComfyPromptsForRuns } from "@/server/services/comfy-queue-cancellation";
import { getActiveComfyApiUrl } from "@/server/services/comfy-target";
import {
  removeManagedRunOutput,
} from "@/server/services/image-result-service";
import { logger } from "@/lib/logger";
import { WorkerRunSnapshot } from "@/server/worker/types";
import {
  RUN_CANCELLABLE_STATUSES,
  isRunCancellableStatus,
} from "@/lib/actions/cancellation-helpers";
import type { QueueControlProgressReporter } from "@/lib/queue-control-progress";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";

const QUEUE_PAUSE_META_KEY = "__queuePause";
const RUN_ACTIVE_STATUSES = [...RUN_CANCELLABLE_STATUSES];

type QueuePauseMarker = {
  source: string;
  batchId: string;
  pausedAt: string;
};

type QueuePauseMarkerInput = {
  source: string;
  batchId: string;
  pausedAt?: string;
};

type PauseAllRunsOptions = {
  source?: string;
  batchId?: string;
  onProgress?: QueueControlProgressReporter;
};

type PauseAllRunsResult = {
  ok: boolean;
  count: number;
  runIds: string[];
  batchId: string;
  error?: string;
};

type ResumeAllRunsOptions = {
  runIds?: string[];
  source?: string;
  batchId?: string;
  markedOnly?: boolean;
  onProgress?: QueueControlProgressReporter;
};

type ResumeAllRunsResult = {
  ok: boolean;
  count: number;
  runIds: string[];
  error?: string;
};

type QueueControlOptions = {
  onProgress?: QueueControlProgressReporter;
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function buildGenerationRunWhere(where: Prisma.RunWhereInput = {}): Prisma.RunWhereInput {
  return {
    AND: [
      where,
      { project: buildGenerationProjectWhere() },
    ],
  };
}

async function updateProjectStatusFromActiveRuns(projectId: string) {
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: { id: true },
  });
  if (!project) return;

  const activeRuns = await prisma.run.count({
    where: buildGenerationRunWhere({ projectId, status: { in: RUN_ACTIVE_STATUSES } }),
  });
  await prisma.project.updateMany({
    where: buildGenerationProjectWhere({ id: projectId }),
    data: { status: activeRuns > 0 ? "queued" : "draft" },
  });
}

function buildQueuePauseMarker(input: QueuePauseMarkerInput): QueuePauseMarker {
  return {
    source: input.source,
    batchId: input.batchId,
    pausedAt: input.pausedAt ?? new Date().toISOString(),
  };
}

function toWritableJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, Prisma.InputJsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Record<
    string,
    Prisma.InputJsonValue
  >;
}

function buildExecutionMetaUpdate(
  currentValue: Prisma.JsonValue | null,
  marker?: QueuePauseMarkerInput,
): Prisma.InputJsonObject | typeof Prisma.DbNull {
  const next = toWritableJsonObject(currentValue);

  if (marker) {
    next[QUEUE_PAUSE_META_KEY] = buildQueuePauseMarker(
      marker,
    ) as unknown as Prisma.InputJsonValue;
  } else {
    delete next[QUEUE_PAUSE_META_KEY];
  }

  return Object.keys(next).length > 0
    ? (next as Prisma.InputJsonObject)
    : Prisma.DbNull;
}

function getQueuePauseMarker(
  value: Prisma.JsonValue | null,
): QueuePauseMarker | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const marker = (value as Record<string, unknown>)[QUEUE_PAUSE_META_KEY];
  if (!marker || typeof marker !== "object" || Array.isArray(marker)) {
    return null;
  }

  const { source, batchId, pausedAt } = marker as Record<string, unknown>;
  if (
    typeof source !== "string" ||
    typeof batchId !== "string" ||
    typeof pausedAt !== "string"
  ) {
    return null;
  }

  return { source, batchId, pausedAt };
}

function matchesResumeOptions(
  run: { id: string; executionMeta: Prisma.JsonValue | null },
  options?: ResumeAllRunsOptions,
) {
  if (!options) return true;

  const runIds = options.runIds
    ? [...new Set(options.runIds)].filter(Boolean)
    : undefined;
  if (runIds && !runIds.includes(run.id)) {
    return false;
  }

  const marker = getQueuePauseMarker(run.executionMeta);
  if (options.markedOnly && !marker) {
    return false;
  }

  if (options.source && marker?.source !== options.source) {
    return false;
  }

  if (options.batchId && marker?.batchId !== options.batchId) {
    return false;
  }

  return true;
}

function formatActionError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function reportQueueProgress(
  reporter: QueueControlProgressReporter | undefined,
  event: Parameters<QueueControlProgressReporter>[0],
) {
  await reporter?.(event);
}

function splitRunsByRemotePrompt<T extends { comfyPromptId: string | null }>(runs: T[]) {
  const remoteRuns: T[] = [];
  const localOnlyRuns: T[] = [];

  for (const run of runs) {
    if (run.comfyPromptId?.trim()) {
      remoteRuns.push(run);
    } else {
      localOnlyRuns.push(run);
    }
  }

  return { remoteRuns, localOnlyRuns };
}

async function refreshProjectStatuses(projectIds: Iterable<string>) {
  for (const projectId of new Set(projectIds)) {
    await updateProjectStatusFromActiveRuns(projectId);
  }
}

async function markRunsCancelled(runIds: string[]) {
  if (runIds.length === 0) return 0;

  const result = await prisma.run.updateMany({
    where: buildGenerationRunWhere({
      id: { in: runIds },
      status: { in: RUN_ACTIVE_STATUSES },
    }),
    data: {
      status: "cancelled",
      finishedAt: new Date(),
      errorMessage: "用户取消",
    },
  });

  return result.count;
}

// ---------------------------------------------------------------------------
// 取消任务（Run）
// ---------------------------------------------------------------------------

export async function cancelRun(
  runId: string,
): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findFirst({
    where: buildGenerationRunWhere({ id: runId }),
    select: { id: true, status: true, projectId: true, comfyPromptId: true },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (!isRunCancellableStatus(run.status)) {
    return { ok: false, error: `任务状态为「${run.status}」，无法取消` };
  }

  if (run.comfyPromptId) {
    try {
      await cancelComfyPromptsForRuns([run]);
    } catch (error) {
      return { ok: false, error: `ComfyUI cancellation failed: ${formatActionError(error)}` };
    }
  }

  await markRunsCancelled([runId]);

  await updateProjectStatusFromActiveRuns(run.projectId);

  revalidatePath("/queue");
  revalidatePath(`/projects/${run.projectId}`);
  return { ok: true };
}

/** Cancel all queued/running runs for a project */
export async function cancelProjectRuns(projectId: string): Promise<number> {
  const activeRuns = await prisma.run.findMany({
    where: buildGenerationRunWhere({
      projectId,
      status: { in: RUN_ACTIVE_STATUSES },
    }),
    select: { id: true, projectId: true, status: true, comfyPromptId: true },
  });

  const { remoteRuns, localOnlyRuns } = splitRunsByRemotePrompt(activeRuns);
  let cancelledCount = 0;

  if (localOnlyRuns.length > 0) {
    cancelledCount += await markRunsCancelled(localOnlyRuns.map((run) => run.id));
    await updateProjectStatusFromActiveRuns(projectId);
  }

  await cancelComfyPromptsForRuns(remoteRuns, undefined, {
    onBatchConfirmed: async (batch) => {
      const result = await prisma.run.updateMany({
        where: buildGenerationRunWhere({
          id: { in: batch.runs.map((run) => run.id).filter((id): id is string => Boolean(id)) },
          status: { in: RUN_ACTIVE_STATUSES },
        }),
        data: {
          status: "cancelled",
          finishedAt: new Date(),
          errorMessage: "用户取消",
        },
      });
      cancelledCount += result.count;
      await updateProjectStatusFromActiveRuns(projectId);
    },
  });

  revalidatePath("/queue");
  revalidatePath(`/projects/${projectId}`);
  return cancelledCount;
}

/** Cancel all queued/running runs across projects. */
export async function clearActiveRuns(options: QueueControlOptions = {}): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  let cancelledCount = 0;
  let processedRuns = 0;
  let totalRuns = 0;
  try {
    await reportQueueProgress(options.onProgress, {
      stage: "reading_queue",
      processedRuns,
      totalRuns,
      message: "Reading active queue",
    });

    const activeRuns = await prisma.run.findMany({
      where: buildGenerationRunWhere({ status: { in: RUN_ACTIVE_STATUSES } }),
      select: { id: true, projectId: true, status: true, comfyPromptId: true },
    });
    totalRuns = activeRuns.length;
    const projectIdByRunId = new Map(activeRuns.map((run) => [run.id, run.projectId]));
    const { remoteRuns, localOnlyRuns } = splitRunsByRemotePrompt(activeRuns);

    await reportQueueProgress(options.onProgress, {
      stage: "reading_queue",
      processedRuns,
      totalRuns,
      message: `Found ${totalRuns} active run(s)`,
    });

    if (localOnlyRuns.length > 0) {
      await reportQueueProgress(options.onProgress, {
        stage: "updating_local",
        processedRuns,
        totalRuns,
        batchIndex: 0,
        batchSize: localOnlyRuns.length,
        message: "Cancelling local-only queued runs",
      });
      cancelledCount += await markRunsCancelled(localOnlyRuns.map((run) => run.id));
      processedRuns += localOnlyRuns.length;
      await refreshProjectStatuses(localOnlyRuns.map((run) => run.projectId));
    }

    await cancelComfyPromptsForRuns(remoteRuns, undefined, {
      onProgress: async (progress) => {
        await reportQueueProgress(options.onProgress, {
          stage:
            progress.stage === "confirming_remote"
              ? "confirming_remote"
              : progress.stage === "updating_local"
                ? "updating_local"
                : "syncing_comfy",
          processedRuns: processedRuns + progress.processedRuns,
          totalRuns,
          batchIndex: progress.batchIndex,
          batchSize: progress.batchSize,
          elapsedMs: progress.elapsedMs,
          message: progress.message,
        });
      },
      onBatchConfirmed: async (batch) => {
        await reportQueueProgress(options.onProgress, {
          stage: "updating_local",
          processedRuns,
          totalRuns,
          batchIndex: batch.batchIndex,
          batchSize: batch.runs.length,
          elapsedMs: batch.elapsedMs,
          message: "Updating confirmed local rows",
        });
        const result = await prisma.run.updateMany({
          where: buildGenerationRunWhere({
            id: { in: batch.runs.map((run) => run.id).filter((id): id is string => Boolean(id)) },
            status: { in: RUN_ACTIVE_STATUSES },
          }),
          data: {
            status: "cancelled",
            finishedAt: new Date(),
            errorMessage: "用户取消",
          },
        });
        cancelledCount += result.count;
        processedRuns += batch.runs.length;
        await refreshProjectStatuses(
          batch.runs
            .map((run) => (run.id ? projectIdByRunId.get(run.id) : null))
            .filter((projectId): projectId is string => Boolean(projectId)),
        );
      },
    });

    await reportQueueProgress(options.onProgress, {
      stage: "refreshing",
      processedRuns,
      totalRuns,
      message: "Refreshing queue views",
    });
    revalidatePath("/queue");
    revalidatePath("/projects");
    await reportQueueProgress(options.onProgress, {
      stage: "done",
      processedRuns,
      totalRuns,
      message: "Active queue cancelled",
    });
    return { ok: true, count: cancelledCount };
  } catch (error) {
    const message = formatActionError(error);
    console.error("Failed to clear active runs:", error);
    await reportQueueProgress(options.onProgress, {
      stage: "failed",
      processedRuns,
      totalRuns,
      error: message,
      message: "Active queue cancellation failed",
    });
    return { ok: false, count: cancelledCount, error: `清空运行中队列失败: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// 一键清空运行记录（删除 done / failed / cancelled 状态的 Run）
// ---------------------------------------------------------------------------

export async function clearRuns(): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  try {
    // 1. Find all runs that will be deleted
    const runsToDelete = await prisma.run.findMany({
      where: buildGenerationRunWhere({ status: { in: ["done", "failed", "cancelled"] } }),
      include: {
        project: { select: { id: true, slug: true } },
        projectSection: { select: { id: true, sortOrder: true } },
      },
    });

    // 2. Delete managed output files for each run
    for (const run of runsToDelete) {
      try {
        const sectionSlug = `section_${run.projectSection.sortOrder + 1}`;
        const runSnapshot: WorkerRunSnapshot = {
          runId: run.id,
          runIndex: run.runIndex,
          status: "done",
          workflowId: "",
          comfyApiUrl: "",
          outputDir: null,
          resolvedConfigSnapshot: null,
          project: {
            id: run.project.id,
            title: "",
            slug: run.project.slug,
          },
          section: {
            id: run.projectSection.id,
            name: "",
            slug: sectionSlug,
          },
        };
        await removeManagedRunOutput(runSnapshot);
      } catch (error) {
        // Log but continue with other runs and database deletion
        console.warn("Failed to cleanup files for run", { runId: run.id, error });
      }
    }

    // 3. Delete database records (cascade handles images, etc.)
    const result = await prisma.run.deleteMany({
      where: buildGenerationRunWhere({ status: { in: ["done", "failed", "cancelled"] } }),
    });

    revalidatePath("/queue");
    return { ok: true, count: result.count };
  } catch (e) {
    console.error("Failed to clear runs:", e);
    return { ok: false, count: 0, error: "清空失败" };
  }
}

// ---------------------------------------------------------------------------
// 暂停任务（Run）
// ---------------------------------------------------------------------------

export async function pauseRun(
  runId: string,
  marker?: QueuePauseMarkerInput,
): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findFirst({
    where: buildGenerationRunWhere({ id: runId }),
    select: {
      id: true,
      status: true,
      projectId: true,
      comfyPromptId: true,
      outputDir: true,
      executionMeta: true,
    },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (run.status !== "queued" && run.status !== "running") {
    return { ok: false, error: `任务状态为「${run.status}」，无法暂停` };
  }

  // Reject pause during finalization
  if (run.outputDir?.startsWith("__finalizing__:")) {
    return { ok: false, error: "任务即将完成，无法暂停" };
  }

  if (run.comfyPromptId) {
    try {
      await cancelComfyPromptsForRuns([run]);
    } catch (error) {
      return { ok: false, error: `ComfyUI pause cancellation failed: ${formatActionError(error)}` };
    }
  }

  await prisma.run.updateMany({
    where: buildGenerationRunWhere({ id: runId }),
    data: {
      status: "paused",
      executionMeta: buildExecutionMetaUpdate(run.executionMeta, marker),
    },
  });

  await updateProjectStatusFromActiveRuns(run.projectId);

  revalidatePath("/queue");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 恢复任务（Run）
// ---------------------------------------------------------------------------

export async function resumeRun(
  runId: string,
): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findFirst({
    where: buildGenerationRunWhere({ id: runId }),
    select: {
      id: true,
      status: true,
      projectId: true,
      submittedPrompt: true,
      executionMeta: true,
    },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (run.status !== "paused") {
    return { ok: false, error: `任务状态为「${run.status}」，无法恢复` };
  }
  if (!run.submittedPrompt) {
    return { ok: false, error: "缺少工作流快照，无法恢复" };
  }

  // Re-submit to ComfyUI
  let newComfyPromptId: string;
  try {
    const apiUrl = getActiveComfyApiUrl().trim().replace(/\/+$/, "");
    newComfyPromptId = await submitRawComfyPrompt(apiUrl, run.submittedPrompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `无法连接到 ComfyUI: ${msg}` };
  }

  await prisma.run.updateMany({
    where: buildGenerationRunWhere({ id: runId }),
    data: {
      status: "queued",
      comfyPromptId: newComfyPromptId,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      executionMeta: buildExecutionMetaUpdate(run.executionMeta),
    },
  });

  // Update project status
  await prisma.project.updateMany({
    where: buildGenerationProjectWhere({ id: run.projectId }),
    data: { status: "queued" },
  });

  // Fire-and-forget: poll for completion
  pollRunCompletion(runId).catch((err) => {
    logger.error(
      "pollRunCompletion failed after resume",
      err instanceof Error ? err : new Error(String(err)),
      { runId },
    );
  });

  revalidatePath("/queue");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 一键暂停所有运行中的任务
// ---------------------------------------------------------------------------

export async function pauseAllRuns(
  options?: PauseAllRunsOptions,
): Promise<PauseAllRunsResult> {
  const batchId = options?.batchId ?? randomUUID();
  let count = 0;
  const runIds: string[] = [];
  let processedRuns = 0;
  let totalRuns = 0;
  try {
    await reportQueueProgress(options?.onProgress, {
      stage: "reading_queue",
      processedRuns,
      totalRuns,
      message: "Reading active queue",
    });

    const activeRuns = await prisma.run.findMany({
      where: buildGenerationRunWhere({ status: { in: ["queued", "running"] } }),
      select: {
        id: true,
        status: true,
        projectId: true,
        comfyPromptId: true,
        outputDir: true,
        executionMeta: true,
      },
      orderBy: { createdAt: "asc" },
    });
    totalRuns = activeRuns.length;

    const failures: string[] = [];
    const pausedRuns: typeof activeRuns = [];
    const marker = options?.source
      ? { source: options.source, batchId }
      : undefined;
    const runById = new Map(activeRuns.map((run) => [run.id, run]));
    const markPausedRun = async (run: (typeof activeRuns)[number]) => {
      const result = await prisma.run.updateMany({
        where: buildGenerationRunWhere({
          id: run.id,
          status: { in: ["queued", "running"] },
        }),
        data: {
          status: "paused",
          executionMeta: buildExecutionMetaUpdate(run.executionMeta, marker),
        },
      });

      if (result.count > 0) {
        count++;
        runIds.push(run.id);
        pausedRuns.push(run);
        await updateProjectStatusFromActiveRuns(run.projectId);
      } else {
        failures.push(`${run.id}: task was no longer active`);
      }
      processedRuns++;
    };

    await reportQueueProgress(options?.onProgress, {
      stage: "reading_queue",
      processedRuns,
      totalRuns,
      message: `Found ${totalRuns} active run(s)`,
    });

    for (const run of activeRuns) {
      if (run.outputDir?.startsWith("__finalizing__:")) {
        failures.push(`${run.id}: 浠诲姟鍗冲皢瀹屾垚锛屾棤娉曟殏鍋?`);
        continue;
      }

      if (run.comfyPromptId?.trim()) {
        continue;
      }

      await markPausedRun(run);
    }

    const remotePauseRuns = activeRuns.filter(
      (run) => run.comfyPromptId?.trim() && !run.outputDir?.startsWith("__finalizing__:"),
    );
    await cancelComfyPromptsForRuns(remotePauseRuns, undefined, {
      onProgress: async (progress) => {
        await reportQueueProgress(options?.onProgress, {
          stage:
            progress.stage === "confirming_remote"
              ? "confirming_remote"
              : progress.stage === "updating_local"
                ? "updating_local"
                : "syncing_comfy",
          processedRuns: processedRuns + progress.processedRuns,
          totalRuns,
          batchIndex: progress.batchIndex,
          batchSize: progress.batchSize,
          elapsedMs: progress.elapsedMs,
          message: progress.message,
        });
      },
      onBatchConfirmed: async (batch) => {
        await reportQueueProgress(options?.onProgress, {
          stage: "updating_local",
          processedRuns,
          totalRuns,
          batchIndex: batch.batchIndex,
          batchSize: batch.runs.length,
          elapsedMs: batch.elapsedMs,
          message: "Pausing confirmed local rows",
        });
        for (const batchRun of batch.runs) {
          const run = batchRun.id ? runById.get(batchRun.id) : undefined;
          if (run) {
            await markPausedRun(run);
          }
        }
      },
    });

    const projectIds = [...new Set(pausedRuns.map((run) => run.projectId))];
    for (const projectId of projectIds) {
      await updateProjectStatusFromActiveRuns(projectId);
    }

    await reportQueueProgress(options?.onProgress, {
      stage: "refreshing",
      processedRuns,
      totalRuns,
      message: "Refreshing queue views",
    });
    revalidatePath("/queue");
    if (failures.length > 0) {
      await reportQueueProgress(options?.onProgress, {
        stage: "failed",
        processedRuns,
        totalRuns,
        error: failures.join("; "),
        message: "Some runs could not be paused",
      });
      return {
        ok: false,
        count,
        runIds,
        batchId,
        error: `批量暂停部分失败：${failures.join("; ")}`,
      };
    }

    await reportQueueProgress(options?.onProgress, {
      stage: "done",
      processedRuns,
      totalRuns,
      message: "Active queue paused",
    });
    return { ok: true, count, runIds, batchId };
  } catch (e) {
    console.error("Failed to pause all runs:", e);
    await reportQueueProgress(options?.onProgress, {
      stage: "failed",
      processedRuns,
      totalRuns,
      error: formatActionError(e),
      message: "Batch pause failed",
    });
    return { ok: false, count, runIds, batchId, error: `批量暂停失败: ${formatActionError(e)}` };
  }
}

// ---------------------------------------------------------------------------
// 一键恢复所有暂停的任务
// ---------------------------------------------------------------------------

export async function resumeAllRuns(
  options?: ResumeAllRunsOptions,
): Promise<ResumeAllRunsResult> {
  let count = 0;
  const runIds: string[] = [];
  let processedRuns = 0;
  let totalRuns = 0;
  try {
    await reportQueueProgress(options?.onProgress, {
      stage: "reading_queue",
      processedRuns,
      totalRuns,
      message: "Reading paused queue",
    });

    const uniqueRunIds = options?.runIds
      ? [...new Set(options.runIds)].filter(Boolean)
      : undefined;
    if (uniqueRunIds && uniqueRunIds.length === 0) {
      return { ok: true, count: 0, runIds: [] };
    }

    const candidateRuns = await prisma.run.findMany({
      where: buildGenerationRunWhere({
        status: "paused",
        ...(uniqueRunIds ? { id: { in: uniqueRunIds } } : {}),
      }),
      select: { id: true, executionMeta: true },
      orderBy: { createdAt: "asc" },
    });
    const resumeOptions = uniqueRunIds
      ? { ...(options ?? {}), runIds: uniqueRunIds }
      : options;
    const pausedRuns = candidateRuns.filter((run) =>
      matchesResumeOptions(run, resumeOptions),
    );
    totalRuns = pausedRuns.length;

    await reportQueueProgress(options?.onProgress, {
      stage: "reading_queue",
      processedRuns,
      totalRuns,
      message: `Found ${totalRuns} paused run(s)`,
    });

    let batchIndex = 0;
    for (const run of pausedRuns) {
      batchIndex++;
      const startedAt = Date.now();
      await reportQueueProgress(options?.onProgress, {
        stage: "syncing_comfy",
        processedRuns,
        totalRuns,
        batchIndex,
        batchSize: 1,
        message: "Resubmitting paused run",
      });
      const result = await resumeRun(run.id);
      const elapsedMs = Date.now() - startedAt;
      if (result.ok) {
        count++;
        runIds.push(run.id);
        await reportQueueProgress(options?.onProgress, {
          stage: "updating_local",
          processedRuns: processedRuns + 1,
          totalRuns,
          batchIndex,
          batchSize: 1,
          elapsedMs,
          message: "Run resumed",
        });
      } else {
        await reportQueueProgress(options?.onProgress, {
          stage: "failed",
          processedRuns,
          totalRuns,
          batchIndex,
          batchSize: 1,
          elapsedMs,
          error: result.error,
          message: "Run resume failed",
        });
      }
      processedRuns++;
    }

    await reportQueueProgress(options?.onProgress, {
      stage: "refreshing",
      processedRuns,
      totalRuns,
      message: "Refreshing queue views",
    });
    revalidatePath("/queue");
    await reportQueueProgress(options?.onProgress, {
      stage: "done",
      processedRuns,
      totalRuns,
      message: "Paused queue resumed",
    });
    return { ok: true, count, runIds };
  } catch (e) {
    console.error("Failed to resume all runs:", e);
    await reportQueueProgress(options?.onProgress, {
      stage: "failed",
      processedRuns,
      totalRuns,
      error: formatActionError(e),
      message: "Batch resume failed",
    });
    return { ok: false, count, runIds, error: "批量恢复失败" };
  }
}
