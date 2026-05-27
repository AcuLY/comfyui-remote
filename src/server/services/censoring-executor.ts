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

// Track active tasks: taskId → { promptId, imageResult }
type ActiveTask = {
  taskId: string;
  promptId: string;
  imageResult: { id: string; filePath: string; reviewStatus: string };
};

const activeTasks = new Map<string, ActiveTask>();

/**
 * On startup, reset any "running" tasks back to "queued" and clear
 * their stale prompts from ComfyUI's queue.
 */
async function recoverStaleCensoringTasks(): Promise<void> {
  const staleTasks = await prisma.censoringTask.findMany({
    where: { status: "running" },
    select: { id: true, errorMessage: true },
  });

  if (staleTasks.length === 0) return;

  // Collect promptIds from stale tasks
  const promptIdsToDelete: string[] = [];
  for (const task of staleTasks) {
    if (task.errorMessage?.startsWith("promptId:")) {
      promptIdsToDelete.push(task.errorMessage.slice("promptId:".length));
    }
  }

  // Clear stale prompts from ComfyUI queue (best-effort)
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
      log.warn("Failed to clear stale prompts from ComfyUI queue", { error: String(error) });
    }
  }

  // Reset tasks to queued
  const result = await prisma.censoringTask.updateMany({
    where: { status: "running" },
    data: { status: "queued", startedAt: null, errorMessage: null },
  });

  log.info(`Recovered ${result.count} stale censoring task(s)`);
}

/**
 * Submit all queued tasks to ComfyUI.
 * Returns promptIds for the unified polling loop.
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
    const claimed = await prisma.censoringTask.updateMany({
      where: { id: task.id, status: "queued" },
      data: { status: "running", startedAt: new Date() },
    });

    if (claimed.count === 0) continue;

    try {
      const { promptId, imageResult } = await submitCensorPrompt(task.imageResultId);

      // Store promptId in DB for recovery
      await prisma.censoringTask.update({
        where: { id: task.id },
        data: { errorMessage: `promptId:${promptId}` },
      });

      // Track for unified polling
      activeTasks.set(promptId, { taskId: task.id, promptId, imageResult });

      log.info("Submitted censoring prompt", { taskId: task.id, promptId });
      submitted++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.censoringTask.update({
        where: { id: task.id },
        data: { status: "failed", errorMessage: message, finishedAt: new Date() },
      }).catch(() => {});
      log.error("Failed to submit censoring task", { taskId: task.id, error: message });
    }
  }

  return submitted;
}

/**
 * Unified polling loop: check ComfyUI history for ALL active prompts
 * in a single request, then process completed ones.
 *
 * Only 1 HTTP request per poll cycle regardless of task count.
 */
async function pollActiveTasksOnce(): Promise<number> {
  if (activeTasks.size === 0) return 0;

  const apiUrl = env.comfyApiUrl.replace(/\/$/, "");
  let completed = 0;

  // Fetch full history (recent) — ComfyUI returns all completed prompts
  let historyData: Record<string, unknown>;
  try {
    const response = await fetch(`${apiUrl}/history`, {
      signal: AbortSignal.timeout(env.comfyRequestTimeoutMs),
    });
    if (!response.ok) return 0;
    historyData = await response.json() as Record<string, unknown>;
  } catch {
    return 0; // Network error, retry next cycle
  }

  // Check each active task
  for (const [promptId, task] of activeTasks) {
    const entry = historyData[promptId];
    if (!entry) continue; // Not completed yet

    // This prompt is done — process it
    activeTasks.delete(promptId);

    try {
      // Download and save the censored image
      await pollCensorCompletion(promptId, task.imageResult);

      await prisma.censoringTask.update({
        where: { id: task.taskId },
        data: { status: "done", finishedAt: new Date(), errorMessage: null },
      });

      log.info("Censoring task completed", { taskId: task.taskId, promptId });
      completed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.censoringTask.update({
        where: { id: task.taskId },
        data: { status: "failed", errorMessage: message, finishedAt: new Date() },
      }).catch(() => {});
      log.error("Censoring task failed during download", { taskId: task.taskId, error: message });
    }
  }

  return completed;
}

/**
 * Main processing loop:
 * 1. Submit all queued tasks
 * 2. Poll for completions (single request per cycle)
 * 3. When all done, sleep until new tasks arrive
 */
async function processingLoop(): Promise<void> {
  processing = true;
  log.info("Censoring processor started");

  try {
    while (true) {
      // Submit any new queued tasks
      const submitted = await submitQueuedTasks();
      if (submitted > 0) {
        log.info(`Submitted ${submitted} censoring tasks to ComfyUI`);
      }

      // Poll until all active tasks are done
      while (activeTasks.size > 0) {
        await sleep(env.comfyHistoryPollIntervalMs);
        const completed = await pollActiveTasksOnce();
        if (completed > 0) {
          // Check if new tasks were queued while we were polling
          const newSubmitted = await submitQueuedTasks();
          if (newSubmitted > 0) {
            log.info(`Submitted ${newSubmitted} new censoring tasks while polling`);
          }
        }
      }

      // All done — sleep until woken
      log.debug("All censoring tasks complete, sleeping");
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start the censoring processor (idempotent).
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
