import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  submitCensorPrompt,
  pollCensorCompletion,
} from "@/server/services/censoring-service";

const log = createLogger({ module: "censoring-executor" });

let processing = false;
let wakeResolver: (() => void) | null = null;

/**
 * On startup, reset any "running" tasks back to "queued" so they get re-submitted.
 * Also clear any censoring prompts from ComfyUI's queue to avoid duplicates.
 */
async function recoverStaleCensoringTasks(): Promise<void> {
  const staleTasks = await prisma.censoringTask.findMany({
    where: { status: "running" },
    select: { id: true, errorMessage: true },
  });

  if (staleTasks.length === 0) return;

  // Collect promptIds from stale tasks (stored in errorMessage field during execution)
  const promptIdsToDelete: string[] = [];
  for (const task of staleTasks) {
    if (task.errorMessage?.startsWith("promptId:")) {
      promptIdsToDelete.push(task.errorMessage.slice("promptId:".length));
    }
  }

  // Clear these prompts from ComfyUI's queue (best-effort)
  if (promptIdsToDelete.length > 0) {
    try {
      const apiUrl = env.comfyApiUrl.replace(/\/$/, "");
      await fetch(`${apiUrl}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete: promptIdsToDelete }),
        signal: AbortSignal.timeout(10000),
      });
      log.info(`Cleared ${promptIdsToDelete.length} stale censoring prompts from ComfyUI queue`);
    } catch (error) {
      log.warn("Failed to clear stale prompts from ComfyUI queue (non-fatal)", { error: String(error) });
    }
  }

  // Reset tasks to queued
  const result = await prisma.censoringTask.updateMany({
    where: { status: "running" },
    data: { status: "queued", startedAt: null, errorMessage: null },
  });

  log.info(`Recovered ${result.count} stale censoring task(s) from "running" to "queued"`);
}

/**
 * Submit all queued censoring tasks to ComfyUI at once (fire-and-forget polling).
 * Returns the number of tasks submitted.
 */
async function submitQueuedTasks(): Promise<number> {
  const tasks = await prisma.censoringTask.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true, imageResultId: true, projectId: true },
  });

  if (tasks.length === 0) return 0;

  let submitted = 0;

  for (const task of tasks) {
    // Claim atomically
    const claimed = await prisma.censoringTask.updateMany({
      where: { id: task.id, status: "queued" },
      data: { status: "running", startedAt: new Date() },
    });

    if (claimed.count === 0) continue;

    log.info("Submitting censoring task", { taskId: task.id, imageResultId: task.imageResultId });

    // Submit to ComfyUI and immediately start polling (fire-and-forget)
    submitAndPoll(task.id, task.imageResultId).catch((error) => {
      log.error("Censoring task submit failed", { taskId: task.id, error: String(error) });
    });

    submitted++;
  }

  return submitted;
}

/**
 * Submit a single task to ComfyUI, then poll for completion in the background.
 */
async function submitAndPoll(taskId: string, imageResultId: string): Promise<void> {
  try {
    // Phase 1: Upload image + submit prompt to ComfyUI (fast)
    const { promptId, imageResult } = await submitCensorPrompt(imageResultId);

    log.info("Censoring prompt submitted, polling", { taskId, promptId });

    // Update task with promptId for reference
    await prisma.censoringTask.update({
      where: { id: taskId },
      data: { errorMessage: `promptId:${promptId}` }, // Store promptId temporarily
    });

    // Phase 2: Poll for completion + download + save (slow, runs in background)
    await pollCensorCompletion(promptId, imageResult);

    // Mark done
    await prisma.censoringTask.update({
      where: { id: taskId },
      data: { status: "done", finishedAt: new Date(), errorMessage: null },
    });

    log.info("Censoring task completed", { taskId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.censoringTask.update({
      where: { id: taskId },
      data: { status: "failed", errorMessage: message, finishedAt: new Date() },
    }).catch(() => {});
    log.error("Censoring task failed", { taskId, error: message });
  }
}

/**
 * Main processing loop. Submits all queued tasks then sleeps until woken.
 */
async function processingLoop(): Promise<void> {
  processing = true;
  log.info("Censoring processor started");

  try {
    while (true) {
      const submitted = await submitQueuedTasks();
      if (submitted > 0) {
        log.info(`Submitted ${submitted} censoring tasks to ComfyUI`);
      }

      // Sleep until new tasks are queued
      log.debug("Censoring queue empty or all submitted, sleeping");
      await new Promise<void>((resolve) => {
        wakeResolver = resolve;
      });
      wakeResolver = null;
      log.debug("Censoring processor woken up");
    }
  } catch (error) {
    log.error("Censoring processor crashed", error);
    processing = false;
    setTimeout(() => startCensoringProcessor(), 5000);
  }
}

/**
 * Start the censoring processor (idempotent).
 * On first start, recovers stale "running" tasks from a previous session.
 */
export function startCensoringProcessor(): void {
  if (processing) return;
  recoverStaleCensoringTasks()
    .then(() => processingLoop())
    .catch((error) => {
      log.error("Censoring processor startup error", error);
      processing = false;
    });
}

/**
 * Wake the processor to check for new tasks.
 */
export function wakeUpCensoringProcessor(): void {
  if (wakeResolver) {
    wakeResolver();
  } else if (!processing) {
    startCensoringProcessor();
  }
}
