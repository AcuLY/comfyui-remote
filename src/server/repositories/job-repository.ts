import { Prisma } from "@/generated/prisma";
import { JobStatus, ReviewStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";
import { detectProvider } from "@/lib/prisma";

export type JobUpdateInput = {
  characterPrompt?: string;
  scenePrompt?: string | null;
  stylePrompt?: string | null;
  characterLoraPath?: string;
  aspectRatio?: string | null;
  batchSize?: number | null;
};

export type JobCreateInput = {
  title: string;
  characterId: string;
  scenePresetId: string | null;
  stylePresetId: string | null;
  positionTemplateIds?: string[];
  notes: string | null;
};

export type JobPositionUpdateInput = {
  positivePrompt?: string | null;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  shortSidePx?: number | null;
  batchSize?: number | null;
  seedPolicy?: string | null;
};

export type ListJobsFilters = {
  status?: JobStatus;
  search?: string;
  enabledOnly?: boolean;
  hasPending?: boolean;
};

export type JobCreateOptions = {
  characters: Array<{ id: string; name: string; slug: string }>;
  scenePresets: Array<{ id: string; name: string; slug: string }>;
  stylePresets: Array<{ id: string; name: string; slug: string }>;
  positionTemplates: Array<{ id: string; name: string; slug: string; enabled: boolean }>;
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
  images: Array<{ reviewStatus: string }>;
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

type PromptBlockSummaryRecord = {
  positive: string;
  negative: string | null;
};

type JobPositionRecord = {
  id: string;
  sortOrder: number;
  enabled: boolean;
  latestRunId: string | null;
  positionTemplateId: string | null;
  positivePrompt: string | null;
  negativePrompt: string | null;
  aspectRatio: string | null;
  batchSize: number | null;
  seedPolicy: string | null;
  loraConfig: Prisma.JsonValue | null;
  extraParams: Prisma.JsonValue | null;
  positionTemplate: PositionTemplateRecord | null;
  runs: LatestRunRecord[];
  promptBlocks: PromptBlockSummaryRecord[];
};

type QueuableJobRecord = {
  id: string;
  title: string;
  slug: string;
  status: string;
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

function summarizeRunImages(images: Array<{ reviewStatus: string }>) {
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
    name: position.positionTemplate?.name ?? null,
    slug: position.positionTemplate?.slug ?? null,
    aspectRatio: position.aspectRatio ?? position.positionTemplate?.defaultAspectRatio ?? null,
    batchSize: position.batchSize ?? position.positionTemplate?.defaultBatchSize ?? null,
    seedPolicy: position.seedPolicy ?? position.positionTemplate?.defaultSeedPolicy ?? null,
    loraConfig: position.loraConfig,
    extraParams: position.extraParams,
    promptOverview: {
      templatePrompt: position.positionTemplate?.prompt ?? null,
      positivePrompt: position.positivePrompt,
      negativePrompt: position.negativePrompt ?? position.positionTemplate?.negativePrompt ?? null,
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
  blocks?: Array<{
    positive: string;
    negative: string | null;
  }>,
  overrideBatchSize?: number,
): Prisma.InputJsonObject {
  const jobLevelOverrides = toInputJsonObject(job.jobLevelOverrides);
  const resolvedAspectRatio =
    position.aspectRatio ??
    resolveJobOverrideString(jobLevelOverrides, "aspectRatio") ??
    position.positionTemplate?.defaultAspectRatio ??
    null;
  const resolvedShortSidePx =
    position.shortSidePx ??
    resolveJobOverrideInteger(jobLevelOverrides, "shortSidePx") ??
    position.positionTemplate?.defaultShortSidePx ??
    null;
  const resolvedBatchSize =
    overrideBatchSize ??
    position.batchSize ??
    resolveJobOverrideInteger(jobLevelOverrides, "batchSize") ??
    position.positionTemplate?.defaultBatchSize ??
    null;
  const resolvedSeedPolicy =
    position.seedPolicy ?? position.positionTemplate?.defaultSeedPolicy ?? null;

  // Compose final prompt from blocks (v0.2) or legacy fallback
  const promptDraft = buildResolvedPromptDraft(job, position, blocks);

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
      name: position.positionTemplate?.name ?? null,
      slug: position.positionTemplate?.slug ?? null,
      templatePrompt: position.positionTemplate?.prompt ?? null,
      positivePrompt: position.positivePrompt,
      negativePrompt:
        position.negativePrompt ?? position.positionTemplate?.negativePrompt ?? null,
    },
    promptBlocks: blocks ?? null,
    composedPrompt: promptDraft,
    parameters: {
      aspectRatio: resolvedAspectRatio,
      shortSidePx: resolvedShortSidePx,
      batchSize: resolvedBatchSize,
      seedPolicy: resolvedSeedPolicy,
    },
    loraConfig: mergeJsonObjects(
      position.positionTemplate?.defaultLoraConfig ?? null,
      position.loraConfig,
    ),
    extraParams: mergeJsonObjects(
      position.positionTemplate?.defaultParams ?? null,
      position.extraParams,
    ),
  };
}

function buildResolvedPromptDraft(
  job: Pick<
    QueuableJobRecord,
    "characterPrompt" | "scenePrompt" | "stylePrompt"
  >,
  position: Pick<
    JobPositionRecord,
    "positivePrompt" | "negativePrompt" | "positionTemplate"
  >,
  blocks?: Array<{
    positive: string;
    negative: string | null;
  }>,
) {
  if (blocks && blocks.length > 0) {
    // Block-based prompt composition (v0.2)
    const positiveParts = blocks
      .map((b) => b.positive)
      .filter((v): v is string => Boolean(v && v.trim()));
    const negativeParts = blocks
      .map((b) => b.negative)
      .filter((v): v is string => Boolean(v && v.trim()));

    return {
      positive: positiveParts.join(", "),
      negative: negativeParts.length > 0 ? negativeParts.join(", ") : null,
    };
  }

  // Legacy fallback (pre-block positions)
  return {
    positive: [
      job.characterPrompt,
      job.scenePrompt,
      job.stylePrompt,
      position.positionTemplate?.prompt,
      position.positivePrompt,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(", "),
    negative: position.negativePrompt ?? position.positionTemplate?.negativePrompt ?? null,
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
    positionName: position.positionTemplate?.name ?? null,
    positionSlug: position.positionTemplate?.slug ?? null,
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

function slugifyJobTitle(title: string) {
  const normalizedTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalizedTitle
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "job";
}

function buildUniqueJobSlug(baseSlug: string, suffixNumber: number) {
  return suffixNumber === 1 ? baseSlug : `${baseSlug}-${suffixNumber}`;
}

async function resolveUniqueJobSlug(
  tx: Prisma.TransactionClient,
  title: string,
) {
  const baseSlug = slugifyJobTitle(title);

  for (let suffixNumber = 1; suffixNumber <= 100; suffixNumber += 1) {
    const slug = buildUniqueJobSlug(baseSlug, suffixNumber);
    const existingJob = await tx.completeJob.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existingJob) {
      return slug;
    }
  }

  throw new Error("JOB_SLUG_EXHAUSTED");
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
  overrideBatchSize?: number,
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
        resolvedConfigSnapshot: buildResolvedConfigSnapshot(job, position, undefined, overrideBatchSize),
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

export async function listJobs(filters: ListJobsFilters = {}) {
  const search = filters.search?.trim();
  // SQLite LIKE is case-insensitive for ASCII by default;
  // PostgreSQL requires explicit mode: "insensitive".
  const ciContains = (value: string) =>
    detectProvider() === "postgresql"
      ? { contains: value, mode: "insensitive" as const }
      : { contains: value };

  const jobs = await db.completeJob.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { title: ciContains(search) },
              { slug: ciContains(search) },
              { character: { name: ciContains(search) } },
              { scenePreset: { is: { name: ciContains(search) } } },
              { stylePreset: { is: { name: ciContains(search) } } },
            ],
          }
        : {}),
      ...(filters.enabledOnly
        ? {
            positions: {
              some: {
                enabled: true,
              },
            },
          }
        : {}),
    },
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

  const serializedJobs = jobs.map((job) => {
    const latestRun = job.positions
      .map((position) => (position.latestRunId ? latestRunsById.get(position.latestRunId) ?? null : null))
      .filter((run): run is LatestRunRecord => run !== null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

    const latestRunSummary = latestRun ? summarizeRunImages(latestRun.images) : null;

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
      latestRunPendingCount: latestRunSummary?.pendingCount ?? 0,
      latestRunTotalCount: latestRunSummary?.totalCount ?? 0,
    };
  });

  if (filters.hasPending) {
    return serializedJobs.filter((job) => job.latestRunPendingCount > 0);
  }

  return serializedJobs;
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
          promptBlocks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              positive: true,
              negative: true,
            },
          },
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

export async function getJobAgentContext(jobId: string) {
  const job = await db.completeJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
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
      _count: {
        select: { positions: true },
      },
      positions: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          positionTemplate: true,
          promptBlocks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              type: true,
              sourceId: true,
              label: true,
              positive: true,
              negative: true,
              sortOrder: true,
            },
          },
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
  const latestRunStatusCounts: Record<string, number> = {};
  const latestRunImageSummary = {
    totalCount: 0,
    pendingCount: 0,
    keptCount: 0,
    trashedCount: 0,
  };
  let positionsWithLatestRunCount = 0;

  const positions = job.positions.map((position) => {
    const latestRun = resolveLatestRun(position, latestRunsById);

    if (latestRun) {
      positionsWithLatestRunCount += 1;
      latestRunStatusCounts[latestRun.status] =
        (latestRunStatusCounts[latestRun.status] ?? 0) + 1;

      const imageSummary = summarizeRunImages(latestRun.images);
      latestRunImageSummary.totalCount += imageSummary.totalCount;
      latestRunImageSummary.pendingCount += imageSummary.pendingCount;
      latestRunImageSummary.keptCount += imageSummary.keptCount;
      latestRunImageSummary.trashedCount += imageSummary.trashedCount;
    }

    return {
      id: position.id,
      sortOrder: position.sortOrder,
      enabled: position.enabled,
      latestRunId: position.latestRunId,
      positionTemplateId: position.positionTemplateId,
      name: position.positionTemplate?.name ?? null,
      slug: position.positionTemplate?.slug ?? null,
      latestRun: serializeLatestRun(latestRun),
      promptBlocks: position.promptBlocks,
      promptDraft: buildResolvedPromptDraft(job, position, position.promptBlocks),
      resolvedConfig: buildResolvedConfigSnapshot(job, position, position.promptBlocks),
    };
  });

  return {
    job: {
      id: job.id,
      title: job.title,
      slug: job.slug,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      notes: job.notes,
      positionCount: job._count.positions,
      enabledPositionCount: job.positions.length,
      character: job.character,
      scenePreset: job.scenePreset,
      stylePreset: job.stylePreset,
      promptOverview: {
        characterPrompt: job.characterPrompt,
        scenePrompt: job.scenePrompt,
        stylePrompt: job.stylePrompt,
        characterLoraPath: job.characterLoraPath,
        jobLevelOverrides: job.jobLevelOverrides,
      },
    },
    summary: {
      positionsWithLatestRunCount,
      positionsWithoutRunsCount: job.positions.length - positionsWithLatestRunCount,
      latestRunStatusCounts,
      latestRunImageSummary,
    },
    positions,
  };
}

export async function getJobPositionOwner(jobPositionId: string) {
  const position = await db.completeJobPosition.findUnique({
    where: { id: jobPositionId },
    select: {
      id: true,
      completeJobId: true,
      enabled: true,
    },
  });

  if (!position) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  return {
    id: position.id,
    jobId: position.completeJobId,
    enabled: position.enabled,
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
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          positive: true,
          negative: true,
        },
      },
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

export async function createJob(input: JobCreateInput) {
  const jobId = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const [character, scenePreset, stylePreset] = await Promise.all([
      tx.character.findUnique({
        where: { id: input.characterId },
        select: {
          id: true,
          name: true,
          prompt: true,
          negativePrompt: true,
          loraPath: true,
        },
      }),
      input.scenePresetId
        ? tx.scenePreset.findUnique({
            where: { id: input.scenePresetId },
            select: {
              id: true,
              name: true,
              prompt: true,
              negativePrompt: true,
            },
          })
        : Promise.resolve(null),
      input.stylePresetId
        ? tx.stylePreset.findUnique({
            where: { id: input.stylePresetId },
            select: {
              id: true,
              name: true,
              prompt: true,
              negativePrompt: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!character) {
      throw new Error("CHARACTER_NOT_FOUND");
    }

    if (input.scenePresetId && !scenePreset) {
      throw new Error("SCENE_PRESET_NOT_FOUND");
    }

    if (input.stylePresetId && !stylePreset) {
      throw new Error("STYLE_PRESET_NOT_FOUND");
    }

    // Optionally resolve position templates
    const positionTemplateIds = input.positionTemplateIds ?? [];
    let orderedPositionTemplates: Array<{
      id: string;
      name: string;
      enabled: boolean;
      prompt: string;
      negativePrompt: string | null;
    }> = [];

    if (positionTemplateIds.length > 0) {
      const positionTemplates = await tx.positionTemplate.findMany({
        where: { id: { in: positionTemplateIds } },
        select: {
          id: true,
          name: true,
          enabled: true,
          prompt: true,
          negativePrompt: true,
        },
      });

      const positionTemplateById = new Map(
        positionTemplates.map((pt): [string, typeof pt] => [pt.id, pt]),
      );
      orderedPositionTemplates = positionTemplateIds
        .map((id) => positionTemplateById.get(id))
        .filter((pt): pt is NonNullable<typeof pt> => !!pt);

      if (orderedPositionTemplates.length !== positionTemplateIds.length) {
        throw new Error("POSITION_TEMPLATE_NOT_FOUND");
      }

      if (orderedPositionTemplates.some((pt) => !pt.enabled)) {
        throw new Error("POSITION_TEMPLATE_DISABLED");
      }
    }

    const slug = await resolveUniqueJobSlug(tx, input.title);
    const createdJob = await tx.completeJob.create({
      data: {
        title: input.title,
        slug,
        status: JobStatus.draft,
        characterId: character.id,
        scenePresetId: scenePreset?.id ?? null,
        stylePresetId: stylePreset?.id ?? null,
        characterPrompt: character.prompt,
        characterLoraPath: character.loraPath,
        scenePrompt: scenePreset?.prompt ?? null,
        stylePrompt: stylePreset?.prompt ?? null,
        notes: input.notes,
        ...(orderedPositionTemplates.length > 0
          ? {
              positions: {
                create: orderedPositionTemplates.map((pt, index) => ({
                  positionTemplateId: pt.id,
                  sortOrder: index + 1,
                  enabled: true,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        positions: {
          select: { id: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Generate initial PromptBlocks for each position (if any)
    for (let i = 0; i < createdJob.positions.length; i++) {
      const positionId = createdJob.positions[i].id;
      const pt = orderedPositionTemplates[i];
      let sortOrder = 0;

      // Character block
      await tx.promptBlock.create({
        data: {
          completeJobPositionId: positionId,
          type: "character",
          sourceId: character.id,
          label: character.name,
          positive: character.prompt,
          negative: character.negativePrompt,
          sortOrder: sortOrder++,
        },
      });

      // Scene block
      if (scenePreset) {
        await tx.promptBlock.create({
          data: {
            completeJobPositionId: positionId,
            type: "scene",
            sourceId: scenePreset.id,
            label: scenePreset.name,
            positive: scenePreset.prompt,
            negative: scenePreset.negativePrompt,
            sortOrder: sortOrder++,
          },
        });
      }

      // Style block
      if (stylePreset) {
        await tx.promptBlock.create({
          data: {
            completeJobPositionId: positionId,
            type: "style",
            sourceId: stylePreset.id,
            label: stylePreset.name,
            positive: stylePreset.prompt,
            negative: stylePreset.negativePrompt,
            sortOrder: sortOrder++,
          },
        });
      }

      // Position block
      if (pt) {
        await tx.promptBlock.create({
          data: {
            completeJobPositionId: positionId,
            type: "position",
            sourceId: pt.id,
            label: pt.name,
            positive: pt.prompt,
            negative: pt.negativePrompt,
            sortOrder: sortOrder++,
          },
        });
      }
    }

    return createdJob.id;
  });

  return getJobDetail(jobId);
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

  if (input.shortSidePx !== undefined) {
    data.shortSidePx = input.shortSidePx;
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
            promptBlocks: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                type: true,
                sourceId: true,
                label: true,
                positive: true,
                negative: true,
                sortOrder: true,
              },
            },
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
            promptBlocks: {
              create: position.promptBlocks.map((block) => ({
                type: block.type,
                sourceId: block.sourceId,
                label: block.label,
                positive: block.positive,
                negative: block.negative,
                sortOrder: block.sortOrder,
              })),
            },
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

export async function enqueueJobRuns(jobId: string, overrideBatchSize?: number) {
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
            promptBlocks: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                positive: true,
                negative: true,
              },
            },
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

    const runs = await createQueuedRunsForPositions(tx, job, job.positions, overrideBatchSize);
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

export async function enqueueJobPositionRun(jobId: string, jobPositionId: string, overrideBatchSize?: number) {
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
        promptBlocks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            positive: true,
            negative: true,
          },
        },
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

    const runs = await createQueuedRunsForPositions(tx, job, [position], overrideBatchSize);
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

export async function getJobCreateOptions(): Promise<JobCreateOptions> {
  const [characters, scenePresets, stylePresets, positionTemplates] = await Promise.all([
    db.character.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    db.scenePreset.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    db.stylePreset.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    db.positionTemplate.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, slug: true, enabled: true },
    }),
  ]);

  return {
    characters,
    scenePresets,
    stylePresets,
    positionTemplates,
  };
}
