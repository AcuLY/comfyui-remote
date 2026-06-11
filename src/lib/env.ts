import path from "node:path";

function readPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

function readBoolEnv(name: string, fallback: boolean) {
  const rawValue = process.env[name]?.trim().toLowerCase();

  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  return rawValue === "true" || rawValue === "1";
}

export const env = {
  dbProvider: (process.env.DB_PROVIDER ?? "postgresql").toLowerCase() as "postgresql" | "sqlite",
  databaseUrl: process.env.DATABASE_URL ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  comfyApiUrl: process.env.COMFY_API_URL ?? "http://127.0.0.1:8188",
  comfyRequestTimeoutMs: readPositiveIntegerEnv("COMFY_REQUEST_TIMEOUT_MS", 10_000),
  comfyQueueSnapshotCacheMs: readPositiveIntegerEnv("COMFY_QUEUE_SNAPSHOT_CACHE_MS", 2_000),
  comfyHistoryPollIntervalMs: readPositiveIntegerEnv("COMFY_HISTORY_POLL_INTERVAL_MS", 2_000),
  comfyHistoryMaxAttempts: readPositiveIntegerEnv("COMFY_HISTORY_MAX_ATTEMPTS", 300),
  modelBaseDir: process.env.MODEL_BASE_DIR ?? "",
  loraBaseDir: process.env.MODEL_BASE_DIR
    ? path.join(process.env.MODEL_BASE_DIR, "loras")
    : "",
  checkpointBaseDir: process.env.MODEL_BASE_DIR
    ? path.join(process.env.MODEL_BASE_DIR, "checkpoints")
    : "",
  characterLoraArtifactRoot: process.env.CHARACTER_LORA_ARTIFACT_ROOT ?? "",
  autoCensorModelPath: process.env.AUTO_CENSOR_MODEL_PATH ?? "",
  autoCensorPythonCmd: process.env.AUTO_CENSOR_PYTHON_CMD ?? "",
  autoCensorBatchSize: readPositiveIntegerEnv(
    "AUTO_CENSOR_BATCH_SIZE",
    readPositiveIntegerEnv("AUTO_CENSOR_CONCURRENCY", 64),
  ),

  // ComfyUI 进程管理
  comfyLaunchCmd: process.env.COMFY_LAUNCH_CMD ?? "",
  comfyLaunchCwd: process.env.COMFY_LAUNCH_CWD ?? "",
  comfyAutoStart: readBoolEnv("COMFY_AUTO_START", false),
  comfyAutoRestart: readBoolEnv("COMFY_AUTO_RESTART", false),
  comfyGpuAwareRestart: readBoolEnv("COMFY_GPU_AWARE_RESTART", false),
  comfyGpuCheckIntervalMs: readPositiveIntegerEnv("COMFY_GPU_CHECK_INTERVAL_MS", 60_000),
  comfyHealthIntervalMs: readPositiveIntegerEnv("COMFY_HEALTH_INTERVAL_MS", 10_000),
  comfyMaxRestarts: readPositiveIntegerEnv("COMFY_MAX_RESTARTS", 3),
  comfyRestartWindowMs: readPositiveIntegerEnv("COMFY_RESTART_WINDOW_MS", 300_000),
  /** Grace period after spawn before health failures count (default 300s) */
  comfyStartupGraceMs: readPositiveIntegerEnv("COMFY_STARTUP_GRACE_MS", 300_000),

  // 日志配置
  logLevel: (process.env.LOG_LEVEL ?? "info").toLowerCase() as "debug" | "info" | "warn" | "error",
  logFormat: (process.env.LOG_FORMAT ?? "pretty").toLowerCase() as "json" | "pretty",
  logEnableFile: readBoolEnv("LOG_ENABLE_FILE", false),
  logFilePath: process.env.LOG_FILE_PATH ?? "logs/app.log",
  logMaxFileSize: readPositiveIntegerEnv("LOG_MAX_FILE_SIZE", 10 * 1024 * 1024), // 10MB
  logMaxFiles: readPositiveIntegerEnv("LOG_MAX_FILES", 5),

  // ComfyUI checkpoint
  comfyCheckpoint: process.env.COMFYUI_CHECKPOINT ?? "",

  // Auth
  authToken: process.env.AUTH_TOKEN ?? "",
};

export function assertEnv() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
}
