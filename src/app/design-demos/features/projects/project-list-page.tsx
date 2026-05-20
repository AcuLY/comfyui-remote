"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, Save, X } from "lucide-react";

import type { DemoData } from "../../data";
import { cx, demoHref } from "../../routing";
import s from "./project-list-page.projects.module.css";
import { Button } from "../../shared/primitives/button";
import { PageHeader } from "../../shared/primitives/page-header";
import {
  ProjectBatchBar,
  ProjectFolderBreadcrumb,
  ProjectFolderRow,
  buildProjectFolderBreadcrumb,
  buildProjectFolderCardData,
} from "./project-folders";
import { ProjectListItem } from "./project-list-item";

const PROJECT_LIST_CREATE_FOLDER_EVENT = "design-demo:projects:create-folder";
const PROJECT_LIST_CREATE_PROJECT_EVENT = "design-demo:projects:create-project";
const PROJECT_LIST_VIEW_MODE_EVENT = "design-demo:projects:view-mode";
const PROJECT_LIST_VIEW_MODE_STORAGE_KEY = "design-demo:projects:view-mode";

type ProjectListViewMode = "card" | "compact";

function isProjectListViewMode(value: unknown): value is ProjectListViewMode {
  return value === "card" || value === "compact";
}

function readProjectListViewMode(): ProjectListViewMode {
  if (typeof window === "undefined") return "card";
  const stored = window.localStorage.getItem(PROJECT_LIST_VIEW_MODE_STORAGE_KEY);
  return isProjectListViewMode(stored) ? stored : "card";
}

export function ProjectsPage({ data }: { data: DemoData }) {
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());
  const [hiddenFolderIds, setHiddenFolderIds] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [listViewMode, setListViewMode] = useState<ProjectListViewMode>(readProjectListViewMode);
  const [newFolderName, setNewFolderName] = useState("角色组探索");
  const folders = data.projectFolders;
  const visibleFolders = folders
    .filter((folder) => folder.parentId === currentFolderId && !hiddenFolderIds.has(folder.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleProjects = data.projects.filter((project) => project.folderId === currentFolderId && !hiddenProjectIds.has(project.id));
  const breadcrumb = buildProjectFolderBreadcrumb(folders, currentFolderId);
  const selectedProjects = visibleProjects.filter((project) => selectedIds.has(project.id));
  const selectedCount = selectedIds.size + selectedFolderIds.size;
  const currentFolderName = breadcrumb.at(-1)?.name ?? "根目录";
  const createProjectHref = currentFolderId ? `/projects/new?folder=${encodeURIComponent(currentFolderId)}` : "/projects/new";

  useEffect(() => {
    function handleCreateFolder() {
      setIsCreatingFolder(true);
    }

    function handleCreateProject() {
      router.push(demoHref(createProjectHref));
    }

    window.addEventListener(PROJECT_LIST_CREATE_FOLDER_EVENT, handleCreateFolder);
    window.addEventListener(PROJECT_LIST_CREATE_PROJECT_EVENT, handleCreateProject);
    return () => {
      window.removeEventListener(PROJECT_LIST_CREATE_FOLDER_EVENT, handleCreateFolder);
      window.removeEventListener(PROJECT_LIST_CREATE_PROJECT_EVENT, handleCreateProject);
    };
  }, [createProjectHref, router]);

  useEffect(() => {
    function handleViewModeChange(event: Event) {
      const nextMode = (event as CustomEvent<{ mode?: unknown }>).detail?.mode;
      if (isProjectListViewMode(nextMode)) setListViewMode(nextMode);
    }

    window.addEventListener(PROJECT_LIST_VIEW_MODE_EVENT, handleViewModeChange);
    return () => window.removeEventListener(PROJECT_LIST_VIEW_MODE_EVENT, handleViewModeChange);
  }, []);

  function navigateFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    setSelectedFolderIds(new Set());
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleFolderSelection(folderId: string) {
    setSelectedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function moveProjects(folderId: string | null) {
    const movedIds = new Set(selectedProjects.map((project) => project.id));
    setSelectedIds((current) => new Set(Array.from(current).filter((id) => !movedIds.has(id))));
    setSelectedFolderIds(new Set());
    setCurrentFolderId(folderId);
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="项目"
        title="项目列表"
        subtitle={`${data.projects.length} 个项目 · ${folders.length} 个文件夹 · 当前：${currentFolderName}`}
      />
      <section className={s.projectFolderWorkspace} aria-label="项目文件夹管理">
        <div className={s.projectFolderTopbar}>
          <ProjectFolderBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateFolder} />
        </div>

        {selectedCount > 0 ? (
          <ProjectBatchBar
            folders={folders}
            selectedCount={selectedCount}
            onClear={() => {
              setSelectedIds(new Set());
              setSelectedFolderIds(new Set());
            }}
            onMove={moveProjects}
          />
        ) : null}

        {isCreatingFolder ? (
          <div className={s.projectFolderDraftRow}>
            <Folder className={s.icon} />
            <input
              aria-label="文件夹名称"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsCreatingFolder(false);
              }}
            />
            <Button
              icon={Save}
              disabled={!newFolderName.trim()}
              feedback={{ title: "文件夹创建动作已预览", detail: `${currentFolderName} / ${newFolderName.trim() || "未命名"}` }}
              onClick={() => setIsCreatingFolder(false)}
            >
              保存
            </Button>
            <Button tone="subtle" icon={X} iconOnly size="sm" onClick={() => setIsCreatingFolder(false)} ariaLabel="取消新建文件夹" />
          </div>
        ) : null}

        <div className={cx(s.projectFolderSurface, listViewMode === "compact" && s.projectFolderSurfaceCompact)}>
          {visibleFolders.length ? (
            <div className={s.projectFolderGrid}>
              {visibleFolders.map((folder) => {
                const folderCard = buildProjectFolderCardData(folder.id, folders, data.projects, data.runs);
                return (
                  <ProjectFolderRow
                    compact={listViewMode === "compact"}
                    folder={folder}
                    images={folderCard.images}
                    key={folder.id}
                    onDelete={() => setHiddenFolderIds(prev => new Set([...prev, folder.id]))}
                    onEnter={() => navigateFolder(folder.id)}
                    onToggleSelected={() => toggleFolderSelection(folder.id)}
                    projectCount={folderCard.projectCount}
                    selected={selectedFolderIds.has(folder.id)}
                    subfolderCount={folderCard.subfolderCount}
                  />
                );
              })}
            </div>
          ) : null}

          {visibleProjects.length ? (
            <div className={s.projectListGrid}>
              {visibleProjects.map((project) => (
                <ProjectListItem
                  compact={listViewMode === "compact"}
                  key={project.id}
                  onDelete={() => setHiddenProjectIds(prev => new Set([...prev, project.id]))}
                  project={project}
                  selected={selectedIds.has(project.id)}
                  onToggleSelected={() => toggleProjectSelection(project.id)}
                />
              ))}
            </div>
          ) : visibleFolders.length ? null : (
            <div className={s.projectFolderEmpty}>
              <Folder className={s.icon} />
              <strong>{currentFolderId ? "此文件夹为空" : "暂无项目"}</strong>
              <span>{currentFolderId ? "可以创建新项目，或从其他文件夹移动项目到这里。" : "创建项目或新建文件夹后会显示在这里。"}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
