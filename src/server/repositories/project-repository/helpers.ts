import { Prisma } from "@/generated/prisma";
import { JobStatus, ReviewStatus } from "@/lib/db-enums";
import { db } from "@/lib/db";
import { resolveSectionConfig } from "@/server/prompt-config/section-resolver";
import type { ResolvedSectionConfig } from "@/server/prompt-config/types";

export type ProjectUpdateInput = {
  aspectRatio?: string | null;
  batchSize?: number | null;
  checkpointName?: string | null;
  folderId?: string | null;
};

export type ProjectCreateInput = {
  title: string;
  checkpointName: string;
  notes: string | null;
  folderId?: string | null;
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
  executionMeta?: Prisma.JsonValue | null;
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
    executionMeta: run.executionMeta ?? null,
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
  resolvedConfig?: ResolvedSectionConfig,
) {
  const hasResolvedConfig = resolvedConfig !== undefined;
  const resolvedParameters = resolvedConfig?.parameters;
  const resolvedString = (key: string) => {
    const value = resolvedParameters?.[key];
    return typeof value === "string" ? value : null;
  };
  const resolvedNumber = (key: string) => {
    const value = resolvedParameters?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  return {
    id: section.id,
    sortOrder: section.sortOrder,
    enabled: section.enabled,
    latestRunId: section.latestRunId,
    name: section.name ?? null,
    slug: null,
    aspectRatio: hasResolvedConfig ? resolvedString("aspectRatio") : section.aspectRatio ?? null,
    batchSize: hasResolvedConfig ? resolvedNumber("batchSize") : section.batchSize ?? null,
    seedPolicy1: hasResolvedConfig ? resolvedString("seedPolicy1") : section.seedPolicy1 ?? null,
    seedPolicy2: hasResolvedConfig ? resolvedString("seedPolicy2") : section.seedPolicy2 ?? null,
    ksampler1: hasResolvedConfig ? resolvedConfig.ksampler1 : section.ksampler1 ?? null,
    ksampler2: hasResolvedConfig ? resolvedConfig.ksampler2 : section.ksampler2 ?? null,
    checkpointName: hasResolvedConfig ? resolvedString("checkpointName") : section.checkpointName,
    loraConfig: hasResolvedConfig ? resolvedConfig.loraConfig : section.loraConfig,
    extraParams: hasResolvedConfig ? resolvedConfig.extraParams : section.extraParams,
    promptOverview: {
      templatePrompt: null,
      positivePrompt: hasResolvedConfig ? resolvedConfig.prompt.positive : section.positivePrompt,
      negativePrompt: hasResolvedConfig ? resolvedConfig.prompt.negative : section.negativePrompt ?? null,
    },
    latestRun: serializeLatestRun(resolveLatestRun(section, latestRunsById)),
  };
}

export async function resolveSectionConfigsById(
  sectionIds: readonly string[],
  client?: Prisma.TransactionClient,
) {
  const entries = await Promise.all(
    sectionIds.map(async (sectionId) => {
      const resolvedConfig = await resolveSectionConfig(
        sectionId,
        client as Parameters<typeof resolveSectionConfig>[1],
      );
      if (!resolvedConfig) {
        throw new Error("JOB_POSITION_CONFIG_NOT_FOUND");
      }
      return [sectionId, resolvedConfig] as const;
    }),
  );

  return new Map(entries);
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
      executionMeta: true,
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

function cloneInputJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function cloneInputJsonObject(value: unknown): MutableInputJsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as MutableInputJsonObject;
}

function readSnapshotCheckpointName(parameters: Prisma.InputJsonObject) {
  const checkpointName = parameters.checkpointName;
  return typeof checkpointName === "string" ? checkpointName : null;
}

export function buildResolvedConfigSnapshot(
  project: QueuableProjectRecord,
  section: Pick<ProjectSectionRecord, "id" | "name" | "sortOrder">,
  resolvedConfig: ResolvedSectionConfig,
  overrideBatchSize?: number,
): Prisma.InputJsonObject {
  const parameters = cloneInputJsonObject(resolvedConfig.parameters) ?? {};
  if (overrideBatchSize !== undefined) {
    parameters.batchSize = overrideBatchSize;
  }
  const resolvedCheckpointName = readSnapshotCheckpointName(parameters);
  const fallbackSectionName = `section_${section.sortOrder + 1}`;

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
      slug: fallbackSectionName,
      templatePrompt: null,
      positivePrompt: resolvedConfig.prompt.positive,
      negativePrompt: resolvedConfig.prompt.negative,
    },
    promptBlocks: cloneInputJsonValue(resolvedConfig.promptBlocks),
    presets: cloneInputJsonValue(resolvedConfig.presets),
    composedPrompt: cloneInputJsonValue(resolvedConfig.prompt),
    parameters,
    checkpointName: resolvedCheckpointName,
    ksampler1: cloneInputJsonValue(resolvedConfig.ksampler1),
    ksampler2: cloneInputJsonValue(resolvedConfig.ksampler2),
    loraConfig: cloneInputJsonValue(resolvedConfig.loraConfig),
    extraParams: cloneInputJsonValue(resolvedConfig.extraParams),
    warnings: cloneInputJsonValue(resolvedConfig.warnings),
    missingReferences: cloneInputJsonValue(resolvedConfig.missingReferences),
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

async function resolveSectionConfigForRun(
  sectionId: string,
  client: Prisma.TransactionClient,
) {
  return resolveSectionConfig(
    sectionId,
    client as Parameters<typeof resolveSectionConfig>[1],
  );
}

export async function createQueuedRunsForPositions(
  tx: Prisma.TransactionClient,
  project: QueuableProjectRecord,
  sections: ProjectSectionRecord[],
  overrideBatchSize?: number,
  resolveConfig: (
    sectionId: string,
    client: Prisma.TransactionClient,
  ) => Promise<ResolvedSectionConfig | null> = resolveSectionConfigForRun,
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
    const resolvedConfig = await resolveConfig(section.id, tx);
    if (!resolvedConfig) {
      throw new Error("JOB_POSITION_CONFIG_NOT_FOUND");
    }

    const createdRun = await tx.run.create({
      data: {
        projectId: project.id,
        projectSectionId: section.id,
        runIndex: (latestRunIndexBySectionId.get(section.id) ?? 0) + 1,
        status: "queued",
        resolvedConfigSnapshot: buildResolvedConfigSnapshot(project, section, resolvedConfig, overrideBatchSize),
      },
      select: {
        id: true,
        runIndex: true,
        status: true,
        createdAt: true,
      },
    });

    queuedRuns.push(serializeEnqueuedRun(section, createdRun));
  }

  return queuedRuns;
}
