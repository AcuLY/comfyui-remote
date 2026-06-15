import process from "node:process";

export * from "../character-lora-training/worker-common";

export function runTrainingWorkerEntrypoint(input: {
  help: string;
  importLegacyWorker: () => Promise<unknown>;
}) {
  process.env.TRAINING_MANAGER_API_NAMESPACE = process.env.TRAINING_MANAGER_API_NAMESPACE?.trim() || "training";

  if (process.argv.slice(2).some((arg) => arg === "--help" || arg === "-h")) {
    console.log(input.help.trim());
    return;
  }

  void input.importLegacyWorker().catch((error: unknown) => {
    console.error("[training worker] failed to load worker adapter");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
