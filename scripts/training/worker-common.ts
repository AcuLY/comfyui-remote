import "dotenv/config";

import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_MANAGER_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_API_NAMESPACE = "training";
const DEFAULT_WORKER_TASK_API_BASE_PATH = "/api/training/worker/tasks";
const TOKEN_HEADER_NAME = "x-api-token";

export type TrainingWorkerType = "image_generation" | "dataset_freeze" | "training";

export type AuthSourceShape = {
  hasToken: boolean;
  headerName: typeof TOKEN_HEADER_NAME;
  source: "TRAINING_MANAGER_TOKEN" | "AUTH_TOKEN" | null;
  token: string | null;
};

export type WorkerCliOptions = {
  help: boolean;
  leaseDurationSeconds: number;
  once: boolean;
  poll: boolean;
  pollIntervalMs: number;
  values: Map<string, string | true>;
  workerOwner: string;
};

export type ManagerTask = {
  id: string;
  jobId?: string | null;
  workerType?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  status?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ManagerJob = Record<string, unknown>;
export type ManagerJobReport = Record<string, unknown>;
export type ManagerProjectDetail = Record<string, unknown>;
export type ManagerProjectLatestRun = Record<string, unknown>;
export type ManagerProjectRunResponse = Record<string, unknown>;

export type ManagerClient = {
  completeTask: (taskId: string, input: WorkerTaskCompleteInput) => Promise<unknown>;
  failTask: (taskId: string, input: WorkerTaskFailInput) => Promise<unknown>;
  heartbeatTask: (taskId: string, input: WorkerTaskHeartbeatInput) => Promise<unknown>;
  leaseNextTask: (input: WorkerTaskLeaseInput) => Promise<ManagerTask | null>;
};

export type WorkerTaskLeaseInput = {
  leaseDurationSeconds?: number;
  leaseOwner?: string;
  targetId?: string;
  targetType?: string;
  workerType: TrainingWorkerType;
};

export type WorkerTaskHeartbeatInput = {
  leaseDurationSeconds?: number;
  leaseOwner?: string;
  progressJson?: Record<string, unknown>;
};

export type WorkerTaskCompleteInput = {
  leaseOwner?: string;
  output?: unknown;
};

export type WorkerTaskFailInput = {
  errorSummary: string;
  leaseOwner?: string;
  providerError?: {
    backendError: string;
    httpStatus?: number;
    retryable: boolean;
  };
};

export type TrainingTaskRunnerResult = {
  output?: unknown;
  progressJson?: Record<string, unknown>;
};

export type TrainingTaskRunnerContext = {
  client: ManagerClient;
  cli: WorkerCliOptions;
  workerType: TrainingWorkerType;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type CreateManagerClientInput = {
  apiNamespace?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  token?: string | null;
};

export class ManagerApiError extends Error {
  details: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ManagerApiError";
    this.status = status;
    this.details = details;
  }
}

export class WorkerError extends Error {
  retryable: boolean;

  constructor(message: string, input: { retryable?: boolean } = {}) {
    super(message);
    this.name = "WorkerError";
    this.retryable = input.retryable ?? false;
  }
}

export function parseWorkerCli(
  args: string[],
  defaults: {
    leaseDurationSeconds?: number;
    pollIntervalMs?: number;
    workerOwner?: string;
  } = {},
): WorkerCliOptions {
  const values = parseArgs(args);
  const help = values.has("--help") || values.has("-h");
  const once = values.has("--once");
  const poll = values.has("--poll") || !once;
  const pollIntervalMs = readNumberOption(values, "--interval-ms") ?? defaults.pollIntervalMs ?? 5_000;
  const leaseDurationSeconds = readNumberOption(values, "--lease-seconds") ?? defaults.leaseDurationSeconds ?? 300;
  const workerOwner = readStringOption(values, "--worker-owner") ?? defaults.workerOwner ?? "training-worker";

  if (pollIntervalMs <= 0) {
    throw new WorkerError("--interval-ms must be greater than 0.");
  }
  if (leaseDurationSeconds < 30) {
    throw new WorkerError("--lease-seconds must be at least 30.");
  }

  return {
    help,
    leaseDurationSeconds,
    once,
    poll,
    pollIntervalMs,
    values,
    workerOwner,
  };
}

export function readStringOption(values: Map<string, string | true>, name: string) {
  const value = values.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readNumberOption(values: Map<string, string | true>, name: string) {
  const value = readStringOption(values, name);
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new WorkerError(`${name} must be a valid number.`);
  }
  return parsed;
}

export function getManagerBaseUrl(input?: { baseUrl?: string | null }) {
  return stripTrailingSlash(input?.baseUrl?.trim() || process.env.TRAINING_MANAGER_URL?.trim() || DEFAULT_MANAGER_BASE_URL);
}

export function getManagerApiNamespace(input?: { apiNamespace?: string | null }) {
  const namespace = input?.apiNamespace?.trim() || process.env.TRAINING_MANAGER_API_NAMESPACE?.trim() || DEFAULT_API_NAMESPACE;
  return namespace.replace(/^\/+|\/+$/g, "");
}

export function getWorkerTaskApiBasePath(input?: { apiNamespace?: string | null }) {
  const namespace = getManagerApiNamespace(input);
  if (namespace !== DEFAULT_API_NAMESPACE) {
    throw new WorkerError("Training worker manager namespace must be \"training\"; worker scripts may only call /api/training/worker routes.");
  }
  return DEFAULT_WORKER_TASK_API_BASE_PATH;
}

export function resolveManagerAuth(input: { token?: string | null } = {}): AuthSourceShape {
  const explicitToken = input.token?.trim();
  if (explicitToken) {
    return { hasToken: true, headerName: TOKEN_HEADER_NAME, source: "TRAINING_MANAGER_TOKEN", token: explicitToken };
  }

  const trainingToken = process.env.TRAINING_MANAGER_TOKEN?.trim();
  if (trainingToken) {
    return { hasToken: true, headerName: TOKEN_HEADER_NAME, source: "TRAINING_MANAGER_TOKEN", token: trainingToken };
  }

  const authToken = process.env.AUTH_TOKEN?.trim();
  if (authToken) {
    return { hasToken: true, headerName: TOKEN_HEADER_NAME, source: "AUTH_TOKEN", token: authToken };
  }

  return { hasToken: false, headerName: TOKEN_HEADER_NAME, source: null, token: null };
}

export function createManagerClient(input: CreateManagerClientInput = {}): ManagerClient {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = getManagerBaseUrl({ baseUrl: input.baseUrl });
  const taskApiBasePath = getWorkerTaskApiBasePath({ apiNamespace: input.apiNamespace });
  const auth = resolveManagerAuth({ token: input.token });

  async function requestJson<T>(method: "GET" | "POST", path: string, body?: unknown, query?: Record<string, unknown>) {
    const url = buildManagerUrl(baseUrl, path, query);
    const headers = new Headers({ accept: "application/json" });
    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }
    if (auth.token) {
      headers.set(auth.headerName, auth.token);
    }

    const response = await fetchImpl(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      method,
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new ManagerApiError(`${method} ${path} failed with HTTP ${response.status}`, response.status, payload);
    }
    if (isRecord(payload) && payload.ok === false) {
      throw new ManagerApiError(readApiErrorMessage(payload) ?? `${method} ${path} failed`, response.status, payload);
    }

    return unwrapApiData<T>(payload);
  }

  return {
    completeTask: (taskId, body) => requestJson("POST", `${taskApiBasePath}/${encodeURIComponent(taskId)}/complete`, body),
    failTask: (taskId, body) => requestJson("POST", `${taskApiBasePath}/${encodeURIComponent(taskId)}/fail`, body),
    heartbeatTask: (taskId, body) => requestJson("POST", `${taskApiBasePath}/${encodeURIComponent(taskId)}/heartbeat`, body),
    leaseNextTask: (query) => requestJson<ManagerTask | null>("GET", `${taskApiBasePath}/next`, undefined, query),
  };
}

export function runTrainingWorkerEntrypoint(input: {
  defaultWorkerOwner: string;
  handleTask: (task: ManagerTask, context: TrainingTaskRunnerContext) => Promise<TrainingTaskRunnerResult>;
  help: string;
  workerLabel: string;
  workerType: TrainingWorkerType;
}) {
  void runTrainingWorkerEntrypointAsync(input).catch((error: unknown) => {
    console.error(`[${input.workerLabel}] failed`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

async function runTrainingWorkerEntrypointAsync(input: {
  defaultWorkerOwner: string;
  handleTask: (task: ManagerTask, context: TrainingTaskRunnerContext) => Promise<TrainingTaskRunnerResult>;
  help: string;
  workerLabel: string;
  workerType: TrainingWorkerType;
}) {
  const cli = parseWorkerCli(process.argv.slice(2), {
    workerOwner: input.defaultWorkerOwner,
  });
  if (cli.help) {
    console.log(input.help.trim());
    return;
  }

  const client = createManagerClient();
  do {
    const processed = await processNextTask(input, cli, client);
    if (cli.once) return;
    if (!processed) {
      await delay(cli.pollIntervalMs);
    }
  } while (cli.poll);
}

async function processNextTask(
  input: {
    handleTask: (task: ManagerTask, context: TrainingTaskRunnerContext) => Promise<TrainingTaskRunnerResult>;
    workerLabel: string;
    workerType: TrainingWorkerType;
  },
  cli: WorkerCliOptions,
  client: ManagerClient,
) {
  const task = await client.leaseNextTask({
    leaseDurationSeconds: cli.leaseDurationSeconds,
    leaseOwner: cli.workerOwner,
    workerType: input.workerType,
  });

  if (!task) {
    console.log(`[${input.workerLabel}] no ${input.workerType} task available`);
    return false;
  }

  console.log(`[${input.workerLabel}] leased task ${task.id}`);
  await client.heartbeatTask(task.id, {
    leaseDurationSeconds: cli.leaseDurationSeconds,
    leaseOwner: cli.workerOwner,
    progressJson: { stage: "started", workerType: input.workerType },
  });

  try {
    const result = await input.handleTask(task, { client, cli, workerType: input.workerType });
    if (result.progressJson) {
      await client.heartbeatTask(task.id, {
        leaseDurationSeconds: cli.leaseDurationSeconds,
        leaseOwner: cli.workerOwner,
        progressJson: result.progressJson,
      });
    }
    await client.completeTask(task.id, {
      leaseOwner: cli.workerOwner,
      ...(result.output === undefined ? {} : { output: result.output }),
    });
    console.log(`[${input.workerLabel}] completed task ${task.id}`);
    return true;
  } catch (error) {
    const errorSummary = toErrorSummary(error);
    try {
      await client.failTask(task.id, {
        errorSummary,
        leaseOwner: cli.workerOwner,
        providerError: {
          backendError: errorSummary,
          retryable: error instanceof WorkerError ? error.retryable : false,
        },
      });
    } catch (reportError) {
      console.error(`[${input.workerLabel}] failed to report task failure`);
      console.error(reportError instanceof Error ? reportError.message : String(reportError));
    }
    throw error;
  }
}

function parseArgs(args: string[]) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("-")) continue;

    const [name, inlineValue] = arg.split("=", 2);
    if (inlineValue !== undefined) {
      values.set(name, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("-")) {
      values.set(name, next);
      index += 1;
      continue;
    }

    values.set(name, true);
  }
  return values;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/g, "");
}

function buildManagerUrl(baseUrl: string, path: string, query?: Record<string, unknown>) {
  const url = new URL(path, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readJsonResponse(response: Response) {
  const rawBody = await response.text();
  if (!rawBody.trim()) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ManagerApiError("Manager returned a non-JSON response.", response.status, rawBody.slice(0, 500));
  }
}

function unwrapApiData<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function readApiErrorMessage(payload: Record<string, unknown>) {
  const error = payload.error;
  if (typeof error === "string" && error.trim()) return error.trim();

  const message = payload.message;
  if (typeof message === "string" && message.trim()) return message.trim();

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toErrorSummary(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const text = String(error).trim();
  return text || "Training worker task failed.";
}
