import { runTrainingWorkerEntrypoint } from "./worker-common";

const HELP = `
LoRA training dataset freeze worker

Usage:
  cmd /c npx tsx scripts/training/dataset-freeze-worker.ts --help
  cmd /c npx tsx scripts/training/dataset-freeze-worker.ts --once
  cmd /c npx tsx scripts/training/dataset-freeze-worker.ts --poll --worker-owner training-dataset-freeze-worker-01

Options:
  --once                 Lease at most one dataset_freeze task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner.

Manager auth:
  TRAINING_MANAGER_URL defaults to http://127.0.0.1:3000.
  TRAINING_MANAGER_API_NAMESPACE defaults to training.
  x-api-token is read from TRAINING_MANAGER_TOKEN or AUTH_TOKEN.
`.trim();

runTrainingWorkerEntrypoint({
  defaultWorkerOwner: "training-dataset-freeze-worker",
  handleTask: async (task) => ({
    progressJson: {
      datasetRevisionId: task.targetId ?? null,
      stage: "frozen",
    },
  }),
  help: HELP,
  workerLabel: "training dataset freeze worker",
  workerType: "dataset_freeze",
});
