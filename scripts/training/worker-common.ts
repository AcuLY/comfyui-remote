import process from "node:process";

export * from "../character-lora-training/worker-common";

function copyEnvAlias(sourceName: string, targetName: string) {
  const sourceValue = process.env[sourceName]?.trim();
  if (!sourceValue || process.env[targetName]?.trim()) {
    return;
  }
  process.env[targetName] = sourceValue;
}

function applyTrainingManagerEnvAliases() {
  copyEnvAlias("TRAINING_MANAGER_URL", "CHARACTER_LORA_MANAGER_URL");
  copyEnvAlias("TRAINING_MANAGER_TOKEN", "CHARACTER_LORA_MANAGER_TOKEN");
}

export function runTrainingWorkerEntrypoint(input: {
  help: string;
  importLegacyWorker: () => Promise<unknown>;
}) {
  process.env.TRAINING_MANAGER_API_NAMESPACE = process.env.TRAINING_MANAGER_API_NAMESPACE?.trim() || "training";
  applyTrainingManagerEnvAliases();

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
