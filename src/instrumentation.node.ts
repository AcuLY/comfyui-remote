/**
 * Next.js Node instrumentation - runs once when the server starts.
 *
 * Used to initialize the ComfyUI process manager for health monitoring
 * and optional auto-start. Also cleans up orphaned runs that were left
 * in "running" state from a previous server session crash, and recovers
 * active runs that still have a comfyPromptId.
 *
 * Graceful shutdown: on SIGTERM/SIGINT, pauses all active runs before exit.
 * Paused runs stay paused on startup and are resumed explicitly after deploy.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "startup" });

const ORPHANED_RUN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function registerNodeInstrumentation() {
  await cleanupOrphanedRuns();

  const { recoverStaleRuns } = await import("@/server/services/run-executor");
  recoverStaleRuns().catch(() => {});

  const { getComfyProcessManager } = await import(
    "@/server/services/comfy-process-manager"
  );
  const manager = getComfyProcessManager();
  manager.initAutoStart();

  // Keep paused runs idle until deployment verification explicitly resumes them.
  // Set AUTO_RESUME_PAUSED_RUNS_ON_STARTUP=true only for crash-recovery sessions
  // where immediate replay is intentional.
  if (process.env.AUTO_RESUME_PAUSED_RUNS_ON_STARTUP === "true") {
    await resumePausedRunsIfHealthy();
  } else {
    await logPausedRunsAwaitingManualResume();
  }

  // Register graceful shutdown hooks
  registerShutdownHooks();
}

/**
 * On startup, if there are paused runs and ComfyUI is reachable,
 * resume them automatically.
 */
async function resumePausedRunsIfHealthy() {
  try {
    const { db } = await import("@/lib/db");
    const { env } = await import("@/lib/env");

    const pausedRuns = await db.run.findMany({
      where: { status: "paused" },
      select: { id: true },
    });

    if (pausedRuns.length === 0) return;

    // Check if ComfyUI is reachable
    let comfyHealthy = false;
    try {
      const res = await fetch(`${env.comfyApiUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });
      comfyHealthy = res.ok;
    } catch {
      // not reachable
    }

    if (!comfyHealthy) {
      log.info(
        `Found ${pausedRuns.length} paused run(s) but ComfyUI is not reachable — skipping resume`,
      );
      return;
    }

    log.info(
      `Resuming ${pausedRuns.length} paused run(s) — ComfyUI is healthy`,
    );

    // Import resumeRun logic (direct DB, not the server action which has revalidatePath)
    const { submitRunToComfyUI, pollRunCompletion, buildSubmittedRunData } = await import("@/server/services/run-executor");
    const { getWorkerRun } = await import("@/server/worker/repository");

    for (const { id: runId } of pausedRuns) {
      try {
        const run = await getWorkerRun(runId);
        if (!run) {
          await db.run.update({ where: { id: runId }, data: { status: "failed", errorMessage: "Resume failed: run data not found" } });
          continue;
        }

        // Re-submit to ComfyUI
        const submitResult = await submitRunToComfyUI(run);
        await db.run.update({
          where: { id: runId },
          data: { ...buildSubmittedRunData(submitResult), status: "running" },
        });

        // Start polling
        pollRunCompletion(runId).catch((err) => {
          log.error(`pollRunCompletion failed for resumed run ${runId}`, err);
        });
      } catch (err) {
        log.error(`Failed to resume run ${runId}`, err);
        await db.run.update({
          where: { id: runId },
          data: { status: "failed", errorMessage: `Resume failed: ${err instanceof Error ? err.message : String(err)}` },
        }).catch(() => {});
      }
    }
  } catch (error) {
    log.error("Failed to resume paused runs", error);
  }
}

async function logPausedRunsAwaitingManualResume() {
  try {
    const { db } = await import("@/lib/db");
    const pausedCount = await db.run.count({ where: { status: "paused" } });

    if (pausedCount > 0) {
      log.info(
        `${pausedCount} paused run(s) are waiting for manual resume via POST /api/queue/resume-paused`,
      );
    }
  } catch (error) {
    log.error("Failed to inspect paused runs", error);
  }
}

/**
 * Register SIGTERM/SIGINT handlers that pause all active runs before exit.
 * This ensures runs can be resumed on next startup instead of being orphaned.
 */
function registerShutdownHooks() {
  let shuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info(`Received ${signal}, pausing active runs...`);

    try {
      const { db } = await import("@/lib/db");
      const { env } = await import("@/lib/env");

      // Find all active runs
      const activeRuns = await db.run.findMany({
        where: { status: { in: ["queued", "running"] } },
        select: { id: true, comfyPromptId: true },
      });

      if (activeRuns.length > 0) {
        log.info(`Pausing ${activeRuns.length} active run(s)...`);

        // Cancel in ComfyUI (best-effort) and set to paused
        const { interruptComfyPrompt, deleteComfyQueueItems, getComfyQueuePosition } = await import("@/server/services/comfyui-service");

        for (const run of activeRuns) {
          try {
            if (run.comfyPromptId) {
              const position = await getComfyQueuePosition(env.comfyApiUrl, run.comfyPromptId).catch(() => null);
              if (position === "running") {
                await interruptComfyPrompt(env.comfyApiUrl).catch(() => {});
              } else if (position === "pending") {
                await deleteComfyQueueItems(env.comfyApiUrl, [run.comfyPromptId]).catch(() => {});
              }
            }
          } catch {
            // best-effort cancellation
          }

          await db.run.update({
            where: { id: run.id },
            data: { status: "paused", comfyPromptId: null },
          }).catch(() => {});
        }

        log.info(`Paused ${activeRuns.length} run(s) — will resume on next startup`);
      } else {
        log.info("No active runs to pause");
      }
    } catch (error) {
      log.error("Error during graceful shutdown", error);
    }

    process.exit(0);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

/**
 * Mark runs as "failed" if they've been in "running" state for too long.
 * This handles cases where the server crashed or ComfyUI became unresponsive
 * during execution, leaving runs permanently stuck.
 */
async function cleanupOrphanedRuns() {
  try {
    const { db } = await import("@/lib/db");
    const cutoff = new Date(Date.now() - ORPHANED_RUN_THRESHOLD_MS);

    const result = await db.run.updateMany({
      where: {
        status: "running",
        startedAt: { lt: cutoff },
      },
      data: {
        status: "failed",
        errorMessage: `Run orphaned: still running after ${ORPHANED_RUN_THRESHOLD_MS / 60000} minutes. Server may have restarted.`,
      },
    });

    if (result.count > 0) {
      log.info(
        `Cleaned up ${result.count} orphaned running run(s) that were started before ${cutoff.toISOString()}`,
      );
    }
  } catch (error) {
    log.error("Failed to cleanup orphaned runs", error);
  }
}
