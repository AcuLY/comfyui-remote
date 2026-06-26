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
};

type ResumeAllRunsResult = {
  ok: boolean;
  count: number;
  runIds: string[];
  error?: string;
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
    } catch (e) {
      // Best-effort: still mark as cancelled in DB even if ComfyUI call fails
      console.warn("Failed to cancel in ComfyUI:", e);
    }
  }

  await prisma.run.updateMany({
    where: buildGenerationRunWhere({ id: runId }),
    data: {
      status: "cancelled",
      finishedAt: new Date(),
      errorMessage: "用户取消",
    },
  });

  await updateProjectStatusFromActiveRuns(run.projectId);

  revalidatePath("/queue");
  revalidatePath(`/projects/${run.projectId}`);
  return { ok: true };
}

/** Cancel all queued/running runs for a project */
export async function cancelProjectRuns(projectId: string): Promise<number> {
  // Find all active runs with comfyPromptIds to cancel in ComfyUI
  const activeRuns = await prisma.run.findMany({
    where: buildGenerationRunWhere({
      projectId,
      status: { in: RUN_ACTIVE_STATUSES },
    }),
    select: { id: true, status: true, comfyPromptId: true },
  });

  try {
    await cancelComfyPromptsForRuns(activeRuns);
  } catch (e) {
    console.warn("Failed to cancel in ComfyUI:", e);
  }

  const result = await prisma.run.updateMany({
    where: buildGenerationRunWhere({
      projectId,
      status: { in: RUN_ACTIVE_STATUSES },
    }),
    data: {
      status: "cancelled",
      finishedAt: new Date(),
      errorMessage: "用户取消",
    },
  });
  await updateProjectStatusFromActiveRuns(projectId);
  revalidatePath("/queue");
  revalidatePath(`/projects/${projectId}`);
  return result.count;
}

/** Cancel all queued/running runs across projects. */
export async function clearActiveRuns(): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  try {
    const activeRuns = await prisma.run.findMany({
      where: buildGenerationRunWhere({ status: { in: RUN_ACTIVE_STATUSES } }),
      select: { id: true, projectId: true, status: true, comfyPromptId: true },
    });

    await cancelComfyPromptsForRuns(activeRuns);

    const result = await prisma.run.updateMany({
      where: buildGenerationRunWhere({ status: { in: RUN_ACTIVE_STATUSES } }),
      data: {
        status: "cancelled",
        finishedAt: new Date(),
        errorMessage: "用户取消",
      },
    });

    const projectIds = [...new Set(activeRuns.map((run) => run.projectId))];
    for (const projectId of projectIds) {
      await updateProjectStatusFromActiveRuns(projectId);
    }

    revalidatePath("/queue");
    revalidatePath("/projects");
    return { ok: true, count: result.count };
  } catch (e) {
    console.error("Failed to clear active runs:", e);
    return { ok: false, count: 0, error: "清空运行中队列失败" };
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

  await prisma.run.updateMany({
    where: buildGenerationRunWhere({ id: runId }),
    data: {
      status: "paused",
      executionMeta: buildExecutionMetaUpdate(run.executionMeta, marker),
    },
  });

  await updateProjectStatusFromActiveRuns(run.projectId);

  // Cancel in ComfyUI after preserving the remote prompt id locally.
  if (run.comfyPromptId) {
    try {
      await cancelComfyPromptsForRuns([run]);
    } catch (e) {
      console.warn("Failed to cancel in ComfyUI during pause:", e);
    }
  }

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
  try {
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

    let count = 0;
    const runIds: string[] = [];
    const failures: string[] = [];
    const pausedRuns: typeof activeRuns = [];
    const marker = options?.source
      ? { source: options.source, batchId }
      : undefined;

    for (const run of activeRuns) {
      if (run.outputDir?.startsWith("__finalizing__:")) {
        failures.push(`${run.id}: 浠诲姟鍗冲皢瀹屾垚锛屾棤娉曟殏鍋?`);
        continue;
      }

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
      } else {
        failures.push(`${run.id}: task was no longer active`);
      }
    }

    const projectIds = [...new Set(pausedRuns.map((run) => run.projectId))];
    for (const projectId of projectIds) {
      await updateProjectStatusFromActiveRuns(projectId);
    }

    try {
      await cancelComfyPromptsForRuns(pausedRuns);
    } catch (e) {
      console.warn("Failed to cancel ComfyUI prompts during batch pause:", e);
    }

    revalidatePath("/queue");
    if (failures.length > 0) {
      return {
        ok: false,
        count,
        runIds,
        batchId,
        error: `批量暂停部分失败：${failures.join("; ")}`,
      };
    }

    return { ok: true, count, runIds, batchId };
  } catch (e) {
    console.error("Failed to pause all runs:", e);
    return { ok: false, count: 0, runIds: [], batchId, error: "批量暂停失败" };
  }
}

// ---------------------------------------------------------------------------
// 一键恢复所有暂停的任务
// ---------------------------------------------------------------------------

export async function resumeAllRuns(
  options?: ResumeAllRunsOptions,
): Promise<ResumeAllRunsResult> {
  try {
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

    let count = 0;
    const runIds: string[] = [];
    for (const run of pausedRuns) {
      const result = await resumeRun(run.id);
      if (result.ok) {
        count++;
        runIds.push(run.id);
      }
    }

    revalidatePath("/queue");
    return { ok: true, count, runIds };
  } catch (e) {
    console.error("Failed to resume all runs:", e);
    return { ok: false, count: 0, runIds: [], error: "批量恢复失败" };
  }
}
