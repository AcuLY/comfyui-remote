import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { buildResolvedConfigSnapshot } from "@/server/repositories/project-repository/helpers";
import { resolveSectionConfig } from "@/server/prompt-config/section-resolver";
import { validateComfyPromptDraft } from "@/server/services/comfyui-service";
import { buildComfyPromptDraft } from "@/server/worker/payload-builder";
import type { WorkerRunSnapshot } from "@/server/worker/types";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";

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
  const project = await db.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
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
      project: buildGenerationProjectWhere({ id: projectId }),
    },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      enabled: true,
    },
  });

  if (!section) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  const latestRunIndex = await db.run.aggregate({
    where: {
      projectSectionId: sectionId,
      project: buildGenerationProjectWhere({ id: projectId }),
    },
    _max: { runIndex: true },
  });

  const resolvedConfig = await resolveSectionConfig(section.id);
  if (!resolvedConfig) {
    throw new Error("JOB_POSITION_CONFIG_NOT_FOUND");
  }

  const resolvedConfigSnapshot = buildResolvedConfigSnapshot(
    project,
    section,
    resolvedConfig,
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
