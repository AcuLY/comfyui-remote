import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import {
  parseWorkerCli,
  readNumberOption,
  readStringOption,
} from "./worker-common";

type WorkerSpec = {
  key: string;
  script: string;
  ownerSuffix: string;
  skipFlag: string;
  extraArgs: string[];
};

type RunningWorker = {
  key: string;
  child: ChildProcess;
  stop: () => void;
};

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

main().catch((error) => {
  console.error("[training worker-queue] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const cli = parseWorkerCli(process.argv.slice(2), {
    workerOwner: "training-queue",
  });
  if (cli.help) {
    console.log(HELP);
    return;
  }

  const ownerPrefix = readStringOption(cli.values, "--worker-owner-prefix") ?? cli.workerOwner;
  const restartDelayMs = readNumberOption(cli.values, "--restart-delay-ms") ?? 5_000;
  const specs = buildWorkerSpecs(cli.values);
  const enabledSpecs = specs.filter((spec) => !cli.values.has(spec.skipFlag));

  if (enabledSpecs.length === 0) {
    throw new Error("No workers are enabled; remove at least one --skip-* option.");
  }

  const tsxCli = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  console.log("[training worker-queue] starting", {
    workers: enabledSpecs.map((spec) => spec.key),
    ownerPrefix,
    intervalMs: cli.pollIntervalMs,
    leaseSeconds: cli.leaseDurationSeconds,
    restartDelayMs,
  });

  let stopping = false;
  const running = new Map<string, RunningWorker>();

  const start = (spec: WorkerSpec) => {
    if (stopping) {
      return;
    }

    const args = [
      tsxCli,
      path.join("scripts", "training", spec.script),
      "--poll",
      "--worker-owner",
      `${ownerPrefix}-${spec.ownerSuffix}`,
      "--interval-ms",
      String(cli.pollIntervalMs),
      "--lease-seconds",
      String(cli.leaseDurationSeconds),
      ...spec.extraArgs,
    ];

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TRAINING_MANAGER_API_NAMESPACE: "training",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const worker: RunningWorker = {
      key: spec.key,
      child,
      stop: () => {
        child.kill("SIGTERM");
      },
    };
    running.set(spec.key, worker);
    pipeWithPrefix(spec.key, "stdout", child.stdout);
    pipeWithPrefix(spec.key, "stderr", child.stderr);

    child.on("exit", (code, signal) => {
      running.delete(spec.key);
      if (stopping) {
        return;
      }
      console.error("[training worker-queue] child exited", {
        worker: spec.key,
        code,
        signal,
        restartDelayMs,
      });
      void delay(restartDelayMs).then(() => start(spec));
    });
  };

  for (const spec of enabledSpecs) {
    start(spec);
  }

  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log("[training worker-queue] stopping", { signal });
    for (const worker of running.values()) {
      worker.stop();
    }
    await delay(2_500);
    for (const worker of running.values()) {
      if (!worker.child.killed) {
        worker.child.kill("SIGKILL");
      }
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

function buildWorkerSpecs(values: Map<string, string | true>): WorkerSpec[] {
  const imageProvider = resolveImageProvider(values);
  const trainingDryRun = values.has("--dry-run-training");
  const trainingMockComplete = values.has("--mock-complete-training");
  const trainingRunnerType = readStringOption(values, "--training-runner-type");
  const trainingRunnerCommand = readStringOption(values, "--training-runner-command");
  if (trainingMockComplete && !trainingDryRun) {
    throw new Error("--mock-complete-training requires --dry-run-training");
  }

  return [
    {
      key: "image",
      script: "image-worker.ts",
      ownerSuffix: "image-worker",
      skipFlag: "--skip-image",
      extraArgs: imageProvider === "task-request" ? [] : ["--provider", imageProvider],
    },
    {
      key: "dataset-freeze",
      script: "dataset-freeze-worker.ts",
      ownerSuffix: "dataset-freeze-worker",
      skipFlag: "--skip-dataset-freeze",
      extraArgs: [],
    },
    {
      key: "training",
      script: "training-worker.ts",
      ownerSuffix: "training-worker",
      skipFlag: "--skip-training",
      extraArgs: [
        ...(trainingDryRun ? ["--dry-run"] : []),
        ...(trainingMockComplete ? ["--mock-complete"] : []),
        ...(trainingRunnerType ? ["--runner-type", trainingRunnerType] : []),
        ...(trainingRunnerCommand ? ["--runner-command", trainingRunnerCommand] : []),
      ],
    },
  ];
}

function resolveImageProvider(values: Map<string, string | true>) {
  if (values.has("--mock-image")) {
    return "mock-local";
  }

  const provider = readStringOption(values, "--image-provider") ?? "task-request";
  if (provider === "task-request" || provider === "mock-local" || provider === "openai-codex") {
    return provider;
  }

  throw new Error(`Unsupported --image-provider: ${provider}`);
}

function pipeWithPrefix(
  workerKey: string,
  streamName: "stdout" | "stderr",
  stream: NodeJS.ReadableStream | null,
) {
  if (!stream) {
    return;
  }
  stream.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const output = text
      .split(/\r?\n/)
      .map((line, index, lines) => {
        if (!line && index === lines.length - 1) {
          return "";
        }
        return `[${workerKey}] ${line}`;
      })
      .join("\n");
    const target = streamName === "stdout" ? process.stdout : process.stderr;
    target.write(output);
  });
}
