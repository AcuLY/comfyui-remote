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

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  comfyApiUrl: process.env.COMFY_API_URL ?? "http://127.0.0.1:8188",
  comfyRequestTimeoutMs: readPositiveIntegerEnv("COMFY_REQUEST_TIMEOUT_MS", 10_000),
  comfyHistoryPollIntervalMs: readPositiveIntegerEnv("COMFY_HISTORY_POLL_INTERVAL_MS", 2_000),
  comfyHistoryMaxAttempts: readPositiveIntegerEnv("COMFY_HISTORY_MAX_ATTEMPTS", 15),
  loraBaseDir: process.env.LORA_BASE_DIR ?? "",
  imageBaseDir: process.env.IMAGE_BASE_DIR ?? "",
};

export function assertEnv() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
}
