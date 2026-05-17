"use client";

import { Folder, FolderInput, GripVertical, Trash2 } from "lucide-react";

import type { DemoImage, DemoProject, DemoProjectFolder, DemoRun } from "../../data";
import { cx } from "../../routing";
import cardStyles from "./project-list-item.projects.module.css";
import s from "./project-folders.projects.module.css";
import { Button } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { ImageListSmall } from "../../shared/media/image-list-small";
import {
  FolderBreadcrumb,
  MoveTargetPicker,
  SelectionBatchBar,
  type MoveTargetOption,
} from "../../shared/patterns";
import { ProjectListCardShell } from "./project-list-item";

const FOLDER_PREVIEW_IMAGE_LIMIT = 24;

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

export function buildProjectFolderCardData(folderId: string, folders: DemoProjectFolder[], projects: DemoProject[], runs: DemoRun[]) {
  const descendantFolderIds = collectDescendantFolderIds(folderId, folders);
  const projectCount = folders
    .filter((folder) => descendantFolderIds.has(folder.id))
    .reduce((count, folder) => count + folder.projectCount, 0);
  const subfolderCount = Math.max(0, descendantFolderIds.size - 1);
  const folderProjects = projects.filter((project) => project.folderId !== null && descendantFolderIds.has(project.folderId));
  const projectIds = new Set(folderProjects.map((project) => project.id));
  const projectsWithRunImages = new Set<string>();
  const runImages = runs.flatMap((run) => {
    const hasPreviewableRunImages = run.imageCount > 0 && run.images.length > 0;
    if (!projectIds.has(run.projectId) || projectsWithRunImages.has(run.projectId) || !hasPreviewableRunImages) {
      return [];
    }
    projectsWithRunImages.add(run.projectId);
    return run.images;
  });
  const fallbackProjectImages = folderProjects.flatMap((project) => (
    projectsWithRunImages.has(project.id) ? [] : project.images
  ));
  const images = uniqueImages([...runImages, ...fallbackProjectImages]).slice(0, FOLDER_PREVIEW_IMAGE_LIMIT);

  return { images, projectCount, subfolderCount };
}

function collectDescendantFolderIds(folderId: string, folders: DemoProjectFolder[]) {
  const ids = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

function uniqueImages(images: DemoImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = image.id || image.src || image.full;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  compact = false,
  folder,
  images,
  onEnter,
  onToggleSelected,
  projectCount,
  selected,
  subfolderCount,
}: {
  compact?: boolean;
  folder: DemoProjectFolder;
  images: DemoImage[];
  onEnter: () => void;
  onToggleSelected: () => void;
  projectCount: number;
  selected: boolean;
  subfolderCount: number;
}) {
  return (
    <ProjectListCardShell
      compact={compact}
      selected={selected}
      leading={(
        <>
          <Checkbox
            className={cardStyles.projectSelectCheckbox}
            checked={selected}
            label={selected ? `取消选择文件夹：${folder.name}` : `选择文件夹：${folder.name}`}
            onCheckedChange={() => onToggleSelected()}
          />
          <Button
            className={cardStyles.projectDragHandle}
            tone="subtle"
            icon={GripVertical}
            iconOnly
            ariaLabel={`拖拽排序文件夹：${folder.name}`}
          />
        </>
      )}
      body={(
        <>
          <div
            aria-label={`打开文件夹：${folder.name}`}
            className={cx(cardStyles.projectListRecentResult, s.projectFolderPreviewButton)}
            onClick={onEnter}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEnter();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <ImageListSmall className={cardStyles.recentResultImages} images={images} limit={images.length} showCounts />
          </div>
        </>
      )}
      title={(
        <div className={cardStyles.projectListTitleRow}>
          <button className={cx(cardStyles.projectListTitleLink, s.projectFolderTitleButton)} type="button" onClick={onEnter}>
            <Folder className={s.projectFolderTitleIcon} aria-hidden="true" />
            <strong>{folder.name}</strong>
            <span>{projectCount} 项目</span>
            <span>{subfolderCount} 子文件夹</span>
          </button>
          <div className={cardStyles.projectItemActions}>
            <Button
              tone="danger"
              icon={Trash2}
              iconOnly
              ariaLabel={`删除文件夹：${folder.name}`}
              size="sm"
              feedback={{ tone: "warning", title: "删除文件夹需要确认", detail: folder.name }}
            />
          </div>
        </div>
      )}
    />
  );
}

export function ProjectBatchBar({
  folders,
  selectedCount,
  onClear,
  onMove,
}: {
  folders: DemoProjectFolder[];
  selectedCount: number;
  onClear: () => void;
  onMove: (folderId: string | null) => void;
}) {
  return (
    <SelectionBatchBar
      actions={<ProjectMoveMenu folders={folders} currentFolderId={null} onMove={onMove} label="移至文件夹" />}
      actionsClassName={s.projectBatchActions}
      className={s.projectBatchBar}
      clearTone="danger"
      label={<>已选 {selectedCount} 项</>}
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
      buttonTone="default"
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
