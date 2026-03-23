import { Prisma, ReviewStatus } from "@/generated/prisma";
import { db } from "@/lib/db";

export type JobUpdateInput = {
  characterPrompt?: string;
  scenePrompt?: string | null;
  stylePrompt?: string | null;
  characterLoraPath?: string;
  aspectRatio?: string | null;
  batchSize?: number | null;
};

export type JobPositionUpdateInput = {
  positivePrompt?: string | null;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  batchSize?: number | null;
  seedPolicy?: string | null;
};

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

type PositionTemplateRecord = {
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string | null;
  defaultAspectRatio: string | null;
  defaultBatchSize: number | null;
  defaultSeedPolicy: string | null;
};

type JobPositionRecord = {
  id: string;
  sortOrder: number;
  enabled: boolean;
  latestRunId: string | null;
  positionTemplateId: string;
  positivePrompt: string | null;
  negativePrompt: string | null;
  aspectRatio: string | null;
  batchSize: number | null;
  seedPolicy: string | null;
  loraConfig: Prisma.JsonValue | null;
  extraParams: Prisma.JsonValue | null;
  positionTemplate: PositionTemplateRecord;
  runs: LatestRunRecord[];
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

function resolveLatestRun(
  position: Pick<JobPositionRecord, "latestRunId" | "runs">,
  latestRunsById: Map<string, LatestRunRecord>,
) {
  const fallbackLatestRun = position.runs[0] ?? null;

  return (
    (position.latestRunId ? latestRunsById.get(position.latestRunId) : undefined) ??
    fallbackLatestRun
  );
}

function serializeJobPosition(
  position: JobPositionRecord,
  latestRunsById: Map<string, LatestRunRecord>,
) {
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
    latestRun: serializeLatestRun(resolveLatestRun(position, latestRunsById)),
  };
}

async function getLatestRunsById(latestRunIds: string[]) {
  if (latestRunIds.length === 0) {
    return new Map<string, LatestRunRecord>();
  }

  const latestRuns = await db.positionRun.findMany({
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
  });

  return new Map(latestRuns.map((run) => [run.id, run]));
}

function toInputJsonObject(value: Prisma.JsonValue | null): Prisma.InputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function buildJobLevelOverridesUpdate(
  currentValue: Prisma.JsonValue | null,
  input: JobUpdateInput,
) {
  if (input.aspectRatio === undefined && input.batchSize === undefined) {
    return undefined;
  }

  const nextOverrides = toInputJsonObject(currentValue);

  if (input.aspectRatio !== undefined) {
    if (input.aspectRatio === null) {
      delete nextOverrides.aspectRatio;
    } else {
      nextOverrides.aspectRatio = input.aspectRatio;
    }
  }

  if (input.batchSize !== undefined) {
    if (input.batchSize === null) {
      delete nextOverrides.batchSize;
    } else {
      nextOverrides.batchSize = input.batchSize;
    }
  }

  return Object.keys(nextOverrides).length > 0 ? nextOverrides : Prisma.DbNull;
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

  const latestRunsById = await getLatestRunsById(latestRunIds);

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
    positions: job.positions.map((position) => serializeJobPosition(position, latestRunsById)),
  };
}

export async function getJobPositionDetail(jobId: string, jobPositionId: string) {
  const position = await db.completeJobPosition.findFirst({
    where: {
      id: jobPositionId,
      completeJobId: jobId,
    },
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
  });

  if (!position) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  const latestRunIds = position.latestRunId ? [position.latestRunId] : [];
  const latestRunsById = await getLatestRunsById(latestRunIds);

  return serializeJobPosition(position, latestRunsById);
}

export async function updateJob(jobId: string, input: JobUpdateInput) {
  const job = await db.completeJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobLevelOverrides: true,
    },
  });

  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }

  const data: Prisma.CompleteJobUpdateInput = {};

  if (input.characterPrompt !== undefined) {
    data.characterPrompt = input.characterPrompt;
  }

  if (input.scenePrompt !== undefined) {
    data.scenePrompt = input.scenePrompt;
  }

  if (input.stylePrompt !== undefined) {
    data.stylePrompt = input.stylePrompt;
  }

  if (input.characterLoraPath !== undefined) {
    data.characterLoraPath = input.characterLoraPath;
  }

  const jobLevelOverrides = buildJobLevelOverridesUpdate(job.jobLevelOverrides, input);
  if (jobLevelOverrides !== undefined) {
    data.jobLevelOverrides = jobLevelOverrides;
  }

  await db.completeJob.update({
    where: { id: jobId },
    data,
  });

  return getJobDetail(jobId);
}

export async function updateJobPosition(
  jobId: string,
  jobPositionId: string,
  input: JobPositionUpdateInput,
) {
  const job = await db.completeJob.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!job) {
    throw new Error("JOB_NOT_FOUND");
  }

  const position = await db.completeJobPosition.findFirst({
    where: {
      id: jobPositionId,
      completeJobId: jobId,
    },
    select: { id: true },
  });

  if (!position) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  const data: Prisma.CompleteJobPositionUpdateInput = {};

  if (input.positivePrompt !== undefined) {
    data.positivePrompt = input.positivePrompt;
  }

  if (input.negativePrompt !== undefined) {
    data.negativePrompt = input.negativePrompt;
  }

  if (input.aspectRatio !== undefined) {
    data.aspectRatio = input.aspectRatio;
  }

  if (input.batchSize !== undefined) {
    data.batchSize = input.batchSize;
  }

  if (input.seedPolicy !== undefined) {
    data.seedPolicy = input.seedPolicy;
  }

  await db.completeJobPosition.update({
    where: { id: jobPositionId },
    data,
  });

  return getJobPositionDetail(jobId, jobPositionId);
}
