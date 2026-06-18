import { prisma } from "@/lib/prisma";
import { buildFolderScopedItemOrder } from "@/lib/folder-navigation";
import { toImageUrl } from "@/lib/image-url";
import type { ReviewStatus } from "@/lib/types";
import {
  extractPresetNames,
  formatDate,
  PROJECT_PRESET_BINDING_DISPLAY_SELECT,
} from "@/server/repositories/queue-data-repository";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { resolveSectionConfigsById } from "@/server/repositories/project-repository/helpers";
import { resolveSectionConfig } from "@/server/prompt-config/section-resolver";
import { listProjectNavigationItems } from "./list-view";
import type { ResolvedSectionConfig } from "@/server/prompt-config/types";

// ---------------------------------------------------------------------------
// Project Detail — 大项目详情 + sections
// ---------------------------------------------------------------------------

/** Used by the frontend section-edit form */
export type ProjectDetailSection = {
  id: string;
  name: string;
  batchSize: number | null;
  upscaleFactor: number | null;
  useTwoStageKSampler: boolean;
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
  folderId: string | null;
  presetNames: string[];
  status: string;
  previousProject: { id: string; title: string } | null;
  nextProject: { id: string; title: string } | null;
  sectionFolders: ProjectSectionFolderItem[];
  sections: {
    id: string;
    name: string;
    folderId: string | null;
    batchSize: number | null;
    aspectRatio: string | null;
    useTwoStageKSampler: boolean;
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

export type ProjectSectionFolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  sectionCount: number;
  childCount: number;
};

function readResolvedNumber(
  resolvedConfig: ResolvedSectionConfig,
  key: string,
) {
  const value = resolvedConfig.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readResolvedString(
  resolvedConfig: ResolvedSectionConfig,
  key: string,
) {
  const value = resolvedConfig.parameters[key];
  return typeof value === "string" ? value : null;
}

function readResolvedBoolean(
  resolvedConfig: ResolvedSectionConfig,
  key: string,
) {
  const value = resolvedConfig.parameters[key];
  return typeof value === "boolean" ? value : null;
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const [project, projectNavItems] = await Promise.all([
    prisma.project.findFirst({
      where: buildGenerationProjectWhere({ id: projectId }),
      select: {
        id: true,
        title: true,
        folderId: true,
        status: true,
        presetBindingRows: PROJECT_PRESET_BINDING_DISPLAY_SELECT,
        projectLevelOverrides: true,
        sectionFolders: {
          orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            parentId: true,
            sortOrder: true,
            _count: {
              select: {
                sections: true,
                children: true,
              },
            },
          },
        },
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
          },
        },
      },
    }),
    listProjectNavigationItems(),
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
  const resolvedConfigsBySectionId = await resolveSectionConfigsById(
    project.sections.map((section) => section.id),
  );

  const presetNames = extractPresetNames(project.presetBindingRows);
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
    folderId: project.folderId,
    presetNames,
    status: project.status,
    previousProject,
    nextProject,
    sectionFolders: project.sectionFolders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      sortOrder: folder.sortOrder,
      sectionCount: folder._count.sections,
      childCount: folder._count.children,
    })),
    sections: project.sections.map((pos) => {
      const resolvedConfig = resolvedConfigsBySectionId.get(pos.id);
      if (!resolvedConfig) {
        throw new Error("JOB_POSITION_CONFIG_NOT_FOUND");
      }
      const positiveBlockCount = resolvedConfig.promptBlocks.filter((b) => b.positive.trim()).length;
      const negativeBlockCount = resolvedConfig.promptBlocks.filter((b) => b.negative?.trim()).length;
      const latestRun = pos.runs[0] ?? null;
      return {
        id: pos.id,
        name: pos.name || `小节 ${pos.sortOrder}`,
        folderId: pos.folderId,
        batchSize: readResolvedNumber(resolvedConfig, "batchSize") ?? projectDefaultBatchSize,
        aspectRatio: readResolvedString(resolvedConfig, "aspectRatio"),
        useTwoStageKSampler: readResolvedBoolean(resolvedConfig, "useTwoStageKSampler") ?? true,
        seedPolicy1: readResolvedString(resolvedConfig, "seedPolicy1"),
        seedPolicy2: readResolvedString(resolvedConfig, "seedPolicy2"),
        latestRunStatus: latestRun?.status ?? null,
        latestRunId: latestRun?.id ?? null,
        promptBlockCount: resolvedConfig.promptBlocks.length,
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

type SectionResultImageData = {
  id: string;
  src: string;
  full: string;
  status: ReviewStatus;
  featured: boolean;
  featured2: boolean;
  cover: boolean;
  censoredSrc: string | null;
  censoredFull: string | null;
  censoredAt: string | null;
};

type SectionResultRunData = {
  id: string;
  runIndex: number;
  status: string;
  createdAt: string;
  images: SectionResultImageData[];
};

type ContinuousReviewImageData = SectionResultImageData & {
  runIndex: number;
  sectionId: string;
  sectionName: string;
  sectionSortOrder: number;
};

type SectionResultImageSource = {
  id: string;
  thumbPath: string | null;
  filePath: string;
  reviewStatus: string;
  featured: boolean;
  featured2: boolean;
  censoredFilePath: string | null;
  censoredThumbPath: string | null;
  censoredAt: Date | null;
};

export type SectionResultsData = {
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
  sectionSortOrder: number;
  batchSize: number | null;
  sectionFolderId: string | null;
  previousSection: { id: string; name: string } | null;
  nextSection: { id: string; name: string } | null;
  nextPendingSection: { id: string; name: string } | null;
  runs: SectionResultRunData[];
  continuousReviewImages: ContinuousReviewImageData[];
  totalPending: number;
};

function serializeSectionResultImage(
  img: SectionResultImageSource,
  coverImageId: string | null,
): SectionResultImageData {
  return {
    id: img.id,
    src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
    full: toImageUrl(img.filePath) ?? "",
    status: img.reviewStatus as ReviewStatus,
    featured: img.featured,
    featured2: img.featured2,
    cover: img.id === coverImageId,
    censoredSrc: img.censoredThumbPath ? toImageUrl(img.censoredThumbPath, img.censoredAt) ?? "" : null,
    censoredFull: img.censoredFilePath ? toImageUrl(img.censoredFilePath, img.censoredAt) ?? "" : null,
    censoredAt: img.censoredAt ? img.censoredAt.toISOString() : null,
  };
}

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
    keptCount: number;
    pendingCount: number;
    featuredCount: number;
    featured2Count: number;
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
        featured2: boolean;
        cover: boolean;
        width: number | null;
        height: number | null;
        censoredSrc: string | null;
        censoredFull: string | null;
        censoredAt: string | null;
      }[];
    }[];
  }[];
};

export async function getSectionResults(sectionId: string): Promise<SectionResultsData | null> {
  const pos = await prisma.projectSection.findFirst({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          coverImageId: true,
          projectLevelOverrides: true,
        },
      },
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
              featured2: true,
              censoredFilePath: true,
              censoredThumbPath: true,
              censoredAt: true,
            },
          },
        },
      },
    },
  });

  if (!pos) return null;

  const [projectSectionFolders, projectSections, pendingRuns, resolvedConfig] = await Promise.all([
    prisma.projectSectionFolder.findMany({
      where: { projectId: pos.project.id },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parentId: true, sortOrder: true },
    }),
    prisma.projectSection.findMany({
      where: { projectId: pos.project.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        folderId: true,
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
                featured2: true,
                censoredFilePath: true,
                censoredThumbPath: true,
                censoredAt: true,
              },
            },
          },
        },
      },
    }),
    prisma.run.findMany({
      where: {
        projectId: pos.project.id,
        project: buildGenerationProjectWhere(),
        images: {
          some: { reviewStatus: "pending" },
        },
      },
      select: { projectSectionId: true },
    }),
    resolveSectionConfig(pos.id),
  ]);
  const projectLevelOverrides = (pos.project.projectLevelOverrides ?? {}) as {
    defaultBatchSize?: number;
    batchSize?: number;
  };
  const projectDefaultBatchSize =
    projectLevelOverrides.defaultBatchSize ??
    projectLevelOverrides.batchSize ??
    null;
  const resolvedBatchSize = resolvedConfig
    ? readResolvedNumber(resolvedConfig, "batchSize")
    : null;
  const orderedProjectSections = buildFolderScopedItemOrder(projectSectionFolders, projectSections);
  const currentIndex = orderedProjectSections.findIndex((section) => section.id === pos.id);
  const previousSection =
    currentIndex > 0
      ? {
          id: orderedProjectSections[currentIndex - 1].id,
          name: orderedProjectSections[currentIndex - 1].name || `小节 ${orderedProjectSections[currentIndex - 1].sortOrder}`,
        }
      : null;
  const nextSection =
    currentIndex >= 0 && currentIndex < orderedProjectSections.length - 1
      ? {
          id: orderedProjectSections[currentIndex + 1].id,
          name: orderedProjectSections[currentIndex + 1].name || `小节 ${orderedProjectSections[currentIndex + 1].sortOrder}`,
        }
      : null;
  const pendingSectionIds = new Set(
    pendingRuns.map((run) => run.projectSectionId).filter((id) => id !== pos.id),
  );
  const nextPendingSource =
    currentIndex >= 0 && pendingSectionIds.size > 0
      ? [
          ...orderedProjectSections.slice(currentIndex + 1),
          ...orderedProjectSections.slice(0, currentIndex),
        ].find((section) => pendingSectionIds.has(section.id))
      : null;
  const nextPendingSection = nextPendingSource
    ? {
        id: nextPendingSource.id,
        name: nextPendingSource.name || `小节 ${nextPendingSource.sortOrder}`,
      }
    : null;

  let totalPending = 0;

  const runs = pos.runs.map((run) => {
    const images = run.images
      .filter((img) => img.reviewStatus !== "trashed")
      .map((img) => serializeSectionResultImage(img, pos.project.coverImageId));

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
  const continuousReviewImages = orderedProjectSections.flatMap((section) =>
    section.runs.flatMap((run) =>
      run.images
        .filter((img) => img.reviewStatus !== "trashed")
        .map((img) => ({
          ...serializeSectionResultImage(img, pos.project.coverImageId),
          runIndex: run.runIndex,
          sectionId: section.id,
          sectionName: section.name || `小节 ${section.sortOrder + 1}`,
          sectionSortOrder: section.sortOrder,
        })),
    ),
  );

  return {
    projectId: pos.project.id,
    projectTitle: pos.project.title,
    sectionId: pos.id,
    sectionName: pos.name || `小节`,
    sectionSortOrder: pos.sortOrder,
    batchSize: resolvedBatchSize ?? projectDefaultBatchSize,
    sectionFolderId: pos.folderId,
    previousSection,
    nextSection,
    nextPendingSection,
    runs,
    continuousReviewImages,
    totalPending,
  };
}

export async function getProjectResults(projectId: string): Promise<ProjectResultsData | null> {
  const [project, projectNavItems] = await Promise.all([
    prisma.project.findFirst({
      where: buildGenerationProjectWhere({ id: projectId }),
      select: {
        id: true,
        title: true,
        coverImageId: true,
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
                    featured2: true,
                    width: true,
                    height: true,
                    censoredFilePath: true,
                    censoredThumbPath: true,
                    censoredAt: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    listProjectNavigationItems(),
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
      let keptCount = 0;
      let pendingCount = 0;
      let featuredCount = 0;
      let featured2Count = 0;

      const runs = section.runs.map((run) => {
        const images = run.images
          .filter((img) => img.reviewStatus !== "trashed")
          .map((img) => {
            imageCount += 1;
            if (img.reviewStatus === "kept") keptCount += 1;
            if (img.reviewStatus === "pending") pendingCount += 1;
            if (img.featured) featuredCount += 1;
            if (img.featured2) featured2Count += 1;

            return {
              id: img.id,
              src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
              full: toImageUrl(img.filePath) ?? "",
              status: img.reviewStatus as ReviewStatus,
              featured: img.featured,
              featured2: img.featured2,
              cover: img.id === project.coverImageId,
              width: img.width,
              height: img.height,
              censoredSrc: img.censoredThumbPath ? toImageUrl(img.censoredThumbPath, img.censoredAt) ?? "" : null,
              censoredFull: img.censoredFilePath ? toImageUrl(img.censoredFilePath, img.censoredAt) ?? "" : null,
              censoredAt: img.censoredAt ? img.censoredAt.toISOString() : null,
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
        keptCount,
        pendingCount,
        featuredCount,
        featured2Count,
        runs,
      };
    }),
  };
}
