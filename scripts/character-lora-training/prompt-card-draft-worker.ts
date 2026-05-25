import process from "node:process";

import {
  createManagerClient,
  parseWorkerCli,
  sleep,
  summarizeUnknown,
  toErrorMessage,
} from "./worker-common";

import type {
  CharacterLoraPromptCardDraftTaskPayload,
} from "../../src/server/character-lora-training/contracts";

const HELP = `
Character LoRA prompt-card draft worker

Usage:
  cmd /c npx tsx scripts/character-lora-training/prompt-card-draft-worker.ts --help
  cmd /c npx tsx scripts/character-lora-training/prompt-card-draft-worker.ts --once
  cmd /c npx tsx scripts/character-lora-training/prompt-card-draft-worker.ts --poll --worker-owner prompt-card-draft-worker-01

Options:
  --once                 Lease at most one prompt_card_draft task and exit.
  --poll                 Keep polling. This is the default when --once is absent.
  --interval-ms <ms>     Poll interval. Default: 5000.
  --lease-seconds <sec>  Lease/heartbeat extension. Default: 300.
  --worker-owner <name>  Lease owner. Default: character-lora-prompt-card-draft-worker.

Manager auth:
  CHARACTER_LORA_MANAGER_URL defaults to http://127.0.0.1:3000.
  x-api-token is read from AUTH_TOKEN, CHARACTER_LORA_MANAGER_TOKEN, or .env.
`.trim();

main().catch((error) => {
  console.error("[character-lora prompt-card-draft-worker] failed");
  console.error(summarizeUnknown(error));
  process.exitCode = 1;
});

async function main() {
  const cli = parseWorkerCli(process.argv.slice(2), {
    workerOwner: "character-lora-prompt-card-draft-worker",
  });

  if (cli.help) {
    console.log(HELP);
    return;
  }

  const client = await createManagerClient();
  console.log("[character-lora prompt-card-draft-worker] starting", {
    managerUrl: client.baseUrl,
    managerAuth: client.authSource,
    workerOwner: cli.workerOwner,
    mode: cli.once ? "once" : "poll",
  });

  do {
    const task = await client.leaseTask({
      workerType: "prompt_card_draft",
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
    });

    if (!task) {
      if (cli.once) {
        console.log("[character-lora prompt-card-draft-worker] no task available");
        return;
      }
      await sleep(cli.pollIntervalMs);
      continue;
    }

    if (task.payload.taskType !== "prompt_card_draft") {
      await client.failTask(task.id, {
        leaseOwner: cli.workerOwner,
        errorSummary: `Unsupported payload taskType: ${task.payload.taskType}`,
      });
      continue;
    }

    await runPromptCardDraftTask({
      client,
      taskId: task.id,
      leaseOwner: cli.workerOwner,
      leaseDurationSeconds: cli.leaseDurationSeconds,
      payload: task.payload,
    });
  } while (cli.poll);
}

async function runPromptCardDraftTask(input: {
  client: Awaited<ReturnType<typeof createManagerClient>>;
  taskId: string;
  leaseOwner: string;
  leaseDurationSeconds: number;
  payload: CharacterLoraPromptCardDraftTaskPayload;
}) {
  const startedAt = new Date().toISOString();
  try {
    await input.client.heartbeatTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      leaseDurationSeconds: input.leaseDurationSeconds,
      progressJson: {
        status: "generating",
        provider: input.payload.request.provider,
        sourceImageIds: input.payload.request.sourceImageIds,
        canonicalVersionIds: input.payload.request.canonicalVersionIds,
        sourceImageCount: input.payload.request.sourceImageIds.length,
        canonicalImageCount: input.payload.request.canonicalVersionIds.length,
        imageCount: input.payload.request.sourceImageIds.length + input.payload.request.canonicalVersionIds.length,
        startedAt,
      },
    });

    const result = normalizePromptCardDraftResult(await input.client.generatePromptCardDraft(
      input.payload.jobId,
      input.payload.request,
    ));

    await input.client.heartbeatTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      leaseDurationSeconds: input.leaseDurationSeconds,
      progressJson: {
        status: "done",
        provider: result.provider,
        sourceImageIds: result.sourceImageIds,
        canonicalVersionIds: result.canonicalVersionIds,
        sourceImageCount: result.sourceImageCount,
        canonicalImageCount: result.canonicalImageCount,
        imageCount: result.imageCount,
        draft: result.draft,
        startedAt,
        finishedAt: new Date().toISOString(),
      },
    });

    await input.client.completeTask(input.taskId, {
      leaseOwner: input.leaseOwner,
    });

    console.log("[character-lora prompt-card-draft-worker] completed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      provider: result.provider,
      imageCount: result.imageCount,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    await input.client.failTask(input.taskId, {
      leaseOwner: input.leaseOwner,
      errorSummary: message,
    });
    console.error("[character-lora prompt-card-draft-worker] failed task", {
      taskId: input.taskId,
      jobId: input.payload.jobId,
      error: message,
    });
  }
}

function normalizePromptCardDraftResult(value: unknown) {
  if (!isRecord(value) || !isRecord(value.draft)) {
    throw new Error("Prompt-card draft API returned an invalid result");
  }

  return {
    provider: readString(value, "provider") ?? "unknown",
    sourceImageIds: readStringArray(value, "sourceImageIds"),
    canonicalVersionIds: readStringArray(value, "canonicalVersionIds"),
    sourceImageCount: readNumber(value, "sourceImageCount") ?? 0,
    canonicalImageCount: readNumber(value, "canonicalImageCount") ?? 0,
    imageCount: readNumber(value, "imageCount") ?? 0,
    draft: {
      characterDescription: requireString(value.draft, "characterDescription"),
      identityTraits: requireString(value.draft, "identityTraits"),
      outfitTraits: requireString(value.draft, "outfitTraits"),
      negativeTraits: requireString(value.draft, "negativeTraits"),
      finalPromptDraft: requireString(value.draft, "finalPromptDraft"),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function requireString(record: Record<string, unknown>, key: string) {
  const value = readString(record, key);
  if (!value) throw new Error(`Prompt-card draft result missing ${key}`);
  return value;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}
