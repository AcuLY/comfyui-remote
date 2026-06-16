import process from "node:process";

import {
  createManagerClient as legacyCreateManagerClient,
  getManagerBaseUrl as legacyGetManagerBaseUrl,
  getWorkerTaskApiBasePath as legacyGetWorkerTaskApiBasePath,
  ManagerApiError as LegacyManagerApiError,
  parseWorkerCli as legacyParseWorkerCli,
  readNumberOption as legacyReadNumberOption,
  readStringOption as legacyReadStringOption,
  resolveManagerAuth as legacyResolveManagerAuth,
  WorkerError as LegacyWorkerError,
} from "../character-lora-training/worker-common";

export const ManagerApiError = LegacyManagerApiError;
export const WorkerError = LegacyWorkerError;

export function parseWorkerCli(...args: Parameters<typeof legacyParseWorkerCli>): ReturnType<typeof legacyParseWorkerCli> {
  return legacyParseWorkerCli(...args);
}

export function readStringOption(...args: Parameters<typeof legacyReadStringOption>): ReturnType<typeof legacyReadStringOption> {
  return legacyReadStringOption(...args);
}

export function readNumberOption(...args: Parameters<typeof legacyReadNumberOption>): ReturnType<typeof legacyReadNumberOption> {
  return legacyReadNumberOption(...args);
}

export function getManagerBaseUrl(...args: Parameters<typeof legacyGetManagerBaseUrl>): ReturnType<typeof legacyGetManagerBaseUrl> {
  return legacyGetManagerBaseUrl(...args);
}

export function getWorkerTaskApiBasePath(...args: Parameters<typeof legacyGetWorkerTaskApiBasePath>): ReturnType<typeof legacyGetWorkerTaskApiBasePath> {
  return legacyGetWorkerTaskApiBasePath(...args);
}

export function resolveManagerAuth(...args: Parameters<typeof legacyResolveManagerAuth>): ReturnType<typeof legacyResolveManagerAuth> {
  return legacyResolveManagerAuth(...args);
}

export function createManagerClient(...args: Parameters<typeof legacyCreateManagerClient>): ReturnType<typeof legacyCreateManagerClient> {
  return legacyCreateManagerClient(...args);
}
export type {
  AuthSourceShape,
  ManagerJob,
  ManagerJobReport,
  ManagerProjectDetail,
  ManagerProjectLatestRun,
  ManagerProjectRunResponse,
  ManagerTask,
  WorkerCliOptions,
} from "../character-lora-training/worker-common";

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

applyTrainingManagerEnvAliases();

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
