import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { processCensorTask } from "@/server/services/censoring-service";

const log = createLogger({ module: "censoring-executor" });

let processing = false;
let wakeResolver: (() => void) | null = null;

async function recoverStaleCensoringTasks(): Promise<void> {
  const result = await prisma.censoringTask.updateMany({
    where: { status: "running" },
    data: { status: "queued", startedAt: null, errorMessage: null },
  });

  if (result.count > 0) {
    log.info("Recovered stale censoring tasks", { count: result.count });
  }
}

async function processQueuedTasks(): Promise<number> {
  const tasks = await prisma.censoringTask.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true, imageResultId: true },
  });

  if (tasks.length === 0) return 0;

  let processed = 0;

  for (const task of tasks) {
    const claimed = await prisma.censoringTask.updateMany({
      where: { id: task.id, status: "queued" },
      data: {
        status: "running",
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      },
    });

    if (claimed.count === 0) continue;

    processed++;

    try {
      await processCensorTask(task.imageResultId);

      const updated = await prisma.censoringTask.updateMany({
        where: { id: task.id, status: "running" },
        data: { status: "done", finishedAt: new Date(), errorMessage: null },
      });

      if (updated.count === 0) {
        log.info("Censoring task changed state before completion update", {
          taskId: task.id,
        });
        continue;
      }

      log.info("Censoring task completed", { taskId: task.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated = await prisma.censoringTask.updateMany({
        where: { id: task.id, status: "running" },
        data: {
          status: "failed",
          errorMessage: message,
          finishedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        log.info("Censoring task changed state before failure update", {
          taskId: task.id,
          error: message,
        });
        continue;
      }

      log.error("Censoring task failed", { taskId: task.id, error: message });
    }
  }

  return processed;
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
