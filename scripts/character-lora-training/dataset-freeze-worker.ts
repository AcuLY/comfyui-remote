import process from "node:process";

import {
  createManagerClient,
  parseWorkerCli,
  sleep,
  summarizeUnknown,
  toErrorMessage,
} from "./worker-common";

import type {
  CharacterLoraDatasetFreezeTaskPayload,
} from "../../src/server/character-lora-training/contracts";

const HELP = `
Character LoRA dataset freeze worker

Usage:
  cmd /c npx tsx scripts/character-lora-training/dataset-freeze-worker.ts --help
  cmd /c npx tsx scripts/character-lora-training/dataset-freeze-worker.ts --once
  cmd /c npx tsx scripts/character-lora-training/dataset-freeze-worker.ts --poll --worker-owner dataset-freeze-worker-01

Options:
  --once                 Lease at most one dataset_freeze task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner. Default: character-lora-dataset-freeze-worker.

Manager auth:
  CHARACTER_LORA_MANAGER_URL defaults to http://127.0.0.1:3000.
  x-api-token is read from AUTH_TOKEN, CHARACTER_LORA_MANAGER_TOKEN, or .env.
`.trim();

main().catch((error) => {
  console.error("[character-lora dataset-freeze-worker] failed");
  console.error(summarizeUnknown(error));
  process.exitCode = 1;
});

async function main() {
  const cli = parseWorkerCli(process.argv.slice(2), {
    workerOwner: "character-lora-dataset-freeze-worker",
  });

  if (cli.help) {
    console.log(HELP);
    return;
  }

  const client = await createManagerClient();
  console.log("[character-lora dataset-freeze-worker] starting", {
    managerUrl: client.baseUrl,
    managerAuth: client.authSource,
    workerOwner: cli.workerOwner,
    mode: cli.once ? "once" : "poll",
  });

  do {
    const task = await client.leaseTask({
      workerType: "dataset_freeze",
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
    });

    if (!task) {
      if (cli.once) {
        console.log("[character-lora dataset-freeze-worker] no task available");
        return;
      }
      await sleep(cli.pollIntervalMs);
      continue;
    }

    if (task.payload.taskType !== "dataset_freeze") {
      await client.failTask(task.id, {
        leaseOwner: cli.workerOwner,
        errorSummary: `Unsupported payload taskType: ${task.payload.taskType}`,
      });
      continue;
    }

    await runDatasetFreezeTask({
      client,
      taskId: task.id,
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
      payload: task.payload,
    });
  } while (cli.poll);
}

async function runDatasetFreezeTask(input: {
  client: Awaited<ReturnType<typeof createManagerClient>>;
  taskId: string;
  leaseOwner: string;
  leaseDurationSeconds: number;
  payload: CharacterLoraDatasetFreezeTaskPayload;
}) {
  try {
    await input.client.heartbeatTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      leaseDurationSeconds: input.leaseDurationSeconds,
      progressJson: {
        status: "materializing",
        datasetRevisionId: input.payload.datasetRevisionId,
        version: input.payload.version,
        keepImageCount: input.payload.keepImageIds.length,
      },
    });

    await input.client.completeTask(input.taskId, {
      leaseOwner: input.leaseOwner,
    });

    console.log("[character-lora dataset-freeze-worker] completed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      datasetRevisionId: input.payload.datasetRevisionId,
      version: input.payload.version,
      keepImageCount: input.payload.keepImageIds.length,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    await input.client.failTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      errorSummary: message,
    });
    console.error("[character-lora dataset-freeze-worker] failed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      datasetRevisionId: input.payload.datasetRevisionId,
      error: message,
    });
  }
}
