/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * Used to initialize the ComfyUI process manager for health monitoring
 * and optional auto-start.
 */

export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getComfyProcessManager } = await import(
      "@/server/services/comfy-process-manager"
    );
    const manager = getComfyProcessManager();
    manager.initAutoStart();
  }
}
