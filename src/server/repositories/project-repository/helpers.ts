import { Prisma } from "@/generated/prisma";
import { JobStatus, ReviewStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";

export type ProjectUpdateInput = {
  aspectRatio?: string | null;
  batchSize?: number | null;
  checkpointName?: string | null;
};

export type ProjectCreateInput = {
  title: string;
  checkpointName: string;
  notes: string | null;
};

export type ProjectSectionUpdateInput = {
  name?: string | null;
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
  checkpointName?: string | null;
  loraConfig?: Record<string, unknown> | null;
};

export type ListProjectsFilters = {
  status?: JobStatus;
  search?: string;
  title?: string;
  enabledOnly?: boolean;
  hasPending?: boolean;
};

export type ProjectCreateOptions = Record<string, never>;

export type LatestRunRecord = {
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

export type PromptBlockSummaryRecord = {
  positive: string;
  negative: string | null;
  type?: string;
  categoryId?: string | null;
  sourceId?: string | null;
  label?: string;
};

export type ProjectSectionRecord = {
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
  checkpointName: string | null;
  loraConfig: Prisma.JsonValue | null;
  extraParams: Prisma.JsonValue | null;
  runs: LatestRunRecord[];
  promptBlocks: PromptBlockSummaryRecord[];
};

export type QueuableProjectRecord = {
  id: string;
  title: string;
  slug: string;
  status: string;
  projectLevelOverrides: Prisma.JsonValue | null;
  checkpointName: string | null;
};

export type EnqueuedRunRecord = {
  id: string;
  runIndex: number;
  status: string;
  createdAt: Date;
};

export function toIsoString(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function summarizeRunImages(images: Array<{ reviewStatus: string }>) {
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

export function serializeLatestRun(run: LatestRunRecord | null) {
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

export function resolveLatestRun(
  section: Pick<ProjectSectionRecord, "latestRunId" | "runs">,
  latestRunsById: Map<string, LatestRunRecord>,
) {
  const fallbackLatestRun = section.runs[0] ?? null;

  return (
    (section.latestRunId ? latestRunsById.get(section.latestRunId) : undefined) ??
    fallbackLatestRun
  );
}

export function serializeProjectSection(
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
    checkpointName: section.checkpointName,
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

export async function getLatestRunsById(latestRunIds: string[]) {
  if (latestRunIds.length === 0) {
    return new Map<string, LatestRunRecord>();
  }

  const latestRuns = await db.run.findMany({
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

export type MutableInputJsonObject = Record<string, Prisma.InputJsonValue>;

export function toInputJsonObject(value: Prisma.JsonValue | null): MutableInputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as MutableInputJsonObject;
}

export function buildProjectLevelOverridesUpdate(
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
      delete nextOverrides.defaultAspectRatio;
    } else {
      nextOverrides.defaultAspectRatio = input.aspectRatio;
    }
  }

  if (input.batchSize !== undefined) {
    if (input.batchSize === null) {
      delete nextOverrides.batchSize;
      delete nextOverrides.defaultBatchSize;
    } else {
      nextOverrides.defaultBatchSize = input.batchSize;
    }
  }

  return Object.keys(nextOverrides).length > 0
    ? (nextOverrides as Prisma.InputJsonObject)
    : Prisma.DbNull;
}

export function resolveProjectOverrideString(
  overrides: MutableInputJsonObject,
  key: string,
) {
  const value = overrides[key];
  return typeof value === "string" ? value : null;
}

export function resolveProjectOverrideInteger(
  overrides: MutableInputJsonObject,
  key: string,
) {
  const value = overrides[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function buildResolvedConfigSnapshot(
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
    resolveProjectOverrideString(projectLevelOverrides, "defaultAspectRatio") ??
    resolveProjectOverrideString(projectLevelOverrides, "aspectRatio") ??
    null;
  const resolvedShortSidePx =
    section.shortSidePx ??
    resolveProjectOverrideInteger(projectLevelOverrides, "shortSidePx") ??
    null;
  const resolvedBatchSize =
    overrideBatchSize ??
    section.batchSize ??
    resolveProjectOverrideInteger(projectLevelOverrides, "defaultBatchSize") ??
    resolveProjectOverrideInteger(projectLevelOverrides, "batchSize") ??
    null;
  const resolvedSeedPolicy1 =
    section.seedPolicy1 ?? null;
  const resolvedSeedPolicy2 =
    section.seedPolicy2 ?? null;
  const resolvedCheckpointName =
    section.checkpointName ??
    project.checkpointName ??
    null;

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
      checkpointName: resolvedCheckpointName,
    },
    checkpointName: resolvedCheckpointName,
    ksampler1: section.ksampler1 ?? null,
    ksampler2: section.ksampler2 ?? null,
    loraConfig: section.loraConfig,
    extraParams: section.extraParams ? (JSON.parse(JSON.stringify(section.extraParams)) as Prisma.InputJsonObject) : null,
  };
}

export function buildResolvedPromptDraft(
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
      positive: positiveParts.join(" BREAK "),
      negative: negativeParts.length > 0 ? negativeParts.join(" BREAK ") : null,
    };
  }

  // Fallback: use section-level prompts only
  return {
    positive: section.positivePrompt ?? "",
    negative: section.negativePrompt ?? null,
  };
}

export function serializeEnqueuedRun(
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

export function cloneJsonValueForCreate(
  value: Prisma.JsonValue | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.DbNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function buildCopyTitle(title: string, copyNumber: number) {
  return copyNumber === 1 ? `${title} Copy` : `${title} Copy ${copyNumber}`;
}

export function buildCopySlug(slug: string, copyNumber: number) {
  return copyNumber === 1 ? `${slug}-copy` : `${slug}-copy-${copyNumber}`;
}

export function slugifyProjectTitle(title: string) {
  const normalizedTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalizedTitle
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "project";
}

export function buildUniqueProjectSlug(baseSlug: string, suffixNumber: number) {
  return suffixNumber === 1 ? baseSlug : `${baseSlug}-${suffixNumber}`;
}

export async function resolveUniqueProjectSlug(
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

export async function resolveUniqueProjectCopyIdentity(
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

export async function ensureQueuedProjectStatus(
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

export async function createQueuedRunsForPositions(
  tx: Prisma.TransactionClient,
  project: QueuableProjectRecord,
  sections: ProjectSectionRecord[],
  overrideBatchSize?: number,
) {
  const sectionIds = sections.map((section) => section.id);
  const latestRunIndexes = await tx.run.groupBy({
    by: ["projectSectionId"],
    where: {
      projectSectionId: { in: sectionIds },
    },
    _max: {
      runIndex: true,
    },
  });

  const latestRunIndexBySectionId = new Map<string, number>(
    latestRunIndexes.map((entry): [string, number] => [
      entry.projectSectionId,
      entry._max.runIndex ?? 0,
    ]),
  );

  const queuedRuns: Array<ReturnType<typeof serializeEnqueuedRun>> = [];

  for (const section of sections) {
    const createdRun = await tx.run.create({
      data: {
        projectId: project.id,
        projectSectionId: section.id,
        runIndex: (latestRunIndexBySectionId.get(section.id) ?? 0) + 1,
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
