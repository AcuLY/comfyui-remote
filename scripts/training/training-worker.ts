import { runTrainingWorkerEntrypoint } from "./worker-common";

const HELP = `
LoRA training launcher worker

Usage:
  cmd /c npx tsx scripts/training/training-worker.ts --help
  cmd /c npx tsx scripts/training/training-worker.ts --once --dry-run
  cmd /c npx tsx scripts/training/training-worker.ts --poll --worker-owner training-worker-01

Options:
  --once                 Lease at most one training task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner.
  --dry-run              Validate inputs without launching training.
  --mock-complete        With --dry-run only, write mock artifacts and complete the task.
`.trim();

runTrainingWorkerEntrypoint({
  help: HELP,
  importLegacyWorker: () => import("../character-lora-training/training-worker"),
});
