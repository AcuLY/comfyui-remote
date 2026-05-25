"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { pollRunCompletion } from "@/server/services/run-executor";
import {
  clearComfyQueueSnapshotCache,
  deleteComfyQueueItems,
  getComfyQueuePosition,
  interruptComfyPrompt,
} from "@/server/services/comfyui-service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const QUEUE_PAUSE_META_KEY = "__queuePause";

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

/**
 * Cancel ComfyUI prompts for a batch of runs. Interrupts the currently
 * running prompt and deletes pending ones from the queue.
 */
async function cancelComfyPrompts(
  runs: Array<{ comfyPromptId: string | null }>,
): Promise<void> {
  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  for (const run of runs) {
    if (!run.comfyPromptId) continue;
    const position = await getComfyQueuePosition(
      env.comfyApiUrl,
      run.comfyPromptId,
    );
    if (position === "running") {
      shouldInterrupt = true;
    } else if (position === "pending") {
      promptIdsToDelete.push(run.comfyPromptId);
    }
  }

  if (promptIdsToDelete.length > 0) {
    await deleteComfyQueueItems(env.comfyApiUrl, promptIdsToDelete);
  }
  if (shouldInterrupt) {
    await interruptComfyPrompt(env.comfyApiUrl);
  }
}

async function cancelComfyPromptForPause(promptId: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    clearComfyQueueSnapshotCache();
    const position = await getComfyQueuePosition(env.comfyApiUrl, promptId);
    if (position === "running") {
      await interruptComfyPrompt(env.comfyApiUrl);
    } else if (position === "pending") {
      await deleteComfyQueueItems(env.comfyApiUrl, [promptId]);
    } else {
      return;
    }
  }
  clearComfyQueueSnapshotCache();
}

// ---------------------------------------------------------------------------
// 取消任务（Run）
// ---------------------------------------------------------------------------

export async function cancelRun(
  runId: string,
): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { id: true, status: true, projectId: true, comfyPromptId: true },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (
    run.status !== "queued" &&
    run.status !== "running" &&
    run.status !== "paused"
  ) {
    return { ok: false, error: `任务状态为「${run.status}」，无法取消` };
  }

  if (run.comfyPromptId && run.status !== "paused") {
    try {
      await cancelComfyPrompts([run]);
    } catch (e) {
      // Best-effort: still mark as cancelled in DB even if ComfyUI call fails
      console.warn("Failed to cancel in ComfyUI:", e);
    }
  }

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "cancelled",
      finishedAt: new Date(),
      errorMessage: "用户取消",
    },
  });

  // Recalculate project status
  const activeRuns = await prisma.run.count({
    where: { projectId: run.projectId, status: { in: ["queued", "running"] } },
  });
  if (activeRuns === 0) {
    await prisma.project.update({
      where: { id: run.projectId },
      data: { status: "draft" },
    });
  }

  revalidatePath("/queue");
  revalidatePath(`/projects/${run.projectId}`);
  return { ok: true };
}

/** Cancel all queued/running runs for a project */
export async function cancelProjectRuns(projectId: string): Promise<number> {
  // Find all active runs with comfyPromptIds to cancel in ComfyUI
  const activeRuns = await prisma.run.findMany({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    select: { id: true, status: true, comfyPromptId: true },
  });

  try {
    await cancelComfyPrompts(activeRuns);
  } catch (e) {
    console.warn("Failed to cancel in ComfyUI:", e);
  }

  const result = await prisma.run.updateMany({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    data: {
      status: "cancelled",
      finishedAt: new Date(),
      errorMessage: "用户取消",
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "draft" },
  });
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
      where: { status: { in: ["queued", "running"] } },
      select: { id: true, projectId: true, comfyPromptId: true },
    });

    try {
      await cancelComfyPrompts(activeRuns);
    } catch (e) {
      console.warn("Failed to clear active ComfyUI queue:", e);
    }

    const result = await prisma.run.updateMany({
      where: { status: { in: ["queued", "running"] } },
      data: {
        status: "cancelled",
        finishedAt: new Date(),
        errorMessage: "用户取消",
      },
    });

    const projectIds = [...new Set(activeRuns.map((run) => run.projectId))];
    if (projectIds.length > 0) {
      await prisma.project.updateMany({
        where: { id: { in: projectIds } },
        data: { status: "draft" },
      });
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
    const result = await prisma.run.deleteMany({
      where: { status: { in: ["done", "failed", "cancelled"] } },
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
  const run = await prisma.run.findUnique({
    where: { id: runId },
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

  // Cancel in ComfyUI (best-effort)
  if (run.comfyPromptId) {
    try {
      await cancelComfyPromptForPause(run.comfyPromptId);
    } catch (e) {
      console.warn("Failed to cancel in ComfyUI during pause:", e);
    }
  }

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "paused",
      comfyPromptId: null,
      executionMeta: buildExecutionMetaUpdate(run.executionMeta, marker),
    },
  });

  // Recalculate project status
  const activeRuns = await prisma.run.count({
    where: { projectId: run.projectId, status: { in: ["queued", "running"] } },
  });
  if (activeRuns === 0) {
    const pausedRuns = await prisma.run.count({
      where: { projectId: run.projectId, status: "paused" },
    });
    await prisma.project.update({
      where: { id: run.projectId },
      data: { status: pausedRuns > 0 ? "queued" : "draft" },
    });
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
  const run = await prisma.run.findUnique({
    where: { id: runId },
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
    const apiUrl = env.comfyApiUrl.trim().replace(/\/+$/, "");
    const res = await fetch(`${apiUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: run.submittedPrompt }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown error");
      throw new Error(`ComfyUI returned ${res.status}: ${text}`);
    }
    const data = await res.json();
    newComfyPromptId = data.prompt_id;
    if (!newComfyPromptId) {
      throw new Error("ComfyUI did not return prompt_id");
    }
    clearComfyQueueSnapshotCache();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `无法连接到 ComfyUI: ${msg}` };
  }

  await prisma.run.update({
    where: { id: runId },
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
  await prisma.project.update({
    where: { id: run.projectId },
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
      where: { status: { in: ["queued", "running"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    let count = 0;
    const runIds: string[] = [];
    const failures: string[] = [];
    const marker = options?.source
      ? { source: options.source, batchId }
      : undefined;
    for (const run of activeRuns) {
      const result = await pauseRun(run.id, marker);
      if (result.ok) {
        count++;
        runIds.push(run.id);
      } else {
        failures.push(`${run.id}: ${result.error ?? "unknown error"}`);
      }
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
      where: {
        status: "paused",
        ...(uniqueRunIds ? { id: { in: uniqueRunIds } } : {}),
      },
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
