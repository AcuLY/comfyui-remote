import { env } from "@/lib/env";
import { db } from "@/lib/db";
import {
  buildResolvedConfigSnapshot,
  type ProjectSectionRecord,
  type QueuableProjectRecord,
} from "@/server/repositories/project-repository/helpers";
import { validateComfyPromptDraft } from "@/server/services/comfyui-service";
import { buildComfyPromptDraft } from "@/server/worker/payload-builder";
import type { WorkerRunSnapshot } from "@/server/worker/types";

function sectionSlug(sortOrder: number) {
  return `section_${sortOrder + 1}`;
}

function buildDownloadRunId(sectionId: string) {
  return `download-${sectionId}`;
}

function buildWorkflowFileStem(projectTitle: string, sectionName: string, sortOrder: number) {
  return `${projectTitle}-${sortOrder + 1}.${sectionName}-workflow`;
}

export async function buildCurrentSectionWorkflow(projectId: string, sectionId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      projectLevelOverrides: true,
      checkpointName: true,
    },
  });

  if (!project) {
    throw new Error("JOB_NOT_FOUND");
  }

  const section = await db.projectSection.findFirst({
    where: {
      id: sectionId,
      projectId,
    },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      enabled: true,
      latestRunId: true,
      positivePrompt: true,
      negativePrompt: true,
      aspectRatio: true,
      shortSidePx: true,
      batchSize: true,
      seedPolicy1: true,
      seedPolicy2: true,
      ksampler1: true,
      ksampler2: true,
      upscaleFactor: true,
      checkpointName: true,
      loraConfig: true,
      extraParams: true,
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          positive: true,
          negative: true,
          type: true,
          categoryId: true,
          sourceId: true,
          label: true,
        },
      },
    },
  });

  if (!section) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  const latestRunIndex = await db.run.aggregate({
    where: { projectSectionId: sectionId },
    _max: { runIndex: true },
  });

  const sectionRecord: ProjectSectionRecord = {
    ...section,
    runs: [],
  };
  const projectRecord: QueuableProjectRecord = project;
  const resolvedConfigSnapshot = buildResolvedConfigSnapshot(
    projectRecord,
    sectionRecord,
    sectionRecord.promptBlocks,
  ) as unknown as WorkerRunSnapshot["resolvedConfigSnapshot"];
  const fallbackSectionName = sectionSlug(section.sortOrder);
  const sectionName = section.name ?? fallbackSectionName;
  const run: WorkerRunSnapshot = {
    runId: buildDownloadRunId(section.id),
    runIndex: (latestRunIndex._max.runIndex ?? 0) + 1,
    status: "draft",
    workflowId: project.slug,
    comfyApiUrl: env.comfyApiUrl,
    outputDir: null,
    resolvedConfigSnapshot,
    project: {
      id: project.id,
      title: project.title,
      slug: project.slug,
    },
    section: {
      id: section.id,
      name: sectionName,
      slug: fallbackSectionName,
    },
  };
  const promptDraft = buildComfyPromptDraft(run);
  const validatedDraft = await validateComfyPromptDraft(env.comfyApiUrl, promptDraft);

  return {
    workflow: validatedDraft.apiPrompt,
    fileStem: buildWorkflowFileStem(project.title, sectionName, section.sortOrder),
  };
}
