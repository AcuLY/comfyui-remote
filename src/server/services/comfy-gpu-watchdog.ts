import { execFileSync } from "node:child_process";

export type GpuAvailabilityState = "available" | "unavailable" | "unknown";

export type GpuAvailability = {
  state: GpuAvailabilityState;
  message: string;
};

type NvidiaSmiResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  errorCode?: string;
};

const NVIDIA_SMI_UNAVAILABLE_PATTERNS = [
  /couldn['’]?t communicate with the nvidia driver/i,
  /no devices were found/i,
  /failed to initialize nvml/i,
  /driver\/library version mismatch/i,
  /gpu is lost/i,
];

let cachedAvailability: GpuAvailability | null = null;
let cachedAt = 0;

export function classifyNvidiaGpuAvailability(result: NvidiaSmiResult): GpuAvailability {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  const combined = `${stdout}\n${stderr}`.trim();

  if (result.ok && stdout.length > 0) {
    return { state: "available", message: "nvidia-smi detected at least one GPU" };
  }

  if (result.errorCode === "ENOENT") {
    return { state: "unknown", message: "nvidia-smi command was not found" };
  }

  if (NVIDIA_SMI_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(combined))) {
    return { state: "unavailable", message: combined || "NVIDIA GPU is unavailable" };
  }

  if (result.ok && stdout.length === 0) {
    return { state: "unavailable", message: "nvidia-smi returned no GPUs" };
  }

  return {
    state: "unknown",
    message: combined || "GPU availability check failed with an unknown error",
  };
}

export function shouldDeferComfyRestartForGpu(
  gpuAwareRestartEnabled: boolean,
  availability: GpuAvailability,
): boolean {
  return gpuAwareRestartEnabled && availability.state === "unavailable";
}

export function readNvidiaGpuAvailability(): GpuAvailability {
  try {
    const stdout = execFileSync("nvidia-smi", ["--list-gpus"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 3000,
    });

    return classifyNvidiaGpuAvailability({ ok: true, stdout, stderr: "" });
  } catch (err) {
    const maybeError = err as NodeJS.ErrnoException & {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };

    return classifyNvidiaGpuAvailability({
      ok: false,
      stdout: bufferLikeToString(maybeError.stdout),
      stderr: bufferLikeToString(maybeError.stderr ?? maybeError.message),
      errorCode: maybeError.code,
    });
  }
}

export function getCachedGpuAvailability(cacheTtlMs: number): GpuAvailability {
  const now = Date.now();
  if (cachedAvailability && now - cachedAt < cacheTtlMs) {
    return cachedAvailability;
  }

  cachedAvailability = readNvidiaGpuAvailability();
  cachedAt = now;
  return cachedAvailability;
}

export function clearGpuAvailabilityCache() {
  cachedAvailability = null;
  cachedAt = 0;
}

function bufferLikeToString(value: Buffer | string | undefined): string {
  if (value === undefined) return "";
  return Buffer.isBuffer(value) ? value.toString("utf8") : value;
}
