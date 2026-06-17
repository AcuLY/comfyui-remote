import process from "node:process";
import { spawn } from "node:child_process";

import {
  readStringOption,
  runTrainingWorkerEntrypoint,
  WorkerError,
  type ManagerTask,
  type TrainingTaskRunnerContext,
} from "./worker-common";

const MOCK_SHA256 = "1".repeat(64);

const HELP = `
LoRA training launcher worker

Usage:
  cmd /c npx tsx scripts/training/training-worker.ts --help
  cmd /c npx tsx scripts/training/training-worker.ts --once --dry-run
  cmd /c npx tsx scripts/training/training-worker.ts --once --dry-run --mock-complete
  cmd /c npx tsx scripts/training/training-worker.ts --poll --worker-owner training-worker-01

Options:
  --once                 Lease at most one training task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner.
  --dry-run              Validate inputs without launching training.
  --mock-complete        With --dry-run only, write mock artifacts and complete the task.
  --runner-type <type>   Training runner adapter. Default: local_wsl_sd_scripts.
  --runner-command <cmd> Command executed by the local_wsl_sd_scripts adapter.

Manager auth:
  TRAINING_MANAGER_URL defaults to http://127.0.0.1:3000.
  TRAINING_MANAGER_API_NAMESPACE defaults to training.
  x-api-token is read from TRAINING_MANAGER_TOKEN or AUTH_TOKEN.
`.trim();

runTrainingWorkerEntrypoint({
  defaultWorkerOwner: "training-worker",
  handleTask: runTrainingTask,
  help: HELP,
  workerLabel: "training launcher worker",
  workerType: "training",
});

async function runTrainingTask(task: ManagerTask, context: TrainingTaskRunnerContext) {
  const dryRun = context.cli.values.has("--dry-run");
  const mockComplete = context.cli.values.has("--mock-complete");
  if (mockComplete && !dryRun) {
    throw new WorkerError("--mock-complete requires --dry-run so real training outputs are not faked accidentally.");
  }

  if (dryRun && mockComplete) {
    return {
      output: createMockTrainingOutput(task),
      progressJson: {
        mockComplete: true,
        stage: "mock-complete",
        trainingRunId: task.targetId ?? null,
      },
    };
  }

  const runnerType = resolveRunnerType(task, context);
  if (runnerType !== "local_wsl_sd_scripts") {
    throw new WorkerError(
      `Training runner readiness error: unsupported runner "${runnerType}". The Training v2 worker currently supports local_wsl_sd_scripts.`,
    );
  }

  const runnerCommand = readStringOption(context.cli.values, "--runner-command") ?? process.env.TRAINING_RUNNER_COMMAND?.trim();
  if (!runnerCommand) {
    throw new WorkerError(
      "Training runner readiness error: local_wsl_sd_scripts requires TRAINING_RUNNER_COMMAND or --runner-command. Use --dry-run --mock-complete only for local lifecycle smoke tests.",
    );
  }

  const output = await runLocalWslSdScriptsAdapter(task, runnerCommand, runnerType);
  return {
    output,
    progressJson: {
      adapter: runnerType,
      stage: "runner-complete",
      trainingRunId: task.targetId ?? null,
    },
  };
}

function resolveRunnerType(task: ManagerTask, context: TrainingTaskRunnerContext) {
  const fromCli = readStringOption(context.cli.values, "--runner-type");
  if (fromCli) return fromCli;

  const fromEnv = process.env.TRAINING_RUNNER_TYPE?.trim();
  if (fromEnv) return fromEnv;

  const payload = task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)
    ? task.payload
    : {};
  const fromTask = payload.runnerType;
  return typeof fromTask === "string" && fromTask.trim() ? fromTask.trim() : "local_wsl_sd_scripts";
}

async function runLocalWslSdScriptsAdapter(
  task: ManagerTask,
  runnerCommand: string,
  runnerType: "local_wsl_sd_scripts",
) {
  const result = await spawnRunnerCommand(runnerCommand, {
    TRAINING_JOB_ID: task.jobId ?? "",
    TRAINING_RUN_ID: task.targetId ?? task.id,
    TRAINING_RUNNER_ADAPTER: runnerType,
    TRAINING_TASK_ID: task.id,
    TRAINING_TASK_PAYLOAD: JSON.stringify(task.payload ?? {}),
    TRAINING_WORKER_TYPE: task.workerType ?? "training",
  });

  if (result.status !== 0) {
    throw new WorkerError(
      [
        `local_wsl_sd_scripts runner failed with exit code ${result.status}.`,
        trimForError(result.stderr) || trimForError(result.stdout),
      ].filter(Boolean).join(" "),
    );
  }

  return parseRunnerOutput(result.stdout, task);
}

function spawnRunnerCommand(command: string, env: Record<string, string>) {
  return new Promise<{ status: number | null; stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer | string) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer | string) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({
        status,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      });
    });
  });
}

function parseRunnerOutput(stdout: string, task: ManagerTask) {
  const payload = readRunnerJson(stdout);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new WorkerError("local_wsl_sd_scripts runner must print a JSON object on stdout.");
  }

  const output = payload as Record<string, unknown>;
  const finalArtifact = output.finalSafetensorsArtifact;
  if (!finalArtifact || typeof finalArtifact !== "object" || Array.isArray(finalArtifact)) {
    throw new WorkerError("local_wsl_sd_scripts runner output is missing finalSafetensorsArtifact.");
  }
  if (typeof (finalArtifact as Record<string, unknown>).relativePath !== "string") {
    throw new WorkerError("local_wsl_sd_scripts runner output finalSafetensorsArtifact.relativePath must be a string.");
  }

  return {
    elapsedMs: typeof output.elapsedMs === "number" ? output.elapsedMs : undefined,
    finalSafetensorsArtifact: finalArtifact,
    hashes: output.hashes && typeof output.hashes === "object" && !Array.isArray(output.hashes) ? output.hashes : undefined,
    metadataSummary: output.metadataSummary && typeof output.metadataSummary === "object" && !Array.isArray(output.metadataSummary)
      ? output.metadataSummary
      : {
          keyCount: 1,
          summary: {
            adapter: "local_wsl_sd_scripts",
            trainingRunId: task.targetId ?? null,
          },
        },
    trainingLogArtifact: output.trainingLogArtifact && typeof output.trainingLogArtifact === "object" && !Array.isArray(output.trainingLogArtifact)
      ? output.trainingLogArtifact
      : undefined,
  };
}

function readRunnerJson(stdout: string) {
  const lines = stdout.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lastLine = lines.at(-1);
  if (!lastLine) return null;

  try {
    return JSON.parse(lastLine) as unknown;
  } catch {
    throw new WorkerError("local_wsl_sd_scripts runner must print valid JSON on the final stdout line.");
  }
}

function trimForError(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 500);
}

function createMockTrainingOutput(task: ManagerTask) {
  const taskLabel = sanitizePathPart(task.targetId ?? task.id);
  return {
    checkpoints: [],
    elapsedMs: 0,
    finalSafetensorsArtifact: {
      kind: "lora",
      relativePath: `mock-training/${taskLabel}/final.safetensors`,
      sha256: MOCK_SHA256,
    },
    finalSha256: MOCK_SHA256,
    hashes: {
      [`mock-training/${taskLabel}/final.safetensors`]: MOCK_SHA256,
    },
    metadataSummary: {
      keyCount: 3,
      summary: {
        dryRun: true,
        mockComplete: true,
        trainingRunId: task.targetId ?? null,
      },
    },
    trainingLogArtifact: {
      kind: "log",
      relativePath: `mock-training/${taskLabel}/training.log`,
    },
  };
}

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-") || "task";
}
