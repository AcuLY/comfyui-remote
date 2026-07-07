import { runTrainingWorkerEntrypoint } from "./worker-common";
import { runTrainingTask } from "./training-worker-runtime";

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
