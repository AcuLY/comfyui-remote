import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyNvidiaGpuAvailability,
  shouldDeferComfyRestartForGpu,
} from "../src/server/services/comfy-gpu-watchdog";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("nvidia-smi output with at least one GPU is available", () => {
  const availability = classifyNvidiaGpuAvailability({
    ok: true,
    stdout: "GPU 0: NVIDIA GeForce RTX 4070 Ti SUPER (UUID: GPU-abc)\n",
    stderr: "",
  });

  assert.equal(availability.state, "available");
});

test("nvidia-smi driver or device failures are unavailable", () => {
  const availability = classifyNvidiaGpuAvailability({
    ok: false,
    stdout: "",
    stderr: "NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver.",
  });

  assert.equal(availability.state, "unavailable");
});

test("missing nvidia-smi is unknown and does not block restart", () => {
  const availability = classifyNvidiaGpuAvailability({
    ok: false,
    stdout: "",
    stderr: "",
    errorCode: "ENOENT",
  });

  assert.equal(availability.state, "unknown");
  assert.equal(shouldDeferComfyRestartForGpu(true, availability), false);
});

test("GPU-aware restart defers only when explicitly enabled and GPU is unavailable", () => {
  const unavailable = {
    state: "unavailable" as const,
    message: "No devices were found",
  };

  assert.equal(shouldDeferComfyRestartForGpu(false, unavailable), false);
  assert.equal(shouldDeferComfyRestartForGpu(true, unavailable), true);
});

test("Comfy process manager checks GPU before consuming restart quota", () => {
  const source = readSource("src/server/services/comfy-process-manager.ts");
  const gpuCheckIndex = source.indexOf("const gpuAvailability = getCachedGpuAvailability(");
  const quotaIndex = source.indexOf("const windowRestarts = this.restartsInWindow()");

  assert.ok(gpuCheckIndex >= 0, "expected GPU availability check in maybeAutoRestart");
  assert.ok(quotaIndex >= 0, "expected restart quota calculation in maybeAutoRestart");
  assert.ok(gpuCheckIndex < quotaIndex, "GPU check should happen before restart quota is consumed");
  assert.match(source, /this\.setState\("waiting_for_gpu"\)/);
});

test("env exposes GPU-aware restart settings", () => {
  const source = readSource("src/lib/env.ts");

  assert.match(source, /comfyGpuAwareRestart:\s*readBoolEnv\("COMFY_GPU_AWARE_RESTART",\s*false\)/);
  assert.match(source, /comfyGpuCheckIntervalMs:\s*readPositiveIntegerEnv\("COMFY_GPU_CHECK_INTERVAL_MS",\s*60_000\)/);
});
