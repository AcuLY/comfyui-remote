import { ReviewStatus } from "@/generated/prisma";
import { db } from "@/lib/db";

type LatestRunRecord = {
  id: string;
  runIndex: number;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  outputDir: string | null;
  errorMessage: string | null;
  images: Array<{ reviewStatus: ReviewStatus }>;
};

function toIsoString(value: Date | null) {
  return value?.toISOString() ?? null;
}

function summarizeRunImages(images: Array<{ reviewStatus: ReviewStatus }>) {
  const summary = {
    totalCount: images.length,
    pendingCount: 0,
    keptCount: 0,
    trashedCount: 0,
  };

  for (const image of images) {
    switch (image.reviewStatus) {
      case ReviewStatus.pending:
        summary.pendingCount += 1;
        break;
      case ReviewStatus.kept:
        summary.keptCount += 1;
        break;
      case ReviewStatus.trashed:
        summary.trashedCount += 1;
        break;
    }
  }

  return summary;
}

function serializeLatestRun(run: LatestRunRecord | null) {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    runIndex: run.runIndex,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    startedAt: toIsoString(run.startedAt),
    finishedAt: toIsoString(run.finishedAt),
    outputDir: run.outputDir,
    errorMessage: run.errorMessage,
    ...summarizeRunImages(run.images),
  };
}

export async function listJobs() {
  const jobs = await db.completeJob.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      character: true,
      scenePreset: true,
      stylePreset: true,
      positions: true,
    },
    take: 50,
  });

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    updatedAt: job.updatedAt.toISOString(),
    characterName: job.character.name,
    sceneName: job.scenePreset?.name ?? "未设置",
    styleName: job.stylePreset?.name ?? "未设置",
    positionCount: job.positions.length,
  }));
}

export async function getJobDetail(jobId: string) {
  const job = await db.completeJob.findUnique({
    where: { id: jobId },
    include: {
      character: true,
      scenePreset: true,
      stylePreset: true,
      _count: {
        select: { positions: true },
      },
      positions: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          positionTemplate: true,
          runs: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              runIndex: true,
              status: true,
              createdAt: true,
              startedAt: true,
              finishedAt: true,
              outputDir: true,
              errorMessage: true,
              images: {
                select: {
                  reviewStatus: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }

  const latestRunIds = job.positions
    .map((position) => position.latestRunId)
    .filter((runId): runId is string => runId !== null);

  const latestRuns = latestRunIds.length
    ? await db.positionRun.findMany({
        where: {
          id: { in: latestRunIds },
        },
        select: {
          id: true,
          runIndex: true,
          status: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          outputDir: true,
          errorMessage: true,
          images: {
            select: {
              reviewStatus: true,
            },
          },
        },
      })
    : [];

  const latestRunsById = new Map(latestRuns.map((run) => [run.id, run]));

  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    notes: job.notes,
    characterName: job.character.name,
    sceneName: job.scenePreset?.name ?? "未设置",
    styleName: job.stylePreset?.name ?? "未设置",
    positionCount: job._count.positions,
    enabledPositionCount: job.positions.length,
    promptOverview: {
      characterPrompt: job.characterPrompt,
      scenePrompt: job.scenePrompt,
      stylePrompt: job.stylePrompt,
      characterLoraPath: job.characterLoraPath,
      jobLevelOverrides: job.jobLevelOverrides,
    },
    character: {
      id: job.character.id,
      name: job.character.name,
      slug: job.character.slug,
      prompt: job.character.prompt,
      loraPath: job.character.loraPath,
      notes: job.character.notes,
    },
    scenePreset: job.scenePreset
      ? {
          id: job.scenePreset.id,
          name: job.scenePreset.name,
          slug: job.scenePreset.slug,
          prompt: job.scenePreset.prompt,
          notes: job.scenePreset.notes,
        }
      : null,
    stylePreset: job.stylePreset
      ? {
          id: job.stylePreset.id,
          name: job.stylePreset.name,
          slug: job.stylePreset.slug,
          prompt: job.stylePreset.prompt,
          notes: job.stylePreset.notes,
        }
      : null,
    positions: job.positions.map((position) => {
      const fallbackLatestRun = position.runs[0] ?? null;
      const latestRun =
        (position.latestRunId ? latestRunsById.get(position.latestRunId) : undefined) ??
        fallbackLatestRun;

      return {
        id: position.id,
        sortOrder: position.sortOrder,
        enabled: position.enabled,
        latestRunId: position.latestRunId,
        positionTemplateId: position.positionTemplateId,
        name: position.positionTemplate.name,
        slug: position.positionTemplate.slug,
        aspectRatio: position.aspectRatio ?? position.positionTemplate.defaultAspectRatio,
        batchSize: position.batchSize ?? position.positionTemplate.defaultBatchSize,
        seedPolicy: position.seedPolicy ?? position.positionTemplate.defaultSeedPolicy,
        loraConfig: position.loraConfig,
        extraParams: position.extraParams,
        promptOverview: {
          templatePrompt: position.positionTemplate.prompt,
          positivePrompt: position.positivePrompt,
          negativePrompt: position.negativePrompt ?? position.positionTemplate.negativePrompt,
        },
        latestRun: serializeLatestRun(latestRun),
      };
    }),
  };
}
