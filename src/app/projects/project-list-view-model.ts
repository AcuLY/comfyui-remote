import type { ProjectCard as ProjectCardData, ProjectFolderItem } from "@/lib/types";

export type ProjectListViewInput = {
  projects: ProjectCardData[];
  folders: ProjectFolderItem[];
  currentFolderId: string | null;
  showArchived: boolean;
};

export type ProjectListViewState = {
  visibleFolders: ProjectFolderItem[];
  folderProjects: ProjectCardData[];
  visibleProjects: ProjectCardData[];
  countableProjects: ProjectCardData[];
  archivedProjectCount: number;
  breadcrumb: ProjectFolderItem[];
};

export function resolveProjectListView({
  projects,
  folders,
  currentFolderId,
  showArchived,
}: ProjectListViewInput): ProjectListViewState {
  const visibleFolders = folders.filter((folder) => (folder.parentId ?? null) === currentFolderId);
  const folderProjects = projects.filter((project) => (project.folderId ?? null) === currentFolderId);
  const visibleProjects = folderProjects.filter((project) => showArchived || !project.archivedAt);
  const countableProjects = showArchived ? projects : projects.filter((project) => !project.archivedAt);
  const archivedProjectCount = folderProjects.filter((project) => project.archivedAt).length;
  const breadcrumb: ProjectFolderItem[] = [];

  let folderId = currentFolderId;
  while (folderId) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) break;
    breadcrumb.unshift(folder);
    folderId = folder.parentId;
  }

  return {
    visibleFolders,
    folderProjects,
    visibleProjects,
    countableProjects,
    archivedProjectCount,
    breadcrumb,
  };
}
