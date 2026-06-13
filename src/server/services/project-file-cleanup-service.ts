import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createLogger } from "@/lib/logger";
import { resolveDataPath } from "@/server/services/runtime-data-path";

const log = createLogger({ module: "project-file-cleanup" });

export type CleanupProjectExportDirectoryResult = {
  deletedExportDir: boolean;
  skippedUnsafePath?: boolean;
};

export function resolveProjectExportDirectory(
  projectTitle: string,
  cwd?: string,
): string | null {
  const exportBase = cwd ? resolve(cwd, "data", "export") : resolveDataPath("export");
  const exportDir = resolve(exportBase, projectTitle);
  if (!exportDir.startsWith(exportBase + sep)) {
    return null;
  }
  return exportDir;
}

export async function cleanupProjectExportDirectory(
  projectTitle: string,
  cwd?: string,
): Promise<CleanupProjectExportDirectoryResult> {
  const exportDir = resolveProjectExportDirectory(projectTitle, cwd);
  if (!exportDir) {
    log.warn("Skipping export directory outside data/export", { projectTitle });
    return { deletedExportDir: false, skippedUnsafePath: true };
  }

  try {
    await rm(exportDir, { recursive: true, force: true });
    return { deletedExportDir: true };
  } catch (error) {
    log.warn("Failed to delete project export directory", { path: exportDir, error });
    return { deletedExportDir: false };
  }
}
