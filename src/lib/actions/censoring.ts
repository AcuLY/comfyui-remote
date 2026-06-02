"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { wakeUpCensoringProcessor } from "@/server/services/censoring-executor";
import {
  clearComfyQueueSnapshotCache,
  deleteComfyQueueItems,
  getComfyQueuePosition,
  interruptComfyPrompt,
} from "@/server/services/comfyui-service";
import {
  CENSORING_CANCELLABLE_STATUSES,
  selectCensoringPromptIds,
} from "@/lib/actions/cancellation-helpers";

const CENSORING_ACTIVE_STATUSES = [...CENSORING_CANCELLABLE_STATUSES];

async function cancelCensoringComfyPrompts(promptIds: string[]) {
  if (promptIds.length === 0) return;

  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  clearComfyQueueSnapshotCache();
  try {
    for (const promptId of promptIds) {
      const position = await getComfyQueuePosition(env.comfyApiUrl, promptId);
      if (position === "running") {
        shouldInterrupt = true;
      } else if (position === "pending") {
        promptIdsToDelete.push(promptId);
      }
    }

    const failures: string[] = [];
    if (promptIdsToDelete.length > 0) {
      await deleteComfyQueueItems(env.comfyApiUrl, promptIdsToDelete).catch((error) => {
        failures.push(error instanceof Error ? error.message : String(error));
      });
    }
    if (shouldInterrupt) {
      await interruptComfyPrompt(env.comfyApiUrl).catch((error) => {
        failures.push(error instanceof Error ? error.message : String(error));
      });
    }
    if (failures.length > 0) {
      throw new Error("one or more ComfyUI cancellation requests failed");
    }
  } finally {
    clearComfyQueueSnapshotCache();
  }
}

export type CensoringPreview = {
  totalKept: number;
  alreadyCensored: number;
  needsCensoring: number;
};

export async function getCensoringPreview(
  projectId: string,
): Promise<CensoringPreview> {
  const totalKept = await prisma.imageResult.count({
    where: {
      run: { projectId },
      reviewStatus: { in: ["kept", "pending"] },
    },
  });

  const alreadyCensored = await prisma.imageResult.count({
    where: {
      run: { projectId },
      reviewStatus: { in: ["kept", "pending"] },
      censoredAt: { not: null },
    },
  });

  return {
    totalKept,
    alreadyCensored,
    needsCensoring: totalKept - alreadyCensored,
  };
}

export type CensoringProgress = {
  total: number;
  done: number;
  running: number;
  queued: number;
  failed: number;
  cancelled: number;
  paused: number;
};

export async function getCensoringProgress(
  projectId: string,
): Promise<CensoringProgress> {
  const tasks = await prisma.censoringTask.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { _all: true },
  });

  const counts: CensoringProgress = {
    total: 0,
    done: 0,
    running: 0,
    queued: 0,
    failed: 0,
    cancelled: 0,
    paused: 0,
  };

  for (const group of tasks) {
    const count = group._count._all;
    counts.total += count;
    if (group.status === "done") counts.done = count;
    else if (group.status === "running") counts.running = count;
    else if (group.status === "queued") counts.queued = count;
    else if (group.status === "failed") counts.failed = count;
    else if (group.status === "cancelled") counts.cancelled = count;
    else if (group.status === "paused") counts.paused = count;
  }

  return counts;
}

export async function censorImage(
  imageResultId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const image = await prisma.imageResult.findUnique({
      where: { id: imageResultId },
      include: { run: { select: { id: true, projectId: true } } },
    });

    if (!image) {
      return { success: false, message: "图片不存在" };
    }

    if (image.reviewStatus !== "kept" && image.reviewStatus !== "pending") {
      return { success: false, message: "只能对已保留或待审核的图片执行打码" };
    }

    // Check if there's already an active task for this image
    const existing = await prisma.censoringTask.findFirst({
      where: {
        imageResultId,
        status: { in: ["queued", "running"] },
      },
    });

    if (existing) {
      return { success: false, message: "该图片已有进行中的打码任务" };
    }

    await prisma.censoringTask.create({
      data: {
        projectId: image.run.projectId,
        imageResultId,
        status: "queued",
      },
    });

    wakeUpCensoringProcessor();
    revalidatePath("/");
    return { success: true, message: "打码任务已加入队列" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建打码任务失败";
    return { success: false, message };
  }
}

export async function censorProjectImages(projectId: string, mode: "all" | "kept" = "all"): Promise<{
  success: boolean;
  message: string;
  taskCount: number;
}> {
  try {
    const reviewStatuses = mode === "kept" ? ["kept"] : ["kept", "pending"];

    // Find all images without censoring that don't have an active task
    const images = await prisma.imageResult.findMany({
      where: {
        run: { projectId },
        reviewStatus: { in: reviewStatuses as ("kept" | "pending")[] },
        censoredAt: null,
        censoringTasks: {
          none: {},
        },
      },
      select: { id: true },
    });

    // Also find images with only failed/cancelled tasks (allow retry)
    const imagesWithFailedTasks = await prisma.imageResult.findMany({
      where: {
        run: { projectId },
        reviewStatus: { in: reviewStatuses as ("kept" | "pending")[] },
        censoredAt: null,
        censoringTasks: {
          every: { status: { in: ["failed", "cancelled"] } },
          some: {},
        },
      },
      select: { id: true },
    });

    const allImageIds = [...new Set([...images.map(i => i.id), ...imagesWithFailedTasks.map(i => i.id)])];

    if (allImageIds.length === 0) {
      return { success: true, message: "没有需要打码的图片", taskCount: 0 };
    }

    // Delete old failed/cancelled tasks for these images before creating new ones
    await prisma.censoringTask.deleteMany({
      where: {
        imageResultId: { in: allImageIds },
        status: { in: ["failed", "cancelled"] },
      },
    });

    // Create tasks in bulk
    await prisma.censoringTask.createMany({
      data: allImageIds.map((imageResultId) => ({
        projectId,
        imageResultId,
        status: "queued",
      })),
    });

    wakeUpCensoringProcessor();
    revalidatePath("/");

    return {
      success: true,
      message: `已创建 ${allImageIds.length} 个打码任务`,
      taskCount: allImageIds.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量打码失败";
    return { success: false, message, taskCount: 0 };
  }
}

export async function cancelCensoringTasks(projectId: string): Promise<{
  success: boolean;
  message: string;
  cancelledCount: number;
}> {
  try {
    const activeTasks = await prisma.censoringTask.findMany({
      where: {
        projectId,
        status: { in: CENSORING_ACTIVE_STATUSES },
      },
      select: { errorMessage: true },
    });
    const promptIds = selectCensoringPromptIds(activeTasks);
    try {
      await cancelCensoringComfyPrompts(promptIds);
    } catch (error) {
      console.warn(
        "Failed to cancel censoring prompts in ComfyUI:",
        error instanceof Error ? error.message : String(error),
      );
    }

    const result = await prisma.censoringTask.updateMany({
      where: {
        projectId,
        status: { in: CENSORING_ACTIVE_STATUSES },
      },
      data: {
        status: "cancelled",
        finishedAt: new Date(),
        errorMessage: "用户取消",
      },
    });

    revalidatePath("/");
    return {
      success: true,
      message: result.count > 0
        ? `已取消 ${result.count} 个打码任务`
        : "没有可取消的任务",
      cancelledCount: result.count,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "取消失败";
    return { success: false, message, cancelledCount: 0 };
  }
}

export async function pauseCensoringTasks(projectId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const result = await prisma.censoringTask.updateMany({
      where: {
        projectId,
        status: "queued",
      },
      data: {
        status: "paused",
      },
    });

    revalidatePath("/");
    return {
      success: true,
      message: result.count > 0
        ? `已暂停 ${result.count} 个打码任务`
        : "没有可暂停的任务",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "暂停失败";
    return { success: false, message };
  }
}

export async function resumeCensoringTasks(projectId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const result = await prisma.censoringTask.updateMany({
      where: {
        projectId,
        status: "paused",
      },
      data: {
        status: "queued",
      },
    });

    if (result.count > 0) {
      wakeUpCensoringProcessor();
    }

    revalidatePath("/");
    return {
      success: true,
      message: result.count > 0
        ? `已恢复 ${result.count} 个打码任务`
        : "没有已暂停的任务",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "恢复失败";
    return { success: false, message };
  }
}
