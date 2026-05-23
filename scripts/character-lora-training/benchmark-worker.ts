import process from "node:process";

import {
  createManagerClient,
  parseWorkerCli,
  readNumberOption,
  sleep,
  summarizeUnknown,
  toErrorMessage,
  type ManagerJobReport,
  type ManagerProjectDetail,
  type ManagerProjectLatestRun,
  type ManagerProjectRunResponse,
} from "./worker-common";

import type {
  CharacterLoraBenchmarkCompleteRequest,
  CharacterLoraBenchmarkTaskPayload,
} from "../../src/server/character-lora-training/contracts";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

const HELP = `
Character LoRA benchmark project worker

Usage:
  cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --help
  cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --once
  cmd /c npx tsx scripts/character-lora-training/benchmark-worker.ts --poll --worker-owner benchmark-worker-01

Options:
  --once                 Lease at most one benchmark task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner. Default: character-lora-benchmark-worker.
  --timeout-ms <ms>      Max wait for submitted project runs. Default: 1800000.
  --skip-wait            Submit project runs and complete the benchmark immediately.

Manager auth:
  CHARACTER_LORA_MANAGER_URL defaults to http://127.0.0.1:3000.
  x-api-token is read from AUTH_TOKEN, CHARACTER_LORA_MANAGER_TOKEN, or .env.
`.trim();

type BenchmarkRunReport = ManagerJobReport["benchmarkRuns"][number];

type BenchmarkContext = {
  benchmarkRun: BenchmarkRunReport;
  testProjectId: string;
  baseCheckpoint: CharacterLoraBenchmarkTaskPayload["baseCheckpoint"];
  checkpointMatrix: string[];
  weightMatrix: number[];
  recommendedWeight: number;
};

type SectionRunSummary = {
  sectionId: string;
  sectionName: string | null;
  sortOrder: number;
  originalSectionName: string | null;
  baseCheckpoint: CharacterLoraBenchmarkTaskPayload["baseCheckpoint"];
  checkpointName: string | null;
  loraWeight: number | null;
  seed: number | null;
  executionMeta: unknown;
  benchmarkMatrix: BenchmarkSectionMatrixMetadata | null;
  latestRunId: string | null;
  latestRun: Pick<
    ManagerProjectLatestRun,
    | "id"
    | "status"
    | "runIndex"
    | "totalCount"
    | "pendingCount"
    | "keptCount"
    | "trashedCount"
    | "errorMessage"
    | "createdAt"
    | "startedAt"
    | "finishedAt"
    | "outputDir"
    | "executionMeta"
  > | null;
};

type BenchmarkSectionMatrixMetadata = {
  originalSectionName: string | null;
  originalSortOrder: number | null;
  baseSectionIndex: number | null;
  checkpointName: string | null;
  checkpointIndex: number | null;
  weight: number | null;
  weightIndex: number | null;
  matrixIndex: number | null;
};

type PollSummary = {
  sectionSummaries: SectionRunSummary[];
  missingRunIds: string[];
  doneCount: number;
  failedCount: number;
  queuedCount: number;
  runningCount: number;
  terminalCount: number;
};

type WaitResult = PollSummary & {
  projectDetail: ManagerProjectDetail;
  timedOut: boolean;
};

class BenchmarkWaitTimeoutError extends Error {
  constructor(
    message: string,
    readonly summary: PollSummary,
  ) {
    super(message);
    this.name = "BenchmarkWaitTimeoutError";
  }
}

main().catch((error) => {
  console.error("[character-lora benchmark-worker] failed");
  console.error(summarizeUnknown(error));
  process.exitCode = 1;
});

async function main() {
  const cli = parseWorkerCli(process.argv.slice(2), {
    workerOwner: "character-lora-benchmark-worker",
  });
  const timeoutMs = readNumberOption(cli.values, "--timeout-ms") ?? DEFAULT_TIMEOUT_MS;
  const skipWait = cli.values.has("--skip-wait");

  if (cli.help) {
    console.log(HELP);
    return;
  }

  const client = await createManagerClient();
  console.log("[character-lora benchmark-worker] starting", {
    managerUrl: client.baseUrl,
    managerAuth: client.authSource,
    workerOwner: cli.workerOwner,
    mode: cli.once ? "once" : "poll",
    timeoutMs,
    skipWait,
  });

  do {
    const task = await client.leaseTask({
      workerType: "benchmark",
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
    });

    if (!task) {
      if (cli.once) {
        console.log("[character-lora benchmark-worker] no task available");
        return;
      }
      await sleep(cli.pollIntervalMs);
      continue;
    }

    await client.heartbeatTask(task.id, {
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
      progressJson: { status: "leased" },
    });

    if (task.payload.taskType !== "benchmark") {
      await client.failTask(task.id, {
        leaseOwner: cli.workerOwner,
        errorSummary: `Unsupported payload taskType: ${task.payload.taskType}`,
      });
      continue;
    }

    await runBenchmarkTask({
      client,
      taskId: task.id,
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
      pollIntervalMs: cli.pollIntervalMs,
      timeoutMs,
      skipWait,
      payload: task.payload,
    });
  } while (cli.poll);
}

async function runBenchmarkTask(input: {
  client: Awaited<ReturnType<typeof createManagerClient>>;
  taskId: string;
  leaseOwner: string;
  leaseDurationSeconds: number;
  pollIntervalMs: number;
  timeoutMs: number;
  skipWait: boolean;
  payload: CharacterLoraBenchmarkTaskPayload;
}) {
  const startedAt = Date.now();
  let heartbeatProgress: Record<string, unknown> = {
    status: "starting",
    benchmarkRunId: input.payload.benchmarkRunId,
    trainingRunId: input.payload.trainingRunId,
  };
  const heartbeatTimer = setInterval(() => {
    void input.client.heartbeatTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      leaseDurationSeconds: input.leaseDurationSeconds,
      progressJson: heartbeatProgress,
    }).catch((error: unknown) => {
      console.warn("[character-lora benchmark-worker] heartbeat failed", summarizeUnknown(error));
    });
  }, Math.max(5_000, Math.floor(input.leaseDurationSeconds * 500)));

  try {
    const context = await resolveBenchmarkContext(input.client, input.payload);
    heartbeatProgress = {
      status: "submitting_project",
      benchmarkRunId: input.payload.benchmarkRunId,
      trainingRunId: input.payload.trainingRunId,
      testProjectId: context.testProjectId,
    };
    await input.client.heartbeatTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      leaseDurationSeconds: input.leaseDurationSeconds,
      progressJson: heartbeatProgress,
    });

    const submitted = await input.client.runProject(context.testProjectId);
    const runIds = submitted.runs.map((run) => run.runId);
    if (runIds.length === 0) {
      throw new Error(`Project ${context.testProjectId} did not enqueue any benchmark runs`);
    }

    heartbeatProgress = {
      status: input.skipWait ? "submitted" : "waiting_project",
      benchmarkRunId: input.payload.benchmarkRunId,
      trainingRunId: input.payload.trainingRunId,
      testProjectId: context.testProjectId,
      runIds,
    };

    const waitResult = input.skipWait
      ? await summarizeSubmittedProject(input.client, context.testProjectId, runIds, context.baseCheckpoint)
      : await waitForProjectRuns({
          client: input.client,
          taskId: input.taskId,
          leaseOwner: input.leaseOwner,
          leaseDurationSeconds: input.leaseDurationSeconds,
          projectId: context.testProjectId,
          runIds,
          baseCheckpoint: context.baseCheckpoint,
          pollIntervalMs: input.pollIntervalMs,
          timeoutMs: input.timeoutMs,
          updateProgress: (summary) => {
            heartbeatProgress = {
              status: "waiting_project",
              benchmarkRunId: input.payload.benchmarkRunId,
              trainingRunId: input.payload.trainingRunId,
              testProjectId: context.testProjectId,
              runIds,
              doneCount: summary.doneCount,
              failedCount: summary.failedCount,
              runningCount: summary.runningCount,
              queuedCount: summary.queuedCount,
              missingRunIds: summary.missingRunIds,
            };
          },
        });

    const completedAt = new Date().toISOString();
    const resultSummary = buildResultSummary({
      context,
      payload: input.payload,
      submitted,
      waitResult,
      runIds,
      startedAt,
      completedAt,
      skipWait: input.skipWait,
    });
    const diagnosticSuggestions = buildDiagnosticSuggestions(waitResult, input.skipWait);
    const completeBody: CharacterLoraBenchmarkCompleteRequest = {
      recommendedWeight: context.recommendedWeight,
      resultSummary,
      diagnosticSuggestions,
    };

    await input.client.completeBenchmarkRun(input.payload.benchmarkRunId, completeBody);
    console.log("[character-lora benchmark-worker] completed benchmark run", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      benchmarkRunId: input.payload.benchmarkRunId,
      testProjectId: context.testProjectId,
      runIds,
      failedCount: waitResult.failedCount,
      skipWait: input.skipWait,
    });
  } catch (error) {
    await failLeasedTask(input, error);
    console.error("[character-lora benchmark-worker] failed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      benchmarkRunId: input.payload.benchmarkRunId,
      error: summarizeUnknown(error),
    });
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function resolveBenchmarkContext(
  client: Awaited<ReturnType<typeof createManagerClient>>,
  payload: CharacterLoraBenchmarkTaskPayload,
): Promise<BenchmarkContext> {
  const report = await client.getJobReport(payload.jobId);
  const benchmarkRun = report.benchmarkRuns.find((run) => run.id === payload.benchmarkRunId);
  if (!benchmarkRun) {
    throw new Error(`Report did not include benchmark run ${payload.benchmarkRunId}`);
  }
  if (benchmarkRun.trainingRunId !== payload.trainingRunId) {
    throw new Error(
      `Benchmark run ${payload.benchmarkRunId} trainingRunId mismatch: ${benchmarkRun.trainingRunId}`,
    );
  }

  const testProjectId = readRequiredString(benchmarkRun.testProjectId, "testProjectId");
  const checkpointMatrix = readRequiredStringArray(benchmarkRun.checkpointMatrix, "checkpointMatrix");
  const weightMatrix = readRequiredPositiveNumberArray(benchmarkRun.weightMatrix, "weightMatrix");
  const recommendedWeight = weightMatrix.find((value) => value > 0) ?? 1;

  return {
    benchmarkRun,
    testProjectId,
    baseCheckpoint: payload.baseCheckpoint,
    checkpointMatrix,
    weightMatrix,
    recommendedWeight,
  };
}

async function summarizeSubmittedProject(
  client: Awaited<ReturnType<typeof createManagerClient>>,
  projectId: string,
  runIds: string[],
  baseCheckpoint: CharacterLoraBenchmarkTaskPayload["baseCheckpoint"],
): Promise<WaitResult> {
  const projectDetail = await client.getProjectDetail(projectId);
  const summary = summarizeProjectRuns(projectDetail, runIds, baseCheckpoint);
  return {
    ...summary,
    projectDetail,
    timedOut: false,
  };
}

async function waitForProjectRuns(input: {
  client: Awaited<ReturnType<typeof createManagerClient>>;
  taskId: string;
  leaseOwner: string;
  leaseDurationSeconds: number;
  projectId: string;
  runIds: string[];
  baseCheckpoint: CharacterLoraBenchmarkTaskPayload["baseCheckpoint"];
  pollIntervalMs: number;
  timeoutMs: number;
  updateProgress: (summary: PollSummary) => void;
}): Promise<WaitResult> {
  const deadline = Date.now() + input.timeoutMs;
  let lastProjectDetail: ManagerProjectDetail | null = null;
  let lastSummary: PollSummary | null = null;

  while (Date.now() <= deadline) {
    lastProjectDetail = await input.client.getProjectDetail(input.projectId);
    lastSummary = summarizeProjectRuns(lastProjectDetail, input.runIds, input.baseCheckpoint);
    input.updateProgress(lastSummary);
    await input.client.heartbeatTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      leaseDurationSeconds: input.leaseDurationSeconds,
      progressJson: {
        status: "waiting_project",
        projectId: input.projectId,
        runIds: input.runIds,
        doneCount: lastSummary.doneCount,
        failedCount: lastSummary.failedCount,
        runningCount: lastSummary.runningCount,
        queuedCount: lastSummary.queuedCount,
        missingRunIds: lastSummary.missingRunIds,
      },
    });

    const allRunsVisible = lastSummary.missingRunIds.length === 0;
    const allVisibleRunsTerminal = lastSummary.terminalCount === input.runIds.length;
    if (allRunsVisible && allVisibleRunsTerminal) {
      return {
        ...lastSummary,
        projectDetail: lastProjectDetail,
        timedOut: false,
      };
    }

    await sleep(input.pollIntervalMs);
  }

  throw new BenchmarkWaitTimeoutError(
    `Timed out waiting for benchmark project runs after ${input.timeoutMs}ms`,
    lastSummary ?? {
      sectionSummaries: [],
      missingRunIds: input.runIds,
      doneCount: 0,
      failedCount: 0,
      queuedCount: 0,
      runningCount: 0,
      terminalCount: 0,
    },
  );
}

function summarizeProjectRuns(
  projectDetail: ManagerProjectDetail,
  runIds: string[],
  baseCheckpoint: CharacterLoraBenchmarkTaskPayload["baseCheckpoint"],
): PollSummary {
  const expectedRunIds = new Set(runIds);
  const foundRunIds = new Set<string>();
  const sectionSummaries: SectionRunSummary[] = [];

  for (const section of projectDetail.sections) {
    const latestRun = section.latestRun;
    if (!latestRun || !expectedRunIds.has(latestRun.id)) {
      continue;
    }

    const matrixMetadata = readBenchmarkSectionMatrixMetadata(section.extraParams);
    const checkpointName = matrixMetadata?.checkpointName ?? readOptionalString(section.checkpointName);
    const loraWeight = matrixMetadata?.weight ?? readLoraWeight(section.loraConfig);
    const seed = readExecutionSeed(latestRun.executionMeta);
    foundRunIds.add(latestRun.id);
    sectionSummaries.push({
      sectionId: section.id,
      sectionName: section.name,
      sortOrder: section.sortOrder,
      originalSectionName: matrixMetadata?.originalSectionName ?? section.name,
      baseCheckpoint,
      checkpointName,
      loraWeight,
      seed,
      executionMeta: latestRun.executionMeta ?? null,
      benchmarkMatrix: matrixMetadata,
      latestRunId: section.latestRunId,
      latestRun: {
        id: latestRun.id,
        status: latestRun.status,
        runIndex: latestRun.runIndex,
        totalCount: latestRun.totalCount,
        pendingCount: latestRun.pendingCount,
        keptCount: latestRun.keptCount,
        trashedCount: latestRun.trashedCount,
        errorMessage: latestRun.errorMessage,
        createdAt: latestRun.createdAt,
        startedAt: latestRun.startedAt,
        finishedAt: latestRun.finishedAt,
        outputDir: latestRun.outputDir,
        executionMeta: latestRun.executionMeta ?? null,
      },
    });
  }

  let doneCount = 0;
  let failedCount = 0;
  let queuedCount = 0;
  let runningCount = 0;
  let terminalCount = 0;

  for (const summary of sectionSummaries) {
    const status = summary.latestRun?.status;
    if (status === "done") {
      doneCount += 1;
      terminalCount += 1;
    } else if (status === "failed" || status === "cancelled") {
      failedCount += 1;
      terminalCount += 1;
    } else if (status === "queued") {
      queuedCount += 1;
    } else if (status === "running") {
      runningCount += 1;
    }
  }

  return {
    sectionSummaries,
    missingRunIds: runIds.filter((runId) => !foundRunIds.has(runId)),
    doneCount,
    failedCount,
    queuedCount,
    runningCount,
    terminalCount,
  };
}

function buildResultSummary(input: {
  context: BenchmarkContext;
  payload: CharacterLoraBenchmarkTaskPayload;
  submitted: ManagerProjectRunResponse;
  waitResult: WaitResult;
  runIds: string[];
  startedAt: number;
  completedAt: string;
  skipWait: boolean;
}): Record<string, unknown> {
  return {
    benchmarkRunId: input.payload.benchmarkRunId,
    trainingRunId: input.payload.trainingRunId,
    testProjectId: input.context.testProjectId,
    runIds: input.runIds,
    submittedRuns: input.submitted.runs,
    sections: input.waitResult.sectionSummaries,
    matrixExpansion: buildMatrixExpansionSummary(input.waitResult.projectDetail, input.context),
    baseCheckpoint: input.context.baseCheckpoint,
    checkpointMatrix: input.context.checkpointMatrix,
    weightMatrix: input.context.weightMatrix,
    recommendedWeight: input.context.recommendedWeight,
    finalSafetensorsArtifact: input.payload.finalSafetensorsArtifact,
    projectStatus: input.waitResult.projectDetail.status,
    completedAt: input.completedAt,
    elapsedMs: Date.now() - input.startedAt,
    skipWait: input.skipWait,
    counts: {
      totalRuns: input.runIds.length,
      done: input.waitResult.doneCount,
      failed: input.waitResult.failedCount,
      queued: input.waitResult.queuedCount,
      running: input.waitResult.runningCount,
      missing: input.waitResult.missingRunIds.length,
    },
  };
}

function buildDiagnosticSuggestions(waitResult: WaitResult, skipWait: boolean) {
  const suggestions: string[] = [];

  if (skipWait) {
    suggestions.push("Benchmark project runs were submitted with --skip-wait; review project results before promotion.");
  }

  for (const section of waitResult.sectionSummaries) {
    const latestRun = section.latestRun;
    if (!latestRun || (latestRun.status !== "failed" && latestRun.status !== "cancelled")) {
      continue;
    }
    suggestions.push(
      [
        `Benchmark run ${latestRun.id} for section ${section.sectionName ?? section.sectionId} ended with ${latestRun.status}.`,
        latestRun.errorMessage ? `Error: ${latestRun.errorMessage}` : "No run error message was recorded.",
      ].join(" "),
    );
  }

  if (waitResult.missingRunIds.length > 0) {
    suggestions.push(`The project detail response did not expose latestRun for: ${waitResult.missingRunIds.join(", ")}.`);
  }

  return suggestions;
}

function buildMatrixExpansionSummary(projectDetail: ManagerProjectDetail, context: BenchmarkContext) {
  const sections = projectDetail.sections.map((section) => {
    const metadata = readBenchmarkSectionMatrixMetadata(section.extraParams);
    const checkpointName = metadata?.checkpointName ?? readOptionalString(section.checkpointName);
    const weight = metadata?.weight ?? readLoraWeight(section.loraConfig);
    return {
      projectSectionId: section.id,
      sectionName: section.name,
      sortOrder: section.sortOrder,
      originalSectionName: metadata?.originalSectionName ?? section.name,
      baseCheckpoint: context.baseCheckpoint,
      baseSectionIndex: metadata?.baseSectionIndex ?? null,
      originalSortOrder: metadata?.originalSortOrder ?? null,
      checkpointName,
      checkpointIndex: metadata?.checkpointIndex ?? inferStringIndex(context.checkpointMatrix, checkpointName),
      weight,
      weightIndex: metadata?.weightIndex ?? inferNumberIndex(context.weightMatrix, weight),
      matrixIndex: metadata?.matrixIndex ?? null,
      latestRunId: section.latestRunId,
    };
  });
  const baseKeys = new Set(
    sections.map((section) =>
      section.baseSectionIndex !== null
        ? `index:${section.baseSectionIndex}`
        : `name:${section.originalSectionName ?? section.sectionName ?? section.sortOrder}`,
    ),
  );
  const baseSectionCount = baseKeys.size;
  return {
    expectedSectionCount: baseSectionCount * context.checkpointMatrix.length * context.weightMatrix.length,
    actualSectionCount: sections.length,
    baseSectionCount,
    checkpointMatrix: context.checkpointMatrix,
    weightMatrix: context.weightMatrix,
    sections,
  };
}

async function failLeasedTask(
  input: {
    client: Awaited<ReturnType<typeof createManagerClient>>;
    taskId: string;
    leaseOwner: string;
  },
  error: unknown,
) {
  try {
    await input.client.failTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      errorSummary: toErrorMessage(error),
    });
  } catch (failError) {
    console.error("[character-lora benchmark-worker] failed to mark task failed", summarizeUnknown(failError));
  }
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Benchmark report did not include ${fieldName}`);
  }
  return value.trim();
}

function readRequiredStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Benchmark report did not include ${fieldName}`);
  }
  return value.map((item) => item.trim());
}

function readRequiredPositiveNumberArray(value: unknown, fieldName: string): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "number" || item <= 0)) {
    throw new Error(`Benchmark report did not include ${fieldName}`);
  }
  return value;
}

function readBenchmarkSectionMatrixMetadata(value: unknown): BenchmarkSectionMatrixMetadata | null {
  const metadata = readJsonRecord(readJsonRecord(value).characterLoraBenchmark);
  const originalSectionName = readOptionalString(metadata.originalSectionName);
  const checkpointName = readOptionalString(metadata.checkpointName);
  const weight = readOptionalPositiveNumber(metadata.weight);
  if (!originalSectionName && !checkpointName && weight === null) {
    return null;
  }

  return {
    originalSectionName,
    originalSortOrder: readOptionalNumber(metadata.originalSortOrder),
    baseSectionIndex: readOptionalNumber(metadata.baseSectionIndex),
    checkpointName,
    checkpointIndex: readOptionalNumber(metadata.checkpointIndex),
    weight,
    weightIndex: readOptionalNumber(metadata.weightIndex),
    matrixIndex: readOptionalNumber(metadata.matrixIndex),
  };
}

function readLoraWeight(value: unknown): number | null {
  const record = readJsonRecord(value);
  for (const key of ["lora1", "lora2"] as const) {
    const entries = record[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const weight = readOptionalPositiveNumber(readJsonRecord(entry).weight);
      if (weight !== null) {
        return roundBenchmarkWeight(weight);
      }
    }
  }
  return null;
}

function readExecutionSeed(value: unknown): number | null {
  const metadata = readJsonRecord(value);
  return readOptionalSeed(metadata.ks1Seed) ?? readOptionalSeed(metadata.ks2Seed);
}

function readJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function readOptionalSeed(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function inferStringIndex(values: string[], value: string | null) {
  if (!value) return null;
  const index = values.indexOf(value);
  return index >= 0 ? index : null;
}

function inferNumberIndex(values: number[], value: number | null) {
  if (value === null) return null;
  const index = values.findIndex((candidate) => roundBenchmarkWeight(candidate) === roundBenchmarkWeight(value));
  return index >= 0 ? index : null;
}

function roundBenchmarkWeight(value: number) {
  return Math.round(value * 1000) / 1000;
}
