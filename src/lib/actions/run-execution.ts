"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  enqueueProjectRuns as enqueueProjectRunsRepo,
  enqueueProjectSectionRun as enqueueProjectSectionRunRepo,
} from "@/server/repositories/project-repository";
import { scheduleQueuedRunsToComfyUI } from "@/server/services/run-executor";
import type { SubmitComfyPromptOptions } from "@/server/services/comfyui-service";

type RunSectionOptions = {
  prioritize?: boolean;
};

type EnqueuedRun = {
  runId: string;
};

function submitQueuedRunsInBackground(
  runs: EnqueuedRun[],
  optionsForRun?: (run: EnqueuedRun) => SubmitComfyPromptOptions,
) {
  return scheduleQueuedRunsToComfyUI(runs, optionsForRun);
}

// ---------------------------------------------------------------------------
// 运行整个项目
// ---------------------------------------------------------------------------

export async function runProject(
  projectId: string,
  overrideBatchSize?: number | null,
) {
  // 1. Create Run records with status="queued" (no comfyPromptId yet)
  const result = await enqueueProjectRunsRepo(
    projectId,
    overrideBatchSize ?? undefined,
  );

  const submission = submitQueuedRunsInBackground(result.runs);

  revalidatePath("/projects");
  revalidatePath("/queue");

  return { ...result, submission };
}

export async function runSections(
  sectionIds: string[],
  overrideBatchSize?: number | null,
) {
  const uniqueSectionIds = Array.from(
    new Set(sectionIds.map((sectionId) => sectionId.trim()).filter(Boolean)),
  );

  if (uniqueSectionIds.length === 0) {
    const submission = submitQueuedRunsInBackground([]);
    return {
      queuedRunCount: 0,
      runs: [],
      submission,
    };
  }

  const sectionOwners = await prisma.projectSection.findMany({
    where: { id: { in: uniqueSectionIds } },
    select: { id: true, projectId: true },
  });
  const projectIdBySectionId = new Map(
    sectionOwners.map((section): [string, string] => [section.id, section.projectId]),
  );

  const results = [];
  for (const sectionId of uniqueSectionIds) {
    const projectId = projectIdBySectionId.get(sectionId);
    if (!projectId) continue;

    results.push(
      await enqueueProjectSectionRunRepo(
        projectId,
        sectionId,
        overrideBatchSize ?? undefined,
      ),
    );
  }

  const runs = results.flatMap((result) => result.runs);
  const submission = submitQueuedRunsInBackground(runs);

  revalidatePath("/projects");
  revalidatePath("/queue");

  return {
    queuedRunCount: runs.length,
    runs,
    submission,
  };
}

// ---------------------------------------------------------------------------
// 运行单个 Section
// ---------------------------------------------------------------------------

export async function runSection(
  sectionId: string,
  overrideBatchSize?: number | null,
  options?: RunSectionOptions,
) {
  // 需要先拿到 projectId，因为 repository 函数需要它
  const pos = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });

  if (!pos) return;

  // 1. Create Run record with status="queued" (no comfyPromptId yet)
  const result = await enqueueProjectSectionRunRepo(
    pos.projectId,
    sectionId,
    overrideBatchSize ?? undefined,
  );
  const runsToSubmit = options?.prioritize
    ? [...result.runs].reverse()
    : result.runs;

  const submission = submitQueuedRunsInBackground(runsToSubmit, () => ({
    front: options?.prioritize === true,
  }));

  revalidatePath("/projects");
  revalidatePath("/queue");

  return { ...result, submission };
}
