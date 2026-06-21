import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type ComfyTargetMode = "local" | "ssh";

export type LocalComfyTargetConfig = {
  mode: "local";
  apiUrl?: string;
  modelBaseDir?: string;
  comfyLaunchCmd?: string;
  comfyLaunchCwd?: string;
};

export type SshComfyTargetConfig = {
  mode: "ssh";
  sshHost: string;
  sshPort?: number;
  sshKeyPath?: string;
  localApiUrl: string;
  remoteApiHost?: string;
  remoteApiPort?: number;
  remoteComfyRoot: string;
  remoteModelsRoot: string;
  startCommand?: string;
  stopCommand?: string;
  restartCommand?: string;
  logCommand?: string;
  hashCommandTemplate?: string;
  tunnelAutoStart?: boolean;
};

export type ComfyTargetConfigFile = {
  active?: string;
  targets: Record<string, LocalComfyTargetConfig | SshComfyTargetConfig>;
};

export type LocalComfyTarget = {
  id: string;
  mode: "local";
  apiUrl: string;
  modelBaseDir: string;
  loraBaseDir: string;
  checkpointBaseDir: string;
  comfyLaunchCmd: string;
  comfyLaunchCwd: string;
};

export type SshComfyTarget = {
  id: string;
  mode: "ssh";
  apiUrl: string;
  sshHost: string;
  sshPort: number;
  sshKeyPath: string | null;
  localApiUrl: string;
  remoteApiHost: string;
  remoteApiPort: number;
  remoteComfyRoot: string;
  remoteModelsRoot: string;
  startCommand: string | null;
  stopCommand: string | null;
  restartCommand: string | null;
  logCommand: string | null;
  hashCommandTemplate: string | null;
  tunnelAutoStart: boolean;
};

export type ComfyTarget = LocalComfyTarget | SshComfyTarget;

type ResolveComfyTargetOptions = {
  activeTargetId?: string | null;
  fallbackApiUrl: string;
  fallbackModelBaseDir: string;
  fallbackLaunchCmd?: string;
  fallbackLaunchCwd?: string;
  tunnelAutoStart?: boolean;
};

function trimTrailingSlashes(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeApiUrl(value: string) {
  const normalized = trimTrailingSlashes(value);
  if (!normalized) {
    throw new Error("ComfyUI API URL is empty.");
  }
  return normalized;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireString(value: unknown, name: string) {
  const text = readString(value);
  if (!text) {
    throw new Error(`${name} is required for SSH ComfyUI targets.`);
  }
  return text;
}

function normalizePort(value: unknown, fallback: number, name: string) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${name} must be a TCP port between 1 and 65535.`);
  }
  return parsed;
}

function localTargetFromConfig(
  id: string,
  config: LocalComfyTargetConfig | null,
  options: ResolveComfyTargetOptions,
): LocalComfyTarget {
  const modelBaseDir = readString(config?.modelBaseDir) || options.fallbackModelBaseDir;
  return {
    id,
    mode: "local",
    apiUrl: normalizeApiUrl(readString(config?.apiUrl) || options.fallbackApiUrl),
    modelBaseDir,
    loraBaseDir: modelBaseDir ? path.join(modelBaseDir, "loras") : "",
    checkpointBaseDir: modelBaseDir ? path.join(modelBaseDir, "checkpoints") : "",
    comfyLaunchCmd: readString(config?.comfyLaunchCmd) || readString(options.fallbackLaunchCmd),
    comfyLaunchCwd: readString(config?.comfyLaunchCwd) || readString(options.fallbackLaunchCwd),
  };
}

function sshTargetFromConfig(
  id: string,
  config: SshComfyTargetConfig,
  options: ResolveComfyTargetOptions,
): SshComfyTarget {
  const localApiUrl = normalizeApiUrl(requireString(config.localApiUrl, "localApiUrl"));
  return {
    id,
    mode: "ssh",
    apiUrl: localApiUrl,
    sshHost: requireString(config.sshHost, "sshHost"),
    sshPort: normalizePort(config.sshPort, 22, "sshPort"),
    sshKeyPath: readString(config.sshKeyPath) || null,
    localApiUrl,
    remoteApiHost: readString(config.remoteApiHost) || "127.0.0.1",
    remoteApiPort: normalizePort(config.remoteApiPort, 8188, "remoteApiPort"),
    remoteComfyRoot: requireString(config.remoteComfyRoot, "remoteComfyRoot"),
    remoteModelsRoot: requireString(config.remoteModelsRoot, "remoteModelsRoot"),
    startCommand: readString(config.startCommand) || null,
    stopCommand: readString(config.stopCommand) || null,
    restartCommand: readString(config.restartCommand) || null,
    logCommand: readString(config.logCommand) || null,
    hashCommandTemplate: readString(config.hashCommandTemplate) || null,
    tunnelAutoStart: config.tunnelAutoStart ?? options.tunnelAutoStart ?? true,
  };
}

export function resolveComfyTargetFromConfig(
  config: ComfyTargetConfigFile | null,
  options: ResolveComfyTargetOptions,
): ComfyTarget {
  if (!config) {
    return localTargetFromConfig("local", null, options);
  }

  const activeId = readString(options.activeTargetId) || readString(config.active);
  if (!activeId) {
    throw new Error("COMFY_ACTIVE_TARGET or config.active is required when COMFY_TARGET_CONFIG_PATH is set.");
  }

  const targetConfig = config.targets?.[activeId];
  if (!targetConfig) {
    throw new Error(`Active ComfyUI target "${activeId}" was not found in target config.`);
  }

  if (targetConfig.mode === "ssh") {
    return sshTargetFromConfig(activeId, targetConfig, options);
  }

  if (targetConfig.mode === "local") {
    return localTargetFromConfig(activeId, targetConfig, options);
  }

  throw new Error(`Unsupported ComfyUI target mode for "${activeId}".`);
}

export function loadComfyTargetConfig(configPath: string | null | undefined): ComfyTargetConfigFile | null {
  const rawPath = readString(configPath);
  if (!rawPath) return null;
  const resolvedPath = path.resolve(process.cwd(), rawPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`ComfyUI target config not found: ${resolvedPath}`);
  }
  return JSON.parse(readFileSync(resolvedPath, "utf8").replace(/^\uFEFF/, "")) as ComfyTargetConfigFile;
}

export function getActiveComfyTarget(): ComfyTarget {
  const config = loadComfyTargetConfig(process.env.COMFY_TARGET_CONFIG_PATH);
  return resolveComfyTargetFromConfig(config, {
    activeTargetId: process.env.COMFY_ACTIVE_TARGET ?? null,
    fallbackApiUrl: process.env.COMFY_API_URL ?? "http://127.0.0.1:8188",
    fallbackModelBaseDir: process.env.MODEL_BASE_DIR ?? "",
    fallbackLaunchCmd: process.env.COMFY_LAUNCH_CMD ?? "",
    fallbackLaunchCwd: process.env.COMFY_LAUNCH_CWD ?? "",
    tunnelAutoStart:
      process.env.COMFY_SSH_TUNNEL_AUTO_START === undefined
        ? true
        : process.env.COMFY_SSH_TUNNEL_AUTO_START.trim().toLowerCase() !== "false",
  });
}

export function getActiveComfyApiUrl() {
  return getActiveComfyTarget().apiUrl;
}
