import process from "node:process";

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
  --runner-command <cmd> Reserved for a real training launcher command.

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

  const runnerCommand = readStringOption(context.cli.values, "--runner-command") ?? process.env.TRAINING_RUNNER_COMMAND?.trim();
  if (!runnerCommand) {
    throw new WorkerError(
      "Training runner is not configured. Set TRAINING_RUNNER_COMMAND or run with --dry-run --mock-complete for a local lifecycle smoke test.",
    );
  }

  throw new WorkerError(
    `Training runner command is configured but scripts/training/training-worker.ts has no safe adapter for executing it yet: ${runnerCommand}`,
  );
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
