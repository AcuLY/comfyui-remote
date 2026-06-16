import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { processCensorTasksBatch, type ProcessCensorTaskResult } from "@/server/services/censoring-service";

const log = createLogger({ module: "censoring-executor" });

let processing = false;
let wakeResolver: (() => void) | null = null;

async function recoverStaleCensoringTasks(): Promise<void> {
  const result = await prisma.censoringTask.updateMany({
    where: {
      status: "running",
      project: buildGenerationProjectWhere(),
    },
    data: { status: "queued", startedAt: null, errorMessage: null },
  });

  if (result.count > 0) {
    log.info("Recovered stale censoring tasks", { count: result.count });
  }
}

type QueuedCensoringTask = {
  id: string;
  imageResultId: string;
};

async function claimQueuedTask(task: QueuedCensoringTask): Promise<QueuedCensoringTask | null> {
  const claimed = await prisma.censoringTask.updateMany({
    where: {
      id: task.id,
      status: "queued",
      project: buildGenerationProjectWhere(),
    },
    data: {
      status: "running",
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
    },
  });

  return claimed.count === 0 ? null : task;
}

async function markTaskDone(result: ProcessCensorTaskResult): Promise<void> {
  if (!result.taskId) return;

  const updated = await prisma.censoringTask.updateMany({
    where: {
      id: result.taskId,
      status: "running",
      project: buildGenerationProjectWhere(),
    },
    data: { status: "done", finishedAt: new Date(), errorMessage: null },
  });

  if (updated.count === 0) {
    log.info("Censoring task changed state before completion update", {
      taskId: result.taskId,
    });
    return;
  }

  log.info("Censoring task completed", { taskId: result.taskId });
}

async function markTaskFailed(taskId: string, error: string): Promise<void> {
  const updated = await prisma.censoringTask.updateMany({
    where: {
      id: taskId,
      status: "running",
      project: buildGenerationProjectWhere(),
    },
    data: {
      status: "failed",
      errorMessage: error,
      finishedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    log.info("Censoring task changed state before failure update", {
      taskId,
      error,
    });
    return;
  }

  log.error("Censoring task failed", { taskId, error });
}

async function finishBatchResult(result: ProcessCensorTaskResult): Promise<void> {
  if (!result.taskId) return;

  if (result.error) {
    await markTaskFailed(result.taskId, result.error);
    return;
  }

  if (!result.persisted) {
    log.info("Skipping completion update for inactive censoring task", {
      taskId: result.taskId,
    });
    return;
  }

  await markTaskDone(result);
}

async function processQueuedTasks(): Promise<number> {
  const tasks = await prisma.censoringTask.findMany({
    where: {
      status: "queued",
      project: buildGenerationProjectWhere(),
    },
    orderBy: { createdAt: "asc" },
    take: env.autoCensorBatchSize,
    select: { id: true, imageResultId: true },
  });

  if (tasks.length === 0) return 0;

  const claimedTasks: QueuedCensoringTask[] = [];

  for (const task of tasks) {
    const claimed = await claimQueuedTask(task);
    if (claimed) claimedTasks.push(claimed);
  }

  if (claimedTasks.length === 0) return 0;

  try {
    const results = await processCensorTasksBatch(
      claimedTasks.map((task) => ({
        imageResultId: task.imageResultId,
        taskId: task.id,
      })),
    );

    for (const result of results) {
      await finishBatchResult(result);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all(claimedTasks.map((task) => markTaskFailed(task.id, message)));
  }

  return claimedTasks.length;
}

async function waitForWakeOrTimeout(): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, env.comfyHistoryPollIntervalMs);
    wakeResolver = () => {
      clearTimeout(timeout);
      resolve();
    };
  });
  wakeResolver = null;
}

async function processingLoop(): Promise<void> {
  processing = true;
  log.info("Censoring processor started");

  try {
    while (true) {
      const processed = await processQueuedTasks();

      if (processed > 0) {
        log.info("Processed censoring tasks", { count: processed });
        continue;
      }

      log.debug("No queued censoring tasks, sleeping");
      await waitForWakeOrTimeout();
      log.debug("Censoring processor woken up");
    }
  } catch (error) {
    log.error("Censoring processor crashed", error);
    processing = false;
    setTimeout(() => startCensoringProcessor(), 5000);
  }
}

export function startCensoringProcessor(): void {
  if (processing) return;
  recoverStaleCensoringTasks()
    .then(() => processingLoop())
    .catch((error) => {
      log.error("Censoring processor startup error", error);
      processing = false;
    });
}

export function wakeUpCensoringProcessor(): void {
  if (wakeResolver) {
    wakeResolver();
  } else if (!processing) {
    startCensoringProcessor();
  }
}
