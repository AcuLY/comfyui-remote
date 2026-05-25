import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import type {
  CharacterLoraBenchmarkCompleteRequest,
  CharacterLoraTrainingCompleteOutput,
  CharacterLoraTrainingProgress,
  CharacterLoraWorkerTaskPayload,
  CharacterLoraWorkerType,
} from "../../src/server/character-lora-training/contracts";

const DEFAULT_MANAGER_URL = "http://127.0.0.1:3000";
const DEFAULT_LEASE_SECONDS = 300;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const ENV_PATH = path.resolve(process.cwd(), ".env");

export type AuthSourceShape = {
  source: "env:AUTH_TOKEN" | "env:CHARACTER_LORA_MANAGER_TOKEN" | ".env:AUTH_TOKEN" | ".env:CHARACTER_LORA_MANAGER_TOKEN" | "none";
  hasToken: boolean;
};

export type WorkerCliOptions = {
  once: boolean;
  poll: boolean;
  workerOwner: string;
  leaseDurationSeconds: number;
  pollIntervalMs: number;
  help: boolean;
  values: Map<string, string | true>;
};

export type ManagerTask = {
  id: string;
  workerType: CharacterLoraWorkerType;
  targetType: string;
  targetId: string;
  leaseOwner: string | null;
  payload: CharacterLoraWorkerTaskPayload;
};

export type ManagerJob = {
  id: string;
  slug?: string;
  artifactRoot: string;
  [key: string]: unknown;
};

export type ManagerJobReport = {
  job: {
    id: string;
    artifactRoot: string;
    [key: string]: unknown;
  };
  datasetRevisions: Array<{
    id: string;
    trainDir: string;
    [key: string]: unknown;
  }>;
  trainingRuns: Array<{
    id: string;
    configArtifact: { relativePath: string } | null;
    outputDir: string;
    [key: string]: unknown;
  }>;
  benchmarkRuns: Array<{
    id: string;
    trainingRunId: string;
    status: string;
    testProjectId: string | null;
    checkpointMatrix: unknown;
    weightMatrix: unknown;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type ManagerProjectRunResponse = {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  queuedRunCount: number;
  runs: Array<{
    runId: string;
    sectionId: string;
    sortOrder: number;
    sectionName: string;
    sectionSlug: string;
    runIndex: number;
    status: string;
    createdAt: string;
  }>;
};

export type ManagerProjectLatestRun = {
  id: string;
  runIndex: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  outputDir: string | null;
  errorMessage: string | null;
  executionMeta: unknown;
  totalCount: number;
  pendingCount: number;
  keptCount: number;
  trashedCount: number;
};

export type ManagerProjectDetail = {
  id: string;
  title: string;
  slug: string;
  status: string;
  sections: Array<{
    id: string;
    sortOrder: number;
    enabled: boolean;
    latestRunId: string | null;
    name: string | null;
    latestRun: ManagerProjectLatestRun | null;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type ManagerEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message?: string; details?: unknown } };

export class WorkerError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "WorkerError";
  }
}

export class ManagerApiError extends WorkerError {
  constructor(
    message: string,
    readonly status: number,
    details?: unknown,
  ) {
    super(message, details);
    this.name = "ManagerApiError";
  }
}

export function parseWorkerCli(argv: string[], defaults: { workerOwner: string }): WorkerCliOptions {
  const values = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new WorkerError(`Unexpected positional argument: ${arg}`);
    }

    const equalsIndex = arg.indexOf("=");
    if (equalsIndex >= 0) {
      values.set(arg.slice(0, equalsIndex), arg.slice(equalsIndex + 1));
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(arg, next);
      index += 1;
      continue;
    }

    values.set(arg, true);
  }

  const once = values.has("--once");
  const poll = values.has("--poll");

  return {
    once,
    poll: poll || !once,
    workerOwner: readStringOption(values, "--worker-owner") ?? defaults.workerOwner,
    leaseDurationSeconds: readNumberOption(values, "--lease-seconds") ?? DEFAULT_LEASE_SECONDS,
    pollIntervalMs: readNumberOption(values, "--interval-ms") ?? DEFAULT_POLL_INTERVAL_MS,
    help: values.has("--help") || values.has("-h"),
    values,
  };
}

export function readStringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

export function readNumberOption(values: Map<string, string | true>, key: string) {
  const value = readStringOption(values, key);
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new WorkerError(`${key} must be a positive number`);
  }
  return parsed;
}

export function getManagerBaseUrl() {
  return (process.env.CHARACTER_LORA_MANAGER_URL?.trim() || DEFAULT_MANAGER_URL).replace(/\/+$/, "");
}

export async function resolveManagerAuth(): Promise<AuthSourceShape & { token: string | null }> {
  if (process.env.AUTH_TOKEN?.trim()) {
    return { source: "env:AUTH_TOKEN", hasToken: true, token: process.env.AUTH_TOKEN.trim() };
  }
  if (process.env.CHARACTER_LORA_MANAGER_TOKEN?.trim()) {
    return {
      source: "env:CHARACTER_LORA_MANAGER_TOKEN",
      hasToken: true,
      token: process.env.CHARACTER_LORA_MANAGER_TOKEN.trim(),
    };
  }

  const envFile = await readDotEnvFile();
  const authToken = envFile.get("AUTH_TOKEN")?.trim();
  if (authToken) {
    return { source: ".env:AUTH_TOKEN", hasToken: true, token: authToken };
  }

  const managerToken = envFile.get("CHARACTER_LORA_MANAGER_TOKEN")?.trim();
  if (managerToken) {
    return { source: ".env:CHARACTER_LORA_MANAGER_TOKEN", hasToken: true, token: managerToken };
  }

  return { source: "none", hasToken: false, token: null };
}

export async function createManagerClient() {
  const baseUrl = getManagerBaseUrl();
  const auth = await resolveManagerAuth();

  async function request<T>(method: "GET" | "POST", pathname: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (auth.token) {
      headers["x-api-token"] = auth.token;
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const payload = parseJsonOrThrow<ManagerEnvelope<T> | { error?: string; message?: string }>(text, pathname);

    if (!response.ok) {
      const message =
        "ok" in payload && payload.ok === false
          ? payload.error.message ?? `Manager API ${response.status}`
          : "message" in payload && payload.message
            ? payload.message
            : `Manager API ${response.status}`;
      throw new ManagerApiError(message, response.status, payload);
    }

    if (!("ok" in payload) || payload.ok !== true) {
      throw new ManagerApiError(`Unexpected Manager API response for ${pathname}`, response.status, payload);
    }

    return payload.data;
  }

  return {
    baseUrl,
    authSource: { source: auth.source, hasToken: auth.hasToken },
    leaseTask: (input: {
      workerType: CharacterLoraWorkerType;
      leaseOwner: string;
      leaseDurationSeconds?: number;
    }) => {
      const params = new URLSearchParams({
        workerType: input.workerType,
        leaseOwner: input.leaseOwner,
      });
      if (input.leaseDurationSeconds) {
        params.set("leaseDurationSeconds", String(input.leaseDurationSeconds));
      }
      return request<ManagerTask | null>("GET", `/api/character-lora-training/worker/tasks/next?${params}`);
    },
    heartbeatTask: (taskId: string, body: { leaseOwner?: string; leaseDurationSeconds?: number; progressJson?: CharacterLoraTrainingProgress | Record<string, unknown> }) =>
      request<unknown>("POST", `/api/character-lora-training/worker/tasks/${encodeURIComponent(taskId)}/heartbeat`, body),
    completeTask: (taskId: string, body: { leaseOwner?: string; output?: unknown }) =>
      request<unknown>("POST", `/api/character-lora-training/worker/tasks/${encodeURIComponent(taskId)}/complete`, body),
    failTask: (taskId: string, body: { leaseOwner?: string; errorSummary: string; providerError?: { httpStatus?: number; backendError: string; retryable: boolean } }) =>
      request<unknown>("POST", `/api/character-lora-training/worker/tasks/${encodeURIComponent(taskId)}/fail`, body),
    getJob: (jobId: string) =>
      request<ManagerJob>("GET", `/api/character-lora-training/jobs/${encodeURIComponent(jobId)}`),
    getJobReport: (jobId: string) =>
      request<ManagerJobReport>("GET", `/api/character-lora-training/jobs/${encodeURIComponent(jobId)}/report`),
    generatePromptCardDraft: (jobId: string, body: unknown) =>
      request<unknown>("POST", `/api/character-lora-training/jobs/${encodeURIComponent(jobId)}/prompt-cards/draft`, body),
    runProject: (projectId: string, body: { batchSize?: number } = {}) =>
      request<ManagerProjectRunResponse>(
        "POST",
        `/api/projects/${encodeURIComponent(projectId)}/run`,
        body.batchSize ? body : undefined,
      ),
    getProjectDetail: (projectId: string) =>
      request<ManagerProjectDetail>("GET", `/api/projects/${encodeURIComponent(projectId)}`),
    completeBenchmarkRun: (benchmarkRunId: string, body: CharacterLoraBenchmarkCompleteRequest) =>
      request<unknown>(
        "POST",
        `/api/character-lora-training/benchmark-runs/${encodeURIComponent(benchmarkRunId)}/complete`,
        body,
      ),
  };
}

export async function getJobArtifactRoot(client: Awaited<ReturnType<typeof createManagerClient>>, jobId: string) {
  const job = await client.getJob(jobId);
  if (!job.artifactRoot || typeof job.artifactRoot !== "string") {
    throw new WorkerError(`Job ${jobId} did not include artifactRoot`);
  }
  return job.artifactRoot;
}

export function safeJoinArtifact(jobRoot: string, relativePath: string) {
  const normalized = normalizeRelativeArtifactPath(relativePath);
  const root = path.resolve(jobRoot);
  const absolutePath = path.resolve(root, ...normalized.split("/"));
  const relativeToRoot = path.relative(root, absolutePath);

  if (
    relativeToRoot === "" ||
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new WorkerError(`Artifact path escapes job root: ${relativePath}`);
  }

  return { absolutePath, relativePath: normalized };
}

export function normalizeRelativeArtifactPath(relativePath: string) {
  if (relativePath.includes("\0")) {
    throw new WorkerError("Artifact path contains a null byte");
  }
  const trimmed = relativePath.trim().replace(/\\/g, "/");
  if (!trimmed || path.isAbsolute(trimmed) || /^[a-z]:\//i.test(trimmed)) {
    throw new WorkerError(`Artifact path must be relative: ${relativePath}`);
  }
  const normalized = path.posix.normalize(trimmed.replace(/^\/+/, ""));
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new WorkerError(`Artifact path is invalid: ${relativePath}`);
  }
  return normalized;
}

export async function writeJsonArtifact(jobRoot: string, relativePath: string, payload: unknown) {
  return writeTextArtifact(jobRoot, relativePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function writeTextArtifact(jobRoot: string, relativePath: string, content: string) {
  const resolved = safeJoinArtifact(jobRoot, relativePath);
  await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
  await writeFile(resolved.absolutePath, content, "utf8");
  return statArtifact(jobRoot, resolved.relativePath);
}

export async function writeBufferArtifact(jobRoot: string, relativePath: string, content: Buffer | Uint8Array) {
  const resolved = safeJoinArtifact(jobRoot, relativePath);
  await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
  await writeFile(resolved.absolutePath, content);
  return statArtifact(jobRoot, resolved.relativePath);
}

export async function statArtifact(jobRoot: string, relativePath: string) {
  const resolved = safeJoinArtifact(jobRoot, relativePath);
  const fileStat = await stat(resolved.absolutePath);
  if (!fileStat.isFile()) {
    throw new WorkerError(`Artifact is not a file: ${resolved.relativePath}`);
  }
  return {
    ...resolved,
    byteSize: fileStat.size,
    sha256: await sha256File(resolved.absolutePath),
    mtime: fileStat.mtime,
  };
}

export async function sha256File(absolutePath: string) {
  return sha256Buffer(await readFile(absolutePath));
}

export function sha256Buffer(content: Buffer | Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

export async function readArtifactBuffer(jobRoot: string, relativePath: string) {
  return readFile(safeJoinArtifact(jobRoot, relativePath).absolutePath);
}

export async function readArtifactText(jobRoot: string, relativePath: string) {
  return readFile(safeJoinArtifact(jobRoot, relativePath).absolutePath, "utf8");
}

export function artifactToDataUrl(relativePath: string, content: Buffer) {
  return `data:${mimeTypeForPath(relativePath)};base64,${content.toString("base64")}`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function summarizeUnknown(error: unknown) {
  if (error instanceof ManagerApiError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }
  return { message: String(error) };
}

export function buildTrainingCompleteOutput(input: CharacterLoraTrainingCompleteOutput) {
  return input;
}

async function readDotEnvFile() {
  const values = new Map<string, string>();
  let content = "";
  try {
    content = await readFile(ENV_PATH, "utf8");
  } catch {
    return values;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }

  return values;
}

function readEnvName(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseJsonOrThrow<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new WorkerError(`Expected JSON response from ${label}`, { responsePreview: text.slice(0, 500) });
  }
}

function mimeTypeForPath(relativePath: string) {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

export const envValue = readEnvName;
