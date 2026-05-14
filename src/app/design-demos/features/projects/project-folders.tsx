"use client";

import { CheckSquare, FolderInput, Pencil, Trash2 } from "lucide-react";

import type { DemoProject, DemoProjectFolder } from "../../data";
import s from "./project-folders.projects.module.css";
import { Button } from "../../shared/primitives/button";
import {
  FolderBreadcrumb,
  FolderRow,
  MoveTargetPicker,
  SelectionBatchBar,
  type MoveTargetOption,
} from "../../shared/patterns";

export function buildProjectFolderBreadcrumb(folders: DemoProjectFolder[], currentFolderId: string | null) {
  const path: DemoProjectFolder[] = [];
  let folderId = currentFolderId;
  while (folderId) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) break;
    path.unshift(folder);
    folderId = folder.parentId;
  }
  return path;
}

export function countProjectFolderItems(folderId: string, folders: DemoProjectFolder[], projects: DemoProject[]) {
  return folders.filter((folder) => folder.parentId === folderId).length + projects.filter((project) => project.folderId === folderId).length;
}

export function ProjectFolderBreadcrumb({
  breadcrumb,
  onNavigate,
}: {
  breadcrumb: DemoProjectFolder[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <FolderBreadcrumb
      activeButtonClassName={s.projectFolderBreadcrumbActive}
      buttonClassName={s.projectFolderBreadcrumbButton}
      className={s.projectFolderBreadcrumbs}
      items={breadcrumb.map((folder) => ({ id: folder.id, label: folder.name }))}
      onNavigate={onNavigate}
      separatorClassName={s.icon}
      size="sm"
    />
  );
}

export function ProjectFolderRow({
  folder,
  itemCount,
  onEnter,
}: {
  folder: DemoProjectFolder;
  itemCount: number;
  onEnter: () => void;
}) {
  return (
    <FolderRow
      actions={
        <>
          <Button tone="subtle" icon={Pencil} iconOnly ariaLabel={`重命名文件夹：${folder.name}`} />
          {itemCount === 0 ? (
            <Button tone="danger" icon={Trash2} iconOnly ariaLabel={`删除文件夹：${folder.name}`} />
          ) : null}
        </>
      }
      actionsClassName={s.projectFolderRowActions}
      className={s.projectFolderRow}
      countLabel={`${itemCount} 项`}
      dragHandleClassName={s.projectFolderGrip}
      iconClassName={s.icon}
      name={folder.name}
      onOpen={onEnter}
      openClassName={s.projectFolderOpen}
    />
  );
}

export function ProjectBatchBar({
  folders,
  selectedCount,
  totalCount,
  onClear,
  onMove,
  onSelectAll,
}: {
  folders: DemoProjectFolder[];
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  onMove: (folderId: string | null) => void;
  onSelectAll: () => void;
}) {
  return (
    <SelectionBatchBar
      actions={
        <>
          <ProjectMoveMenu folders={folders} currentFolderId={null} onMove={onMove} label="移至文件夹" />
          <Button icon={CheckSquare} onClick={selectedCount === totalCount ? onClear : onSelectAll}>
            {selectedCount === totalCount ? "取消全选" : "全选"}
          </Button>
        </>
      }
      actionsClassName={s.projectBatchActions}
      className={s.projectBatchBar}
      label={<>已选 {selectedCount} 个项目</>}
      onClear={onClear}
      selectedCount={selectedCount}
    />
  );
}

export function ProjectMoveMenu({
  currentFolderId,
  folders,
  label = "移动",
  onMove,
}: {
  currentFolderId: string | null;
  folders: DemoProjectFolder[];
  label?: string;
  onMove: (folderId: string | null) => void;
}) {
  if (!folders.length) return null;

  return (
    <MoveTargetPicker
      buttonClassName={s.projectMoveMenuButton}
      className={s.projectMoveMenu}
      currentId={currentFolderId}
      icon={FolderInput}
      iconOnly={label === "移动"}
      label={label}
      menuClassName={s.projectMoveMenuList}
      onMove={onMove}
      optionClassName={s.projectMoveMenuOption}
      options={flattenProjectFolderOptions(folders)}
    />
  );
}

function flattenProjectFolderOptions(folders: DemoProjectFolder[], parentId: string | null = null, depth = 0): MoveTargetOption[] {
  const options: MoveTargetOption[] = [];
  if (depth === 0) options.push({ id: null, label: "根目录", depth: 0 });
  const children = folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const child of children) {
    options.push({ id: child.id, label: child.name, depth: depth + 1 });
    options.push(...flattenProjectFolderOptions(folders, child.id, depth + 1));
  }
  return options;
}
