import { Prisma } from "@/generated/prisma";
import { JobStatus, ReviewStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";
import { detectProvider } from "@/lib/prisma";

export type ProjectUpdateInput = {
  aspectRatio?: string | null;
  batchSize?: number | null;
};

export type ProjectCreateInput = {
  title: string;
  notes: string | null;
};

export type ProjectSectionUpdateInput = {
  positivePrompt?: string | null;
  negativePrompt?: string | null;
  aspectRatio?: string | null;
  shortSidePx?: number | null;
  batchSize?: number | null;
  // v0.3: dual seedPolicy
  seedPolicy1?: string | null;
  seedPolicy2?: string | null;
  // v0.3: ksampler params
  ksampler1?: Record<string, unknown> | null;
  ksampler2?: Record<string, unknown> | null;
  upscaleFactor?: number | null;
};

export type ListProjectsFilters = {
  status?: JobStatus;
  search?: string;
  enabledOnly?: boolean;
  hasPending?: boolean;
};

export type ProjectCreateOptions = Record<string, never>;

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

type PromptBlockSummaryRecord = {
  positive: string;
  negative: string | null;
  type?: string;
  categoryId?: string | null;
  sourceId?: string | null;
  label?: string;
};

type ProjectSectionRecord = {
  id: string;
  name: string | null;
  sortOrder: number;
  enabled: boolean;
  latestRunId: string | null;
  positivePrompt: string | null;
  negativePrompt: string | null;
  aspectRatio: string | null;
  shortSidePx: number | null;
  batchSize: number | null;
  seedPolicy1: string | null;
  seedPolicy2: string | null;
  ksampler1: Prisma.JsonValue | null;
  ksampler2: Prisma.JsonValue | null;
  upscaleFactor: number | null;
  loraConfig: Prisma.JsonValue | null;
  extraParams: Prisma.JsonValue | null;
  runs: LatestRunRecord[];
  promptBlocks: PromptBlockSummaryRecord[];
};

type QueuableProjectRecord = {
  id: string;
  title: string;
  slug: string;
  status: string;
  projectLevelOverrides: Prisma.JsonValue | null;
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
  section: Pick<ProjectSectionRecord, "latestRunId" | "runs">,
  latestRunsById: Map<string, LatestRunRecord>,
) {
  const fallbackLatestRun = section.runs[0] ?? null;

  return (
    (section.latestRunId ? latestRunsById.get(section.latestRunId) : undefined) ??
    fallbackLatestRun
  );
}

function serializeProjectSection(
  section: ProjectSectionRecord,
  latestRunsById: Map<string, LatestRunRecord>,
) {
  return {
    id: section.id,
    sortOrder: section.sortOrder,
    enabled: section.enabled,
    latestRunId: section.latestRunId,
    name: section.name ?? null,
    slug: null,
    aspectRatio: section.aspectRatio ?? null,
    batchSize: section.batchSize ?? null,
    seedPolicy1: section.seedPolicy1 ?? null,
    seedPolicy2: section.seedPolicy2 ?? null,
    ksampler1: section.ksampler1 ?? null,
    ksampler2: section.ksampler2 ?? null,
    loraConfig: section.loraConfig,
    extraParams: section.extraParams,
    promptOverview: {
      templatePrompt: null,
      positivePrompt: section.positivePrompt,
      negativePrompt: section.negativePrompt ?? null,
    },
    latestRun: serializeLatestRun(resolveLatestRun(section, latestRunsById)),
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

function buildProjectLevelOverridesUpdate(
  currentValue: Prisma.JsonValue | null,
  input: ProjectUpdateInput,
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

function resolveProjectOverrideString(
  overrides: MutableInputJsonObject,
  key: string,
) {
  const value = overrides[key];
  return typeof value === "string" ? value : null;
}

function resolveProjectOverrideInteger(
  overrides: MutableInputJsonObject,
  key: string,
) {
  const value = overrides[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function buildResolvedConfigSnapshot(
  project: QueuableProjectRecord,
  section: ProjectSectionRecord,
  blocks?: Array<{
    positive: string;
    negative: string | null;
    type?: string;
    categoryId?: string | null;
    sourceId?: string | null;
    label?: string;
  }>,
  overrideBatchSize?: number,
): Prisma.InputJsonObject {
  const projectLevelOverrides = toInputJsonObject(project.projectLevelOverrides);
  const resolvedAspectRatio =
    section.aspectRatio ??
    resolveProjectOverrideString(projectLevelOverrides, "aspectRatio") ??
    null;
  const resolvedShortSidePx =
    section.shortSidePx ??
    resolveProjectOverrideInteger(projectLevelOverrides, "shortSidePx") ??
    null;
  const resolvedBatchSize =
    overrideBatchSize ??
    section.batchSize ??
    resolveProjectOverrideInteger(projectLevelOverrides, "batchSize") ??
    null;
  const resolvedSeedPolicy1 =
    section.seedPolicy1 ?? null;
  const resolvedSeedPolicy2 =
    section.seedPolicy2 ?? null;

  // Compose final prompt from blocks (v0.2) or legacy fallback
  const promptDraft = buildResolvedPromptDraft(project, section, blocks);

  return {
    project: {
      id: project.id,
      title: project.title,
      slug: project.slug,
    },
    section: {
      id: section.id,
      templateId: null,
      sortOrder: section.sortOrder,
      name: section.name ?? `section_${section.sortOrder + 1}`,
      slug: `section_${section.sortOrder + 1}`,
      templatePrompt: null,
      positivePrompt: section.positivePrompt,
      negativePrompt: section.negativePrompt ?? null,
    },
    promptBlocks: blocks ?? null,
    // v0.4: presets array from blocks that have type=preset
    presets: blocks
      ? blocks
          .filter((b) => b.type === "preset" && b.categoryId && b.sourceId)
          .map((b) => ({
            categoryId: b.categoryId,
            presetId: b.sourceId,
            label: b.label ?? null,
          }))
      : null,
    composedPrompt: promptDraft,
    parameters: {
      aspectRatio: resolvedAspectRatio,
      shortSidePx: resolvedShortSidePx,
      batchSize: resolvedBatchSize,
      // v0.3: dual seedPolicy (keep seedPolicy for backward compat)
      seedPolicy: resolvedSeedPolicy1,
      seedPolicy1: resolvedSeedPolicy1,
      seedPolicy2: resolvedSeedPolicy2,
      upscaleFactor: section.upscaleFactor ?? null,
    },
    ksampler1: section.ksampler1 ?? null,
    ksampler2: section.ksampler2 ?? null,
    loraConfig: section.loraConfig,
    extraParams: section.extraParams ? (JSON.parse(JSON.stringify(section.extraParams)) as Prisma.InputJsonObject) : null,
  };
}

function buildResolvedPromptDraft(
  _project: Pick<QueuableProjectRecord, "id">,
  section: Pick<
    ProjectSectionRecord,
    "positivePrompt" | "negativePrompt"
  >,
  blocks?: Array<{
    positive: string;
    negative: string | null;
  }>,
) {
  if (blocks && blocks.length > 0) {
    // Block-based prompt composition
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

  // Fallback: use section-level prompts only
  return {
    positive: section.positivePrompt ?? "",
    negative: section.negativePrompt ?? null,
  };
}

function serializeEnqueuedRun(
  section: Pick<
    ProjectSectionRecord,
    "id" | "name" | "sortOrder"
  >,
  run: EnqueuedRunRecord,
) {
  return {
    runId: run.id,
    sectionId: section.id,
    sortOrder: section.sortOrder,
    sectionName: section.name ?? `section_${section.sortOrder + 1}`,
    sectionSlug: `section_${section.sortOrder + 1}`,
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

function slugifyProjectTitle(title: string) {
  const normalizedTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalizedTitle
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "project";
}

function buildUniqueProjectSlug(baseSlug: string, suffixNumber: number) {
  return suffixNumber === 1 ? baseSlug : `${baseSlug}-${suffixNumber}`;
}

async function resolveUniqueProjectSlug(
  tx: Prisma.TransactionClient,
  title: string,
) {
  const baseSlug = slugifyProjectTitle(title);

  for (let suffixNumber = 1; suffixNumber <= 100; suffixNumber += 1) {
    const slug = buildUniqueProjectSlug(baseSlug, suffixNumber);
    const existingProject = await tx.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existingProject) {
      return slug;
    }
  }

  throw new Error("JOB_SLUG_EXHAUSTED");
}

async function resolveUniqueProjectCopyIdentity(
  tx: Prisma.TransactionClient,
  project: Pick<QueuableProjectRecord, "title" | "slug">,
) {
  for (let copyNumber = 1; copyNumber <= 100; copyNumber += 1) {
    const title = buildCopyTitle(project.title, copyNumber);
    const slug = buildCopySlug(project.slug, copyNumber);
    const existingProject = await tx.project.findFirst({
      where: {
        OR: [{ title }, { slug }],
      },
      select: { id: true },
    });

    if (!existingProject) {
      return { title, slug };
    }
  }

  throw new Error("JOB_COPY_IDENTITY_EXHAUSTED");
}

async function ensureQueuedProjectStatus(
  tx: Prisma.TransactionClient,
  project: Pick<QueuableProjectRecord, "id" | "status">,
) {
  if (project.status === JobStatus.queued || project.status === JobStatus.running) {
    return project.status;
  }

  const updatedProject = await tx.project.update({
    where: { id: project.id },
    data: { status: JobStatus.queued },
    select: { status: true },
  });

  return updatedProject.status;
}

async function createQueuedRunsForPositions(
  tx: Prisma.TransactionClient,
  project: QueuableProjectRecord,
  sections: ProjectSectionRecord[],
  overrideBatchSize?: number,
) {
  const sectionIds = sections.map((section) => section.id);
  const latestRunIndexes = await tx.positionRun.groupBy({
    by: ["projectSectionId"],
    where: {
      projectSectionId: { in: sectionIds },
    },
    _max: {
      runIndex: true,
    },
  });

  const latestRunIndexByPositionId = new Map<string, number>(
    latestRunIndexes.map((entry): [string, number] => [
      entry.projectSectionId,
      entry._max.runIndex ?? 0,
    ]),
  );

  const queuedRuns: Array<ReturnType<typeof serializeEnqueuedRun>> = [];

  for (const section of sections) {
    const createdRun = await tx.positionRun.create({
      data: {
        projectId: project.id,
        projectSectionId: section.id,
        runIndex: (latestRunIndexByPositionId.get(section.id) ?? 0) + 1,
        status: "queued",
        resolvedConfigSnapshot: buildResolvedConfigSnapshot(project, section, section.promptBlocks, overrideBatchSize),
      },
      select: {
        id: true,
        runIndex: true,
        status: true,
        createdAt: true,
      },
    });

    await tx.projectSection.update({
      where: { id: section.id },
      data: { latestRunId: createdRun.id },
    });

    queuedRuns.push(serializeEnqueuedRun(section, createdRun));
  }

  return queuedRuns;
}

export async function listProjects(filters: ListProjectsFilters = {}) {
  const search = filters.search?.trim();
  // SQLite LIKE is case-insensitive for ASCII by default;
  // PostgreSQL requires explicit mode: "insensitive".
  const ciContains = (value: string) =>
    detectProvider() === "postgresql"
      ? { contains: value, mode: "insensitive" as const }
      : { contains: value };

  const projects = await db.project.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { title: ciContains(search) },
              { slug: ciContains(search) },
            ],
          }
        : {}),
      ...(filters.enabledOnly
        ? {
            sections: {
              some: {
                enabled: true,
              },
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      sections: {
        select: {
          id: true,
          enabled: true,
          latestRunId: true,
        },
      },
    },
    take: 50,
  });

  const latestRunIds = projects.flatMap((project) =>
    project.sections
      .map((section) => section.latestRunId)
      .filter((runId): runId is string => runId !== null),
  );

  const latestRunsById = await getLatestRunsById(latestRunIds);

  const serializedProjects = projects.map((project) => {
    const latestRun = project.sections
      .map((section) => (section.latestRunId ? latestRunsById.get(section.latestRunId) ?? null : null))
      .filter((run): run is LatestRunRecord => run !== null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

    const latestRunSummary = latestRun ? summarizeRunImages(latestRun.images) : null;

    return {
      id: project.id,
      title: project.title,
      status: project.status,
      updatedAt: project.updatedAt.toISOString(),
      sectionCount: project.sections.length,
      enabledPositionCount: project.sections.filter((section) => section.enabled).length,
      latestRunAt: latestRun?.createdAt.toISOString() ?? null,
      latestRunStatus: latestRun?.status ?? null,
      latestRunPendingCount: latestRunSummary?.pendingCount ?? 0,
      latestRunTotalCount: latestRunSummary?.totalCount ?? 0,
    };
  });

  if (filters.hasPending) {
    return serializedProjects.filter((project) => project.latestRunPendingCount > 0);
  }

  return serializedProjects;
}

export async function getProjectDetail(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: { sections: true },
      },
      sections: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
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

  if (!project) {
    throw new Error("JOB_NOT_FOUND");
  }

  const latestRunIds = project.sections
    .map((section) => section.latestRunId)
    .filter((runId): runId is string => runId !== null);

  const latestRunsById = await getLatestRunsById(latestRunIds);

  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    notes: project.notes,
    sectionCount: project._count.sections,
    enabledPositionCount: project.sections.length,
    promptOverview: {
      projectLevelOverrides: project.projectLevelOverrides,
    },
    sections: project.sections.map((section) => serializeProjectSection(section, latestRunsById)),
  };
}

export async function getProjectAgentContext(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      projectLevelOverrides: true,
      _count: {
        select: { sections: true },
      },
      sections: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          promptBlocks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              type: true,
              sourceId: true,
              categoryId: true,
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

  if (!project) {
    throw new Error("JOB_NOT_FOUND");
  }

  const latestRunIds = project.sections
    .map((section) => section.latestRunId)
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

  const sections = project.sections.map((section) => {
    const latestRun = resolveLatestRun(section, latestRunsById);

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
      id: section.id,
      sortOrder: section.sortOrder,
      enabled: section.enabled,
      latestRunId: section.latestRunId,
      name: section.name ?? null,
      slug: null,
      latestRun: serializeLatestRun(latestRun),
      promptBlocks: section.promptBlocks,
      promptDraft: buildResolvedPromptDraft(project, section, section.promptBlocks),
      resolvedConfig: buildResolvedConfigSnapshot(project, section, section.promptBlocks),
    };
  });

  return {
    project: {
      id: project.id,
      title: project.title,
      slug: project.slug,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      notes: project.notes,
      sectionCount: project._count.sections,
      enabledPositionCount: project.sections.length,
      promptOverview: {
        projectLevelOverrides: project.projectLevelOverrides,
      },
    },
    summary: {
      positionsWithLatestRunCount,
      positionsWithoutRunsCount: project.sections.length - positionsWithLatestRunCount,
      latestRunStatusCounts,
      latestRunImageSummary,
    },
    sections,
  };
}

export async function getProjectSectionOwner(sectionId: string) {
  const section = await db.projectSection.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      projectId: true,
      enabled: true,
    },
  });

  if (!section) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  return {
    id: section.id,
    projectId: section.projectId,
    enabled: section.enabled,
  };
}

export async function getProjectSectionDetail(projectId: string, sectionId: string) {
  const section = await db.projectSection.findFirst({
    where: {
      id: sectionId,
      projectId: projectId,
    },
    include: {
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

  if (!section) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  const latestRunIds = section.latestRunId ? [section.latestRunId] : [];
  const latestRunsById = await getLatestRunsById(latestRunIds);

  return serializeProjectSection(section, latestRunsById);
}

export async function createProject(input: ProjectCreateInput) {
  const projectId = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const slug = await resolveUniqueProjectSlug(tx, input.title);
    const createdProject = await tx.project.create({
      data: {
        title: input.title,
        slug,
        status: JobStatus.draft,
        notes: input.notes,
      },
      select: {
        id: true,
      },
    });

    return createdProject.id;
  });

  return getProjectDetail(projectId);
}

export async function updateProject(projectId: string, input: ProjectUpdateInput) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectLevelOverrides: true,
    },
  });

  if (!project) {
    throw new Error("JOB_NOT_FOUND");
  }

  const data: Prisma.ProjectUpdateInput = {};

  const projectLevelOverrides = buildProjectLevelOverridesUpdate(project.projectLevelOverrides, input);
  if (projectLevelOverrides !== undefined) {
    data.projectLevelOverrides = projectLevelOverrides;
  }

  await db.project.update({
    where: { id: projectId },
    data,
  });

  return getProjectDetail(projectId);
}

export async function updateProjectSection(
  projectId: string,
  sectionId: string,
  input: ProjectSectionUpdateInput,
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("JOB_NOT_FOUND");
  }

  const section = await db.projectSection.findFirst({
    where: {
      id: sectionId,
      projectId: projectId,
    },
    select: { id: true },
  });

  if (!section) {
    throw new Error("JOB_POSITION_NOT_FOUND");
  }

  const data: Prisma.ProjectSectionUpdateInput = {};

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

  // v0.3: dual seedPolicy
  if (input.seedPolicy1 !== undefined) {
    data.seedPolicy1 = input.seedPolicy1;
  }
  if (input.seedPolicy2 !== undefined) {
    data.seedPolicy2 = input.seedPolicy2;
  }
  // v0.3: ksampler params
  if (input.ksampler1 !== undefined) {
    data.ksampler1 = input.ksampler1 ? JSON.parse(JSON.stringify(input.ksampler1)) : null;
  }
  if (input.ksampler2 !== undefined) {
    data.ksampler2 = input.ksampler2 ? JSON.parse(JSON.stringify(input.ksampler2)) : null;
  }
  if (input.upscaleFactor !== undefined) {
    data.upscaleFactor = input.upscaleFactor;
  }

  await db.projectSection.update({
    where: { id: sectionId },
    data,
  });

  return getProjectSectionDetail(projectId, sectionId);
}

export async function copyProject(projectId: string) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        sections: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            sortOrder: true,
            enabled: true,
            positivePrompt: true,
            negativePrompt: true,
            aspectRatio: true,
            batchSize: true,
            // v0.3: dual seedPolicy
            seedPolicy1: true,
            seedPolicy2: true,
            // v0.3: ksampler params
            ksampler1: true,
            ksampler2: true,
            upscaleFactor: true,
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

    if (!project) {
      throw new Error("JOB_NOT_FOUND");
    }

    const identity = await resolveUniqueProjectCopyIdentity(tx, project);
    const copiedProject = await tx.project.create({
      data: {
        title: identity.title,
        slug: identity.slug,
        status: JobStatus.draft,
        projectLevelOverrides: cloneJsonValueForCreate(project.projectLevelOverrides),
        notes: project.notes,
        presetBindings: cloneJsonValueForCreate(project.presetBindings),
        sections: {
          create: project.sections.map((section) => ({
            sortOrder: section.sortOrder,
            enabled: section.enabled,
            positivePrompt: section.positivePrompt,
            negativePrompt: section.negativePrompt,
            aspectRatio: section.aspectRatio,
            batchSize: section.batchSize,
            seedPolicy1: section.seedPolicy1,
            seedPolicy2: section.seedPolicy2,
            ksampler1: cloneJsonValueForCreate(section.ksampler1),
            ksampler2: cloneJsonValueForCreate(section.ksampler2),
            loraConfig: cloneJsonValueForCreate(section.loraConfig),
            extraParams: cloneJsonValueForCreate(section.extraParams),
            promptBlocks: {
              create: section.promptBlocks.map((block) => ({
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
        sections: {
          select: { id: true },
        },
      },
    });

    return {
      id: copiedProject.id,
      title: copiedProject.title,
      slug: copiedProject.slug,
      status: copiedProject.status,
      createdAt: copiedProject.createdAt.toISOString(),
      sectionCount: copiedProject.sections.length,
    };
  });
}

export async function enqueueProjectRuns(projectId: string, overrideBatchSize?: number) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        projectLevelOverrides: true,
        sections: {
          where: { enabled: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
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

    if (!project) {
      throw new Error("JOB_NOT_FOUND");
    }

    if (project.sections.length === 0) {
      throw new Error("JOB_HAS_NO_ENABLED_POSITIONS");
    }

    const runs = await createQueuedRunsForPositions(tx, project, project.sections, overrideBatchSize);
    const projectStatus = await ensureQueuedProjectStatus(tx, project);

    return {
      projectId: project.id,
      projectTitle: project.title,
      projectStatus,
      queuedRunCount: runs.length,
      runs,
    };
  });
}

export async function enqueueProjectSectionRun(projectId: string, sectionId: string, overrideBatchSize?: number) {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        projectLevelOverrides: true,
      },
    });

    if (!project) {
      throw new Error("JOB_NOT_FOUND");
    }

    const section = await tx.projectSection.findFirst({
      where: {
        id: sectionId,
        projectId: projectId,
      },
      include: {
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

    if (!section) {
      throw new Error("JOB_POSITION_NOT_FOUND");
    }

    if (!section.enabled) {
      throw new Error("JOB_POSITION_DISABLED");
    }

    const runs = await createQueuedRunsForPositions(tx, project, [section], overrideBatchSize);
    const projectStatus = await ensureQueuedProjectStatus(tx, project);

    return {
      projectId: project.id,
      projectTitle: project.title,
      projectStatus,
      queuedRunCount: runs.length,
      runs,
    };
  });
}

export async function getProjectCreateOptions(): Promise<ProjectCreateOptions> {
  return {};
}
