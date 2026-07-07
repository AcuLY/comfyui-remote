import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { prisma } from "@/lib/prisma";

import {
  parseWorkerCli,
  readNumberOption,
  readStringOption,
  WorkerError,
  type ManagerTask,
  type TrainingTaskRunnerContext,
} from "./worker-common";

const MOCK_SHA256 = "0".repeat(64);
const DEFAULT_CODEX_IMAGE_SCRIPT = "scripts/codex_gpt_image2.py";
const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const DEFAULT_CODEX_HOST_MODEL = "gpt-5.5";
const DEFAULT_CODEX_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_RELATIVE_OUTPUT_TEMPLATE = "data/images/training/{projectId}/generation-tasks/{taskId}/outputs/{viewOrIndex}.png";

type ImageWorkerConfig = {
  artifactPolicy?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  provider?: string;
  runner?: Record<string, unknown>;
};

type CodexProviderConfig = {
  aspect: string;
  authFilePath: string | null;
  background: string;
  baseUrl: string;
  configPath: string | null;
  hostModel: string;
  imageModel: string;
  outputTemplate: string;
  pythonCommand: string;
  quality: string;
  scriptPath: string;
  size: string | null;
  timeoutSeconds: number;
};

type GenerationTaskDetails = NonNullable<Awaited<ReturnType<typeof loadGenerationTaskDetails>>>;

type SpawnResult = {
  status: number | null;
  stderr: string;
  stdout: string;
  timedOut: boolean;
};

export async function runImageProviderCheck(args: string[]) {
  const cli = parseWorkerCli(args, {
    workerOwner: "training-image-worker",
  });
  const config = await loadCodexProviderConfig(cli.values);
  const auth = await checkCodexProvider(config);
  return {
    ok: true,
    provider: "openai-codex",
    scriptPath: config.scriptPath,
    authFileConfigured: Boolean(config.authFilePath),
    authFileExists: config.authFilePath ? await pathExists(config.authFilePath) : false,
    hostModel: config.hostModel,
    imageModel: config.imageModel,
    outputTemplate: config.outputTemplate,
    auth,
  };
}

export async function runImageTask(task: ManagerTask, context: TrainingTaskRunnerContext) {
  const provider = resolveProvider(task, context);
  if (provider === "mock-local") {
    return { output: createMockImageOutput(task) };
  }
  if (provider !== "openai-codex" && provider !== "codex_gpt_image2") {
    throw new WorkerError(
      `Image provider "${provider}" is not configured. Use --provider mock-local for local lifecycle tests or --provider openai-codex for the Codex GPT-Image-2 bridge.`,
    );
  }

  const config = await loadCodexProviderConfig(context.cli.values);
  const details = await loadGenerationTaskDetails(task);
  if (!details) {
    throw new WorkerError(`Generation task not found for Manager task ${task.id}.`);
  }
  if (details.generationKind !== "image_generation") {
    throw new WorkerError(`Generation task ${details.id} is not image_generation.`);
  }

  const prompt = buildPrompt(details);
  const inputImages = await resolveInputImagePaths(details);
  const viewOrIndex = detectViewOrIndex(details);
  const relativePath = renderOutputTemplate(config.outputTemplate, {
    projectId: details.trainingProjectId,
    taskId: details.id,
    viewOrIndex,
  });
  const outputPath = resolveProjectPath(relativePath);
  const promptPath = `${outputPath}.prompt.txt`;
  const metadataPath = `${outputPath}.metadata.json`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(promptPath, prompt, "utf8");

  const startedAt = Date.now();
  const result = await runCodexImageScript(config, {
    inputImages,
    metadataPath,
    outputPath,
    promptPath,
  });
  if (result.status !== 0) {
    throw new WorkerError(
      [
        `Codex GPT-Image-2 runner failed with exit code ${result.status}${result.timedOut ? " after timeout" : ""}.`,
        trimForError(result.stderr) || trimForError(result.stdout),
      ].filter(Boolean).join(" "),
      { retryable: true },
    );
  }

  const runnerOutput = readRunnerJson(result.stdout);
  if (!runnerOutput || runnerOutput.success !== true) {
    throw new WorkerError("Codex GPT-Image-2 runner did not print a successful JSON result.", { retryable: true });
  }

  const imageBytes = await fs.readFile(outputPath);
  const dimensions = readImageDimensions(imageBytes) ?? parseSize(config.size);
  const sha256 = createHash("sha256").update(imageBytes).digest("hex");
  const elapsedMs = Date.now() - startedAt;
  const metadataRelativePath = toProjectRelativePath(metadataPath);
  const promptRelativePath = toProjectRelativePath(promptPath);

  return {
    output: {
      images: [
        {
          height: dimensions?.height ?? null,
          relativePath,
          sha256,
          width: dimensions?.width ?? null,
        },
      ],
      elapsedMs,
      provider: "openai-codex",
      requestRedactedPath: promptRelativePath,
      responseSummaryPath: metadataRelativePath,
    },
    progressJson: {
      elapsedMs,
      imageCount: 1,
      provider: "openai-codex",
      stage: "runner-complete",
      taskId: details.id,
    },
  };
}

function resolveProvider(task: ManagerTask, context: TrainingTaskRunnerContext) {
  const fromCli = readStringOption(context.cli.values, "--provider");
  if (fromCli) return normalizeProviderName(fromCli);

  const payload = task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)
    ? task.payload
    : {};
  const fromPayload = typeof payload.provider === "string" && payload.provider.trim() ? payload.provider.trim() : null;
  if (fromPayload) return normalizeProviderName(fromPayload);

  return "task-request";
}

function normalizeProviderName(value: string) {
  const provider = value.trim();
  if (provider === "codex_gpt_image2") return "openai-codex";
  return provider;
}

async function loadGenerationTaskDetails(task: ManagerTask) {
  const generationTaskId = resolveGenerationTaskId(task);
  if (!generationTaskId) return null;

  return prisma.trainingGenerationTask.findUnique({
    where: { id: generationTaskId },
    include: {
      inputs: {
        include: {
          artifact: true,
          snapshotArtifact: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      sectionRuns: {
        include: {
          section: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

function resolveGenerationTaskId(task: ManagerTask) {
  if (task.targetId?.trim()) return task.targetId.trim();
  const prefix = "training-generation-worker-task-";
  if (task.id.startsWith(prefix)) return task.id.slice(prefix.length);
  return task.id.trim() || null;
}

function buildPrompt(details: GenerationTaskDetails) {
  const taskPrompt = details.supplementalPrompt?.trim();
  if (taskPrompt) return taskPrompt;

  const sectionRunPrompt = details.sectionRuns[0]?.imagePromptText?.trim();
  if (sectionRunPrompt) return sectionRunPrompt;

  const snapshotText = details.inputs
    .map((input) => input.snapshotText?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
  if (snapshotText) return snapshotText;

  throw new WorkerError(`Generation task ${details.id} has no prompt text.`);
}

async function resolveInputImagePaths(details: GenerationTaskDetails) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const input of details.inputs) {
    const candidate = input.snapshotFilePath
      ?? input.snapshotArtifact?.filePath
      ?? input.snapshotArtifact?.storageKey
      ?? input.artifact?.filePath
      ?? input.artifact?.storageKey
      ?? null;
    if (!candidate) continue;

    const absolutePath = resolveProjectPath(candidate);
    if (!await pathExists(absolutePath)) {
      throw new WorkerError(`Input reference image is missing for generation task ${details.id}: ${candidate}`);
    }
    if (!seen.has(absolutePath)) {
      seen.add(absolutePath);
      out.push(absolutePath);
    }
  }
  return out;
}

function detectViewOrIndex(details: GenerationTaskDetails) {
  const params = isRecord(details.paramsJson) ? details.paramsJson : {};
  for (const key of ["view", "viewKey", "angle", "sectionKey"]) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) return sanitizePathPart(value);
  }

  const sectionName = details.sectionRuns[0]?.section?.name ?? "";
  const prompt = `${sectionName}\n${details.supplementalPrompt ?? ""}`.toLowerCase();
  if (prompt.includes("左侧") || prompt.includes("left side") || prompt.includes("left profile")) return "left";
  if (prompt.includes("右侧") || prompt.includes("right side") || prompt.includes("right profile")) return "right";
  if (prompt.includes("背面") || prompt.includes("back view") || prompt.includes("behind")) return "back";
  if (prompt.includes("正面") || prompt.includes("front view")) return "front";
  return "image-0001";
}

async function loadCodexProviderConfig(values: Map<string, string | true>): Promise<CodexProviderConfig> {
  const configPath = readStringOption(values, "--config")
    ?? process.env.TRAINING_IMAGE_WORKER_CONFIG_PATH?.trim()
    ?? null;
  const rawConfig = configPath ? await readOptionalJsonConfig(configPath) : {};
  const runner = isRecord(rawConfig.runner) ? rawConfig.runner : {};
  const defaults = isRecord(rawConfig.defaults) ? rawConfig.defaults : {};
  const artifactPolicy = isRecord(rawConfig.artifactPolicy) ? rawConfig.artifactPolicy : {};

  const authFileEnv = readString(runner.authFileEnv) ?? "CODEX_IMAGE_AUTH_FILE";
  const authFilePath = readStringOption(values, "--auth-file")
    ?? process.env[authFileEnv]?.trim()
    ?? process.env.CODEX_IMAGE_AUTH_FILE?.trim()
    ?? process.env.CODEX_AUTH_FILE?.trim()
    ?? readString(runner.authFilePath)
    ?? null;

  return {
    aspect: readStringOption(values, "--aspect") ?? readString(defaults.aspect) ?? "portrait",
    authFilePath,
    background: readStringOption(values, "--background") ?? readString(defaults.background) ?? "opaque",
    baseUrl: readStringOption(values, "--base-url") ?? process.env.CODEX_BASE_URL?.trim() ?? readString(runner.baseUrl) ?? DEFAULT_CODEX_BASE_URL,
    configPath,
    hostModel: readStringOption(values, "--host-model") ?? process.env.CODEX_HOST_MODEL?.trim() ?? readString(runner.hostModel) ?? DEFAULT_CODEX_HOST_MODEL,
    imageModel: readStringOption(values, "--image-model") ?? readString(runner.imageModel) ?? DEFAULT_CODEX_IMAGE_MODEL,
    outputTemplate: readString(artifactPolicy.relativeOutputTemplate) ?? DEFAULT_RELATIVE_OUTPUT_TEMPLATE,
    pythonCommand: readStringOption(values, "--python") ?? process.env.TRAINING_CODEX_IMAGE_PYTHON?.trim() ?? readString(runner.pythonCommand) ?? "python",
    quality: readStringOption(values, "--quality") ?? readString(defaults.quality) ?? "high",
    scriptPath: resolveProjectPath(readStringOption(values, "--runner-script") ?? process.env.TRAINING_CODEX_IMAGE_SCRIPT?.trim() ?? readString(runner.scriptPath) ?? DEFAULT_CODEX_IMAGE_SCRIPT),
    size: readStringOption(values, "--size") ?? readString(defaults.size) ?? null,
    timeoutSeconds: readNumberOption(values, "--timeout-seconds") ?? readNumber(defaults.timeoutSeconds) ?? 600,
  };
}

async function readOptionalJsonConfig(configPath: string): Promise<ImageWorkerConfig> {
  const absolutePath = resolveProjectPath(configPath);
  if (!await pathExists(absolutePath)) return {};
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return isRecord(parsed) ? parsed as ImageWorkerConfig : {};
}

async function checkCodexProvider(config: CodexProviderConfig) {
  if (!await pathExists(config.scriptPath)) {
    throw new WorkerError(`Codex image script not found: ${config.scriptPath}`);
  }
  if (!config.authFilePath) {
    throw new WorkerError("CODEX_IMAGE_AUTH_FILE / authFilePath is required for openai-codex image generation.");
  }
  if (!await pathExists(config.authFilePath)) {
    throw new WorkerError(`Codex auth file not found: ${config.authFilePath}`);
  }

  const result = await spawnCommand(config.pythonCommand, [
    config.scriptPath,
    "--check-auth",
    "--auth-file",
    config.authFilePath,
    "--base-url",
    config.baseUrl,
    "--host-model",
    config.hostModel,
    "--image-model",
    config.imageModel,
  ], Math.min(config.timeoutSeconds, 120) * 1_000);

  if (result.status !== 0) {
    throw new WorkerError(`Codex auth check failed: ${trimForError(result.stderr) || trimForError(result.stdout)}`);
  }
  return readRunnerJson(result.stdout) ?? {};
}

function runCodexImageScript(
  config: CodexProviderConfig,
  input: { inputImages: string[]; metadataPath: string; outputPath: string; promptPath: string },
) {
  if (!config.authFilePath) {
    throw new WorkerError("CODEX_IMAGE_AUTH_FILE / authFilePath is required for openai-codex image generation.");
  }

  const args = [
    config.scriptPath,
    "--prompt-file",
    input.promptPath,
    "--output",
    input.outputPath,
    "--metadata",
    input.metadataPath,
    "--auth-file",
    config.authFilePath,
    "--base-url",
    config.baseUrl,
    "--host-model",
    config.hostModel,
    "--image-model",
    config.imageModel,
    "--quality",
    config.quality,
    "--background",
    config.background,
    "--timeout",
    String(config.timeoutSeconds),
  ];
  if (config.size) {
    args.push("--size", config.size);
  } else {
    args.push("--aspect", config.aspect);
  }
  for (const imagePath of input.inputImages) {
    args.push("--input-image", imagePath);
  }

  return spawnCommand(config.pythonCommand, args, (config.timeoutSeconds + 30) * 1_000);
}

function spawnCommand(command: string, args: string[], timeoutMs: number) {
  return new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer | string) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({
        status,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
        timedOut,
      });
    });
  });
}

function readRunnerJson(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Some runners print progress before the final compact JSON line.
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lastLine = lines.at(-1);
  if (!lastLine) return null;
  try {
    return JSON.parse(lastLine) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function renderOutputTemplate(template: string, values: { projectId: string; taskId: string; viewOrIndex: string }) {
  return normalizeRelativePath(template
    .replaceAll("{projectId}", sanitizePathPart(values.projectId))
    .replaceAll("{taskId}", sanitizePathPart(values.taskId))
    .replaceAll("{viewOrIndex}", sanitizePathPart(values.viewOrIndex)));
}

function resolveProjectPath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized) || path.isAbsolute(normalized)) return normalized;
  return path.resolve(process.cwd(), normalized);
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function toProjectRelativePath(value: string) {
  const relative = path.relative(process.cwd(), value).replace(/\\/g, "/");
  return relative.startsWith("..") ? normalizeRelativePath(value) : normalizeRelativePath(relative);
}

async function pathExists(value: string) {
  try {
    await fs.access(resolveProjectPath(value));
    return true;
  } catch {
    return false;
  }
}

function readImageDimensions(buffer: Buffer) {
  if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      height: buffer.readUInt32BE(20),
      width: buffer.readUInt32BE(16),
    };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  return null;
}

function parseSize(size: string | null) {
  const match = size?.match(/^(\d+)x(\d+)$/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

function createMockImageOutput(task: ManagerTask) {
  const taskLabel = sanitizePathPart(task.targetId ?? task.id);
  return {
    images: [
      {
        height: 1024,
        relativePath: `mock-training/${taskLabel}/image-0001.png`,
        sha256: MOCK_SHA256,
        width: 1024,
      },
    ],
    elapsedMs: 0,
    requestRedactedPath: `mock-training/${taskLabel}/request-redacted.json`,
    responseSummaryPath: `mock-training/${taskLabel}/response-summary.json`,
  };
}

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-") || "task";
}

function trimForError(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 500);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
