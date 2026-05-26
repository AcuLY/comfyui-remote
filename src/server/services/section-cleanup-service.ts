import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

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
  const managedProjectDir = resolve(process.cwd(), "data", "images", projectSlug);
  const managedBase = resolve(process.cwd(), "data", "images") + sep;
  if (managedProjectDir.startsWith(managedBase)) {
    try {
      await rm(managedProjectDir, { recursive: true, force: true });
      deletedManagedDir = true;
    } catch (err) {
      log.warn("Failed to delete managed image directory", { path: managedProjectDir, error: err });
    }
  }

  // 2. Delete ComfyUI output directories
  if (env.comfyLaunchCwd) {
    const outputBase = resolve(env.comfyLaunchCwd, "output");
    const safePrefix = outputBase + sep;
    const uniqueDirs = new Set<string>();

    for (const section of sections) {
      for (const run of section.runs) {
        if (run.comfyOutputSubfolder) {
          // Use top-level directory (same logic as archive service)
          const topLevel = run.comfyOutputSubfolder.split("/")[0];
          if (topLevel) {
            const dirPath = resolve(outputBase, topLevel);
            if (dirPath.startsWith(safePrefix)) {
              uniqueDirs.add(dirPath);
            }
          }
        }
      }
    }

    for (const dir of uniqueDirs) {
      try {
        await rm(dir, { recursive: true, force: true });
        deletedComfyDirs++;
      } catch (err) {
        log.warn("Failed to delete ComfyUI output directory", { path: dir, error: err });
      }
    }
  }

  return { deletedManagedDir, deletedComfyDirs };
}
