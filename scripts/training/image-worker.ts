import {
  readStringOption,
  runTrainingWorkerEntrypoint,
  WorkerError,
  type ManagerTask,
} from "./worker-common";

const MOCK_SHA256 = "0".repeat(64);

const HELP = `
LoRA training image provider worker

Usage:
  cmd /c npx tsx scripts/training/image-worker.ts --help
  cmd /c npx tsx scripts/training/image-worker.ts --once
  cmd /c npx tsx scripts/training/image-worker.ts --poll --provider openai-codex --worker-owner training-image-worker-01

Options:
  --once                 Lease at most one image_generation task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner.
  --provider <name>      Override task provider with mock-local or openai-codex.

Manager auth:
  TRAINING_MANAGER_URL defaults to http://127.0.0.1:3000.
  TRAINING_MANAGER_API_NAMESPACE defaults to training.
  x-api-token is read from TRAINING_MANAGER_TOKEN or AUTH_TOKEN.
`.trim();

runTrainingWorkerEntrypoint({
  defaultWorkerOwner: "training-image-worker",
  handleTask: async (task, context) => {
    const provider = readStringOption(context.cli.values, "--provider") ?? "task-request";
    if (provider === "mock-local") {
      return { output: createMockImageOutput(task) };
    }

    throw new WorkerError(
      `Image provider "${provider}" is not configured. Use --provider mock-local for local lifecycle tests or configure a Training image runner before consuming real tasks.`,
    );
  },
  help: HELP,
  workerLabel: "training image worker",
  workerType: "image_generation",
});

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
