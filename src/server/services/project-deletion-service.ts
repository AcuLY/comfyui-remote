import { rm } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import {
  CENSORING_CANCELLABLE_STATUSES,
  RUN_CANCELLABLE_STATUSES,
  selectCensoringPromptIds,
} from "@/lib/actions/cancellation-helpers";
import {
  clearComfyQueueSnapshotCache,
  deleteComfyQueueItems,
  getComfyQueuePosition,
  interruptComfyPrompt,
} from "@/server/services/comfyui-service";
import { cleanupProjectSectionFiles } from "@/server/services/section-cleanup-service";
import { cleanupProjectExportDirectory } from "@/server/services/project-file-cleanup-service";
import { isPathInsideDirectory, resolveDataPath, resolveProjectPath } from "@/server/services/runtime-data-path";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";

const log = createLogger({ module: "project-deletion" });

const RUN_ACTIVE_STATUSES = [...RUN_CANCELLABLE_STATUSES];
const CENSORING_ACTIVE_STATUSES = [...CENSORING_CANCELLABLE_STATUSES];
const USER_CANCEL_MESSAGE = "用户取消";

type CleanupSection = Parameters<typeof cleanupProjectSectionFiles>[1][number];
type ComfyQueuePosition = Awaited<ReturnType<typeof getComfyQueuePosition>>;

type ProjectDeletionProject = {
  id: string;
  slug: string;
  title: string;
  sections: CleanupSection[];
};

type ProjectDeletionRun = {
  id: string;
  status: string;
  comfyPromptId: string | null;
};

type ProjectDeletionCensoringTask = {
  id?: string;
  status?: string;
  errorMessage: string | null;
};

type ProjectDeletionTrashImage = {
  trashRecord: { id: string; trashPath: string | null } | null;
};

type CountResult = { count: number };

export type ProjectDeletionDb = {
  project: {
    findFirst(args: unknown): Promise<ProjectDeletionProject | null>;
    delete(args: unknown): Promise<unknown>;
  };
  run: {
    findMany(args: unknown): Promise<ProjectDeletionRun[]>;
    updateMany(args: unknown): Promise<CountResult>;
  };
  censoringTask: {
    findMany(args: unknown): Promise<ProjectDeletionCensoringTask[]>;
    updateMany(args: unknown): Promise<CountResult>;
  };
  imageResult: {
    findMany(args: unknown): Promise<ProjectDeletionTrashImage[]>;
  };
  trashRecord: {
    deleteMany(args: unknown): Promise<CountResult>;
  };
};

export type ProjectDeletionDependencies = {
  db: ProjectDeletionDb;
  now: () => Date;
  cleanupProjectSectionFiles: typeof cleanupProjectSectionFiles;
  cleanupProjectExportDirectory: typeof cleanupProjectExportDirectory;
  removeTrashFile: (path: string) => Promise<void>;
  comfy: {
    apiUrl: string;
    clearQueueSnapshotCache: () => void;
    getQueuePosition: (apiUrl: string, promptId: string) => Promise<ComfyQueuePosition>;
    deleteQueueItems: (apiUrl: string, promptIds: string[]) => Promise<void>;
    interruptPrompt: (apiUrl: string) => Promise<void>;
  };
  logWarning: (message: string, details?: Record<string, unknown>) => void;
};

export type ProjectDeletionResult = {
  deletedProject: boolean;
  cancelledRuns: number;
  cancelledCensoringTasks: number;
  deletedManagedDir: boolean;
  deletedExportDir: boolean;
  deletedTrashFiles: number;
  deletedComfyDirs: number;
};

export function createProjectDeletionDependencies(db: ProjectDeletionDb): ProjectDeletionDependencies {
  return {
    db,
    now: () => new Date(),
    cleanupProjectSectionFiles,
    cleanupProjectExportDirectory,
    removeTrashFile: (path) => rm(path, { force: true }),
    comfy: {
      apiUrl: env.comfyApiUrl,
      clearQueueSnapshotCache: clearComfyQueueSnapshotCache,
      getQueuePosition: getComfyQueuePosition,
      deleteQueueItems: deleteComfyQueueItems,
      interruptPrompt: interruptComfyPrompt,
    },
    logWarning: (message, details) => log.warn(message, details),
  };
}

export async function deleteProjectCompletely(projectId: string): Promise<ProjectDeletionResult> {
  return deleteProjectCompletelyWithDependencies(
    projectId,
    createProjectDeletionDependencies(prisma as unknown as ProjectDeletionDb),
  );
}

export async function cancelProjectTasksForCleanup(projectId: string) {
  return cancelProjectTasksForCleanupWithDependencies(
    projectId,
    createProjectDeletionDependencies(prisma as unknown as ProjectDeletionDb),
  );
}

export async function deleteProjectCompletelyWithDependencies(
  projectId: string,
  deps: ProjectDeletionDependencies,
): Promise<ProjectDeletionResult> {
  const project = await deps.db.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: {
      id: true,
      slug: true,
      title: true,
      sections: {
        select: {
          id: true,
          runs: { select: { comfyOutputSubfolder: true } },
        },
      },
    },
  });

  if (!project) {
    return emptyDeletionResult(false);
  }

  const cancellation = await cancelProjectTasksForCleanupWithDependencies(project.id, deps);
  const sectionCleanup = await deps.cleanupProjectSectionFiles(project.slug, project.sections);
  const exportCleanup = await deps.cleanupProjectExportDirectory(project.title);
  const deletedTrashFiles = await cleanupProjectTrashFiles(project.id, deps);

  await deps.db.project.delete({ where: { id: project.id } });

  return {
    deletedProject: true,
    cancelledRuns: cancellation.cancelledRuns,
    cancelledCensoringTasks: cancellation.cancelledCensoringTasks,
    deletedManagedDir: sectionCleanup.deletedManagedDir,
    deletedExportDir: exportCleanup.deletedExportDir,
    deletedTrashFiles,
    deletedComfyDirs: sectionCleanup.deletedComfyDirs,
  };
}

export async function cancelProjectTasksForCleanupWithDependencies(
  projectId: string,
  deps: ProjectDeletionDependencies,
) {
  const projectBoundary = buildGenerationProjectWhere({ id: projectId });
  const activeRuns = await deps.db.run.findMany({
    where: {
      projectId,
      project: projectBoundary,
      status: { in: RUN_ACTIVE_STATUSES },
    },
    select: { id: true, status: true, comfyPromptId: true },
  });

  try {
    await cancelComfyPromptsForRuns(activeRuns, deps);
  } catch (error) {
    deps.logWarning("Failed to cancel project run prompts in ComfyUI", {
      projectId,
      error,
    });
  }

  const runResult = await deps.db.run.updateMany({
    where: {
      projectId,
      project: projectBoundary,
      status: { in: RUN_ACTIVE_STATUSES },
    },
    data: {
      status: "cancelled",
      finishedAt: deps.now(),
      errorMessage: USER_CANCEL_MESSAGE,
    },
  });

  const activeCensoringTasks = await deps.db.censoringTask.findMany({
    where: {
      projectId,
      project: projectBoundary,
      status: { in: CENSORING_ACTIVE_STATUSES },
    },
    select: { id: true, status: true, errorMessage: true },
  });
  const censoringPromptIds = selectCensoringPromptIds(activeCensoringTasks);

  try {
    await cancelComfyPromptIds(censoringPromptIds, deps);
  } catch (error) {
    deps.logWarning("Failed to cancel project censoring prompts in ComfyUI", {
      projectId,
      error,
    });
  }

  const censoringResult = await deps.db.censoringTask.updateMany({
    where: {
      projectId,
      project: projectBoundary,
      status: { in: CENSORING_ACTIVE_STATUSES },
    },
    data: {
      status: "cancelled",
      finishedAt: deps.now(),
      errorMessage: USER_CANCEL_MESSAGE,
    },
  });

  return {
    cancelledRuns: runResult.count,
    cancelledCensoringTasks: censoringResult.count,
  };
}

async function cancelComfyPromptsForRuns(
  runs: ProjectDeletionRun[],
  deps: ProjectDeletionDependencies,
) {
  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  deps.comfy.clearQueueSnapshotCache();
  try {
    for (const run of runs) {
      if (run.status === "paused" || !run.comfyPromptId) continue;
      const position = await deps.comfy.getQueuePosition(deps.comfy.apiUrl, run.comfyPromptId);
      if (position === "running") {
        shouldInterrupt = true;
      } else if (position === "pending") {
        promptIdsToDelete.push(run.comfyPromptId);
      }
    }

    await applyComfyPromptCancellation(promptIdsToDelete, shouldInterrupt, deps);
  } finally {
    deps.comfy.clearQueueSnapshotCache();
  }
}

async function cancelComfyPromptIds(
  promptIds: string[],
  deps: ProjectDeletionDependencies,
) {
  if (promptIds.length === 0) return;

  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  deps.comfy.clearQueueSnapshotCache();
  try {
    for (const promptId of promptIds) {
      const position = await deps.comfy.getQueuePosition(deps.comfy.apiUrl, promptId);
      if (position === "running") {
        shouldInterrupt = true;
      } else if (position === "pending") {
        promptIdsToDelete.push(promptId);
      }
    }

    await applyComfyPromptCancellation(promptIdsToDelete, shouldInterrupt, deps);
  } finally {
    deps.comfy.clearQueueSnapshotCache();
  }
}

async function applyComfyPromptCancellation(
  promptIdsToDelete: string[],
  shouldInterrupt: boolean,
  deps: ProjectDeletionDependencies,
) {
  const failures: string[] = [];

  if (promptIdsToDelete.length > 0) {
    await deps.comfy.deleteQueueItems(deps.comfy.apiUrl, promptIdsToDelete).catch((error) => {
      failures.push(error instanceof Error ? error.message : String(error));
    });
  }

  if (shouldInterrupt) {
    await deps.comfy.interruptPrompt(deps.comfy.apiUrl).catch((error) => {
      failures.push(error instanceof Error ? error.message : String(error));
    });
  }

  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

async function cleanupProjectTrashFiles(
  projectId: string,
  deps: ProjectDeletionDependencies,
) {
  const projectBoundary = buildGenerationProjectWhere({ id: projectId });
  const trashedImages = await deps.db.imageResult.findMany({
    where: { run: { projectId, project: projectBoundary }, reviewStatus: "trashed" },
    select: { trashRecord: { select: { id: true, trashPath: true } } },
  });

  const trashRecordIds: string[] = [];
  let deletedTrashFiles = 0;
  const dataBase = resolveDataPath();

  for (const image of trashedImages) {
    if (!image.trashRecord) continue;

    if (image.trashRecord.trashPath) {
      const trashFilePath = resolveProjectPath(image.trashRecord.trashPath);
      if (isPathInsideDirectory(trashFilePath, dataBase)) {
        try {
          await deps.removeTrashFile(trashFilePath);
          deletedTrashFiles++;
        } catch (error) {
          deps.logWarning("Failed to delete trash file", { path: trashFilePath, error });
        }
      } else {
        deps.logWarning("Skipping trash file outside data directory", { path: trashFilePath });
      }
    }

    trashRecordIds.push(image.trashRecord.id);
  }

  if (trashRecordIds.length > 0) {
    await deps.db.trashRecord.deleteMany({ where: { id: { in: trashRecordIds } } });
  }

  return deletedTrashFiles;
}

function emptyDeletionResult(deletedProject: boolean): ProjectDeletionResult {
  return {
    deletedProject,
    cancelledRuns: 0,
    cancelledCensoringTasks: 0,
    deletedManagedDir: false,
    deletedExportDir: false,
    deletedTrashFiles: 0,
    deletedComfyDirs: 0,
  };
}
