"use client";

import { useMemo, useState, useTransition, useId } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Archive, ChevronRight, Folder, FolderPlus, ImageIcon, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { HardNavigationLink } from "@/components/hard-navigation-link";
import { SectionCard } from "@/components/section-card";
import {
  createProjectFolder,
  deleteProjectFolder,
  moveProjectToFolder,
  renameProjectFolder,
  reorderProjectFolders,
} from "@/lib/actions";
import { hrefWithFolderQuery } from "@/lib/folder-navigation";
import type { ProjectCard as ProjectCardData, ProjectFolderItem } from "@/lib/types";
import {
  BatchActionBar,
  countFolderItems,
  FolderBreadcrumb,
  MoveToFolderButton,
  SortableFolderRow,
} from "@/app/assets/presets/folder-components";
import { ProjectArchiveButton } from "./project-archive-button";
import { ProjectDeleteButton } from "./project-delete-button";

export function ProjectsClient({
  initialProjects,
  folders,
  initialFolderId,
}: {
  initialProjects: ProjectCardData[];
  folders: ProjectFolderItem[];
  initialFolderId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const visibleFolders = useMemo(
    () => folders.filter((folder) => (folder.parentId ?? null) === currentFolderId),
    [folders, currentFolderId],
  );
  const folderProjects = useMemo(
    () => initialProjects.filter((project) => (project.folderId ?? null) === currentFolderId),
    [initialProjects, currentFolderId],
  );
  const visibleProjects = useMemo(
    () => folderProjects.filter((project) => showArchived || !project.archivedAt),
    [folderProjects, showArchived],
  );
  const countableProjects = useMemo(
    () => showArchived ? initialProjects : initialProjects.filter((project) => !project.archivedAt),
    [initialProjects, showArchived],
  );
  const archivedProjectCount = folderProjects.filter((project) => project.archivedAt).length;
  const breadcrumb = useMemo(() => {
    const path: ProjectFolderItem[] = [];
    let folderId = currentFolderId;
    while (folderId) {
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parentId;
    }
    return path;
  }, [currentFolderId, folders]);

  const folderDndId = useId();
  const folderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function navigateFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    router.replace(hrefWithFolderQuery("/projects", "folder", folderId), { scroll: false });
  }

  function refresh() {
    router.refresh();
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createProjectFolder(currentFolderId, name);
        toast.success("文件夹已创建");
        setNewFolderName("");
        setIsCreatingFolder(false);
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "创建文件夹失败");
      }
    });
  }

  function handleFolderDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleFolders.findIndex((folder) => folder.id === active.id);
    const newIndex = visibleFolders.findIndex((folder) => folder.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(visibleFolders, oldIndex, newIndex);
    startTransition(async () => {
      try {
        await reorderProjectFolders(currentFolderId, reordered.map((folder) => folder.id));
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "排序失败");
      }
    });
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function handleMoveProjects(projectIds: string[], folderId: string | null) {
    if (projectIds.length === 0) return;
    startTransition(async () => {
      try {
        for (const projectId of projectIds) {
          await moveProjectToFolder(projectId, folderId);
        }
        setSelectedIds(new Set());
        toast.success(`已移动 ${projectIds.length} 个项目`);
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "移动失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Link
          href={currentFolderId ? `/projects/new?folder=${encodeURIComponent(currentFolderId)}` : "/projects/new"}
          className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
        >
          <Plus className="size-4" /> 创建新项目
        </Link>
      </div>
      <SectionCard
        title="项目"
        subtitle={`${visibleProjects.length} 个项目${!showArchived && archivedProjectCount > 0 ? `，隐藏 ${archivedProjectCount} 个归档` : ""}`}
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <FolderBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateFolder} />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 px-2 text-[11px] text-zinc-300 transition hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => {
                    setShowArchived(event.currentTarget.checked);
                    setSelectedIds(new Set());
                  }}
                  className="size-3 accent-sky-500"
                />
                显示归档
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/[0.04] px-2 text-[11px] text-zinc-400 hover:bg-white/[0.08]"
              >
                <FolderPlus className="size-3" />
                新建文件夹
              </button>
            </div>
          </div>

          <BatchActionBar
            selectedCount={selectedIds.size}
            totalCount={visibleProjects.length}
            folders={folders}
            onMoveToFolder={(folderId) => handleMoveProjects(Array.from(selectedIds), folderId)}
            onSelectAll={() => setSelectedIds(new Set(visibleProjects.map((project) => project.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
          />

          {isCreatingFolder && (
            <div className="flex items-center gap-2">
              <Folder className="size-3.5 text-amber-400/60" />
              <input
                type="text"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="文件夹名称"
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleCreateFolder();
                  if (event.key === "Escape") {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }
                }}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={isPending || !newFolderName.trim()}
                className="rounded-lg bg-sky-500/20 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
              >
                <Save className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName("");
                }}
                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/[0.06]"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          <DndContext
            id={folderDndId}
            sensors={folderSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleFolderDragEnd}
          >
            <SortableContext items={visibleFolders.map((folder) => folder.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleFolders.map((folder) => (
                  <SortableFolderRow
                    key={folder.id}
                    folder={folder}
                    itemCount={countFolderItems(folder.id, folders, countableProjects)}
                    onEnter={() => navigateFolder(folder.id)}
                    onRename={(name) => {
                      startTransition(async () => {
                        try {
                          await renameProjectFolder(folder.id, name);
                          toast.success("文件夹已重命名");
                          refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "重命名失败");
                        }
                      });
                    }}
                    onDelete={() => {
                      if (!confirm(`确认删除文件夹「${folder.name}」？`)) return;
                      startTransition(async () => {
                        try {
                          await deleteProjectFolder(folder.id);
                          toast.success("文件夹已删除");
                          refresh();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "删除失败");
                        }
                      });
                    }}
                    isPending={isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {visibleProjects.length === 0 && visibleFolders.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/5 text-xs text-zinc-600">
              {currentFolderId ? "此文件夹为空" : "暂无项目，点击「创建新项目」开始"}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 justify-items-center md:grid-cols-2">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  folders={folders}
                  selected={selectedIds.has(project.id)}
                  onToggleSelected={() => toggleProjectSelection(project.id)}
                  onMove={(folderId) => handleMoveProjects([project.id], folderId)}
                />
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function ProjectCard({
  project,
  folders,
  selected,
  onToggleSelected,
  onMove,
}: {
  project: ProjectCardData;
  folders: ProjectFolderItem[];
  selected: boolean;
  onToggleSelected: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const isArchived = Boolean(project.archivedAt);

  return (
    <article
      className={`relative w-full rounded-xl border bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.06] md:max-w-[500px] ${
        selected
          ? "border-sky-400/50 ring-1 ring-sky-400/30"
          : isArchived
            ? "border-amber-500/20"
            : "border-white/10"
      }`}
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        <MoveToFolderButton currentFolderId={project.folderId} folders={folders} onMove={onMove} />
        {isArchived ? (
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg border border-amber-500/20 bg-zinc-950/85 text-amber-300"
            title={project.archivedAt ? `已归档：${project.archivedAt}` : "已归档"}
            aria-label={`已归档项目：${project.title}`}
          >
            <Archive className="size-3.5" />
          </span>
        ) : (
          <ProjectArchiveButton
            projectId={project.id}
            projectTitle={project.title}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-amber-500/20 bg-zinc-950/85 text-amber-300 shadow-sm transition hover:bg-amber-500/15 disabled:opacity-50"
          />
        )}
        <ProjectDeleteButton
          projectId={project.id}
          projectTitle={project.title}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-500/20 bg-zinc-950/85 text-rose-300 shadow-sm transition hover:bg-rose-500/15 disabled:opacity-50"
        />
      </div>
      <label className="absolute left-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-950/85">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="size-3.5 accent-sky-400"
          aria-label={`选择项目：${project.title}`}
        />
      </label>
      <HardNavigationLink href={`/projects/${project.id}`} className="block p-3 pt-12">
        {isArchived ? (
          <div className="mb-3 flex h-24 items-center justify-center rounded-lg border border-amber-500/10 bg-amber-500/[0.03] text-[11px] text-amber-200/70">
            <Archive className="mr-1.5 size-3.5" />
            已归档 · 文件已清理
          </div>
        ) : project.latestImages && project.latestImages.length > 0 ? (
          <div className="mb-3 border-b border-white/5 pb-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
              <ImageIcon className="size-3" />
              <span>最近结果 · {project.latestImageCount ?? project.latestImages.length} 张</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {project.latestImages.slice(0, 6).map((img) => (
                <div
                  key={img.id}
                  className={`flex h-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[var(--panel-soft)] ${
                    img.status === "kept"
                      ? "border-emerald-500/30"
                      : img.status === "trashed"
                        ? "border-rose-500/20 opacity-45"
                        : "border-white/10"
                  }`}
                >
                  <Image
                    src={img.src}
                    alt=""
                    width={72}
                    height={72}
                    loading="lazy"
                    unoptimized
                    draggable={false}
                    className="h-full w-auto object-contain"
                  />
                </div>
              ))}
              {(project.latestImageCount ?? 0) > 6 && (
                <div className="flex shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] px-3 text-[10px] text-zinc-500">
                  +{(project.latestImageCount ?? 0) - 6}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-[11px] text-zinc-600">
            <ImageIcon className="mr-1.5 size-3.5" />
            暂无最近结果
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{project.title}</div>
            <div className="mt-1 text-xs text-zinc-400">{project.presetNames.join(" · ") || "无预设"}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
              {isArchived ? "已归档" : project.status}
            </span>
            <ChevronRight className="size-4 text-zinc-500" />
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          最近更新：{project.updatedAt} · {project.sectionCount} 个小节
          {project.archivedAt ? ` · 归档：${project.archivedAt}` : project.latestRunAt ? ` · 最近运行：${project.latestRunAt}` : ""}
        </div>
      </HardNavigationLink>
    </article>
  );
}
