/**
 * Next.js Node instrumentation - runs once when the server starts.
 *
 * Used to initialize the ComfyUI process manager for health monitoring
 * and optional auto-start. Also cleans up orphaned runs that were left
 * in "running" state from a previous server session crash, and recovers
 * active runs that still have a comfyPromptId.
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
