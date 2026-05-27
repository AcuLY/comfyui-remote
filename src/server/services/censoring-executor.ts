import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { censorSingleImage } from "@/server/services/censoring-service";

const log = createLogger({ module: "censoring-executor" });

let processing = false;
let wakeResolver: (() => void) | null = null;

/**
 * Process the next queued censoring task.
 * Returns true if a task was processed, false if queue is empty.
 */
async function processNextTask(): Promise<boolean> {
  // Claim the next queued task atomically
  const task = await prisma.censoringTask.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true, imageResultId: true, projectId: true },
  });

  if (!task) return false;

  // Mark as running
  const claimed = await prisma.censoringTask.updateMany({
    where: { id: task.id, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });

  if (claimed.count === 0) return true; // Someone else claimed it, try next

  log.info("Processing censoring task", { taskId: task.id, imageResultId: task.imageResultId });

  try {
    await censorSingleImage(task.imageResultId);
    await prisma.censoringTask.update({
      where: { id: task.id },
      data: { status: "done", finishedAt: new Date() },
    });
    log.info("Censoring task completed", { taskId: task.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.censoringTask.update({
      where: { id: task.id },
      data: { status: "failed", errorMessage: message, finishedAt: new Date() },
    });
    log.error("Censoring task failed", { taskId: task.id, error: message });
  }

  return true;
}

/**
 * Main processing loop. Runs until queue is empty, then sleeps.
 */
async function processingLoop(): Promise<void> {
  processing = true;
  log.info("Censoring processor started");

  try {
    while (true) {
      const hadWork = await processNextTask();
      if (!hadWork) {
        // Queue empty — wait for wake signal
        log.debug("Censoring queue empty, sleeping");
        await new Promise<void>((resolve) => {
          wakeResolver = resolve;
        });
        wakeResolver = null;
        log.debug("Censoring processor woken up");
      }
    }
  } catch (error) {
    log.error("Censoring processor crashed", error);
    processing = false;
    // Restart after a brief delay
    setTimeout(() => startCensoringProcessor(), 5000);
  }
}

/**
 * Start the censoring processor (idempotent — no-op if already running).
 */
export function startCensoringProcessor(): void {
  if (processing) return;
  processingLoop().catch((error) => {
    log.error("Censoring processor loop error", error);
    processing = false;
  });
}

/**
 * Wake the processor to check for new tasks.
 * Call this after creating new CensoringTask records.
 */
export function wakeUpCensoringProcessor(): void {
  if (wakeResolver) {
    wakeResolver();
  } else if (!processing) {
    startCensoringProcessor();
  }
}
