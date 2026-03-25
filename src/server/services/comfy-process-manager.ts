/**
 * ComfyUI Process Manager — singleton service
 *
 * Manages ComfyUI process lifecycle:
 * - spawn / stop / restart via child_process
 * - periodic health checks (GET /system_stats)
 * - automatic restart with sliding-window rate limiting
 * - ring-buffer log capture (stdout + stderr)
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComfyProcessState =
  | "stopped"
  | "starting"
  | "running"
  | "unhealthy"
  | "restarting"
  | "error";

export type ComfyProcessStatus = {
  state: ComfyProcessState;
  pid: number | null;
  uptime: number | null;
  lastHealthCheck: string | null;
  lastHealthOk: boolean;
  restartCount: number;
  restartsInWindow: number;
  maxRestartsReached: boolean;
  autoRestartEnabled: boolean;
  managedMode: boolean;
  logs: string[];
  comfyApiUrl: string;
  errorMessage: string | null;
};

// ---------------------------------------------------------------------------
// Ring buffer for logs
// ---------------------------------------------------------------------------

const MAX_LOG_LINES = 200;

class RingBuffer {
  private buffer: string[] = [];
  private pointer = 0;
  private full = false;

  push(line: string) {
    if (this.full) {
      this.buffer[this.pointer] = line;
    } else {
      this.buffer.push(line);
    }

    this.pointer = (this.pointer + 1) % MAX_LOG_LINES;

    if (this.pointer === 0 && !this.full) {
      this.full = true;
    }
  }

  toArray(): string[] {
    if (!this.full) {
      return [...this.buffer];
    }

    return [
      ...this.buffer.slice(this.pointer),
      ...this.buffer.slice(0, this.pointer),
    ];
  }

  clear() {
    this.buffer = [];
    this.pointer = 0;
    this.full = false;
  }
}

// ---------------------------------------------------------------------------
// Manager singleton
// ---------------------------------------------------------------------------

class ComfyProcessManager {
  private process: ChildProcess | null = null;
  private state: ComfyProcessState = "stopped";
  private startedAt: number | null = null;
  private lastHealthCheck: string | null = null;
  private lastHealthOk = false;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private restartTimestamps: number[] = [];
  private restartCount = 0;
  private maxRestartsReached = false;
  private logs = new RingBuffer();
  private errorMessage: string | null = null;
  private consecutiveHealthFailures = 0;

  /** Number of consecutive health-check failures before considering unhealthy */
  private static readonly UNHEALTHY_THRESHOLD = 3;

  // -------------------------------------------------------------------------
  // Public: Status
  // -------------------------------------------------------------------------

  getStatus(): ComfyProcessStatus {
    return {
      state: this.state,
      pid: this.process?.pid ?? null,
      uptime:
        this.startedAt !== null ? Math.floor((Date.now() - this.startedAt) / 1000) : null,
      lastHealthCheck: this.lastHealthCheck,
      lastHealthOk: this.lastHealthOk,
      restartCount: this.restartCount,
      restartsInWindow: this.restartsInWindow(),
      maxRestartsReached: this.maxRestartsReached,
      autoRestartEnabled: env.comfyAutoRestart,
      managedMode: Boolean(env.comfyLaunchCmd.trim()),
      logs: this.logs.toArray(),
      comfyApiUrl: env.comfyApiUrl,
      errorMessage: this.errorMessage,
    };
  }

  // -------------------------------------------------------------------------
  // Public: Lifecycle
  // -------------------------------------------------------------------------

  async start(): Promise<{ ok: boolean; message: string }> {
    if (!env.comfyLaunchCmd.trim()) {
      return { ok: false, message: "COMFY_LAUNCH_CMD is not configured" };
    }

    if (this.state === "running" || this.state === "starting") {
      return { ok: false, message: `ComfyUI is already ${this.state}` };
    }

    this.maxRestartsReached = false;
    this.errorMessage = null;
    return this.spawnProcess();
  }

  async stop(): Promise<{ ok: boolean; message: string }> {
    if (!this.process || this.state === "stopped") {
      this.setState("stopped");
      return { ok: true, message: "ComfyUI is already stopped" };
    }

    this.stopHealthCheck();
    this.killProcess();
    return { ok: true, message: "ComfyUI stop signal sent" };
  }

  async restart(): Promise<{ ok: boolean; message: string }> {
    await this.stop();
    // Wait a short moment for process cleanup
    await sleep(1000);
    return this.start();
  }

  /** Called once at server startup from instrumentation.ts */
  initAutoStart() {
    if (!env.comfyLaunchCmd.trim()) {
      this.log("[manager] Managed mode disabled: COMFY_LAUNCH_CMD not set");
      // Even in non-managed mode, start health monitoring
      this.startHealthCheck();
      return;
    }

    this.log("[manager] Managed mode enabled");

    if (env.comfyAutoStart) {
      this.log("[manager] Auto-start enabled, launching ComfyUI...");
      this.start().catch((err) => {
        this.log(`[manager] Auto-start failed: ${String(err)}`);
      });
    } else {
      this.log("[manager] Auto-start disabled, waiting for manual start");
      this.startHealthCheck();
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Process spawn
  // -------------------------------------------------------------------------

  private async spawnProcess(): Promise<{ ok: boolean; message: string }> {
    this.setState("starting");
    this.errorMessage = null;

    // Check and kill any process occupying the ComfyUI port before spawning
    await this.ensurePortFree();

    const cmd = env.comfyLaunchCmd.trim();
    const cwd = env.comfyLaunchCwd.trim() || undefined;

    this.log(`[manager] Starting ComfyUI: ${cmd}`);

    if (cwd) {
      this.log(`[manager] Working directory: ${cwd}`);
    }

    try {
      const child = spawn(cmd, [], {
        shell: true,
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        // Force UTF-8 encoding for child process to handle emoji and unicode chars
        // This prevents UnicodeEncodeError on Windows (GBK) when custom nodes output emoji
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONLEGACYWINDOWSSTDIO: "0",
          PYTHONUTF8: "1",
        },
      });

      this.process = child;
      this.startedAt = Date.now();

      child.stdout?.on("data", (data: Buffer) => {
        for (const line of data.toString("utf8").split("\n")) {
          if (line.trim()) {
            this.log(`[stdout] ${line}`);
          }
        }
      });

      child.stderr?.on("data", (data: Buffer) => {
        for (const line of data.toString("utf8").split("\n")) {
          if (line.trim()) {
            this.log(`[stderr] ${line}`);
          }
        }
      });

      child.on("error", (err) => {
        this.log(`[manager] Process error: ${err.message}`);
        this.errorMessage = err.message;
        this.setState("error");
        this.process = null;
        this.handleProcessExit();
      });

      child.on("exit", (code, signal) => {
        this.log(
          `[manager] Process exited (code=${code ?? "null"}, signal=${signal ?? "null"})`,
        );

        if (this.state !== "stopped") {
          this.errorMessage = `Process exited unexpectedly (code=${code ?? "null"})`;
          this.setState("error");
        }

        this.process = null;
        this.startedAt = null;
        this.handleProcessExit();
      });

      // Start health check loop
      this.startHealthCheck();

      return { ok: true, message: "ComfyUI starting" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`[manager] Failed to spawn: ${message}`);
      this.errorMessage = message;
      this.setState("error");
      return { ok: false, message };
    }
  }

  private killProcess() {
    if (!this.process) return;

    this.log("[manager] Sending SIGTERM...");
    this.setState("stopped");

    try {
      this.process.kill("SIGTERM");
    } catch {
      // Process may already be dead
    }

    // Force kill after 5 seconds if still alive
    const child = this.process;
    setTimeout(() => {
      try {
        if (child && !child.killed) {
          this.log("[manager] Force killing with SIGKILL...");
          child.kill("SIGKILL");
        }
      } catch {
        // Ignore
      }
    }, 5000);
  }

  // -------------------------------------------------------------------------
  // Internal: Port check
  // -------------------------------------------------------------------------

  /** Extract port number from ComfyUI API URL (e.g. http://127.0.0.1:8188 → 8188) */
  private extractPort(): number {
    try {
      const url = new URL(env.comfyApiUrl);
      const port = parseInt(url.port, 10);
      return port > 0 ? port : 8188;
    } catch {
      return 8188;
    }
  }

  /** Check if the port is in use; if so, kill the occupying process */
  private ensurePortFree(): Promise<void> {
    const port = this.extractPort();

    return new Promise((resolve) => {
      const server = createConnection({ port, host: "127.0.0.1" }, () => {
        // Connection succeeded → port is occupied
        server.destroy();
        this.log(`[manager] Port ${port} is occupied, killing existing process...`);
        const { execSync } = require("node:child_process") as typeof import("node:child_process");
        try {
          const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
          if (pids) {
            execSync(`kill -9 ${pids.split("\n").join(" ")}`, { encoding: "utf8" });
            this.log(`[manager] Killed process(es) on port ${port}: ${pids}`);
          }
        } catch {
          // lsof found nothing or kill failed — ignore
        }
        // Give OS a moment to release the port
        setTimeout(resolve, 500);
      });

      server.on("error", () => {
        // Connection refused → port is free
        server.destroy();
        resolve();
      });

      // Timeout after 2 seconds (treat as free)
      setTimeout(() => {
        server.destroy();
        resolve();
      }, 2000);
    });
  }

  // -------------------------------------------------------------------------
  // Internal: Process spawn (continued)
  // -------------------------------------------------------------------------

  private startHealthCheck() {
    this.stopHealthCheck();

    this.healthTimer = setInterval(() => {
      this.performHealthCheck().catch(() => {
        // Errors handled inside performHealthCheck
      });
    }, env.comfyHealthIntervalMs);

    // Run an initial check immediately
    this.performHealthCheck().catch(() => {});
  }

  private stopHealthCheck() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private async performHealthCheck() {
    const now = new Date().toISOString();
    this.lastHealthCheck = now;

    try {
      const res = await fetch(`${env.comfyApiUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        this.lastHealthOk = true;
        this.consecutiveHealthFailures = 0;

        // Transition to running if we were starting
        if (this.state === "starting" || this.state === "unhealthy" || this.state === "restarting") {
          this.log("[health] ComfyUI is responsive ✓");
          this.setState("running");
        }

        return;
      }
    } catch {
      // Fetch failed
    }

    this.lastHealthOk = false;
    this.consecutiveHealthFailures += 1;

    // Only mark unhealthy after threshold consecutive failures
    if (
      this.consecutiveHealthFailures >= ComfyProcessManager.UNHEALTHY_THRESHOLD &&
      (this.state === "running" || this.state === "starting")
    ) {
      this.log(
        `[health] ComfyUI unreachable (${this.consecutiveHealthFailures} consecutive failures) ✗`,
      );
      this.setState("unhealthy");
      this.maybeAutoRestart();
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Auto restart
  // -------------------------------------------------------------------------

  private handleProcessExit() {
    if (this.state === "stopped") {
      return; // User-initiated stop, don't auto-restart
    }

    this.maybeAutoRestart();
  }

  private maybeAutoRestart() {
    if (!env.comfyAutoRestart) {
      this.log("[manager] Auto-restart disabled");
      return;
    }

    if (!env.comfyLaunchCmd.trim()) {
      return; // Non-managed mode, no auto-restart
    }

    if (this.maxRestartsReached) {
      return; // Already logged
    }

    const windowRestarts = this.restartsInWindow();

    if (windowRestarts >= env.comfyMaxRestarts) {
      this.maxRestartsReached = true;
      this.log(
        `[manager] Max restarts reached (${windowRestarts}/${env.comfyMaxRestarts} in ${env.comfyRestartWindowMs / 1000}s window). Giving up.`,
      );
      this.setState("error");
      this.errorMessage = `Max restarts reached (${env.comfyMaxRestarts} in ${env.comfyRestartWindowMs / 1000}s)`;
      return;
    }

    this.restartTimestamps.push(Date.now());
    this.restartCount += 1;
    this.setState("restarting");
    this.log(
      `[manager] Auto-restarting (${windowRestarts + 1}/${env.comfyMaxRestarts} in window)...`,
    );

    // Small delay before restart
    setTimeout(() => {
      this.spawnProcess().catch((err) => {
        this.log(`[manager] Restart failed: ${String(err)}`);
      });
    }, 2000);
  }

  private restartsInWindow(): number {
    const cutoff = Date.now() - env.comfyRestartWindowMs;
    this.restartTimestamps = this.restartTimestamps.filter((ts) => ts > cutoff);
    return this.restartTimestamps.length;
  }

  // -------------------------------------------------------------------------
  // Internal: Utilities
  // -------------------------------------------------------------------------

  private setState(newState: ComfyProcessState) {
    if (this.state !== newState) {
      this.state = newState;
    }
  }

  private log(message: string) {
    const ts = new Date().toISOString();
    this.logs.push(`${ts} ${message}`);
  }

  /** Reset the max-restart flag so user can retry */
  resetMaxRestarts() {
    this.maxRestartsReached = false;
    this.restartTimestamps = [];
    this.log("[manager] Restart counter reset");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const globalForComfy = globalThis as typeof globalThis & {
  __comfyProcessManager?: ComfyProcessManager;
};

export function getComfyProcessManager(): ComfyProcessManager {
  if (!globalForComfy.__comfyProcessManager) {
    globalForComfy.__comfyProcessManager = new ComfyProcessManager();
  }

  return globalForComfy.__comfyProcessManager;
}
