import "dotenv/config";

import process from "node:process";

import { runImageProviderCheck, runImageTask } from "./image-worker-runtime";
import { runTrainingWorkerEntrypoint } from "./worker-common";

const HELP = `
LoRA training image provider worker

Usage:
  cmd /c npx tsx scripts/training/image-worker.ts --help
  cmd /c npx tsx scripts/training/image-worker.ts --check-provider --provider openai-codex
  cmd /c npx tsx scripts/training/image-worker.ts --once --provider openai-codex
  cmd /c npx tsx scripts/training/image-worker.ts --poll --provider openai-codex --worker-owner training-image-worker-01

Options:
  --once                 Lease at most one image_generation task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner.
  --provider <name>      Override task provider with mock-local, openai-codex, or codex_gpt_image2.
  --config <path>          Image worker config JSON. Defaults to TRAINING_IMAGE_WORKER_CONFIG_PATH.
  --project-id <id>       Restrict leases to one training project.
  --runner-script <path>  Override codex_gpt_image2.py path.
  --check-provider        Validate the Codex bridge/auth config without leasing a Manager task.

Codex bridge env/config:
  TRAINING_IMAGE_WORKER_CONFIG_PATH points at config/training-image-worker.codex_gpt_image2.local.json.
  CODEX_IMAGE_AUTH_FILE / CODEX_AUTH_FILE should point at an auth JSON file; raw tokens are not logged.
  CODEX_BASE_URL, CODEX_HOST_MODEL, and the JSON config may override provider settings.

Manager auth:
  TRAINING_MANAGER_URL defaults to http://127.0.0.1:3000.
  TRAINING_MANAGER_API_NAMESPACE defaults to training.
  x-api-token is read from TRAINING_MANAGER_TOKEN or AUTH_TOKEN.
`.trim();

main().catch((error: unknown) => {
  console.error("[training image worker] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check-provider")) {
    console.log(JSON.stringify(await runImageProviderCheck(args), null, 2));
    return;
  }

  runTrainingWorkerEntrypoint({
    defaultWorkerOwner: "training-image-worker",
    handleTask: runImageTask,
    help: HELP,
    workerLabel: "training image worker",
    workerType: "image_generation",
  });
}
