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
import { execSync } from "node:child_process";
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
  /** Timestamp when the process was last spawned — used for startup grace period */
  private spawnedAt: number | null = null;

  /**
   * When true, ComfyUI was detected as already running (not spawned by us).
   * stop() must use an external kill method (lsof/taskkill) since we don't
   * hold the ChildProcess handle.
   */
  private externallyStarted = false;

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

    // Check if ComfyUI is already reachable (e.g. started externally)
    const alreadyRunning = await this.checkExistingComfyUI();
    if (alreadyRunning) {
      this.externallyStarted = true;
      this.setState("running");
      this.startHealthCheck();
      return { ok: true, message: "ComfyUI is already running (external)" };
    }

    this.maxRestartsReached = false;
    this.errorMessage = null;
    this.externallyStarted = false;
    return this.spawnProcess();
  }

  async stop(): Promise<{ ok: boolean; message: string }> {
    // ComfyUI detected as externally started — kill by port
    if (this.externallyStarted && (this.state === "running" || this.state === "unhealthy")) {
      this.log("[manager] ComfyUI was started externally, killing by port...");
      this.stopHealthCheck();
      this.setState("stopped");
      this.externallyStarted = false;
      await this.killByPort();
      return { ok: true, message: "ComfyUI external process kill signal sent" };
    }

    if (!this.process || this.state === "stopped") {
      this.setState("stopped");
      this.externallyStarted = false;
      return { ok: true, message: "ComfyUI is already stopped" };
    }

    this.stopHealthCheck();
    this.killProcess();
    this.externallyStarted = false;
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
        // TQDM_DISABLE prevents tqdm from writing progress bars through the pipe,
        // which causes OSError [Errno 22] on Windows when colorama tries to write
        // terminal escape sequences to a non-TTY pipe.
        // NO_COLOR disables colorama and other color libraries entirely on Windows,
        // preventing escape sequence flush failures in ComfyUI's custom logger.
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONLEGACYWINDOWSSTDIO: "0",
          PYTHONUTF8: "1",
          TQDM_DISABLE: "1",
          NO_COLOR: "1",
        },
      });

      this.process = child;
      this.startedAt = Date.now();
      this.spawnedAt = Date.now();

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

    const pid = this.process.pid;
    this.log(`[manager] Killing process tree (pid=${pid})...`);
    this.setState("stopped");

    try {
      if (process.platform === "win32") {
        // On Windows with shell:true, SIGTERM only kills cmd.exe, not the Python child.
        // Use taskkill /T to kill the entire process tree.
        const { execSync } = require("child_process") as typeof import("child_process");
        try {
          execSync(`taskkill /T /F /PID ${pid}`, { stdio: "ignore" });
          this.log(`[manager] taskkill /T /F /PID ${pid} succeeded`);
        } catch {
          // Process may already be dead
          this.log(`[manager] taskkill failed (process may already be dead)`);
        }
      } else {
        this.process.kill("SIGTERM");
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
    } catch {
      // Process may already be dead
    }
  }

  /**
   * Kill a process listening on the ComfyUI port.
   * Used when ComfyUI was started externally (we don't hold the ChildProcess handle).
   * Uses `lsof` (macOS/Linux) or `netstat` (Windows) to find the PID.
   */
  private async killByPort() {
    const port = this.extractPortFromUrl(env.comfyApiUrl);
    if (!port) {
      this.log("[manager] Cannot extract port from comfyApiUrl, trying taskkill on all python processes...");
      this.execKillAll("python");
      return;
    }

    this.log(`[manager] Looking for processes on port ${port}...`);

    try {
      const pids = this.findPidsOnPort(port);
      if (pids.length === 0) {
        this.log(`[manager] No processes found on port ${port}`);
        return;
      }

      this.log(`[manager] Found PIDs on port ${port}: ${pids.join(", ")}`);

      for (const pid of pids) {
        this.killPid(pid);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`[manager] Failed to kill by port: ${message}`);
    }
  }

  private extractPortFromUrl(url: string): number | null {
    try {
      const parsed = new URL(url);
      const port = parsed.port;
      return port ? parseInt(port, 10) : null;
    } catch {
      return null;
    }
  }

  private findPidsOnPort(port: number): number[] {
    const isWin = process.platform === "win32";

    try {
      if (isWin) {
        // netstat -ano | findstr :PORT
        const output = execSync(`netstat -ano | findstr :${port}`, {
          encoding: "utf8",
          timeout: 5000,
        });
        const pids = new Set<number>();
        for (const line of output.split("\n")) {
          const match = line.match(/\s+LISTENING\s+(\d+)/);
          if (match) pids.add(parseInt(match[1], 10));
        }
        return [...pids];
      } else {
        // lsof -ti :PORT
        const output = execSync(`lsof -ti :${port}`, {
          encoding: "utf8",
          timeout: 5000,
        });
        return output
          .split("\n")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
      }
    } catch {
      // Command returned non-zero (no process found) — that's fine
      return [];
    }
  }

  private killPid(pid: number) {
    const isWin = process.platform === "win32";

    try {
      if (isWin) {
        execSync(`taskkill /F /PID ${pid}`, { encoding: "utf8", timeout: 5000 });
        this.log(`[manager] Killed PID ${pid} via taskkill`);
      } else {
        process.kill(pid, "SIGTERM");
        this.log(`[manager] Sent SIGTERM to PID ${pid}`);

        // Force kill after 3 seconds
        setTimeout(() => {
          try {
            process.kill(pid, 0); // Check if process still exists
            this.log(`[manager] PID ${pid} still alive, sending SIGKILL...`);
            process.kill(pid, "SIGKILL");
          } catch {
            // Process already dead
          }
        }, 3000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`[manager] Failed to kill PID ${pid}: ${message}`);
    }
  }

  private execKillAll(name: string) {
    const isWin = process.platform === "win32";

    try {
      if (isWin) {
        execSync(`taskkill /F /IM ${name}.exe`, { encoding: "utf8", timeout: 10000 });
        this.log(`[manager] Killed all ${name}.exe processes`);
      } else {
        execSync(`pkill -f ${name}`, { encoding: "utf8", timeout: 10000 });
        this.log(`[manager] Sent pkill for ${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`[manager] execKillAll failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Pre-launch health check
  // -------------------------------------------------------------------------

  /** Check if ComfyUI is already reachable via its API endpoint */
  private async checkExistingComfyUI(): Promise<boolean> {
    try {
      const res = await fetch(`${env.comfyApiUrl}/system_stats`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        this.log("[manager] ComfyUI is already reachable, skipping spawn");
        return true;
      }
    } catch {
      // Not reachable
    }
    return false;
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

  /**
   * Manually trigger a health check and return the result.
   * Unlike the periodic check this always runs immediately.
   */
  async probeHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const res = await fetch(`${env.comfyApiUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        // Update internal state as if a periodic check succeeded
        this.lastHealthCheck = new Date().toISOString();
        this.lastHealthOk = true;
        this.consecutiveHealthFailures = 0;
        if (this.state !== "running") {
          this.log(`[health] Manual probe: ComfyUI is responsive ✓, transitioning from ${this.state} → running`);
          this.setState("running");
        }
        return { ok: true, latencyMs };
      }
      // Update internal state as if a periodic check failed
      this.lastHealthCheck = new Date().toISOString();
      this.lastHealthOk = false;
      this.consecutiveHealthFailures += 1;
      if (this.state === "running") {
        this.log(`[health] Manual probe: HTTP ${res.status} (${this.consecutiveHealthFailures} consecutive failures)`);
        if (this.consecutiveHealthFailures >= ComfyProcessManager.UNHEALTHY_THRESHOLD) {
          this.setState("unhealthy");
        }
      }
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err) {
      const latencyMs = Date.now() - start;
      // Update internal state as if a periodic check failed
      this.lastHealthCheck = new Date().toISOString();
      this.lastHealthOk = false;
      this.consecutiveHealthFailures += 1;
      if (this.state === "running") {
        this.log(`[health] Manual probe: ComfyUI is unreachable (${this.consecutiveHealthFailures} consecutive failures)`);
        if (this.consecutiveHealthFailures >= ComfyProcessManager.UNHEALTHY_THRESHOLD) {
          this.setState("unhealthy");
        }
      }
      return { ok: false, latencyMs, error: String(err) };
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

    // During startup grace period, don't escalate to unhealthy
    const inGracePeriod =
      this.spawnedAt !== null &&
      Date.now() - this.spawnedAt < env.comfyStartupGraceMs;

    if (inGracePeriod && this.state === "starting") {
      // Still within grace period — log but don't act
      if (this.consecutiveHealthFailures % 6 === 1) {
        // Log every ~60s to avoid spam (6 × 10s interval)
        this.log(
          `[health] ComfyUI starting up (${Math.round((Date.now() - this.spawnedAt!) / 1000)}s elapsed, grace period ${env.comfyStartupGraceMs / 1000}s)`,
        );
      }
      return;
    }

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
      // Don't restart if user has stopped the process in the meantime
      if (this.state === "stopped") {
        this.log("[manager] Auto-restart cancelled: process was stopped");
        return;
      }
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
