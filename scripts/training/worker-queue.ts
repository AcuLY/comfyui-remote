import process from "node:process";

import { runTrainingWorkerQueue } from "./worker-queue-runtime";

const HELP = `
LoRA training worker queue supervisor

Usage:
  cmd /c npx tsx scripts/training/worker-queue.ts --help
  cmd /c npm run training:workers
  cmd /c npm run training:workers:mock

Options:
  --worker-owner-prefix <name>  Prefix for per-worker lease owners. Default: training-queue.
  --interval-ms <ms>           Poll interval passed to child workers. Default: 5000.
  --lease-seconds <sec>        Lease/heartbeat extension passed to child workers. Default: 300.
  --project-id <id>            Restrict child worker leases to one training project.
  --restart-delay-ms <ms>      Restart delay for crashed child workers. Default: 5000.

  --mock-image                 Force image worker provider to mock-local.
  --image-provider <provider>  task-request, mock-local, or openai-codex. Default: task-request.
  --dry-run-training           Pass --dry-run to training worker.
  --mock-complete-training     Pass --mock-complete to training worker; requires --dry-run-training.
  --training-runner-type <type> Training runner adapter passed to training worker. Default: local_wsl_sd_scripts.
  --training-runner-command <cmd> Command passed to the local_wsl_sd_scripts adapter.

  --skip-image                 Do not start the image generation worker.
  --skip-dataset-freeze        Do not start the dataset freeze worker.
  --skip-training              Do not start the training worker.

Notes:
  The supervisor does not run inside Next.js. Keep it alive beside the Manager
  process when queued LoRA training tasks should be consumed.
`.trim();

runTrainingWorkerQueue(process.argv.slice(2), HELP).catch((error) => {
  console.error("[training worker-queue] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
