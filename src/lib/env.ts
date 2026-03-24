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
  comfyHistoryPollIntervalMs: readPositiveIntegerEnv("COMFY_HISTORY_POLL_INTERVAL_MS", 2_000),
  comfyHistoryMaxAttempts: readPositiveIntegerEnv("COMFY_HISTORY_MAX_ATTEMPTS", 15),
  loraBaseDir: process.env.LORA_BASE_DIR ?? "",
  imageBaseDir: process.env.IMAGE_BASE_DIR ?? "",

  // ComfyUI 进程管理
  comfyLaunchCmd: process.env.COMFY_LAUNCH_CMD ?? "",
  comfyLaunchCwd: process.env.COMFY_LAUNCH_CWD ?? "",
  comfyAutoStart: readBoolEnv("COMFY_AUTO_START", false),
  comfyAutoRestart: readBoolEnv("COMFY_AUTO_RESTART", true),
  comfyHealthIntervalMs: readPositiveIntegerEnv("COMFY_HEALTH_INTERVAL_MS", 10_000),
  comfyMaxRestarts: readPositiveIntegerEnv("COMFY_MAX_RESTARTS", 3),
  comfyRestartWindowMs: readPositiveIntegerEnv("COMFY_RESTART_WINDOW_MS", 300_000),
};

export function assertEnv() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
}
