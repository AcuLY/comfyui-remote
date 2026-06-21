import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createLogger } from "@/lib/logger";
import { cleanupActiveComfyOutputSubfolders } from "@/server/services/comfy-output-cleanup";
import { resolveDataPath, withTrailingSeparator } from "@/server/services/runtime-data-path";

const log = createLogger({ module: "section-cleanup" });

type CleanupSection = {
  runs: Array<{ comfyOutputSubfolder: string | null }>;
};

export type CleanupResult = {
  deletedManagedDir: boolean;
  deletedComfyDirs: number;
};

/**
 * Delete all disk files associated with project sections:
 * 1. Managed images directory (data/images/{projectSlug}/)
 * 2. ComfyUI output directories (per-run comfyOutputSubfolder)
 */
export async function cleanupProjectSectionFiles(
  projectSlug: string,
  sections: CleanupSection[],
): Promise<CleanupResult> {
  let deletedManagedDir = false;
  let deletedComfyDirs = 0;

  // 1. Delete managed images directory
  const managedBase = resolveDataPath("images");
  const managedProjectDir = resolve(managedBase, projectSlug);
  const safeManagedPrefix = withTrailingSeparator(managedBase);
  if (managedProjectDir.startsWith(safeManagedPrefix)) {
    try {
      await rm(managedProjectDir, { recursive: true, force: true });
      deletedManagedDir = true;
    } catch (err) {
      log.warn("Failed to delete managed image directory", { path: managedProjectDir, error: err });
    }
  }

  const comfyOutputSubfolders = sections.flatMap((section) =>
    section.runs.map((run) => run.comfyOutputSubfolder),
  );
  deletedComfyDirs = await cleanupActiveComfyOutputSubfolders(comfyOutputSubfolders);

  return { deletedManagedDir, deletedComfyDirs };
}
