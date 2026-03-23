import { JobStatus, Prisma, ReviewStatus } from "@/generated/prisma";
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
  defaultLoraConfig: Prisma.JsonValue | null;
  defaultAspectRatio: string | null;
  defaultBatchSize: number | null;
  defaultSeedPolicy: string | null;
  defaultParams: Prisma.JsonValue | null;
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

type QueuableJobRecord = {
  id: string;
  title: string;
  slug: string;
  status: JobStatus;
  characterPrompt: string;
  characterLoraPath: string;
  scenePrompt: string | null;
  stylePrompt: string | null;
  jobLevelOverrides: Prisma.JsonValue | null;
  character: {
    id: string;
    name: string;
    slug: string;
  };
  scenePreset: {
    id: string;
    name: string;
    slug: string;
  } | null;
  stylePreset: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type EnqueuedRunRecord = {
  id: string;
  runIndex: number;
  status: string;
  createdAt: Date;
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

  return new Map<string, LatestRunRecord>(
    latestRuns.map((run): [string, LatestRunRecord] => [run.id, run]),
  );
}

type MutableInputJsonObject = Record<string, Prisma.InputJsonValue>;

function toInputJsonObject(value: Prisma.JsonValue | null): MutableInputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as MutableInputJsonObject;
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

  return Object.keys(nextOverrides).length > 0
    ? (nextOverrides as Prisma.InputJsonObject)
    : Prisma.DbNull;
}

function resolveJobOverrideString(
  overrides: MutableInputJsonObject,
  key: string,
) {
  const value = overrides[key];
  return typeof value === "string" ? value : null;
}

function resolveJobOverrideInteger(
  overrides: MutableInputJsonObject,
  key: string,
) {
  const value = overrides[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function mergeJsonObjects(
  baseValue: Prisma.JsonValue | null,
  overrideValue: Prisma.JsonValue | null,
) {
  const mergedValue = {
    ...toInputJsonObject(baseValue),
    ...toInputJsonObject(overrideValue),
  };

  return Object.keys(mergedValue).length > 0
    ? (mergedValue as Prisma.InputJsonObject)
    : null;
}

function buildResolvedConfigSnapshot(
  job: QueuableJobRecord,
  position: JobPositionRecord,
): Prisma.InputJsonObject {
  const jobLevelOverrides = toInputJsonObject(job.jobLevelOverrides);
  const resolvedAspectRatio =
    position.aspectRatio ??
    resolveJobOverrideString(jobLevelOverrides, "aspectRatio") ??
    position.positionTemplate.defaultAspectRatio;
  const resolvedBatchSize =
    position.batchSize ??
    resolveJobOverrideInteger(jobLevelOverrides, "batchSize") ??
    position.positionTemplate.defaultBatchSize;
  const resolvedSeedPolicy =
    position.seedPolicy ?? position.positionTemplate.defaultSeedPolicy;

  return {
    job: {
      id: job.id,
      title: job.title,
      slug: job.slug,
    },
    character: {
      id: job.character.id,
      name: job.character.name,
      slug: job.character.slug,
      prompt: job.characterPrompt,
      loraPath: job.characterLoraPath,
    },
    scene: job.scenePreset
      ? {
          id: job.scenePreset.id,
          name: job.scenePreset.name,
          slug: job.scenePreset.slug,
          prompt: job.scenePrompt,
        }
      : null,
    style: job.stylePreset
      ? {
          id: job.stylePreset.id,
          name: job.stylePreset.name,
          slug: job.stylePreset.slug,
          prompt: job.stylePrompt,
        }
      : null,
    position: {
      id: position.id,
      templateId: position.positionTemplateId,
      name: position.positionTemplate.name,
      slug: position.positionTemplate.slug,
      templatePrompt: position.positionTemplate.prompt,
      positivePrompt: position.positivePrompt,
      negativePrompt:
        position.negativePrompt ?? position.positionTemplate.negativePrompt,
    },
    parameters: {
      aspectRatio: resolvedAspectRatio,
      batchSize: resolvedBatchSize,
      seedPolicy: resolvedSeedPolicy,
    },
    loraConfig: mergeJsonObjects(
      position.positionTemplate.defaultLoraConfig,
      position.loraConfig,
    ),
    extraParams: mergeJsonObjects(
      position.positionTemplate.defaultParams,
      position.extraParams,
    ),
  };
}

function serializeEnqueuedRun(
  position: Pick<
    JobPositionRecord,
    "id" | "sortOrder" | "positionTemplateId" | "positionTemplate"
  >,
  run: EnqueuedRunRecord,
) {
  return {
    runId: run.id,
    jobPositionId: position.id,
    positionTemplateId: position.positionTemplateId,
    sortOrder: position.sortOrder,
    positionName: position.positionTemplate.name,
    positionSlug: position.positionTemplate.slug,
    runIndex: run.runIndex,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
  };
}

function cloneJsonValueForCreate(
  value: Prisma.JsonValue | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.DbNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildCopyTitle(title: string, copyNumber: number) {
  return copyNumber === 1 ? `${title} Copy` : `${title} Copy ${copyNumber}`;
}

function buildCopySlug(slug: string, copyNumber: number) {
  return copyNumber === 1 ? `${slug}-copy` : `${slug}-copy-${copyNumber}`;
}

async function resolveUniqueJobCopyIdentity(
  tx: Prisma.TransactionClient,
  job: Pick<QueuableJobRecord, "title" | "slug">,
) {
  for (let copyNumber = 1; copyNumber <= 100; copyNumber += 1) {
    const title = buildCopyTitle(job.title, copyNumber);
    const slug = buildCopySlug(job.slug, copyNumber);
    const existingJob = await tx.completeJob.findFirst({
      where: {
        OR: [{ title }, { slug }],
      },
      select: { id: true },
    });

    if (!existingJob) {
      return { title, slug };
    }
  }

  throw new Error("JOB_COPY_IDENTITY_EXHAUSTED");
}

async function ensureQueuedJobStatus(
  tx: Prisma.TransactionClient,
  job: Pick<QueuableJobRecord, "id" | "status">,
) {
  if (job.status === JobStatus.queued || job.status === JobStatus.running) {
    return job.status;
  }

  const updatedJob = await tx.completeJob.update({
    where: { id: job.id },
    data: { status: JobStatus.queued },
    select: { status: true },
  });

  return updatedJob.status;
}

async function createQueuedRunsForPositions(
  tx: Prisma.TransactionClient,
  job: QueuableJobRecord,
  positions: JobPositionRecord[],
) {
  const positionIds = positions.map((position) => position.id);
  const latestRunIndexes = await tx.positionRun.groupBy({
    by: ["completeJobPositionId"],
    where: {
      completeJobPositionId: { in: positionIds },
    },
    _max: {
      runIndex: true,
    },
  });

  const latestRunIndexByPositionId = new Map<string, number>(
    latestRunIndexes.map((entry): [string, number] => [
      entry.completeJobPositionId,
      entry._max.runIndex ?? 0,
    ]),
  );

  const queuedRuns: Array<ReturnType<typeof serializeEnqueuedRun>> = [];

  for (const position of positions) {
    const createdRun = await tx.positionRun.create({
      data: {
        completeJobId: job.id,
        completeJobPositionId: position.id,
        runIndex: (latestRunIndexByPositionId.get(position.id) ?? 0) + 1,
        status: "queued",
        resolvedConfigSnapshot: buildResolvedConfigSnapshot(job, position),
      },
      select: {
        id: true,
        runIndex: true,
        status: true,
        createdAt: true,
      },
    });

    await tx.completeJobPosition.update({
      where: { id: position.id },
      data: { latestRunId: createdRun.id },
    });

    queuedRuns.push(serializeEnqueuedRun(position, createdRun));
  }

  return queuedRuns;
}

export async function listJobs() {
  const jobs = await db.completeJob.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      character: true,
      scenePreset: true,
      stylePreset: true,
      positions: {
        select: {
          id: true,
          enabled: true,
          latestRunId: true,
        },
      },
    },
    take: 50,
  });

  const latestRunIds = jobs.flatMap((job) =>
    job.positions
      .map((position) => position.latestRunId)
      .filter((runId): runId is string => runId !== null),
  );

  const latestRunsById = await getLatestRunsById(latestRunIds);

  return jobs.map((job) => {
    const latestRun = job.positions
      .map((position) => (position.latestRunId ? latestRunsById.get(position.latestRunId) ?? null : null))
      .filter((run): run is LatestRunRecord => run !== null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

    return {
      id: job.id,
      title: job.title,
      status: job.status,
      updatedAt: job.updatedAt.toISOString(),
      characterName: job.character.name,
      sceneName: job.scenePreset?.name ?? "未设置",
      styleName: job.stylePreset?.name ?? "未设置",
      positionCount: job.positions.length,
      enabledPositionCount: job.positions.filter((position) => position.enabled).length,
      latestRunAt: latestRun?.createdAt.toISOString() ?? null,
      latestRunStatus: latestRun?.status ?? null,
      latestRunPendingCount: latestRun ? summarizeRunImages(latestRun.images).pendingCount : 0,
      latestRunTotalCount: latestRun ? summarizeRunImages(latestRun.images).totalCount : 0,
    };
  });
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

export async function copyJob(jobId: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const job = await tx.completeJob.findUnique({
      where: { id: jobId },
      include: {
        positions: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            positionTemplateId: true,
            sortOrder: true,
            enabled: true,
            positivePrompt: true,
            negativePrompt: true,
            aspectRatio: true,
            batchSize: true,
            seedPolicy: true,
            loraConfig: true,
            extraParams: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error("JOB_NOT_FOUND");
    }

    const identity = await resolveUniqueJobCopyIdentity(tx, job);
    const copiedJob = await tx.completeJob.create({
      data: {
        title: identity.title,
        slug: identity.slug,
        status: JobStatus.draft,
        characterId: job.characterId,
        scenePresetId: job.scenePresetId,
        stylePresetId: job.stylePresetId,
        characterPrompt: job.characterPrompt,
        characterLoraPath: job.characterLoraPath,
        scenePrompt: job.scenePrompt,
        stylePrompt: job.stylePrompt,
        jobLevelOverrides: cloneJsonValueForCreate(job.jobLevelOverrides),
        notes: job.notes,
        positions: {
          create: job.positions.map((position) => ({
            positionTemplateId: position.positionTemplateId,
            sortOrder: position.sortOrder,
            enabled: position.enabled,
            positivePrompt: position.positivePrompt,
            negativePrompt: position.negativePrompt,
            aspectRatio: position.aspectRatio,
            batchSize: position.batchSize,
            seedPolicy: position.seedPolicy,
            loraConfig: cloneJsonValueForCreate(position.loraConfig),
            extraParams: cloneJsonValueForCreate(position.extraParams),
          })),
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        positions: {
          select: { id: true },
        },
      },
    });

    return {
      id: copiedJob.id,
      title: copiedJob.title,
      slug: copiedJob.slug,
      status: copiedJob.status,
      createdAt: copiedJob.createdAt.toISOString(),
      positionCount: copiedJob.positions.length,
    };
  });
}

export async function enqueueJobRuns(jobId: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const job = await tx.completeJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        characterPrompt: true,
        characterLoraPath: true,
        scenePrompt: true,
        stylePrompt: true,
        jobLevelOverrides: true,
        character: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        scenePreset: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        stylePreset: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
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

    if (job.positions.length === 0) {
      throw new Error("JOB_HAS_NO_ENABLED_POSITIONS");
    }

    const runs = await createQueuedRunsForPositions(tx, job, job.positions);
    const jobStatus = await ensureQueuedJobStatus(tx, job);

    return {
      jobId: job.id,
      jobTitle: job.title,
      jobStatus,
      queuedRunCount: runs.length,
      runs,
    };
  });
}

export async function enqueueJobPositionRun(jobId: string, jobPositionId: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const job = await tx.completeJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        characterPrompt: true,
        characterLoraPath: true,
        scenePrompt: true,
        stylePrompt: true,
        jobLevelOverrides: true,
        character: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        scenePreset: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        stylePreset: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error("JOB_NOT_FOUND");
    }

    const position = await tx.completeJobPosition.findFirst({
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

    if (!position.enabled) {
      throw new Error("JOB_POSITION_DISABLED");
    }

    const runs = await createQueuedRunsForPositions(tx, job, [position]);
    const jobStatus = await ensureQueuedJobStatus(tx, job);

    return {
      jobId: job.id,
      jobTitle: job.title,
      jobStatus,
      queuedRunCount: runs.length,
      runs,
    };
  });
}
