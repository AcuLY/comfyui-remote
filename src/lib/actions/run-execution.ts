"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  enqueueProjectRuns as enqueueProjectRunsRepo,
  enqueueProjectSectionRun as enqueueProjectSectionRunRepo,
} from "@/server/repositories/project-repository";
import { trySubmitQueuedRunToComfyUI } from "@/server/services/run-executor";

type RunSectionOptions = {
  prioritize?: boolean;
};

type EnqueuedRun = {
  runId: string;
};

function submitQueuedRunsInBackground(
  runs: EnqueuedRun[],
  optionsForRun?: (run: EnqueuedRun) => Parameters<typeof trySubmitQueuedRunToComfyUI>[1],
) {
  void (async () => {
    for (const enqueuedRun of runs) {
      await trySubmitQueuedRunToComfyUI(enqueuedRun.runId, optionsForRun?.(enqueuedRun));
    }
  })().catch((error) => {
    console.error("Failed to submit queued runs to ComfyUI in background:", error);
  });
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

  submitQueuedRunsInBackground(result.runs);

  revalidatePath("/projects");
  revalidatePath("/queue");

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

  submitQueuedRunsInBackground(runsToSubmit, () => ({
    front: options?.prioritize === true,
  }));

  revalidatePath("/projects");
  revalidatePath("/queue");
}
