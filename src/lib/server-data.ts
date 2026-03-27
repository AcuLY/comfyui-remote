import { prisma } from "@/lib/prisma";
import { toImageUrl } from "@/lib/image-url";
import type { QueueRun, RunningRun, FailedRun, ReviewGroup, ReviewImage, ReviewStatus, JobCard, TrashItem, LoraAsset } from "@/lib/types";
import { listWorkflowTemplateSummaries } from "@/server/services/workflow-template-service";

// Re-export types used by frontend components (originally from backend branch)
export type { JobCreateOptions } from "@/server/repositories/job-repository";

// ---------------------------------------------------------------------------
// Preset binding helpers — resolve display names from presetBindings JSON
// ---------------------------------------------------------------------------

type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;

async function batchResolvePresetNames(presetIds: string[]): Promise<Map<string, { name: string; categorySlug: string }>> {
  if (presetIds.length === 0) return new Map();
  const presets = await prisma.promptPreset.findMany({
    where: { id: { in: presetIds } },
    select: { id: true, name: true, category: { select: { slug: true } } },
  });
  return new Map(presets.map((p) => [p.id, { name: p.name, categorySlug: p.category.slug }]));
}

function extractDisplayNames(
  bindings: PresetBindingJson | null,
  presetMap: Map<string, { name: string; categorySlug: string }>,
): { characterName: string; sceneName: string; styleName: string } {
  const result = { characterName: "—", sceneName: "—", styleName: "—" };
  if (!bindings) return result;
  for (const b of bindings) {
    const preset = presetMap.get(b.presetId);
    if (!preset) continue;
    if (preset.categorySlug === "character") result.characterName = preset.name;
    else if (preset.categorySlug === "scene") result.sceneName = preset.name;
    else if (preset.categorySlug === "style") result.styleName = preset.name;
  }
  return result;
}

/** Collect all unique preset IDs from an array of presetBindings JSON values */
function collectPresetIds(bindingsArray: (unknown)[]): string[] {
  const ids = new Set<string>();
  for (const raw of bindingsArray) {
    const bindings = raw as PresetBindingJson | null;
    if (bindings) for (const b of bindings) ids.add(b.presetId);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Queue — 待审核队列
// ---------------------------------------------------------------------------

export async function getQueueRuns(): Promise<QueueRun[]> {
  const runs = await prisma.positionRun.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    include: {
      completeJob: {
        select: { id: true, title: true, presetBindings: true },
      },
      completeJobPosition: {
        include: { positionTemplate: true },
      },
      images: true,
    },
  });

  // Batch resolve preset names
  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.completeJob.presetBindings)),
  );

  return runs
    .map((run) => {
      const names = extractDisplayNames(run.completeJob.presetBindings as PresetBindingJson | null, presetMap);
      return {
        id: run.id,
        characterName: names.characterName,
        jobTitle: run.completeJob.title,
        positionName:
          run.completeJobPosition.name ??
          run.completeJobPosition.positionTemplate?.name ??
          `section_${run.completeJobPosition.sortOrder + 1}`,
        createdAt: formatDate(run.createdAt),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        pendingCount: run.images.filter((img) => img.reviewStatus === "pending").length,
        totalCount: run.images.length,
        status: run.status as QueueRun["status"],
      };
    })
    .filter((run) => run.pendingCount > 0);
}

// ---------------------------------------------------------------------------
// Running Runs — 当前运行中的任务
// ---------------------------------------------------------------------------

export async function getRunningRuns(): Promise<RunningRun[]> {
  const runs = await prisma.positionRun.findMany({
    where: { status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
    include: {
      completeJob: {
        select: { id: true, title: true, presetBindings: true },
      },
      completeJobPosition: { include: { positionTemplate: true } },
    },
  });

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.completeJob.presetBindings)),
  );

  return runs.map((run) => {
    const names = extractDisplayNames(run.completeJob.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: run.id,
      characterName: names.characterName,
      jobTitle: run.completeJob.title,
      positionName:
        run.completeJobPosition.name ??
        run.completeJobPosition.positionTemplate?.name ??
        `section_${run.completeJobPosition.sortOrder + 1}`,
      startedAt: formatDate(run.createdAt),
      status: run.status as RunningRun["status"],
    };
  });
}

// ---------------------------------------------------------------------------
// Failed Runs — 最近失败的任务
// ---------------------------------------------------------------------------

export async function getFailedRuns(): Promise<FailedRun[]> {
  const runs = await prisma.positionRun.findMany({
    where: { status: "failed" },
    orderBy: { finishedAt: "desc" },
    take: 20,
    include: {
      completeJob: {
        select: { id: true, title: true, presetBindings: true },
      },
      completeJobPosition: { include: { positionTemplate: true } },
    },
  });

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.completeJob.presetBindings)),
  );

  return runs.map((run) => {
    const names = extractDisplayNames(run.completeJob.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: run.id,
      characterName: names.characterName,
      jobTitle: run.completeJob.title,
      positionName:
        run.completeJobPosition.name ??
        run.completeJobPosition.positionTemplate?.name ??
        `section_${run.completeJobPosition.sortOrder + 1}`,
      errorMessage: run.errorMessage,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Review Group — 单组审核详情（宫格页）
// ---------------------------------------------------------------------------

export async function getReviewGroup(runId: string): Promise<ReviewGroup | null> {
  const run = await prisma.positionRun.findUnique({
    where: { id: runId },
    include: {
      completeJob: {
        select: { id: true, title: true, presetBindings: true },
      },
      completeJobPosition: {
        include: { positionTemplate: true },
      },
      images: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!run) return null;

  // Resolve characterName from presetBindings
  const presetMap = await batchResolvePresetNames(
    collectPresetIds([run.completeJob.presetBindings]),
  );
  const names = extractDisplayNames(run.completeJob.presetBindings as PresetBindingJson | null, presetMap);

  const images: ReviewImage[] = run.images.map((img, index) => ({
    id: img.id,
    src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
    label: `${index + 1}`.padStart(2, "0"),
    status: img.reviewStatus as ReviewImage["status"],
  }));

  return {
    id: run.id,
    title: run.completeJob.title,
    characterName: names.characterName,
    positionName:
      run.completeJobPosition.name ??
      run.completeJobPosition.positionTemplate?.name ??
      `section_${run.completeJobPosition.sortOrder + 1}`,
    createdAt: formatDate(run.createdAt),
    pendingCount: images.filter((img) => img.status === "pending").length,
    totalCount: images.length,
    images,
  };
}

// ---------------------------------------------------------------------------
// Review Group 列表 — 用于上/下一组导航
// ---------------------------------------------------------------------------

export async function getReviewGroupIds(): Promise<string[]> {
  const runs = await prisma.positionRun.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return runs.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Jobs — 大任务列表
// ---------------------------------------------------------------------------

export async function getJobs(): Promise<JobCard[]> {
  const jobs = await prisma.completeJob.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      presetBindings: true,
      _count: { select: { positions: true } },
    },
  });

  // Batch resolve preset names
  const presetMap = await batchResolvePresetNames(
    collectPresetIds(jobs.map((j) => j.presetBindings)),
  );

  return jobs.map((job) => {
    const names = extractDisplayNames(job.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: job.id,
      title: job.title,
      characterName: names.characterName,
      sceneName: names.sceneName,
      styleName: names.styleName,
      status: job.status as JobCard["status"],
      updatedAt: formatDate(job.updatedAt),
      positionCount: job._count.positions,
    };
  });
}

// ---------------------------------------------------------------------------
// Job Detail — 大任务详情 + positions
// ---------------------------------------------------------------------------

/** Used by the frontend position-edit form */
export type JobDetailPosition = {
  id: string;
  name: string;
  batchSize: number | null;
  aspectRatio: string | null;
  seedPolicy1: string | null;
  seedPolicy2: string | null;
  promptOverview: {
    positivePrompt: string | null;
    negativePrompt: string | null;
  };
};

export type JobDetail = {
  id: string;
  title: string;
  characterName: string;
  sceneName: string;
  styleName: string;
  status: string;
  positions: {
    id: string;
    name: string;
    batchSize: number | null;
    aspectRatio: string | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    latestRunStatus: string | null;
    latestRunId: string | null;
    promptBlockCount: number;
    positiveBlockCount: number;
    negativeBlockCount: number;
    /** Thumbnail images from the latest completed run */
    latestImages: { id: string; src: string; status: string }[];
  }[];
};

export async function getJobDetail(jobId: string): Promise<JobDetail | null> {
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      status: true,
      presetBindings: true,
      positions: {
        orderBy: { sortOrder: "asc" },
        include: {
          positionTemplate: true,
          runs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              images: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  thumbPath: true,
                  filePath: true,
                  reviewStatus: true,
                },
              },
            },
          },
          promptBlocks: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, positive: true, negative: true },
          },
        },
      },
    },
  });

  if (!job) return null;

  // Resolve display names from presetBindings
  const presetMap = await batchResolvePresetNames(
    collectPresetIds([job.presetBindings]),
  );
  const names = extractDisplayNames(job.presetBindings as PresetBindingJson | null, presetMap);

  return {
    id: job.id,
    title: job.title,
    characterName: names.characterName,
    sceneName: names.sceneName,
    styleName: names.styleName,
    status: job.status,
    positions: job.positions.map((pos) => {
      const positiveBlockCount = pos.promptBlocks.filter((b) => b.positive?.trim()).length;
      const negativeBlockCount = pos.promptBlocks.filter((b) => b.negative?.trim()).length;
      const latestRun = pos.runs[0] ?? null;
      return {
        id: pos.id,
        name: pos.name || pos.positionTemplate?.name || `小节 ${pos.sortOrder}`,
        batchSize: pos.batchSize ?? pos.positionTemplate?.defaultBatchSize ?? null,
        aspectRatio: pos.aspectRatio ?? pos.positionTemplate?.defaultAspectRatio ?? null,
        // v0.3: dual seedPolicy
        seedPolicy1: pos.seedPolicy1 ?? pos.positionTemplate?.defaultSeedPolicy1 ?? null,
        seedPolicy2: pos.seedPolicy2 ?? pos.positionTemplate?.defaultSeedPolicy2 ?? null,
        latestRunStatus: latestRun?.status ?? null,
        latestRunId: latestRun?.id ?? null,
        promptBlockCount: pos.promptBlocks.length,
        positiveBlockCount,
        negativeBlockCount,
        latestImages: (latestRun?.images ?? []).map((img) => ({
          id: img.id,
          src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
          status: img.reviewStatus,
        })),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Position Results — 小节结果页
// ---------------------------------------------------------------------------

export type PositionResultsData = {
  jobId: string;
  jobTitle: string;
  positionId: string;
  positionName: string;
  runs: {
    id: string;
    runIndex: number;
    status: string;
    createdAt: string;
    images: {
      id: string;
      src: string;
      full: string;
      status: ReviewStatus;
      featured: boolean;
    }[];
  }[];
  /** 最新有 pending 图片的 run id（用于「跳转至审核」按钮） */
  pendingRunId: string | null;
  totalPending: number;
};

export async function getPositionResults(positionId: string): Promise<PositionResultsData | null> {
  const pos = await prisma.completeJobPosition.findUnique({
    where: { id: positionId },
    include: {
      positionTemplate: { select: { name: true } },
      completeJob: { select: { id: true, title: true } },
      runs: {
        orderBy: { createdAt: "desc" },
        include: {
          images: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              thumbPath: true,
              filePath: true,
              reviewStatus: true,
              featured: true,
            },
          },
        },
      },
    },
  });

  if (!pos) return null;

  let pendingRunId: string | null = null;
  let totalPending = 0;

  const runs = pos.runs.map((run) => {
    const images = run.images
      .filter((img) => img.reviewStatus !== "trashed")
      .map((img) => ({
        id: img.id,
        src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
        full: toImageUrl(img.filePath) ?? "",
        status: img.reviewStatus as ReviewStatus,
        featured: img.featured,
      }));

    const runPending = images.filter((img) => img.status === "pending").length;
    totalPending += runPending;

    if (runPending > 0 && !pendingRunId) {
      pendingRunId = run.id;
    }

    return {
      id: run.id,
      runIndex: run.runIndex,
      status: run.status,
      createdAt: formatDate(run.createdAt),
      images,
    };
  });

  return {
    jobId: pos.completeJob.id,
    jobTitle: pos.completeJob.title,
    positionId: pos.id,
    positionName: pos.name || pos.positionTemplate?.name || `小节`,
    runs,
    pendingRunId,
    totalPending,
  };
}

// ---------------------------------------------------------------------------
// Trash — 回收站
// ---------------------------------------------------------------------------

export async function getTrashItems(): Promise<TrashItem[]> {
  const records = await prisma.trashRecord.findMany({
    where: { restoredAt: null },
    orderBy: { deletedAt: "desc" },
    include: {
      imageResult: {
        include: {
          positionRun: {
            include: {
              completeJob: true,
              completeJobPosition: {
                include: { positionTemplate: true },
              },
            },
          },
        },
      },
    },
  });

  return records.map((rec) => {
    const run = rec.imageResult.positionRun;
    return {
      id: rec.id,
      src: toImageUrl(rec.imageResult.thumbPath ?? rec.imageResult.filePath) ?? "",
      title: `${run.completeJob.title} / ${run.completeJobPosition.positionTemplate?.name ?? "Unknown"}`,
      deletedAt: formatDate(rec.deletedAt),
      originalPath: rec.originalPath,
    };
  });
}

// ---------------------------------------------------------------------------
// LoRA Assets
// ---------------------------------------------------------------------------

export async function getLoraAssets(): Promise<LoraAsset[]> {
  const assets = await prisma.loraAsset.findMany({
    orderBy: { uploadedAt: "desc" },
  });

  return assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    relativePath: asset.relativePath,
    uploadedAt: formatDate(asset.uploadedAt),
  }));
}

// ---------------------------------------------------------------------------
// Prompt Library — 词库（用于添加提示词块时选择）
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Job Form Options — 创建/编辑 Job 所需的下拉选项
// ---------------------------------------------------------------------------

export type JobFormCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  presets: Array<{
    id: string;
    name: string;
    slug: string;
    prompt: string;
    negativePrompt: string | null;
    isActive: boolean;
  }>;
};

export type JobFormOptions = {
  categories: JobFormCategory[];
};

export async function getJobFormOptions(): Promise<JobFormOptions> {
  const categories = await prisma.promptCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, prompt: true, negativePrompt: true, isActive: true },
      },
    },
  });

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      presets: c.presets,
    })),
  };
}

// ---------------------------------------------------------------------------
// Job Edit Data — 编辑 Job 时加载完整数据
// ---------------------------------------------------------------------------

export type PresetBinding = { categoryId: string; presetId: string };

export type JobEditData = {
  id: string;
  title: string;
  slug: string;
  presetBindings: PresetBinding[];
  notes: string | null;
  positions: {
    id: string;
    positionTemplateId: string | null;
    sortOrder: number;
    enabled: boolean;
    positivePrompt: string | null;
    negativePrompt: string | null;
    aspectRatio: string | null;
    batchSize: number | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
  }[];
  // 小节默认值
  defaultAspectRatio: string;
  defaultShortSidePx: number;
  defaultBatchSize: number;
  defaultSeedPolicy1: string;
  defaultSeedPolicy2: string;
};

export async function getJobEditData(jobId: string): Promise<JobEditData | null> {
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    include: {
      positions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          positionTemplateId: true,
          sortOrder: true,
          enabled: true,
          positivePrompt: true,
          negativePrompt: true,
          aspectRatio: true,
          batchSize: true,
          seedPolicy1: true,
          seedPolicy2: true,
        },
      },
    },
  });

  if (!job) return null;

  // 解析 jobLevelOverrides
  const overrides = (job.jobLevelOverrides ?? {}) as {
    defaultAspectRatio?: string;
    defaultShortSidePx?: number;
    defaultBatchSize?: number;
    defaultSeedPolicy1?: string;
    defaultSeedPolicy2?: string;
  };

  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    presetBindings: Array.isArray(job.presetBindings) ? (job.presetBindings as PresetBinding[]) : [],
    notes: job.notes,
    positions: job.positions.map((pos) => ({
      ...pos,
    })),
    // 小节默认值
    defaultAspectRatio: overrides.defaultAspectRatio ?? "2:3",
    defaultShortSidePx: overrides.defaultShortSidePx ?? 512,
    defaultBatchSize: overrides.defaultBatchSize ?? 2,
    defaultSeedPolicy1: overrides.defaultSeedPolicy1 ?? "random",
    defaultSeedPolicy2: overrides.defaultSeedPolicy2 ?? "random",
  };
}

export async function getWorkflowTemplateOptions() {
  return listWorkflowTemplateSummaries();
}

// ---------------------------------------------------------------------------
// Prompt Categories & Presets — 统一提示词管理
// ---------------------------------------------------------------------------

export type PromptCategoryItem = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  positivePromptOrder: number;
  negativePromptOrder: number;
  lora1Order: number;
  lora2Order: number;
  sortOrder: number;
  presetCount: number;
};

export async function getPromptCategories(): Promise<PromptCategoryItem[]> {
  const categories = await prisma.promptCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { presets: true } } },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    color: c.color,
    positivePromptOrder: c.positivePromptOrder,
    negativePromptOrder: c.negativePromptOrder,
    lora1Order: c.lora1Order,
    lora2Order: c.lora2Order,
    sortOrder: c.sortOrder,
    presetCount: c._count.presets,
  }));
}

export type PromptPresetItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: unknown;
  lora2: unknown;
  defaultParams: unknown;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
};

export async function getPromptPresets(categoryId: string): Promise<PromptPresetItem[]> {
  const presets = await prisma.promptPreset.findMany({
    where: { categoryId },
    orderBy: { sortOrder: "asc" },
  });
  return presets.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    slug: p.slug,
    prompt: p.prompt,
    negativePrompt: p.negativePrompt,
    lora1: p.lora1,
    lora2: p.lora2,
    defaultParams: p.defaultParams,
    notes: p.notes,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  }));
}

export type PromptCategoryFull = PromptCategoryItem & {
  presets: PromptPresetItem[];
};

export async function getPromptCategoriesWithPresets(): Promise<PromptCategoryFull[]> {
  const categories = await prisma.promptCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { presets: true } },
      presets: { orderBy: { sortOrder: "asc" } },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    color: c.color,
    positivePromptOrder: c.positivePromptOrder,
    negativePromptOrder: c.negativePromptOrder,
    lora1Order: c.lora1Order,
    lora2Order: c.lora2Order,
    sortOrder: c.sortOrder,
    presetCount: c._count.presets,
    presets: c.presets.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      prompt: p.prompt,
      negativePrompt: p.negativePrompt,
      lora1: p.lora1,
      lora2: p.lora2,
      defaultParams: p.defaultParams,
      notes: p.notes,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    })),
  }));
}

/** V2 prompt library: dynamic categories for the block editor import panel */
export type PromptLibraryV2 = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
    presets: Array<{
      id: string;
      name: string;
      prompt: string;
      negativePrompt: string | null;
      lora1: unknown;
      lora2: unknown;
    }>;
  }>;
};

export async function getPromptLibraryV2(): Promise<PromptLibraryV2> {
  const categories = await prisma.promptCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, prompt: true, negativePrompt: true, lora1: true, lora2: true },
      },
    },
  });
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      color: c.color,
      icon: c.icon,
      presets: c.presets,
    })),
  };
}

// ---------------------------------------------------------------------------
// Job Revisions — 修订历史
// ---------------------------------------------------------------------------

export type JobRevisionSummary = {
  id: string;
  revisionNumber: number;
  actorType: string;
  createdAt: string;
};

export async function getJobRevisions(jobId: string): Promise<JobRevisionSummary[]> {
  const revisions = await prisma.jobRevision.findMany({
    where: { completeJobId: jobId },
    orderBy: { revisionNumber: "desc" },
    take: 20,
    select: {
      id: true,
      revisionNumber: true,
      actorType: true,
      createdAt: true,
    },
  });

  return revisions.map((rev) => ({
    id: rev.id,
    revisionNumber: rev.revisionNumber,
    actorType: rev.actorType,
    createdAt: formatDate(rev.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// PromptBlocks — 某个 Position 的提示词块列表
// ---------------------------------------------------------------------------

export type PositionBlockSummary = {
  id: string;
  type: string;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export async function getPositionBlocks(
  jobPositionId: string,
): Promise<PositionBlockSummary[]> {
  const { listPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const blocks = await listPromptBlocks(jobPositionId);
  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    label: b.label,
    positive: b.positive,
    negative: b.negative,
    sortOrder: b.sortOrder,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}
