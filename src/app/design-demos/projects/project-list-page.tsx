"use client";

import { useState } from "react";
import { Folder, FolderPlus, Plus, Save, X } from "lucide-react";

import type { DemoData } from "../design-demo-data";
import s from "../styles/projects.module.css";
import { Button } from "../ui/button";
import { ButtonLink } from "../ui/button-link";
import { PageHeader } from "../ui/page-header";
import {
  ProjectBatchBar,
  ProjectFolderBreadcrumb,
  ProjectFolderRow,
  buildProjectFolderBreadcrumb,
  countProjectFolderItems,
} from "./project-folders";
import { ProjectListItem } from "./project-list-item";

export function ProjectsPage({ data }: { data: DemoData }) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("角色组探索");
  const folders = data.projectFolders;
  const visibleFolders = folders
    .filter((folder) => folder.parentId === currentFolderId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleProjects = data.projects.filter((project) => project.folderId === currentFolderId);
  const breadcrumb = buildProjectFolderBreadcrumb(folders, currentFolderId);
  const selectedProjects = visibleProjects.filter((project) => selectedIds.has(project.id));
  const currentFolderName = breadcrumb.at(-1)?.name ?? "根目录";
  const createProjectHref = currentFolderId ? `/projects/new?folder=${encodeURIComponent(currentFolderId)}` : "/projects/new";

  function navigateFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function moveProjects(folderId: string | null) {
    const movedIds = new Set(selectedProjects.map((project) => project.id));
    setSelectedIds((current) => new Set(Array.from(current).filter((id) => !movedIds.has(id))));
    setCurrentFolderId(folderId);
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="项目"
        title="项目列表"
        subtitle={`${data.projects.length} 个项目 · ${folders.length} 个文件夹 · 当前：${currentFolderName}`}
        actions={<ButtonLink href={createProjectHref} tone="primary" icon={Plus}>创建项目</ButtonLink>}
      />
      <section className={s.projectFolderWorkspace} aria-label="项目文件夹管理">
        <div className={s.projectFolderTopbar}>
          <ProjectFolderBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateFolder} />
          <div className={s.projectFolderActions}>
            <Button tone="subtle" icon={FolderPlus} onClick={() => setIsCreatingFolder(true)}>
              新建文件夹
            </Button>
            <ButtonLink href={createProjectHref} tone="primary" icon={Plus}>创建项目</ButtonLink>
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <ProjectBatchBar
            folders={folders}
            selectedCount={selectedIds.size}
            totalCount={visibleProjects.length}
            onClear={() => setSelectedIds(new Set())}
            onMove={moveProjects}
            onSelectAll={() => setSelectedIds(new Set(visibleProjects.map((project) => project.id)))}
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

        <div className={s.projectFolderSurface}>
          {visibleFolders.length ? (
            <div className={s.projectFolderGrid}>
              {visibleFolders.map((folder) => (
                <ProjectFolderRow
                  folder={folder}
                  itemCount={countProjectFolderItems(folder.id, folders, data.projects)}
                  key={folder.id}
                  onEnter={() => navigateFolder(folder.id)}
                />
              ))}
            </div>
          ) : null}

          {visibleProjects.length ? (
            <div className={s.projectListGrid}>
              {visibleProjects.map((project) => (
                <ProjectListItem
                  key={project.id}
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
