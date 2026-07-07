"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { hrefWithFolderQuery } from "@/lib/folder-navigation";
import type { ProjectCard as ProjectCardData, ProjectFolderItem } from "@/lib/types";
import { resolveProjectListView } from "./project-list-view-model";

export function useProjectListViewState({
  initialProjects,
  folders,
  initialFolderId,
}: {
  initialProjects: ProjectCardData[];
  folders: ProjectFolderItem[];
  initialFolderId: string | null;
}) {
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchivedValue] = useState(false);

  const view = useMemo(
    () =>
      resolveProjectListView({
        projects: initialProjects,
        folders,
        currentFolderId,
        showArchived,
      }),
    [currentFolderId, folders, initialProjects, showArchived],
  );

  const clearProjectSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const navigateFolder = useCallback(
    (folderId: string | null) => {
      setCurrentFolderId(folderId);
      clearProjectSelection();
      router.replace(hrefWithFolderQuery("/projects", "folder", folderId), { scroll: false });
    },
    [clearProjectSelection, router],
  );

  const setShowArchived = useCallback(
    (value: boolean) => {
      setShowArchivedValue(value);
      clearProjectSelection();
    },
    [clearProjectSelection],
  );

  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const selectAllVisibleProjects = useCallback(() => {
    setSelectedIds(new Set(view.visibleProjects.map((project) => project.id)));
  }, [view.visibleProjects]);

  const refreshProjectList = useCallback(() => {
    router.refresh();
  }, [router]);

  return {
    ...view,
    currentFolderId,
    selectedIds,
    showArchived,
    setShowArchived,
    navigateFolder,
    toggleProjectSelection,
    selectAllVisibleProjects,
    clearProjectSelection,
    refreshProjectList,
  };
}
