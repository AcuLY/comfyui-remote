import { prisma } from "@/lib/prisma";
import { toImageUrl } from "@/lib/image-url";
import type { ProjectCard, TrashItem, ReviewStatus } from "@/lib/types";
import {
  batchResolvePresetNames,
  extractPresetNames,
  collectPresetIds,
  formatDate,
  type PresetBindingJson,
} from "@/server/repositories/queue-data-repository";

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
      runs: {
        where: { status: "done" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          createdAt: true,
          images: {
            orderBy: { createdAt: "asc" },
            take: 6,
            select: {
              id: true,
              thumbPath: true,
              filePath: true,
              reviewStatus: true,
            },
          },
          _count: {
            select: {
              images: true,
            },
          },
        },
      },
      _count: { select: { sections: true } },
    },
  });

  // Batch resolve preset names
  const presetMap = await batchResolvePresetNames(
    collectPresetIds(projects.map((j) => j.presetBindings)),
  );

  return projects.map((project) => {
    const presetNames = extractPresetNames(project.presetBindings as PresetBindingJson | null, presetMap);
    const latestRun = project.runs[0] ?? null;
    return {
      id: project.id,
      title: project.title,
      presetNames,
      status: project.status as ProjectCard["status"],
      updatedAt: formatDate(project.updatedAt),
      sectionCount: project._count.sections,
      latestRunId: latestRun?.id ?? null,
      latestRunAt: latestRun ? formatDate(latestRun.createdAt) : null,
      latestRunStatus: latestRun?.status as ProjectCard["latestRunStatus"],
      latestImages: (latestRun?.images ?? []).map((img) => ({
        id: img.id,
        src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
        status: img.reviewStatus as ReviewStatus,
      })),
      latestImageCount: latestRun?._count.images ?? 0,
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
  previousProject: { id: string; title: string } | null;
  nextProject: { id: string; title: string } | null;
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
    latestImageCount: number;
    pendingImageCount: number;
  }[];
};

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const [project, projectNavItems] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        status: true,
        presetBindings: true,
        projectLevelOverrides: true,
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
                  take: 8,
                  select: {
                    id: true,
                    thumbPath: true,
                    filePath: true,
                    reviewStatus: true,
                  },
                },
                _count: {
                  select: {
                    images: true,
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
    }),
    prisma.project.findMany({
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  if (!project) return null;

  const latestRunIds = project.sections
    .map((pos) => pos.runs[0]?.id)
    .filter((id): id is string => Boolean(id));
  const pendingCounts = latestRunIds.length
    ? await prisma.imageResult.groupBy({
        by: ["runId"],
        where: {
          runId: { in: latestRunIds },
          reviewStatus: "pending",
        },
        _count: { _all: true },
      })
    : [];
  const pendingCountByRunId = new Map(
    pendingCounts.map((row) => [row.runId, row._count._all]),
  );

  // Resolve display names from presetBindings
  const presetMap = await batchResolvePresetNames(
    collectPresetIds([project.presetBindings]),
  );
  const presetNames = extractPresetNames(project.presetBindings as PresetBindingJson | null, presetMap);
  const projectLevelOverrides = (project.projectLevelOverrides ?? {}) as {
    defaultBatchSize?: number;
    batchSize?: number;
  };
  const projectDefaultBatchSize =
    projectLevelOverrides.defaultBatchSize ??
    projectLevelOverrides.batchSize ??
    null;
  const projectIndex = projectNavItems.findIndex((item) => item.id === project.id);
  const previousProject = projectIndex > 0 ? projectNavItems[projectIndex - 1] : null;
  const nextProject =
    projectIndex >= 0 && projectIndex < projectNavItems.length - 1
      ? projectNavItems[projectIndex + 1]
      : null;

  return {
    id: project.id,
    title: project.title,
    presetNames,
    status: project.status,
    previousProject,
    nextProject,
    sections: project.sections.map((pos) => {
      const positiveBlockCount = pos.promptBlocks.filter((b) => b.positive?.trim()).length;
      const negativeBlockCount = pos.promptBlocks.filter((b) => b.negative?.trim()).length;
      const latestRun = pos.runs[0] ?? null;
      return {
        id: pos.id,
        name: pos.name || `小节 ${pos.sortOrder}`,
        batchSize: pos.batchSize ?? projectDefaultBatchSize,
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
        latestImageCount: latestRun?._count.images ?? 0,
        pendingImageCount: latestRun ? (pendingCountByRunId.get(latestRun.id) ?? 0) : 0,
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
  previousSection: { id: string; name: string } | null;
  nextSection: { id: string; name: string } | null;
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
  totalPending: number;
};

export type ProjectResultsData = {
  id: string;
  title: string;
  previousProject: { id: string; title: string } | null;
  nextProject: { id: string; title: string } | null;
  sections: {
    id: string;
    name: string;
    sortOrder: number;
    runCount: number;
    imageCount: number;
    pendingCount: number;
    featuredCount: number;
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
        width: number | null;
        height: number | null;
      }[];
    }[];
  }[];
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

  const projectSections = await prisma.projectSection.findMany({
    where: { projectId: pos.project.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
  const currentIndex = projectSections.findIndex((section) => section.id === pos.id);
  const previousSection =
    currentIndex > 0
      ? {
          id: projectSections[currentIndex - 1].id,
          name: projectSections[currentIndex - 1].name || `小节 ${projectSections[currentIndex - 1].sortOrder}`,
        }
      : null;
  const nextSection =
    currentIndex >= 0 && currentIndex < projectSections.length - 1
      ? {
          id: projectSections[currentIndex + 1].id,
          name: projectSections[currentIndex + 1].name || `小节 ${projectSections[currentIndex + 1].sortOrder}`,
        }
      : null;

  let totalPending = 0;

  const runs = pos.runs.map((run) => {
    const images = run.images
      .filter((img) => img.reviewStatus !== "trashed")
      .map((img) => ({
        id: img.id,
        src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
        full: (toImageUrl(img.filePath) ?? "") + "?q=80",
        status: img.reviewStatus as ReviewStatus,
        featured: img.featured,
      }));

    const runPending = images.filter((img) => img.status === "pending").length;
    totalPending += runPending;

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
    previousSection,
    nextSection,
    runs,
    totalPending,
  };
}

export async function getProjectResults(projectId: string): Promise<ProjectResultsData | null> {
  const [project, projectNavItems] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        sections: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            sortOrder: true,
            runs: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                runIndex: true,
                status: true,
                createdAt: true,
                images: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    thumbPath: true,
                    filePath: true,
                    reviewStatus: true,
                    featured: true,
                    width: true,
                    height: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.project.findMany({
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  if (!project) return null;

  const projectIndex = projectNavItems.findIndex((item) => item.id === project.id);
  const previousProject = projectIndex > 0 ? projectNavItems[projectIndex - 1] : null;
  const nextProject =
    projectIndex >= 0 && projectIndex < projectNavItems.length - 1
      ? projectNavItems[projectIndex + 1]
      : null;

  return {
    id: project.id,
    title: project.title,
    previousProject,
    nextProject,
    sections: project.sections.map((section) => {
      let imageCount = 0;
      let pendingCount = 0;
      let featuredCount = 0;

      const runs = section.runs.map((run) => {
        const images = run.images
          .filter((img) => img.reviewStatus !== "trashed")
          .map((img) => {
            imageCount += 1;
            if (img.reviewStatus === "pending") pendingCount += 1;
            if (img.featured) featuredCount += 1;

            return {
              id: img.id,
              src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
              full: (toImageUrl(img.filePath) ?? "") + "?q=80",
              status: img.reviewStatus as ReviewStatus,
              featured: img.featured,
              width: img.width,
              height: img.height,
            };
          });

        return {
          id: run.id,
          runIndex: run.runIndex,
          status: run.status,
          createdAt: formatDate(run.createdAt),
          images,
        };
      });

      return {
        id: section.id,
        name: section.name || `小节 ${section.sortOrder}`,
        sortOrder: section.sortOrder,
        runCount: runs.length,
        imageCount,
        pendingCount,
        featuredCount,
        runs,
      };
    }),
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
  checkpointName: string | null;
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
    checkpointName: project.checkpointName,
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

// ---------------------------------------------------------------------------
// PromptBlocks – 某个 Section 的提示词块列表
// ---------------------------------------------------------------------------

export type SectionBlockSummary = {
  id: string;
  type: string;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};
