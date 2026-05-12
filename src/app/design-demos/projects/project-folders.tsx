"use client";

import { useState } from "react";
import { CheckSquare, ChevronRight, Folder, FolderInput, GripVertical, Pencil, Trash2, X } from "lucide-react";

import type { DemoProject, DemoProjectFolder } from "../design-demo-data";
import s from "./project-folders.projects.module.css";
import { Button } from "../ui/button";

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
    <div className={s.projectFolderBreadcrumbs} aria-label="项目文件夹路径">
      <Button tone="subtle" onClick={() => onNavigate(null)} disabled={breadcrumb.length === 0}>
        根目录
      </Button>
      {breadcrumb.map((folder, index) => (
        <span key={folder.id}>
          <ChevronRight className={s.icon} />
          <Button
            tone="subtle"
            onClick={() => onNavigate(folder.id)}
            disabled={index === breadcrumb.length - 1}
          >
            {folder.name}
          </Button>
        </span>
      ))}
    </div>
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
    <div className={s.projectFolderRow}>
      <Button className={s.projectFolderGrip} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
      <button className={s.projectFolderOpen} type="button" onClick={onEnter}>
        <Folder className={s.icon} />
        <strong>{folder.name}</strong>
        <span>{itemCount} 项</span>
        <ChevronRight className={s.icon} />
      </button>
      <div className={s.projectFolderRowActions}>
        <Button tone="subtle" icon={Pencil} iconOnly ariaLabel={`重命名文件夹：${folder.name}`} />
        {itemCount === 0 ? (
          <Button tone="danger" icon={Trash2} iconOnly ariaLabel={`删除文件夹：${folder.name}`} />
        ) : null}
      </div>
    </div>
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
    <div className={s.projectBatchBar}>
      <strong>已选 {selectedCount} 个项目</strong>
      <div>
        <ProjectMoveMenu folders={folders} currentFolderId={null} onMove={onMove} label="移至文件夹" />
        <Button icon={CheckSquare} onClick={selectedCount === totalCount ? onClear : onSelectAll}>
          {selectedCount === totalCount ? "取消全选" : "全选"}
        </Button>
        <Button tone="subtle" icon={X} iconOnly onClick={onClear} ariaLabel="清除选择" />
      </div>
    </div>
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
  const [open, setOpen] = useState(false);
  if (!folders.length) return null;
  const options = flattenProjectFolderOptions(folders);

  return (
    <div className={s.projectMoveMenu}>
      <Button
        tone="subtle"
        icon={FolderInput}
        iconOnly={label === "移动"}
        ariaLabel={label}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? (
        <div className={s.projectMoveMenuList}>
          {options.map((option) => (
            <button
              disabled={option.id === currentFolderId}
              key={option.id ?? "__root"}
              onClick={() => {
                onMove(option.id);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function flattenProjectFolderOptions(folders: DemoProjectFolder[], parentId: string | null = null, depth = 0): Array<{ id: string | null; label: string }> {
  const options: Array<{ id: string | null; label: string }> = [];
  if (depth === 0) options.push({ id: null, label: "根目录" });
  const children = folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const child of children) {
    options.push({ id: child.id, label: `${"  ".repeat(depth + 1)}${child.name}` });
    options.push(...flattenProjectFolderOptions(folders, child.id, depth + 1));
  }
  return options;
}
