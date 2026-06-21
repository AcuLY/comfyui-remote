import type { SshComfyTarget } from "@/server/services/comfy-target";
import { quotePosixShellArg, runSshCommand } from "@/server/services/comfy-ssh";

function normalizeRoot(root: string) {
  return root.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function safeTopLevelSubfolder(subfolder: string | null) {
  const topLevel = subfolder?.replace(/\\/g, "/").split("/").find(Boolean)?.trim();
  if (!topLevel || topLevel === "." || topLevel === "..") {
    return null;
  }
  return topLevel;
}

export function getSafeTopLevelComfyOutputSubfolders(subfolders: Array<string | null>) {
  return Array.from(new Set(
    subfolders
      .map(safeTopLevelSubfolder)
      .filter((value): value is string => Boolean(value)),
  ));
}

export function buildRemoteOutputCleanupCommand(
  remoteComfyRoot: string,
  subfolders: Array<string | null>,
) {
  const outputRoot = `${normalizeRoot(remoteComfyRoot)}/output`;
  const uniqueDirs = getSafeTopLevelComfyOutputSubfolders(subfolders);

  if (uniqueDirs.length === 0) return null;

  const quotedDirs = uniqueDirs.map((dir) => quotePosixShellArg(`${outputRoot}/${dir}`));
  return `rm -rf -- ${quotedDirs.join(" ")}`;
}

export async function cleanupRemoteComfyOutputSubfolders(
  target: SshComfyTarget,
  subfolders: Array<string | null>,
) {
  const command = buildRemoteOutputCleanupCommand(target.remoteComfyRoot, subfolders);
  if (!command) return 0;
  await runSshCommand(target, command);
  return getSafeTopLevelComfyOutputSubfolders(subfolders).length;
}
