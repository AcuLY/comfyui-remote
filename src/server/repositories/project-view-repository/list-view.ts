import { prisma } from "@/lib/prisma";
import { buildFolderScopedItemOrder } from "@/lib/folder-navigation";
import { toImageUrl } from "@/lib/image-url";
import type { ProjectCard, ProjectFolderItem, ReviewStatus } from "@/lib/types";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import {
  extractPresetNames,
  formatDate,
  PROJECT_PRESET_BINDING_DISPLAY_SELECT,
} from "@/server/repositories/queue-data-repository";

// ---------------------------------------------------------------------------
// Projects — 大项目列表
// ---------------------------------------------------------------------------

export async function listProjectNavigationItems() {
  const [folders, projects] = await Promise.all([
    prisma.projectFolder.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        parentId: true,
        sortOrder: true,
      },
    }),
    prisma.project.findMany({
      where: buildGenerationProjectWhere(),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        folderId: true,
      },
    }),
  ]);

  return buildFolderScopedItemOrder(folders, projects);
}

export async function listProjects(): Promise<ProjectCard[]> {
  const projects = await prisma.project.findMany({
    where: buildGenerationProjectWhere(),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      folderId: true,
      status: true,
      publishedAt: true,
      archivedAt: true,
      updatedAt: true,
      presetBindingRows: PROJECT_PRESET_BINDING_DISPLAY_SELECT,
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

  return projects.map((project) => {
    const presetNames = extractPresetNames(project.presetBindingRows);
    const latestRun = project.runs[0] ?? null;
    return {
      id: project.id,
      title: project.title,
      folderId: project.folderId,
      presetNames,
      status: project.status as ProjectCard["status"],
      publishedAt: project.publishedAt ? formatDate(project.publishedAt) : null,
      archivedAt: project.archivedAt ? formatDate(project.archivedAt) : null,
      updatedAt: formatDate(project.updatedAt),
      sectionCount: project._count.sections,
      latestRunId: latestRun?.id ?? null,
      latestRunAt: latestRun ? formatDate(latestRun.createdAt) : null,
      latestRunStatus: latestRun?.status as ProjectCard["latestRunStatus"],
      latestImages: project.archivedAt ? [] : (latestRun?.images ?? []).map((img) => ({
        id: img.id,
        src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
        status: img.reviewStatus as ReviewStatus,
      })),
      latestImageCount: project.archivedAt ? 0 : latestRun?._count.images ?? 0,
    };
  });
}

export async function listProjectFolders(): Promise<ProjectFolderItem[]> {
  const folders = await prisma.projectFolder.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      parentId: true,
      sortOrder: true,
      _count: {
        select: {
          projects: { where: buildGenerationProjectWhere() },
          children: true,
        },
      },
    },
  });

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    sortOrder: folder.sortOrder,
    projectCount: folder._count.projects,
    childCount: folder._count.children,
  }));
}
