/**
 * Next.js Node instrumentation - runs once when the server starts.
 *
 * Used to initialize the ComfyUI process manager for health monitoring
 * and optional auto-start. Also cleans up orphaned runs that were left
 * in "running" state from a previous server session crash, and recovers
 * active runs that still have a comfyPromptId.
 *
 * Graceful shutdown: on SIGTERM/SIGINT, pauses all active runs before exit.
 * Graceful startup: resumes paused runs if ComfyUI is healthy.
 */

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

  // Attempt to resume paused runs if ComfyUI is reachable
  await resumePausedRunsIfHealthy();

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
      console.log(
        `[startup] Found ${pausedRuns.length} paused run(s) but ComfyUI is not reachable — skipping resume`,
      );
      return;
    }

    console.log(
      `[startup] Resuming ${pausedRuns.length} paused run(s) — ComfyUI is healthy`,
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
          console.error(`[startup] pollRunCompletion failed for resumed run ${runId}:`, err);
        });
      } catch (err) {
        console.error(`[startup] Failed to resume run ${runId}:`, err);
        await db.run.update({
          where: { id: runId },
          data: { status: "failed", errorMessage: `Resume failed: ${err instanceof Error ? err.message : String(err)}` },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("[startup] Failed to resume paused runs:", error);
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

    console.log(`[shutdown] Received ${signal}, pausing active runs...`);

    try {
      const { db } = await import("@/lib/db");
      const { env } = await import("@/lib/env");

      // Find all active runs
      const activeRuns = await db.run.findMany({
        where: { status: { in: ["queued", "running"] } },
        select: { id: true, comfyPromptId: true },
      });

      if (activeRuns.length > 0) {
        console.log(`[shutdown] Pausing ${activeRuns.length} active run(s)...`);

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

        console.log(`[shutdown] Paused ${activeRuns.length} run(s) — will resume on next startup`);
      } else {
        console.log("[shutdown] No active runs to pause");
      }
    } catch (error) {
      console.error("[shutdown] Error during graceful shutdown:", error);
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
      console.log(
        `[startup] Cleaned up ${result.count} orphaned running run(s) that were started before ${cutoff.toISOString()}`,
      );
    }
  } catch (error) {
    console.error("[startup] Failed to cleanup orphaned runs:", error);
  }
}
