import { buildLoraTrainingDemoData } from "@/app/design-demos/data/lora-training";
import type {
  LoraTrainingRun,
  LoraTrainingTaskKind,
  LoraTrainingTaskStatus,
} from "@/app/design-demos/data/lora-training-types";
import { loadTrainingRouteData } from "@/app/training/load-training-route-data";
import {
  getCharacterLoraWorkerQueueStatus,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";
import {
  getTrainingSceneDescriptionPreset,
  listTrainingSceneDescriptionPresets,
} from "@/server/services/training/preset-service";

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

async function loadTrainingSnapshot() {
  const demoData = await loadTrainingRouteData();
  return buildLoraTrainingDemoData(demoData);
}

function filterRuns(
  runs: LoraTrainingRun[],
  filters: {
    kind?: LoraTrainingTaskKind;
    projectId?: string;
    status?: LoraTrainingTaskStatus;
  },
) {
  return runs.filter((run) => {
    if (filters.kind && run.kind !== filters.kind) return false;
    if (filters.projectId && run.projectId !== filters.projectId) return false;
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
  return projects;
}

export async function getTrainingProject(projectId: string) {
  const snapshot = await loadTrainingSnapshot();
  const project = snapshot.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new TrainingReadServiceError("Training project not found", 404, { projectId });
  }
  return project;
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

export async function getTrainingSectionSceneDescription(sectionId: string) {
  const snapshot = await loadTrainingSnapshot();
  for (const project of snapshot.projects) {
    const section = project.sections.find((item) => item.id === sectionId);
    if (section) {
      return {
        projectId: project.id,
        sectionId,
        text: section.resolvedScene,
        blocks: section.blocks,
      };
    }
  }

  throw new TrainingReadServiceError("Training section not found", 404, { sectionId });
}

export async function listTrainingRuns(filters: {
  kind?: LoraTrainingTaskKind;
  projectId?: string;
  status?: LoraTrainingTaskStatus;
} = {}) {
  const snapshot = await loadTrainingSnapshot();
  return filterRuns(snapshot.runs, filters);
}

export async function getTrainingRun(runId: string, kind?: LoraTrainingTaskKind) {
  const snapshot = await loadTrainingSnapshot();
  const run = snapshot.runs.find((item) => item.id === runId && (!kind || item.kind === kind));
  if (!run) {
    throw new TrainingReadServiceError("Training run not found", 404, { runId, kind: kind ?? null });
  }
  return run;
}

export async function listTrainingPresets() {
  return listTrainingSceneDescriptionPresets();
}

export async function getTrainingPreset(presetId: string) {
  return getTrainingSceneDescriptionPreset(presetId);
}

export async function listTrainingTemplates() {
  const snapshot = await loadTrainingSnapshot();
  return snapshot.templates;
}

export async function getTrainingSchedulerStatus() {
  const snapshot = await loadTrainingSnapshot();

  try {
    const workerQueueStatus = await getCharacterLoraWorkerQueueStatus();
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
    const mapped = mapCharacterLoraPhase3Error(error);
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
