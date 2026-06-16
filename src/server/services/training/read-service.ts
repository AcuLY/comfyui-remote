import type {
  LoraTrainingRun,
  LoraTrainingTaskKind,
  LoraTrainingTaskStatus,
  TrainingImage,
} from "@/features/training/types";
import { toImageUrl } from "@/lib/image-url";
import {
  getTrainingWorkerQueueStatus,
  mapTrainingWorkerTaskError,
} from "@/server/worker/training/task-api";
import {
  getTrainingSceneDescriptionPreset,
  listTrainingSceneDescriptionPresets,
} from "@/server/services/training/preset-service";
import {
  listTrainingTemplates as listTrainingTemplatesFromPrisma,
} from "@/server/services/training/template-service";
import {
  getTrainingGenerationRun as getTrainingGenerationRunRecord,
} from "@/server/repositories/training/snapshot";
import {
  listTrainingProjectOrderIds,
  orderTrainingProjectsByStoredIds,
} from "@/server/services/training/project-order-service";
import { listHiddenTrainingRunIds } from "@/server/services/training/run-visibility-service";
import { loadTrainingSnapshot } from "@/server/services/training/snapshot-service";

export class TrainingReadServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingReadServiceError";
    this.status = status;
    this.details = details;
  }
}

function filterRuns(
  runs: LoraTrainingRun[],
  filters: {
    kind?: LoraTrainingTaskKind;
    projectId?: string;
    sectionId?: string;
    status?: LoraTrainingTaskStatus;
  },
) {
  return runs.filter((run) => {
    if (filters.kind && run.kind !== filters.kind) return false;
    if (filters.projectId && run.projectId !== filters.projectId) return false;
    if (filters.sectionId && run.sectionId !== filters.sectionId) return false;
    if (filters.status && run.status !== filters.status) return false;
    return true;
  });
}

export async function listTrainingProjects(filters: { status?: string } = {}) {
  const snapshot = await loadTrainingSnapshot();
  const projects = snapshot.projects.filter((project) => {
    if (!filters.status) return true;
    return project.status === filters.status;
  });
  return orderTrainingProjectsByStoredIds(projects, await listTrainingProjectOrderIds());
}

export async function getTrainingProject(projectId: string) {
  const snapshot = await loadTrainingSnapshot();
  const project = snapshot.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new TrainingReadServiceError("Training project not found", 404, { projectId });
  }
  return project;
}

export async function getTrainingDatasetRevision(revisionId: string) {
  const snapshot = await loadTrainingSnapshot();
  for (const project of snapshot.projects) {
    const revision = project.datasetRevisions.find((item) => item.id === revisionId);
    if (revision) {
      return {
        ...revision,
        projectId: project.id,
      };
    }
  }

  throw new TrainingReadServiceError("Training dataset revision not found", 404, { revisionId });
}

export async function getTrainingDatasetReadiness(projectId: string) {
  const project = await getTrainingProject(projectId);
  return {
    projectId: project.id,
    readiness: project.readiness,
    readyForTraining: project.status !== "archived" && project.keptCount > 0 && project.captionMissingCount === 0,
    keptCount: project.keptCount,
    captionMissingCount: project.captionMissingCount,
    datasetVersion: project.datasetVersion,
    referenceImageCount: project.referenceImages.length,
    sectionCount: project.sections.length,
  };
}

export async function getTrainingSectionSceneDescription(sectionId: string, projectId?: string | null) {
  const { project, section } = await getTrainingSectionContext(sectionId, projectId);
  return {
    projectId: project.id,
    sectionId,
    text: section.resolvedScene,
    blocks: section.blocks,
  };
}

export async function getTrainingSectionContext(sectionId: string, projectId?: string | null) {
  if (projectId) {
    const project = await getTrainingProject(projectId);
    const section = project.sections.find((item) => item.id === sectionId);
    if (section) {
      return { project, section };
    }

    throw new TrainingReadServiceError("Training section not found", 404, { projectId, sectionId });
  }

  const snapshot = await loadTrainingSnapshot();
  for (const project of snapshot.projects) {
    const section = project.sections.find((item) => item.id === sectionId);
    if (section) {
      return { project, section };
    }
  }

  throw new TrainingReadServiceError("Training section not found", 404, { sectionId });
}

export async function getTrainingBlockContext(blockId: string, projectId?: string | null) {
  if (projectId) {
    const project = await getTrainingProject(projectId);
    for (const section of project.sections) {
      const block = section.blocks.find((item) => item.id === blockId);
      if (block) {
        return { project, section, block };
      }
    }

    throw new TrainingReadServiceError("Training section block not found", 404, { blockId, projectId });
  }

  const snapshot = await loadTrainingSnapshot();
  for (const project of snapshot.projects) {
    for (const section of project.sections) {
      const block = section.blocks.find((item) => item.id === blockId);
      if (block) {
        return { project, section, block };
      }
    }
  }

  throw new TrainingReadServiceError("Training section block not found", 404, { blockId });
}

export async function listTrainingRuns(filters: {
  kind?: LoraTrainingTaskKind;
  projectId?: string;
  sectionId?: string;
  status?: LoraTrainingTaskStatus;
} = {}) {
  const snapshot = await loadTrainingSnapshot();
  const hiddenRunIds = new Set(await listHiddenTrainingRunIds());
  return filterRuns(snapshot.runs, filters).filter((run) => !hiddenRunIds.has(run.id));
}

function normalizeGenerationStatus(status: string): LoraTrainingTaskStatus {
  if (status === "done") return "completed";
  if (status === "running") return "running";
  if (status === "queued") return "queued";
  if (status === "cancelled" || status === "canceled") return "cancelled" as LoraTrainingTaskStatus;
  return "failed";
}

async function getTrainingGenerationRunDirect(runId: string): Promise<LoraTrainingRun | null> {
  const generationRun = await getTrainingGenerationRunRecord(runId);
  if (!generationRun) return null;

  const project = await getTrainingProject(generationRun.jobId);
  const section = generationRun.sectionId
    ? project.sections.find((item) => item.id === generationRun.sectionId) ?? null
    : null;

  const taskInputImages: TrainingImage[] = generationRun.inputImages.flatMap((inputImage, index) => {
    const url = toImageUrl(inputImage.relativePath);
    if (!url) return [];
    return [{
      id: `${generationRun.id}-input-${index + 1}`,
      src: url,
      full: url,
      label: inputImage.role,
      status: "pending",
      featured: false,
      featured2: false,
      cover: false,
      width: null,
      height: null,
    }];
  });

  return {
    id: generationRun.id,
    kind: "generation",
    status: normalizeGenerationStatus(generationRun.status),
    projectId: project.id,
    sectionId: generationRun.sectionId ?? undefined,
    projectTitle: project.title,
    title: section ? `${section.title} 图片生成` : "训练图片生成",
    summary: section ? `图片 · 小节 ${section.title}` : "图片生成",
    timestamp: generationRun.finishedAt ?? generationRun.startedAt ?? generationRun.createdAt,
    provider: generationRun.imageModel ?? generationRun.hostModel ?? generationRun.provider ?? undefined,
    finalInput: generationRun.visualPrompt ?? generationRun.hostInstruction ?? undefined,
    inputImages: [
      ...project.referenceImages.map((reference) => reference.image),
      ...taskInputImages,
    ],
    errorMessage: typeof generationRun.errorSummary === "string" ? generationRun.errorSummary : undefined,
    outputLabel: `输出 ${generationRun.counts.candidateImages} 张图片`,
    outputResultIds: [],
  };
}

export async function getTrainingRun(runId: string, kind?: LoraTrainingTaskKind) {
  if ((await listHiddenTrainingRunIds()).includes(runId)) {
    throw new TrainingReadServiceError("Training run not found", 404, { runId, kind: kind ?? null });
  }

  const snapshot = await loadTrainingSnapshot();
  const run = snapshot.runs.find((item) => item.id === runId && (!kind || item.kind === kind));
  if (!run && kind === "generation") {
    const directGenerationRun = await getTrainingGenerationRunDirect(runId);
    if (directGenerationRun) return directGenerationRun;
  }
  if (!run) {
    throw new TrainingReadServiceError("Training run not found", 404, { runId, kind: kind ?? null });
  }
  return run;
}

export async function listTrainingGenerationOutputs(taskId: string) {
  const run = await getTrainingRun(taskId, "generation");
  const project = await getTrainingProject(run.projectId);
  const outputIds = run.outputResultIds ?? [];
  if (outputIds.length === 0) return [];
  return outputIds
    .map((outputId) => project.resultPool.find((result) => result.id === outputId))
    .filter((result): result is NonNullable<typeof result> => Boolean(result));
}

export async function listTrainingPresets() {
  return listTrainingSceneDescriptionPresets();
}

export async function getTrainingPreset(presetId: string) {
  return getTrainingSceneDescriptionPreset(presetId);
}

export async function listTrainingTemplates() {
  return listTrainingTemplatesFromPrisma();
}

export async function getTrainingSchedulerStatus() {
  const snapshot = await loadTrainingSnapshot();

  try {
    const workerQueueStatus = await getTrainingWorkerQueueStatus();
    return {
      workerQueueStatus,
      summary: {
        generationRunCount: snapshot.runs.filter((run) => run.kind === "generation").length,
        projectCount: snapshot.projects.length,
        runCount: snapshot.runs.length,
        trainingRunCount: snapshot.runs.filter((run) => run.kind === "training").length,
      },
    };
  } catch (error) {
    const mapped = mapTrainingWorkerTaskError(error);
    return {
      workerQueueStatus: {
        error: mapped.message,
        details: mapped.details,
        unavailable: true,
      },
      summary: {
        generationRunCount: snapshot.runs.filter((run) => run.kind === "generation").length,
        projectCount: snapshot.projects.length,
        runCount: snapshot.runs.length,
        trainingRunCount: snapshot.runs.filter((run) => run.kind === "training").length,
      },
    };
  }
}

export function mapTrainingReadError(error: unknown) {
  if (error instanceof TrainingReadServiceError) {
    return {
      details: error.details,
      message: error.message,
      status: error.status,
    };
  }

  return {
    details: error instanceof Error ? error.message : String(error),
    message: "Unexpected training read error",
    status: 500,
  };
}
