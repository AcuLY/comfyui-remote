import { access, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { cancelProjectTasksForCleanup } from "@/server/services/project-deletion-service";
import { cleanupProjectExportDirectory } from "@/server/services/project-file-cleanup-service";

const log = createLogger({ module: "project-archive-service" });

export type ArchiveProjectResult = {
  success: boolean;
  message: string;
  cancelledRuns: number;
  cancelledCensoringTasks: number;
  deletedManagedDir: boolean;
  deletedExportDir: boolean;
  deletedTrashFiles: number;
  deletedComfyDirs: number;
};

export async function archiveProject(projectId: string): Promise<ArchiveProjectResult> {
  // 1. Find the project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, slug: true, status: true, publishedAt: true, archivedAt: true },
  });

  // 2. Validate preconditions
  if (!project) {
    return { success: false, message: "Project not found", cancelledRuns: 0, cancelledCensoringTasks: 0, deletedManagedDir: false, deletedExportDir: false, deletedTrashFiles: 0, deletedComfyDirs: 0 };
  }

  if (project.archivedAt !== null) {
    return { success: false, message: "Project is already archived", cancelledRuns: 0, cancelledCensoringTasks: 0, deletedManagedDir: false, deletedExportDir: false, deletedTrashFiles: 0, deletedComfyDirs: 0 };
  }

  if (project.publishedAt === null) {
    return { success: false, message: "Project must be exported (published) before archiving", cancelledRuns: 0, cancelledCensoringTasks: 0, deletedManagedDir: false, deletedExportDir: false, deletedTrashFiles: 0, deletedComfyDirs: 0 };
  }

  if (project.status !== "done" && project.status !== "partial_done") {
    return { success: false, message: `Project status is ${project.status}`, cancelledRuns: 0, cancelledCensoringTasks: 0, deletedManagedDir: false, deletedExportDir: false, deletedTrashFiles: 0, deletedComfyDirs: 0 };
  }

  const exportDir = resolve(process.cwd(), "data", "export", project.title);
  const exportBase = resolve(process.cwd(), "data", "export") + sep;
  if (!exportDir.startsWith(exportBase)) {
    return { success: false, message: "Invalid project title for filesystem path", cancelledRuns: 0, cancelledCensoringTasks: 0, deletedManagedDir: false, deletedExportDir: false, deletedTrashFiles: 0, deletedComfyDirs: 0 };
  }
  try {
    await access(exportDir);
  } catch {
    return { success: false, message: `Export directory not found at data/export/${project.title}/`, cancelledRuns: 0, cancelledCensoringTasks: 0, deletedManagedDir: false, deletedExportDir: false, deletedTrashFiles: 0, deletedComfyDirs: 0 };
  }

  const cancellation = await cancelProjectTasksForCleanup(projectId);

  // 3. Delete trash files
  let deletedTrashFiles = 0;
  try {
    const trashedImages = await prisma.imageResult.findMany({
      where: { run: { projectId }, reviewStatus: "trashed" },
      select: { id: true, trashRecord: { select: { id: true, trashPath: true } } },
    });

    const trashRecordIds: string[] = [];

    for (const image of trashedImages) {
      if (image.trashRecord && image.trashRecord.trashPath) {
        const trashFilePath = resolve(process.cwd(), image.trashRecord.trashPath);

        // Safety check: only delete files under project data directories
        const dataBase = resolve(process.cwd(), "data") + sep;
        if (!trashFilePath.startsWith(dataBase)) {
          log.warn("Skipping trash file outside data directory", { path: trashFilePath });
          continue;
        }

        try {
          await rm(trashFilePath, { force: true });
          deletedTrashFiles++;
        } catch (err) {
          log.warn("Failed to delete trash file", { path: trashFilePath, error: err });
        }
        trashRecordIds.push(image.trashRecord.id);
      }
    }

    if (trashRecordIds.length > 0) {
      await prisma.trashRecord.deleteMany({ where: { id: { in: trashRecordIds } } });
    }
  } catch (err) {
    log.error("Failed to process trash files", { projectId, error: err });
  }

  // 4. Delete managed image directory
  let deletedManagedDir = false;
  const managedImageDir = resolve(process.cwd(), "data", "images", project.slug);
  try {
    await rm(managedImageDir, { recursive: true, force: true });
    deletedManagedDir = true;
  } catch (err) {
    log.warn("Failed to delete managed image directory", { path: managedImageDir, error: err });
  }

  // 5. Delete ComfyUI output directories
  let deletedComfyDirs = 0;
  if (env.comfyLaunchCwd) {
    try {
      const runs = await prisma.run.findMany({
        where: { projectId, comfyOutputSubfolder: { not: null } },
        select: { comfyOutputSubfolder: true },
      });

      const outputBase = resolve(env.comfyLaunchCwd, "output");
      const safePrefix = outputBase + sep;

      const uniqueTopLevelDirs = new Set<string>();
      for (const run of runs) {
        if (run.comfyOutputSubfolder) {
          const topLevel = run.comfyOutputSubfolder.split("/")[0];
          if (topLevel) {
            uniqueTopLevelDirs.add(topLevel);
          }
        }
      }

      for (const dirName of uniqueTopLevelDirs) {
        const dirPath = resolve(outputBase, dirName);

        // Safety check: resolved path must be inside the output directory
        if (!dirPath.startsWith(safePrefix)) {
          log.warn("Skipping ComfyUI output dir outside safe prefix", { dirPath, safePrefix });
          continue;
        }

        try {
          await rm(dirPath, { recursive: true, force: true });
          deletedComfyDirs++;
        } catch (err) {
          log.warn("Failed to delete ComfyUI output directory", { path: dirPath, error: err });
        }
      }
    } catch (err) {
      log.error("Failed to process ComfyUI output directories", { projectId, error: err });
    }
  }

  // 6. Delete export artifacts
  const exportCleanup = await cleanupProjectExportDirectory(project.title);

  // 7. Set archivedAt
  await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
  });

  // 8. Return success result
  return {
    success: true,
    message: "Project archived successfully",
    cancelledRuns: cancellation.cancelledRuns,
    cancelledCensoringTasks: cancellation.cancelledCensoringTasks,
    deletedManagedDir,
    deletedExportDir: exportCleanup.deletedExportDir,
    deletedTrashFiles,
    deletedComfyDirs,
  };
}
