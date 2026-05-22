import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  buildTrainingCompleteOutput,
  createManagerClient,
  envValue,
  parseWorkerCli,
  safeJoinArtifact,
  sha256File,
  sleep,
  statArtifact,
  summarizeUnknown,
  toErrorMessage,
  writeBufferArtifact,
  writeJsonArtifact,
  writeTextArtifact,
} from "./worker-common";

import type {
  CharacterLoraTrainingCompleteOutput,
  CharacterLoraTrainingProgress,
  CharacterLoraTrainingTaskPayload,
} from "../../src/server/character-lora-training/contracts";

const HELP = `
Character LoRA training launcher worker

Usage:
  cmd /c npx tsx scripts/character-lora-training/training-worker.ts --help
  cmd /c npx tsx scripts/character-lora-training/training-worker.ts --once --dry-run
  cmd /c npx tsx scripts/character-lora-training/training-worker.ts --poll --worker-owner training-worker-01

Options:
  --once                 Lease at most one training task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner. Default: character-lora-training-worker.
  --dry-run              Write a log and validate inputs without launching training.
  --mock-complete        With --dry-run only, write valid mock .safetensors and complete the task.

Training command:
  CHARACTER_LORA_TRAINING_COMMAND is executed by the platform shell.
  The worker injects CHARACTER_LORA_JOB_ROOT, CHARACTER_LORA_TRAIN_DIR,
  CHARACTER_LORA_CONFIG_PATH, CHARACTER_LORA_OUTPUT_DIR,
  CHARACTER_LORA_BASE_CHECKPOINT, and CHARACTER_LORA_CANCEL_SIGNAL.

Manager auth:
  CHARACTER_LORA_MANAGER_URL defaults to http://127.0.0.1:3000.
  x-api-token is read from AUTH_TOKEN, CHARACTER_LORA_MANAGER_TOKEN, or .env.
`.trim();

type TrainingContext = {
  jobRoot: string;
  trainDir: string;
  configPath: string;
  outputDir: string;
  logRelativePath: string;
  logAbsolutePath: string;
  cancelSignalRelativePath: string;
  cancelSignalPath: string;
};

type JsonObject = Record<string, unknown>;

type SafetensorsHeaderSummary = {
  readable: boolean;
  keyCount: number;
  tensorKeyPreview: string[];
  metadataKeyCount: number;
  metadataPreview: JsonObject;
  headerLengthBytes?: number;
  fileSizeBytes?: number;
  error?: string;
};

const CANCEL_SIGNAL_POLL_MS = 1_000;
const CANCEL_TERMINATION_GRACE_MS = 15_000;
const MAX_SAFETENSORS_HEADER_BYTES = 64 * 1024 * 1024;

main().catch((error) => {
  console.error("[character-lora training-worker] failed");
  console.error(summarizeUnknown(error));
  process.exitCode = 1;
});

async function main() {
  const cli = parseWorkerCli(process.argv.slice(2), {
    workerOwner: "character-lora-training-worker",
  });
  const dryRun = cli.values.has("--dry-run");
  const mockComplete = cli.values.has("--mock-complete");

  if (cli.help) {
    console.log(HELP);
    return;
  }
  if (mockComplete && !dryRun) {
    throw new Error("--mock-complete is only supported with --dry-run");
  }

  const client = await createManagerClient();
  console.log("[character-lora training-worker] starting", {
    managerUrl: client.baseUrl,
    managerAuth: client.authSource,
    workerOwner: cli.workerOwner,
    mode: cli.once ? "once" : "poll",
    dryRun,
    mockComplete,
  });

  do {
    const task = await client.leaseTask({
      workerType: "training",
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
    });

    if (!task) {
      if (cli.once) {
        console.log("[character-lora training-worker] no task available");
        return;
      }
      await sleep(cli.pollIntervalMs);
      continue;
    }

    if (task.payload.taskType !== "training") {
      await client.failTask(task.id, {
        leaseOwner: cli.workerOwner,
        errorSummary: `Unsupported payload taskType: ${task.payload.taskType}`,
      });
      continue;
    }

    await runTrainingTask({
      client,
      taskId: task.id,
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
      payload: task.payload,
      dryRun,
      mockComplete,
    });
  } while (cli.poll);
}

async function runTrainingTask(input: {
  client: Awaited<ReturnType<typeof createManagerClient>>;
  taskId: string;
  leaseOwner: string;
  leaseDurationSeconds: number;
  payload: CharacterLoraTrainingTaskPayload;
  dryRun: boolean;
  mockComplete: boolean;
}) {
  const startedAt = Date.now();
  let heartbeatTimer: NodeJS.Timeout | null = null;

  try {
    const context = await resolveTrainingContext(input.client, input.payload);
    await writeTextArtifact(
      context.jobRoot,
      context.logRelativePath,
      `[${new Date().toISOString()}] training worker leased task ${input.taskId}\n`,
    );
    await input.client.heartbeatTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      leaseDurationSeconds: input.leaseDurationSeconds,
      progressJson: {
        status: input.dryRun ? "dry-run" : "running",
        trainingRunId: input.payload.trainingRunId,
      },
    });

    heartbeatTimer = setInterval(() => {
      void heartbeatFromLog(input.client, input.taskId, input.leaseOwner, input.leaseDurationSeconds, context.logAbsolutePath)
        .catch((error: unknown) => {
          console.warn("[character-lora training-worker] heartbeat failed", summarizeUnknown(error));
        });
    }, Math.max(5_000, Math.floor(input.leaseDurationSeconds * 500)));

    if (input.dryRun) {
      await writeTextArtifact(
        context.jobRoot,
        context.logRelativePath,
        [
          `[${new Date().toISOString()}] dry-run validated inputs`,
          `trainDir=${context.trainDir}`,
          `configPath=${context.configPath}`,
          `outputDir=${context.outputDir}`,
          "",
        ].join("\n"),
      );

      if (!input.mockComplete) {
        throw new Error("Dry run finished without --mock-complete; refusing to fake training success");
      }

      await writeBufferArtifact(
        context.jobRoot,
        `${input.payload.outputDir}/mock-final.safetensors`,
        createMockSafetensors({
          trainingRunId: input.payload.trainingRunId,
          role: "final",
        }),
      );
      await writeBufferArtifact(
        context.jobRoot,
        `${input.payload.outputDir}/checkpoint-step-0001.safetensors`,
        createMockSafetensors({
          trainingRunId: input.payload.trainingRunId,
          role: "checkpoint",
        }),
      );
    } else {
      const command = envValue("CHARACTER_LORA_TRAINING_COMMAND");
      if (!command) {
        throw new Error("CHARACTER_LORA_TRAINING_COMMAND is required unless --dry-run is used");
      }
      await runTrainingCommand(command, context, input.payload);
      if (await fileExists(context.cancelSignalPath)) {
        await appendLog(
          context.logAbsolutePath,
          Buffer.from(
            `[${new Date().toISOString()}] cancel signal found after training command exit; refusing to register success\n`,
            "utf8",
          ),
        );
        throw new TrainingCancelledError(context.cancelSignalRelativePath);
      }
    }

    const output = await buildCompleteOutput(context, input.payload, startedAt);
    await input.client.completeTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      output,
    });
    console.log("[character-lora training-worker] completed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      trainingRunId: input.payload.trainingRunId,
      final: output.finalSafetensorsArtifact.relativePath,
    });
  } catch (error) {
    const isCancelled = error instanceof TrainingCancelledError;
    await input.client.failTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      errorSummary: toErrorMessage(error),
      ...(isCancelled
        ? {
            providerError: {
              backendError: toErrorMessage(error),
              retryable: false,
            },
          }
        : {}),
    });
    console.error("[character-lora training-worker] failed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      trainingRunId: input.payload.trainingRunId,
      error: summarizeUnknown(error),
    });
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }
}

async function resolveTrainingContext(
  client: Awaited<ReturnType<typeof createManagerClient>>,
  payload: CharacterLoraTrainingTaskPayload,
): Promise<TrainingContext> {
  const report = await client.getJobReport(payload.jobId);
  const jobRoot = report.job.artifactRoot;
  const dataset = report.datasetRevisions.find((revision) => revision.id === payload.datasetRevisionId);
  const run = report.trainingRuns.find((trainingRun) => trainingRun.id === payload.trainingRunId);

  if (!dataset?.trainDir) {
    throw new Error(`Report did not include dataset trainDir for ${payload.datasetRevisionId}`);
  }
  if (!run?.configArtifact?.relativePath) {
    throw new Error(`Report did not include training config artifact for ${payload.trainingRunId}`);
  }

  const trainDir = safeJoinArtifact(jobRoot, dataset.trainDir).absolutePath;
  const configPath = safeJoinArtifact(jobRoot, run.configArtifact.relativePath).absolutePath;
  const outputDir = safeJoinArtifact(jobRoot, payload.outputDir).absolutePath;
  const cancelSignalPath = safeJoinArtifact(jobRoot, payload.cancelSignalPath).absolutePath;
  const cancelSignalRelativePath = safeJoinArtifact(jobRoot, payload.cancelSignalPath).relativePath;
  const logRelativePath = `${payload.outputDir}/train.log`;
  const logAbsolutePath = safeJoinArtifact(jobRoot, logRelativePath).absolutePath;

  return {
    jobRoot,
    trainDir,
    configPath,
    outputDir,
    cancelSignalRelativePath,
    cancelSignalPath,
    logRelativePath,
    logAbsolutePath,
  };
}

async function runTrainingCommand(
  command: string,
  context: TrainingContext,
  payload: CharacterLoraTrainingTaskPayload,
) {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let cancelRequested = false;
    let cancelPollInFlight = false;
    let cancelPollTimer: NodeJS.Timeout | null = null;
    let cancelTerminationTimer: NodeJS.Timeout | null = null;

    const child = spawn(command, {
      shell: true,
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        CHARACTER_LORA_JOB_ROOT: context.jobRoot,
        CHARACTER_LORA_TRAIN_DIR: context.trainDir,
        CHARACTER_LORA_CONFIG_PATH: context.configPath,
        CHARACTER_LORA_OUTPUT_DIR: context.outputDir,
        CHARACTER_LORA_BASE_CHECKPOINT: payload.baseCheckpointPath,
        CHARACTER_LORA_CANCEL_SIGNAL: context.cancelSignalPath,
      },
      windowsHide: true,
    });

    const cleanupTimers = () => {
      if (cancelPollTimer) {
        clearInterval(cancelPollTimer);
        cancelPollTimer = null;
      }
      if (cancelTerminationTimer) {
        clearTimeout(cancelTerminationTimer);
        cancelTerminationTimer = null;
      }
    };
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanupTimers();
      resolve();
    };
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanupTimers();
      reject(error);
    };
    const pollCancelSignal = async () => {
      if (settled || cancelRequested || cancelPollInFlight) {
        return;
      }

      cancelPollInFlight = true;
      try {
        if (!(await fileExists(context.cancelSignalPath))) {
          return;
        }

        cancelRequested = true;
        try {
          await appendLog(
            context.logAbsolutePath,
            Buffer.from(
              [
                `[${new Date().toISOString()}] cancel signal detected at ${context.cancelSignalRelativePath}`,
                `terminating training process pid=${child.pid ?? "unknown"}`,
                "",
              ].join("\n"),
              "utf8",
            ),
          );
        } catch (error) {
          console.warn("[character-lora training-worker] cancel log write failed", summarizeUnknown(error));
        }
        await terminateTrainingProcess(child);
        if (settled) {
          return;
        }
        cancelTerminationTimer = setTimeout(() => {
          void appendLog(
            context.logAbsolutePath,
            Buffer.from(
              `[${new Date().toISOString()}] training process did not exit within ${CANCEL_TERMINATION_GRACE_MS}ms after cancel; forcing termination\n`,
              "utf8",
            ),
          ).catch((error: unknown) => {
            console.warn("[character-lora training-worker] cancel timeout log write failed", summarizeUnknown(error));
          }).finally(() => {
            void terminateTrainingProcess(child, { force: true }).finally(() => {
              rejectOnce(new TrainingCancelledError(context.cancelSignalRelativePath));
            });
          });
        }, CANCEL_TERMINATION_GRACE_MS);
      } catch (error) {
        console.warn("[character-lora training-worker] cancel signal check failed", summarizeUnknown(error));
      } finally {
        cancelPollInFlight = false;
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      void appendLog(context.logAbsolutePath, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      void appendLog(context.logAbsolutePath, chunk);
    });
    child.on("error", (error) => {
      rejectOnce(error);
    });
    child.on("close", (code, signal) => {
      if (cancelRequested) {
        rejectOnce(new TrainingCancelledError(context.cancelSignalRelativePath));
        return;
      }
      if (code === 0) {
        resolveOnce();
        return;
      }
      rejectOnce(new Error(`Training command exited with code ${code ?? "null"} signal ${signal ?? "null"}`));
    });

    cancelPollTimer = setInterval(() => {
      void pollCancelSignal();
    }, CANCEL_SIGNAL_POLL_MS);
    void pollCancelSignal();
  });
}

async function appendLog(logAbsolutePath: string, chunk: Buffer) {
  await writeFile(logAbsolutePath, chunk, { flag: "a" });
}

async function heartbeatFromLog(
  client: Awaited<ReturnType<typeof createManagerClient>>,
  taskId: string,
  leaseOwner: string,
  leaseDurationSeconds: number,
  logAbsolutePath: string,
) {
  const progress = await parseProgressFromLog(logAbsolutePath);
  await client.heartbeatTask(taskId, {
    leaseOwner,
    leaseDurationSeconds,
    progressJson: {
      status: "running",
      ...progress,
    },
  });
}

async function parseProgressFromLog(logAbsolutePath: string): Promise<CharacterLoraTrainingProgress> {
  let text = "";
  try {
    text = await readFile(logAbsolutePath, "utf8");
  } catch {
    return {};
  }

  const tail = text.slice(-16_384);
  const progress: CharacterLoraTrainingProgress = {};
  const stepMatch =
    /(?:step|steps?)\s*[:=]?\s*(\d+)\s*(?:\/|of)\s*(\d+)/i.exec(tail) ??
    /(\d+)\s*\/\s*(\d+)\s*(?:steps?|it)/i.exec(tail);
  if (stepMatch) {
    progress.step = Number(stepMatch[1]);
    progress.targetSteps = Number(stepMatch[2]);
  }

  const lossMatch = /(?:loss|train_loss)\s*[:=]\s*([0-9]*\.?[0-9]+)/i.exec(tail);
  if (lossMatch) {
    progress.loss = Number(lossMatch[1]);
  }

  const etaMatch = /ETA\s*[:=]\s*(?:(\d+):)?(\d+):(\d+)/i.exec(tail);
  if (etaMatch) {
    const hours = Number(etaMatch[1] ?? 0);
    const minutes = Number(etaMatch[2]);
    const seconds = Number(etaMatch[3]);
    progress.etaSeconds = hours * 3600 + minutes * 60 + seconds;
  }

  return progress;
}

async function buildCompleteOutput(
  context: TrainingContext,
  payload: CharacterLoraTrainingTaskPayload,
  startedAt: number,
): Promise<CharacterLoraTrainingCompleteOutput> {
  const safetensors = await listFilesByExtension(context.outputDir, ".safetensors");
  if (safetensors.length === 0) {
    throw new Error(`No .safetensors files found in ${context.outputDir}`);
  }

  const newest = safetensors
    .filter((file) => !/checkpoint-step/i.test(path.basename(file.absolutePath)))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ?? safetensors.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  const finalRelativePath = toArtifactRelativePath(payload.outputDir, context.outputDir, newest.absolutePath);
  const hashes: Record<string, string> = {};

  for (const file of safetensors) {
    hashes[toArtifactRelativePath(payload.outputDir, context.outputDir, file.absolutePath)] = await sha256File(file.absolutePath);
  }
  await writeJsonArtifact(context.jobRoot, `${payload.outputDir}/hashes.json`, {
    trainingRunId: payload.trainingRunId,
    hashes,
    writtenAt: new Date().toISOString(),
  });

  const finalStat = await statArtifact(context.jobRoot, finalRelativePath);
  const logStat = await statArtifact(context.jobRoot, `${payload.outputDir}/train.log`);
  const metadataSummary = await buildSafetensorsMetadataSummary({
    context,
    payload,
    finalRelativePath,
    finalAbsolutePath: newest.absolutePath,
  });
  const checkpoints = await Promise.all(
    safetensors
      .filter((file) => /checkpoint-step/i.test(path.basename(file.absolutePath)))
      .map(async (file) => {
        const relativePath = toArtifactRelativePath(payload.outputDir, context.outputDir, file.absolutePath);
        const step = parseCheckpointStep(relativePath);
        return {
          step,
          artifact: {
            kind: "safetensors" as const,
            relativePath,
            sha256: await sha256File(file.absolutePath),
          },
        };
      }),
  );

  return buildTrainingCompleteOutput({
    finalSafetensorsArtifact: {
      kind: "safetensors",
      relativePath: finalStat.relativePath,
      sha256: finalStat.sha256,
    },
    finalSha256: finalStat.sha256,
    hashes,
    metadataSummary,
    checkpoints,
    trainingLogArtifact: {
      kind: "training_log",
      relativePath: logStat.relativePath,
      sha256: logStat.sha256,
    },
    elapsedMs: Date.now() - startedAt,
  });
}

async function listFilesByExtension(root: string, extension: string) {
  const entries = await readdir(root, { withFileTypes: true });
  const files: Array<{ absolutePath: string; mtimeMs: number }> = [];

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesByExtension(absolutePath, extension));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
      const fileStat = await stat(absolutePath);
      files.push({ absolutePath, mtimeMs: fileStat.mtimeMs });
    }
  }

  return files;
}

function toArtifactRelativePath(outputDirRelative: string, outputDirAbsolute: string, fileAbsolutePath: string) {
  const relative = path.relative(outputDirAbsolute, fileAbsolutePath).replace(/\\/g, "/");
  return `${outputDirRelative}/${relative}`;
}

function parseCheckpointStep(relativePath: string) {
  const match = /checkpoint-step-?(\d+)/i.exec(relativePath) ?? /step-?(\d+)/i.exec(relativePath);
  return match ? Number(match[1]) : 0;
}

class TrainingCancelledError extends Error {
  constructor(cancelSignalRelativePath: string) {
    super(`Training cancelled after cancel signal was detected: ${cancelSignalRelativePath}`);
    this.name = "TrainingCancelledError";
  }
}

async function fileExists(absolutePath: string) {
  try {
    await stat(absolutePath);
    return true;
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(getErrorCode(error) ?? "")) {
      return false;
    }
    throw error;
  }
}

async function terminateTrainingProcess(
  child: ChildProcessWithoutNullStreams,
  options: { force?: boolean } = {},
) {
  const pid = child.pid;
  if (!pid) {
    return;
  }

  const force = options.force ?? process.platform === "win32";
  try {
    if (process.platform === "win32") {
      await taskkillProcessTree(pid, force);
      return;
    }

    const signal: NodeJS.Signals = force ? "SIGKILL" : "SIGTERM";
    try {
      process.kill(-pid, signal);
    } catch (error) {
      if (getErrorCode(error) === "ESRCH") {
        return;
      }
      process.kill(pid, signal);
    }
  } catch (error) {
    if (getErrorCode(error) !== "ESRCH") {
      console.warn("[character-lora training-worker] process termination failed", summarizeUnknown(error));
    }
  }
}

async function taskkillProcessTree(pid: number, force: boolean) {
  await new Promise<void>((resolve) => {
    const args = ["/pid", String(pid), "/t"];
    if (force) {
      args.push("/f");
    }
    const taskkill = spawn("taskkill", args, {
      windowsHide: true,
      stdio: "ignore",
    });
    taskkill.on("error", () => {
      resolve();
    });
    taskkill.on("close", () => {
      resolve();
    });
  });
}

function createMockSafetensors(input: { trainingRunId: string; role: "final" | "checkpoint" }) {
  const tensorData = Buffer.alloc(4);
  const header = Buffer.from(JSON.stringify({
    __metadata__: {
      format: "pt",
      mock: "true",
      role: input.role,
      training_run_id: input.trainingRunId,
      created_by: "character-lora-training-worker",
    },
    [`mock.${input.role}.weight`]: {
      dtype: "F32",
      shape: [1],
      data_offsets: [0, tensorData.byteLength],
    },
  }), "utf8");
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64LE(BigInt(header.byteLength), 0);
  return Buffer.concat([prefix, header, tensorData]);
}

async function buildSafetensorsMetadataSummary(input: {
  context: TrainingContext;
  payload: CharacterLoraTrainingTaskPayload;
  finalRelativePath: string;
  finalAbsolutePath: string;
}): Promise<CharacterLoraTrainingCompleteOutput["metadataSummary"]> {
  const headerSummary = await readSafetensorsHeaderSummary(input.finalAbsolutePath);
  if (!headerSummary.readable || headerSummary.keyCount <= 0) {
    throw new Error(
      `Unable to read usable safetensors metadata for ${input.finalRelativePath}: ${
        headerSummary.error ?? `tensor key count is ${headerSummary.keyCount}`
      }`,
    );
  }

  const resolvedConfigSummary = summarizeTrainingConfig(input.payload.resolvedConfig);
  const metadataArtifact = await writeJsonArtifact(input.context.jobRoot, `${input.payload.outputDir}/safetensors-metadata.json`, {
    trainingRunId: input.payload.trainingRunId,
    finalSafetensors: input.finalRelativePath,
    safetensors: headerSummary,
    resolvedConfig: resolvedConfigSummary,
    writtenAt: new Date().toISOString(),
  });

  return {
    keyCount: headerSummary.keyCount,
    metadataPath: metadataArtifact.relativePath,
    summary: {
      source: headerSummary.readable ? "safetensors_header" : "safetensors_header_unreadable",
      finalSafetensors: input.finalRelativePath,
      tensorKeyCount: headerSummary.keyCount,
      tensorKeyPreview: headerSummary.tensorKeyPreview,
      metadataKeyCount: headerSummary.metadataKeyCount,
      metadataPreview: headerSummary.metadataPreview,
      headerLengthBytes: headerSummary.headerLengthBytes ?? null,
      fileSizeBytes: headerSummary.fileSizeBytes ?? null,
      error: headerSummary.error ?? null,
      resolvedConfig: resolvedConfigSummary,
    },
  };
}

async function readSafetensorsHeaderSummary(absolutePath: string): Promise<SafetensorsHeaderSummary> {
  let fileSizeBytes: number | undefined;
  let handle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    const fileStat = await stat(absolutePath);
    fileSizeBytes = fileStat.size;
    if (fileSizeBytes < 8) {
      throw new Error("Safetensors file is smaller than the 8-byte header prefix");
    }

    handle = await open(absolutePath, "r");
    const prefix = Buffer.alloc(8);
    const prefixRead = await handle.read(prefix, 0, prefix.byteLength, 0);
    if (prefixRead.bytesRead !== prefix.byteLength) {
      throw new Error("Could not read safetensors header prefix");
    }

    const headerLengthBigInt = prefix.readBigUInt64LE(0);
    if (headerLengthBigInt > BigInt(MAX_SAFETENSORS_HEADER_BYTES)) {
      throw new Error(`Safetensors header exceeds ${MAX_SAFETENSORS_HEADER_BYTES} bytes`);
    }

    const headerLengthBytes = Number(headerLengthBigInt);
    if (8 + headerLengthBytes > fileSizeBytes) {
      throw new Error("Safetensors header length exceeds file size");
    }

    const headerBuffer = Buffer.alloc(headerLengthBytes);
    const headerRead = await handle.read(headerBuffer, 0, headerLengthBytes, 8);
    if (headerRead.bytesRead !== headerLengthBytes) {
      throw new Error("Could not read full safetensors header");
    }

    const header = JSON.parse(headerBuffer.toString("utf8")) as unknown;
    if (!isJsonObject(header)) {
      throw new Error("Safetensors header is not a JSON object");
    }

    const tensorKeys = Object.keys(header).filter((key) => key !== "__metadata__");
    const metadata = isJsonObject(header.__metadata__) ? header.__metadata__ : {};

    return {
      readable: true,
      keyCount: tensorKeys.length,
      tensorKeyPreview: tensorKeys.slice(0, 20),
      metadataKeyCount: Object.keys(metadata).length,
      metadataPreview: previewRecord(metadata, 20),
      headerLengthBytes,
      fileSizeBytes,
    };
  } catch (error) {
    return {
      readable: false,
      keyCount: 0,
      tensorKeyPreview: [],
      metadataKeyCount: 0,
      metadataPreview: {},
      fileSizeBytes,
      error: toErrorMessage(error),
    };
  } finally {
    await handle?.close();
  }
}

function summarizeTrainingConfig(resolvedConfig: Record<string, unknown>) {
  return {
    configKeyCount: Object.keys(resolvedConfig).length,
    summary: {
      profile: resolvedConfig.profile ?? null,
      launcher: resolvedConfig.launcher ?? null,
      ordinary: resolvedConfig.ordinary ?? null,
      advancedKeys: resolvedConfig.advanced && typeof resolvedConfig.advanced === "object"
        ? Object.keys(resolvedConfig.advanced as Record<string, unknown>)
        : [],
    },
  };
}

function previewRecord(record: JsonObject, limit: number): JsonObject {
  const output: JsonObject = {};
  const entries = Object.entries(record);
  for (const [key, value] of entries.slice(0, limit)) {
    output[key] = previewValue(value);
  }
  if (entries.length > limit) {
    output._truncatedKeyCount = entries.length - limit;
  }
  return output;
}

function previewValue(value: unknown): unknown {
  if (typeof value === "string") {
    return truncateText(value, 300);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      preview: value.slice(0, 5).map((item) => previewValue(item)),
    };
  }
  if (isJsonObject(value)) {
    const keys = Object.keys(value);
    return {
      type: "object",
      keyCount: keys.length,
      keyPreview: keys.slice(0, 10),
    };
  }
  return String(value);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}
