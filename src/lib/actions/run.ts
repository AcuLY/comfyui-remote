"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  enqueueProjectRuns as enqueueProjectRunsRepo,
  enqueueProjectSectionRun as enqueueProjectSectionRunRepo,
} from "@/server/repositories/project-repository";
import { submitRunToComfyUI, pollRunCompletion } from "@/server/services/run-executor";
import { getWorkerRun } from "@/server/worker/repository";
import {
  deleteComfyQueueItems,
  getComfyQueuePosition,
  interruptComfyPrompt,
} from "@/server/services/comfyui-service";
import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// 运行整个项目
// ---------------------------------------------------------------------------

export async function runProject(projectId: string, overrideBatchSize?: number | null) {
  // 1. Create Run records with status="queued" (no comfyPromptId yet)
  const result = await enqueueProjectRunsRepo(projectId, overrideBatchSize ?? undefined);

  // 2. Submit each created run to ComfyUI synchronously
  let allFailed = true;

  for (const enqueuedRun of result.runs) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const { comfyPromptId } = await submitRunToComfyUI(run);
      // Store comfyPromptId — now "queued" means "in ComfyUI's queue"
      await prisma.run.update({
        where: { id: run.runId },
        data: { comfyPromptId },
      });
      // Fire-and-forget: poll for completion
      pollRunCompletion(run.runId).catch(() => {});
      allFailed = false;
    } catch (error) {
      // ComfyUI submission failed — delete the Run record
      console.error(`Failed to submit run ${run.runId} to ComfyUI:`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
    }
  }

  // If all runs were deleted, reset project status from "queued" back to "draft"
  if (allFailed && result.runs.length > 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "draft" },
    }).catch(() => {});
  }

  revalidatePath("/projects");
  revalidatePath("/queue");

  if (allFailed && result.runs.length > 0) {
    throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
  }
}

// ---------------------------------------------------------------------------
// 运行单个 Section
// ---------------------------------------------------------------------------

export async function runSection(sectionId: string, overrideBatchSize?: number | null) {
  // 需要先拿到 projectId，因为 repository 函数需要它
  const pos = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });

  if (!pos) return;

  // 1. Create Run record with status="queued" (no comfyPromptId yet)
  const result = await enqueueProjectSectionRunRepo(pos.projectId, sectionId, overrideBatchSize ?? undefined);

  // 2. Submit to ComfyUI synchronously
  for (const enqueuedRun of result.runs) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const { comfyPromptId } = await submitRunToComfyUI(run);
      await prisma.run.update({
        where: { id: run.runId },
        data: { comfyPromptId },
      });
      pollRunCompletion(run.runId).catch(() => {});
    } catch (error) {
      console.error(`Failed to submit run ${run.runId} to ComfyUI:`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
      // Reset project status from "queued" back since the run was deleted
      await prisma.project.update({
        where: { id: pos.projectId },
        data: { status: "draft" },
      }).catch(() => {});
      throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
    }
  }

  revalidatePath("/projects");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 取消任务（Run）
// ---------------------------------------------------------------------------

export async function cancelRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { id: true, status: true, projectId: true, comfyPromptId: true },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (run.status !== "queued" && run.status !== "running") {
    return { ok: false, error: `任务状态为「${run.status}」，无法取消` };
  }

  // Use ComfyUI's real queue state. /interrupt is global, so only call it
  // when this prompt is actually in queue_running.
  if (run.comfyPromptId) {
    try {
      const position = await getComfyQueuePosition(env.comfyApiUrl, run.comfyPromptId);
      if (position === "running") {
        await interruptComfyPrompt(env.comfyApiUrl);
      } else if (position === "pending") {
        await deleteComfyQueueItems(env.comfyApiUrl, [run.comfyPromptId]);
      }
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

  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  // Only interrupt the prompt that ComfyUI is actually executing. Pending
  // prompts should be deleted from the queue instead.
  try {
    for (const run of activeRuns) {
      if (!run.comfyPromptId) continue;
      const position = await getComfyQueuePosition(env.comfyApiUrl, run.comfyPromptId);
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
export async function clearActiveRuns(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const activeRuns = await prisma.run.findMany({
      where: { status: { in: ["queued", "running"] } },
      select: { id: true, projectId: true, comfyPromptId: true },
    });

    const promptIdsToDelete: string[] = [];
    let shouldInterrupt = false;

    try {
      for (const run of activeRuns) {
        if (!run.comfyPromptId) continue;
        const position = await getComfyQueuePosition(env.comfyApiUrl, run.comfyPromptId);
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

export async function clearRuns(): Promise<{ ok: boolean; count: number; error?: string }> {
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
