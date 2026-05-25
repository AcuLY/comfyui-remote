"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  enqueueProjectRuns as enqueueProjectRunsRepo,
  enqueueProjectSectionRun as enqueueProjectSectionRunRepo,
} from "@/server/repositories/project-repository";
import {
  buildSubmittedRunData,
  submitRunToComfyUI,
  pollRunCompletion,
} from "@/server/services/run-executor";
import { getWorkerRun } from "@/server/worker/repository";
import { logger } from "@/lib/logger";

type RunSectionOptions = {
  prioritize?: boolean;
};

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

  // 2. Submit each created run to ComfyUI synchronously
  let allFailed = true;

  for (const enqueuedRun of result.runs) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const submitResult = await submitRunToComfyUI(run);
      // Store comfyPromptId — now "queued" means "in ComfyUI's queue"
      await prisma.run.update({
        where: { id: run.runId },
        data: buildSubmittedRunData(submitResult),
      });
      // Fire-and-forget: poll for completion
      pollRunCompletion(run.runId).catch((err) => {
        logger.error(
          "pollRunCompletion failed",
          err instanceof Error ? err : new Error(String(err)),
          { runId: run.runId },
        );
      });
      allFailed = false;
    } catch (error) {
      // ComfyUI submission failed — delete the Run record
      console.error(`Failed to submit run ${run.runId} to ComfyUI:`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
    }
  }

  // If all runs were deleted, reset project status from "queued" back to "draft"
  if (allFailed && result.runs.length > 0) {
    await prisma.project
      .update({
        where: { id: projectId },
        data: { status: "draft" },
      })
      .catch(() => {});
  }

  revalidatePath("/projects");
  revalidatePath("/queue");

  if (allFailed && result.runs.length > 0) {
    throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
  }
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

  // 2. Submit to ComfyUI synchronously
  for (const enqueuedRun of runsToSubmit) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const submitResult = await submitRunToComfyUI(run, {
        front: options?.prioritize === true,
      });
      await prisma.run.update({
        where: { id: run.runId },
        data: buildSubmittedRunData(submitResult),
      });
      pollRunCompletion(run.runId).catch((err) => {
        logger.error(
          "pollRunCompletion failed",
          err instanceof Error ? err : new Error(String(err)),
          { runId: run.runId },
        );
      });
    } catch (error) {
      console.error(`Failed to submit run ${run.runId} to ComfyUI:`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
      // Reset project status from "queued" back since the run was deleted
      await prisma.project
        .update({
          where: { id: pos.projectId },
          data: { status: "draft" },
        })
        .catch(() => {});
      throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
    }
  }

  revalidatePath("/projects");
  revalidatePath("/queue");
}
