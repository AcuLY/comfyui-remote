import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { createLogger } from "@/lib/logger";
import type { ComfyTarget, SshComfyTarget } from "@/server/services/comfy-target";
import { getActiveComfyTarget } from "@/server/services/comfy-target";
import {
  cleanupRemoteComfyOutputSubfolders,
  getSafeTopLevelComfyOutputSubfolders,
} from "@/server/services/comfy-remote-output-cleanup";

const log = createLogger({ module: "comfy-output-cleanup" });

type CleanupDeps = {
  removeLocalDirectory?: (dirPath: string) => Promise<void>;
  cleanupRemote?: (target: SshComfyTarget, subfolders: Array<string | null>) => Promise<number>;
  logWarning?: (message: string, meta: Record<string, unknown>) => void;
};

function warn(deps: CleanupDeps, message: string, meta: Record<string, unknown>) {
  if (deps.logWarning) {
    deps.logWarning(message, meta);
    return;
  }
  log.warn(message, meta);
}

export function resolveLocalComfyOutputDirectories(
  comfyLaunchCwd: string,
  subfolders: Array<string | null>,
) {
  const launchCwd = comfyLaunchCwd.trim();
  if (!launchCwd) return [];

  const outputBase = resolve(launchCwd, "output");
  const safePrefix = outputBase + sep;
  const uniqueDirs = new Set<string>();

  for (const topLevel of getSafeTopLevelComfyOutputSubfolders(subfolders)) {
    const dirPath = resolve(outputBase, topLevel);
    if (dirPath.startsWith(safePrefix)) {
      uniqueDirs.add(dirPath);
    }
  }

  return Array.from(uniqueDirs);
}

export async function cleanupComfyOutputSubfoldersForTarget(
  target: ComfyTarget,
  subfolders: Array<string | null>,
  deps: CleanupDeps = {},
) {
  if (target.mode === "ssh") {
    try {
      return await (deps.cleanupRemote ?? cleanupRemoteComfyOutputSubfolders)(target, subfolders);
    } catch (error) {
      warn(deps, "Failed to delete remote ComfyUI output directories", {
        targetId: target.id,
        error,
      });
      return 0;
    }
  }

  const removeLocalDirectory = deps.removeLocalDirectory ?? ((dirPath: string) => rm(dirPath, { recursive: true, force: true }));
  let deletedComfyDirs = 0;

  for (const dirPath of resolveLocalComfyOutputDirectories(target.comfyLaunchCwd, subfolders)) {
    try {
      await removeLocalDirectory(dirPath);
      deletedComfyDirs++;
    } catch (error) {
      warn(deps, "Failed to delete ComfyUI output directory", { path: dirPath, error });
    }
  }

  return deletedComfyDirs;
}

export async function cleanupActiveComfyOutputSubfolders(
  subfolders: Array<string | null>,
  deps: CleanupDeps = {},
) {
  try {
    return await cleanupComfyOutputSubfoldersForTarget(getActiveComfyTarget(), subfolders, deps);
  } catch (error) {
    warn(deps, "Failed to process ComfyUI output directories", { error });
    return 0;
  }
}
