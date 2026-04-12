import { prisma } from "@/lib/prisma";
import { toImageUrl } from "@/lib/image-url";
import type { QueueRun, RunningRun, FailedRun, ReviewGroup, ReviewImage, ReviewStatus, ProjectCard, TrashItem, LoraAsset } from "@/lib/types";
import { listWorkflowTemplateSummaries } from "@/server/services/workflow-template-service";

// Re-export types used by frontend components (originally from backend branch)
export type { ProjectCreateOptions } from "@/server/repositories/project-repository";

// ---------------------------------------------------------------------------
// Preset binding helpers — resolve display names from presetBindings JSON
// ---------------------------------------------------------------------------

type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;

async function batchResolvePresetNames(presetIds: string[]): Promise<Map<string, { name: string }>> {
  if (presetIds.length === 0) return new Map();
  const presets = await prisma.preset.findMany({
    where: { id: { in: presetIds } },
    select: { id: true, name: true },
  });
  return new Map(presets.map((p) => [p.id, { name: p.name }]));
}

function extractPresetNames(
  bindings: PresetBindingJson | null,
  presetMap: Map<string, { name: string }>,
): string[] {
  if (!bindings) return [];
  return bindings
    .map((b) => presetMap.get(b.presetId)?.name)
    .filter((n): n is string => !!n);
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
  const runs = await prisma.run.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
      images: true,
    },
  });

  // Batch resolve preset names
  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );

  return runs
    .map((run) => {
      const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);
      // Extract thumbnail from first image
      const firstImage = run.images[0] ?? null;
      const thumbnailUrl = firstImage
        ? (toImageUrl(firstImage.thumbPath ?? firstImage.filePath) ?? null)
        : null;
      return {
        id: run.id,
        presetNames,
        projectTitle: run.project.title,
        sectionName:
          run.projectSection.name ??
          run.projectSection.name ??
          `section_${run.projectSection.sortOrder + 1}`,
        createdAt: formatDate(run.createdAt),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        pendingCount: run.images.filter((img) => img.reviewStatus === "pending").length,
        totalCount: run.images.length,
        status: run.status as QueueRun["status"],
        thumbnailUrl,
      };
    })
    .filter((run) => run.pendingCount > 0);
}

// ---------------------------------------------------------------------------
// Running Runs — 当前运行中的任务
// ---------------------------------------------------------------------------

export async function getRunningRuns(): Promise<RunningRun[]> {
  const runs = await prisma.run.findMany({
    where: { status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
    },
  });

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );

  return runs.map((run) => {
    const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: run.id,
      presetNames,
      projectTitle: run.project.title,
      sectionName:
        run.projectSection.name ??
        `section_${run.projectSection.sortOrder + 1}`,
      startedAt: formatDate(run.createdAt),
      status: run.status as RunningRun["status"],
    };
  });
}

// ---------------------------------------------------------------------------
// Failed Runs — 最近失败的任务
// ---------------------------------------------------------------------------

export async function getFailedRuns(): Promise<FailedRun[]> {
  const runs = await prisma.run.findMany({
    where: { status: "failed" },
    orderBy: { finishedAt: "desc" },
    take: 20,
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
    },
  });

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );

  return runs.map((run) => {
    const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: run.id,
      presetNames,
      projectTitle: run.project.title,
      sectionName:
        run.projectSection.name ??
        `section_${run.projectSection.sortOrder + 1}`,
      errorMessage: run.errorMessage,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Review Group — 单组审核详情（宫格页）
// ---------------------------------------------------------------------------

export async function getReviewGroup(runId: string): Promise<ReviewGroup | null> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
      images: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!run) return null;

  // Resolve preset names from presetBindings
  const presetMap = await batchResolvePresetNames(
    collectPresetIds([run.project.presetBindings]),
  );
  const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);

  const images: ReviewImage[] = run.images.map((img, index) => ({
    id: img.id,
    src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
    full: toImageUrl(img.filePath) ?? "",
    label: `${index + 1}`.padStart(2, "0"),
    status: img.reviewStatus as ReviewImage["status"],
  }));

  return {
    id: run.id,
    title: run.project.title,
    presetNames,
    sectionName:
      run.projectSection.name ??
      `section_${run.projectSection.sortOrder + 1}`,
    createdAt: formatDate(run.createdAt),
    pendingCount: images.filter((img) => img.status === "pending").length,
    totalCount: images.length,
    images,
    executionMeta: (run.executionMeta as Record<string, unknown>) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Review Group 列表 — 用于上/下一组导航
// ---------------------------------------------------------------------------

export async function getReviewGroupIds(): Promise<string[]> {
  const runs = await prisma.run.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return runs.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Projects — 大项目列表
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<ProjectCard[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      presetBindings: true,
      _count: { select: { sections: true } },
    },
  });

  // Batch resolve preset names
  const presetMap = await batchResolvePresetNames(
    collectPresetIds(projects.map((j) => j.presetBindings)),
  );

  return projects.map((project) => {
    const presetNames = extractPresetNames(project.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: project.id,
      title: project.title,
      presetNames,
      status: project.status as ProjectCard["status"],
      updatedAt: formatDate(project.updatedAt),
      sectionCount: project._count.sections,
    };
  });
}

// ---------------------------------------------------------------------------
// Project Detail — 大项目详情 + sections
// ---------------------------------------------------------------------------

/** Used by the frontend section-edit form */
export type ProjectDetailSection = {
  id: string;
  name: string;
  batchSize: number | null;
  upscaleFactor: number | null;
  aspectRatio: string | null;
  seedPolicy1: string | null;
  seedPolicy2: string | null;
  promptOverview: {
    positivePrompt: string | null;
    negativePrompt: string | null;
  };
};

export type ProjectDetail = {
  id: string;
  title: string;
  presetNames: string[];
  status: string;
  sections: {
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

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      status: true,
      presetBindings: true,
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          runs: {
            where: { status: "done" },
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

  if (!project) return null;

  // Resolve display names from presetBindings
  const presetMap = await batchResolvePresetNames(
    collectPresetIds([project.presetBindings]),
  );
  const presetNames = extractPresetNames(project.presetBindings as PresetBindingJson | null, presetMap);

  return {
    id: project.id,
    title: project.title,
    presetNames,
    status: project.status,
    sections: project.sections.map((pos) => {
      const positiveBlockCount = pos.promptBlocks.filter((b) => b.positive?.trim()).length;
      const negativeBlockCount = pos.promptBlocks.filter((b) => b.negative?.trim()).length;
      const latestRun = pos.runs[0] ?? null;
      return {
        id: pos.id,
        name: pos.name || `小节 ${pos.sortOrder}`,
        batchSize: pos.batchSize,
        aspectRatio: pos.aspectRatio,
        seedPolicy1: pos.seedPolicy1,
        seedPolicy2: pos.seedPolicy2,
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
// Section Results — 小节结果页
// ---------------------------------------------------------------------------

export type SectionResultsData = {
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
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

export async function getSectionResults(sectionId: string): Promise<SectionResultsData | null> {
  const pos = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    include: {
      project: { select: { id: true, title: true } },
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
    projectId: pos.project.id,
    projectTitle: pos.project.title,
    sectionId: pos.id,
    sectionName: pos.name || `小节`,
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
          run: {
            include: {
              project: true,
              projectSection: true,
            },
          },
        },
      },
    },
  });

  return records.map((rec) => {
    const run = rec.imageResult.run;
    return {
      id: rec.id,
      src: toImageUrl(rec.imageResult.thumbPath ?? rec.imageResult.filePath) ?? "",
      title: `${run.project.title} / ${run.projectSection.name ?? "Unknown"}`,
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
// Prompt Library — 预制库（用于导入预制时选择）
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Project Form Options — 创建/编辑 Project 所需的下拉选项
// ---------------------------------------------------------------------------

export type ProjectFormCategory = {
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
    isActive: boolean;
    variants: Array<{
      id: string;
      name: string;
      slug: string;
      prompt: string;
      negativePrompt: string | null;
      isActive: boolean;
    }>;
  }>;
};

export type ProjectFormOptions = {
  categories: ProjectFormCategory[];
};


export async function getProjectFormOptions(): Promise<ProjectFormOptions> {
  const categories = await prisma.presetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, slug: true, prompt: true, negativePrompt: true, isActive: true },
          },
        },
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
      presets: c.presets.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        variants: p.variants,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Project Edit Data — 编辑 Project 时加载完整数据
// ---------------------------------------------------------------------------

export type PresetBinding = { categoryId: string; presetId: string; variantId?: string };

export type ProjectEditData = {
  id: string;
  title: string;
  slug: string;
  presetBindings: PresetBinding[];
  notes: string | null;
  sections: {
    id: string;
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
  defaultUpscaleFactor: number;
  defaultSeedPolicy1: string;
  defaultSeedPolicy2: string;
  defaultKsampler1: Record<string, unknown>;
  defaultKsampler2: Record<string, unknown>;
};

export async function getProjectEditData(projectId: string): Promise<ProjectEditData | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
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

  if (!project) return null;

  // 解析 projectLevelOverrides
  const overrides = (project.projectLevelOverrides ?? {}) as {
    defaultAspectRatio?: string;
    defaultShortSidePx?: number;
    defaultBatchSize?: number;
    defaultUpscaleFactor?: number;
    defaultSeedPolicy1?: string;
    defaultSeedPolicy2?: string;
    defaultKsampler1?: Record<string, unknown>;
    defaultKsampler2?: Record<string, unknown>;
  };

  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    presetBindings: Array.isArray(project.presetBindings) ? (project.presetBindings as PresetBinding[]) : [],
    notes: project.notes,
    sections: project.sections.map((pos) => ({
      ...pos,
    })),
    // 小节默认值
    defaultAspectRatio: overrides.defaultAspectRatio ?? "2:3",
    defaultShortSidePx: overrides.defaultShortSidePx ?? 512,
    defaultBatchSize: overrides.defaultBatchSize ?? 2,
    defaultUpscaleFactor: overrides.defaultUpscaleFactor ?? 2,
    defaultSeedPolicy1: overrides.defaultSeedPolicy1 ?? "random",
    defaultSeedPolicy2: overrides.defaultSeedPolicy2 ?? "random",
    defaultKsampler1: overrides.defaultKsampler1 ?? {},
    defaultKsampler2: overrides.defaultKsampler2 ?? {},
  };
}

export async function getWorkflowTemplateOptions() {
  return listWorkflowTemplateSummaries();
}

// ---------------------------------------------------------------------------
// Preset Categories & Presets — 预制管理
// ---------------------------------------------------------------------------

export type SlotTemplateDef = { categoryId: string; label?: string };

export type PresetCategoryItem = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  type: string; // "preset" | "group"
  slotTemplate: SlotTemplateDef[];
  positivePromptOrder: number;
  negativePromptOrder: number;
  lora1Order: number;
  lora2Order: number;
  sortOrder: number;
  presetCount: number;
  groupCount: number;
};

export async function getPresetCategories(): Promise<PresetCategoryItem[]> {
  const categories = await prisma.presetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          presets: { where: { isActive: true } },
          groups: { where: { isActive: true } },
        },
      },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    color: c.color,
    type: c.type,
    slotTemplate: (Array.isArray(c.slotTemplate) ? c.slotTemplate : []) as SlotTemplateDef[],
    positivePromptOrder: c.positivePromptOrder,
    negativePromptOrder: c.negativePromptOrder,
    lora1Order: c.lora1Order,
    lora2Order: c.lora2Order,
    sortOrder: c.sortOrder,
    presetCount: c._count.presets,
    groupCount: c._count.groups,
  }));
}

export type PresetItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
  folderId: string | null;
  variantCount: number;
};

export type LinkedVariantRef = { presetId: string; variantId: string };

export type PresetVariantItem = {
  id: string;
  presetId: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: unknown;
  lora2: unknown;
  defaultParams: unknown;
  linkedVariants: LinkedVariantRef[];
  sortOrder: number;
  isActive: boolean;
};

export async function getPresets(categoryId: string): Promise<PresetItem[]> {
  const presets = await prisma.preset.findMany({
    where: { categoryId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { variants: true } } },
  });
  return presets.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    slug: p.slug,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    notes: p.notes,
    folderId: p.folderId,
    variantCount: p._count.variants,
  }));
}

export type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type PresetCategoryFull = PresetCategoryItem & {
  presets: PresetFull[];
  groups: PresetGroupItem[];
  folders: FolderItem[];
};

export type PresetFull = PresetItem & {
  variants: PresetVariantItem[];
};

export async function getPresetCategoriesWithPresets(): Promise<PresetCategoryFull[]> {
  const categories = await prisma.presetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          presets: { where: { isActive: true } },
          groups: { where: { isActive: true } },
        },
      },
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { variants: true } },
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      groups: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          members: { orderBy: { sortOrder: "asc" } },
        },
      },
      folders: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Resolve display names for group members (batch)
  const allPresetIds = new Set<string>();
  const allVariantIds = new Set<string>();
  const allGroupIds = new Set<string>();
  for (const c of categories) {
    for (const g of c.groups) {
      for (const m of g.members) {
        if (m.presetId) allPresetIds.add(m.presetId);
        if (m.variantId) allVariantIds.add(m.variantId);
        if (m.subGroupId) allGroupIds.add(m.subGroupId);
      }
    }
  }
  const [presetNames, variantNames, groupNames] = await Promise.all([
    allPresetIds.size > 0
      ? prisma.preset.findMany({ where: { id: { in: [...allPresetIds] } }, select: { id: true, name: true } })
      : [],
    allVariantIds.size > 0
      ? prisma.presetVariant.findMany({ where: { id: { in: [...allVariantIds] } }, select: { id: true, name: true } })
      : [],
    allGroupIds.size > 0
      ? prisma.presetGroup.findMany({ where: { id: { in: [...allGroupIds] } }, select: { id: true, name: true } })
      : [],
  ]);
  const pMap = new Map(presetNames.map((p) => [p.id, p.name]));
  const vMap = new Map(variantNames.map((v) => [v.id, v.name]));
  const gMap = new Map(groupNames.map((g) => [g.id, g.name]));

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    color: c.color,
    type: c.type,
    slotTemplate: (Array.isArray(c.slotTemplate) ? c.slotTemplate : []) as SlotTemplateDef[],
    positivePromptOrder: c.positivePromptOrder,
    negativePromptOrder: c.negativePromptOrder,
    lora1Order: c.lora1Order,
    lora2Order: c.lora2Order,
    sortOrder: c.sortOrder,
    presetCount: c._count.presets,
    groupCount: c._count.groups,
    presets: c.presets.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      notes: p.notes,
      folderId: p.folderId,
      variantCount: p._count.variants,
      variants: p.variants.map((v) => ({
        id: v.id,
        presetId: v.presetId,
        name: v.name,
        slug: v.slug,
        prompt: v.prompt,
        negativePrompt: v.negativePrompt,
        lora1: v.lora1,
        lora2: v.lora2,
        defaultParams: v.defaultParams,
        linkedVariants: (Array.isArray(v.linkedVariants) ? v.linkedVariants : []) as LinkedVariantRef[],
        sortOrder: v.sortOrder,
        isActive: v.isActive,
      })),
    })),
    groups: c.groups.map((g) => ({
      id: g.id,
      categoryId: g.categoryId,
      name: g.name,
      slug: g.slug,
      sortOrder: g.sortOrder,
      folderId: g.folderId,
      members: g.members.map((m) => ({
        id: m.id,
        presetId: m.presetId,
        variantId: m.variantId,
        subGroupId: m.subGroupId,
        slotCategoryId: m.slotCategoryId,
        sortOrder: m.sortOrder,
        presetName: m.presetId ? pMap.get(m.presetId) : undefined,
        variantName: m.variantId ? vMap.get(m.variantId) : undefined,
        subGroupName: m.subGroupId ? gMap.get(m.subGroupId) : undefined,
      })),
    })),
    folders: c.folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      sortOrder: f.sortOrder,
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
    type: string; // "preset" | "group"
    positivePromptOrder?: number;
    lora1Order?: number;
    lora2Order?: number;
    folders: Array<{ id: string; name: string; parentId: string | null; sortOrder: number }>;
    presets: Array<{
      id: string;
      name: string;
      folderId: string | null;
      variants: Array<{
        id: string;
        name: string;
        prompt: string;
        negativePrompt: string | null;
        lora1: unknown;
        lora2: unknown;
        linkedVariants: unknown;
      }>;
    }>;
    groups: Array<{
      id: string;
      name: string;
      slug: string;
      folderId: string | null;
      members: Array<{
        id: string;
        presetId: string | null;
        variantId: string | null;
        subGroupId: string | null;
        presetName?: string;
        variantName?: string;
        subGroupName?: string;
      }>;
    }>;
  }>;
};

export async function getPromptLibraryV2(): Promise<PromptLibraryV2> {
  const categories = await prisma.presetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      folders: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, parentId: true, sortOrder: true },
      },
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          folderId: true,
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, prompt: true, negativePrompt: true, lora1: true, lora2: true, linkedVariants: true },
          },
        },
      },
      groups: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          members: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  // Resolve member display names for groups
  const allPresetIds = new Set<string>();
  const allVariantIds = new Set<string>();
  const allSubGroupIds = new Set<string>();
  for (const c of categories) {
    for (const g of c.groups) {
      for (const m of g.members) {
        if (m.presetId) allPresetIds.add(m.presetId);
        if (m.variantId) allVariantIds.add(m.variantId);
        if (m.subGroupId) allSubGroupIds.add(m.subGroupId);
      }
    }
  }

  const [presetNames, variantNames, groupNames] = await Promise.all([
    allPresetIds.size > 0
      ? prisma.preset.findMany({ where: { id: { in: [...allPresetIds] } }, select: { id: true, name: true } })
      : [],
    allVariantIds.size > 0
      ? prisma.presetVariant.findMany({ where: { id: { in: [...allVariantIds] } }, select: { id: true, name: true } })
      : [],
    allSubGroupIds.size > 0
      ? prisma.presetGroup.findMany({ where: { id: { in: [...allSubGroupIds] } }, select: { id: true, name: true } })
      : [],
  ]);

  const presetNameMap = new Map(presetNames.map((p) => [p.id, p.name]));
  const variantNameMap = new Map(variantNames.map((v) => [v.id, v.name]));
  const groupNameMap = new Map(groupNames.map((g) => [g.id, g.name]));

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      color: c.color,
      icon: c.icon,
      type: c.type,
      positivePromptOrder: c.positivePromptOrder,
      lora1Order: c.lora1Order,
      lora2Order: c.lora2Order,
      folders: c.folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        sortOrder: f.sortOrder,
      })),
      presets: c.presets.map((p) => ({
        id: p.id,
        name: p.name,
        folderId: p.folderId,
        variants: p.variants,
      })),
      groups: c.groups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        folderId: g.folderId,
        members: g.members.map((m) => ({
          id: m.id,
          presetId: m.presetId,
          variantId: m.variantId,
          subGroupId: m.subGroupId,
          presetName: m.presetId ? presetNameMap.get(m.presetId) : undefined,
          variantName: m.variantId ? variantNameMap.get(m.variantId) : undefined,
          subGroupName: m.subGroupId ? groupNameMap.get(m.subGroupId) : undefined,
        })),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Preset Groups — 预制组
// ---------------------------------------------------------------------------

export type PresetGroupItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  folderId: string | null;
  members: Array<{
    id: string;
    presetId: string | null;
    variantId: string | null;
    subGroupId: string | null;
    slotCategoryId: string | null;
    sortOrder: number;
    presetName?: string;
    variantName?: string;
    subGroupName?: string;
  }>;
};

export async function getPresetGroups(): Promise<PresetGroupItem[]> {
  const groups = await prisma.presetGroup.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      members: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Resolve display names for members
  const allPresetIds = new Set<string>();
  const allVariantIds = new Set<string>();
  const allGroupIds = new Set<string>();
  for (const g of groups) {
    for (const m of g.members) {
      if (m.presetId) allPresetIds.add(m.presetId);
      if (m.variantId) allVariantIds.add(m.variantId);
      if (m.subGroupId) allGroupIds.add(m.subGroupId);
    }
  }

  const [presetNames, variantNames, groupNames] = await Promise.all([
    allPresetIds.size > 0
      ? prisma.preset.findMany({ where: { id: { in: [...allPresetIds] } }, select: { id: true, name: true } })
      : [],
    allVariantIds.size > 0
      ? prisma.presetVariant.findMany({ where: { id: { in: [...allVariantIds] } }, select: { id: true, name: true } })
      : [],
    allGroupIds.size > 0
      ? prisma.presetGroup.findMany({ where: { id: { in: [...allGroupIds] } }, select: { id: true, name: true } })
      : [],
  ]);

  const pMap = new Map(presetNames.map((p) => [p.id, p.name]));
  const vMap = new Map(variantNames.map((v) => [v.id, v.name]));
  const gMap = new Map(groupNames.map((g) => [g.id, g.name]));

  return groups.map((g) => ({
    id: g.id,
    categoryId: g.categoryId,
    name: g.name,
    slug: g.slug,
    sortOrder: g.sortOrder,
    folderId: g.folderId,
    members: g.members.map((m) => ({
      id: m.id,
      presetId: m.presetId,
      variantId: m.variantId,
      subGroupId: m.subGroupId,
      slotCategoryId: m.slotCategoryId,
      sortOrder: m.sortOrder,
      presetName: m.presetId ? pMap.get(m.presetId) : undefined,
      variantName: m.variantId ? vMap.get(m.variantId) : undefined,
      subGroupName: m.subGroupId ? gMap.get(m.subGroupId) : undefined,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Project Revisions — 修订历史
// ---------------------------------------------------------------------------

export type ProjectRevisionSummary = {
  id: string;
  revisionNumber: number;
  actorType: string;
  createdAt: string;
};

export async function getProjectRevisions(projectId: string): Promise<ProjectRevisionSummary[]> {
  const revisions = await prisma.projectRevision.findMany({
    where: { projectId: projectId },
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
// PromptBlocks — 某个 Section 的提示词块列表
// ---------------------------------------------------------------------------

export type SectionBlockSummary = {
  id: string;
  type: string;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export async function getSectionBlocks(
  sectionId: string,
): Promise<SectionBlockSummary[]> {
  const { listPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const blocks = await listPromptBlocks(sectionId);
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
