import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { env } from "@/lib/env";

export const AUTO_CENSOR_SELECTED_CLASSES = [2, 4] as const; // CLI argument: "2,4"
export const AUTO_CENSOR_MOSAIC_SIZE = 100;

const DEFAULT_TIMEOUT_MS = 120_000;

export type AutoCensorRunInput = {
  sourcePath: string;
  outputPath: string;
  timeoutMs?: number;
};

export type AutoCensorRunResult = {
  detections: number;
  selectedDetections: number;
  outputPath: string;
};

export type AutoCensorBatchRunInput = AutoCensorRunInput & {
  id?: string;
};

export type AutoCensorBatchRunResult =
  | {
      ok: true;
      detections: number;
      selectedDetections: number;
      outputPath: string;
    }
  | {
      ok: false;
      error: string;
      outputPath: string;
    };

type NormalizedBatchInput = {
  id: string;
  outputAbsPath: string;
  outputPath: string;
  sourceAbsPath: string;
  timeoutMs?: number;
};

export async function runAutoCensorMosaic(
  input: AutoCensorRunInput,
): Promise<AutoCensorRunResult> {
  const [result] = await runAutoCensorMosaicBatch([input]);

  if (!result) {
    throw new Error("Auto-censor batch returned no result for single image.");
  }

  if (!result.ok) {
    throw new Error(result.error);
  }

  return {
    detections: result.detections,
    selectedDetections: result.selectedDetections,
    outputPath: result.outputPath,
  };
}

export async function runAutoCensorMosaicBatch(
  inputs: AutoCensorBatchRunInput[],
): Promise<AutoCensorBatchRunResult[]> {
  if (inputs.length === 0) return [];

  const modelPath = env.autoCensorModelPath.trim();

  if (!modelPath) {
    throw new Error("AUTO_CENSOR_MODEL_PATH is not configured.");
  }

  const modelAbsPath = resolve(modelPath);
  const scriptPath = resolve(process.cwd(), "scripts/auto-censor-mosaic.py");
  const normalizedInputs = inputs.map((input, index) => ({
    id: input.id ?? String(index),
    outputAbsPath: resolve(input.outputPath),
    outputPath: input.outputPath,
    sourceAbsPath: resolve(input.sourcePath),
    timeoutMs: input.timeoutMs,
  }));

  await ensureReadableFile(modelAbsPath, "Auto-censor model");
  await Promise.all(
    normalizedInputs.map(async (input) => {
      await ensureReadableFile(input.sourceAbsPath, "Auto-censor source image");
      await mkdir(dirname(input.outputAbsPath), { recursive: true });
    }),
  );

  const tempRoot = await mkdtemp(join(tmpdir(), "auto-censor-batch-"));
  const manifestPath = join(tempRoot, `manifest-${randomUUID()}.json`);

  try {
    await writeFile(
      manifestPath,
      JSON.stringify({
        items: normalizedInputs.map((input) => ({
          id: input.id,
          inputPath: input.sourceAbsPath,
          outputPath: input.outputAbsPath,
        })),
      }),
    );

    const command = env.autoCensorPythonCmd.trim() || "python3";
    const stdout = await runPythonCli(command, [
      scriptPath,
      "--model",
      modelAbsPath,
      "--batch",
      manifestPath,
      "--classes",
      AUTO_CENSOR_SELECTED_CLASSES.join(","),
      "--mosaic-size",
      String(AUTO_CENSOR_MOSAIC_SIZE),
    ], batchTimeoutMs(normalizedInputs));

    const payload = parseAutoCensorJson(stdout);
    return parseBatchResults(payload, normalizedInputs);
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function ensureReadableFile(path: string, label: string) {
  let fileStat;

  try {
    fileStat = await stat(path);
  } catch (error) {
    throw new Error(`${label} does not exist: ${path}`, { cause: error });
  }

  if (!fileStat.isFile()) {
    throw new Error(`${label} must be a file: ${path}`);
  }

  try {
    await access(path, constants.R_OK);
  } catch (error) {
    throw new Error(`${label} is not readable: ${path}`, { cause: error });
  }
}

function batchTimeoutMs(inputs: NormalizedBatchInput[]) {
  const explicitTimeouts = inputs
    .map((input) => input.timeoutMs)
    .filter((timeoutMs): timeoutMs is number => typeof timeoutMs === "number");

  if (explicitTimeouts.length > 0) {
    return Math.max(...explicitTimeouts);
  }

  return DEFAULT_TIMEOUT_MS * Math.max(1, inputs.length);
}

function runPythonCli(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const child = spawn(command, [...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      forceKillTimer.unref();
    }, timeoutMs);
    timeoutTimer.unref();

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    };

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error: unknown) => {
      rejectOnce(new Error(`Failed to start auto-censor Python CLI "${command}": ${errorMessage(error)}`));
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();

      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (timedOut) {
        rejectPromise(new Error(`Auto-censor Python CLI timed out after ${timeoutMs} ms.`));
        return;
      }

      if (code !== 0) {
        const processLabel = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
        const detail = stderr.trim() || stdout.trim() || "no process output";
        rejectPromise(new Error(`Auto-censor Python CLI exited with ${processLabel}: ${detail}`));
        return;
      }

      resolvePromise(stdout);
    });
  });
}

function parseAutoCensorJson(stdout: string): Record<string, unknown> {
  const lastLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!lastLine) {
    throw new Error("Auto-censor Python CLI did not emit a JSON result line.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(lastLine);
  } catch (error) {
    throw new Error(`Auto-censor Python CLI emitted invalid JSON result: ${lastLine}`, {
      cause: error,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Auto-censor Python CLI JSON result must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function parseBatchResults(
  payload: Record<string, unknown>,
  inputs: NormalizedBatchInput[],
): AutoCensorBatchRunResult[] {
  const items = Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload.items)
      ? payload.items
      : inputs.length === 1
        ? [payload]
        : [];

  return inputs.map((input, index) => {
    const item = items[index];

    if (!item || typeof item !== "object") {
      return {
        ok: false,
        error: "Auto-censor Python CLI did not return a result for this item.",
        outputPath: input.outputPath,
      };
    }

    const record = item as Record<string, unknown>;
    const error = typeof record.error === "string" ? record.error : "";

    if (record.ok === false || error) {
      return {
        ok: false,
        error: error || "Auto-censor Python CLI reported item failure.",
        outputPath: input.outputPath,
      };
    }

    return {
      ok: true,
      detections: readFiniteNumber(record.detections),
      selectedDetections: readFiniteNumber(
        record.selectedDetections ?? record.selected_detections,
      ),
      outputPath: input.outputPath,
    };
  });
}

function readFiniteNumber(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
