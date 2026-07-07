"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Folder, Search, X } from "lucide-react";

type ProjectFolderDef = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
};

type ProjectDef = {
  id: string;
  title: string;
  folderId?: string | null;
};

type ProjectCascadePickerProps = {
  projects: ProjectDef[];
  folders: ProjectFolderDef[];
  value: string | null;
  onChange: (project: ProjectDef | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  clearLabel?: string;
};

export function ProjectCascadePicker({
  projects,
  folders,
  value,
  onChange,
  placeholder = "选择项目...",
  disabled = false,
  clearable = false,
  clearLabel = "不选择项目",
}: ProjectCascadePickerProps) {
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === value) ?? null,
    [projects, value],
  );
  const folderIds = useMemo(() => new Set(folders.map((folder) => folder.id)), [folders]);
  const [open, setOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedFolderId = useCallback((folderId: string | null | undefined) => {
    return folderId && folderIds.has(folderId) ? folderId : null;
  }, [folderIds]);

  function openPicker() {
    setCurrentFolderId(normalizedFolderId(selectedProject?.folderId));
    setSearchQuery("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => searchInputRef.current?.focus(), 100);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const breadcrumb = useMemo(() => {
    const path: ProjectFolderDef[] = [];
    let folderId = currentFolderId;
    while (folderId) {
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parentId;
    }
    return path;
  }, [currentFolderId, folders]);

  const parentFolderId = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null;
  const isSearching = searchQuery.trim().length > 0;
  const subFolders = useMemo(
    () => folders.filter((folder) => (folder.parentId ?? null) === currentFolderId),
    [folders, currentFolderId],
  );
  const visibleProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      return projects.filter((project) => project.title.toLowerCase().includes(query));
    }
    return projects.filter((project) => normalizedFolderId(project.folderId) === currentFolderId);
  }, [projects, searchQuery, currentFolderId, normalizedFolderId]);

  function folderPathLabel(folderId: string | null | undefined) {
    const path: string[] = [];
    let currentId = normalizedFolderId(folderId);
    while (currentId) {
      const folder = folders.find((item) => item.id === currentId);
      if (!folder) break;
      path.unshift(folder.name);
      currentId = folder.parentId;
    }
    return path.length > 0 ? path.join(" / ") : "项目";
  }

  function selectProject(project: ProjectDef) {
    onChange(project);
    setOpen(false);
  }

  const pickerDialog = open ? createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === backdropRef.current) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="选择项目"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        style={{ maxHeight: "75vh" }}
      >
        <div className="border-b border-white/5 px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <Search className="size-3.5 shrink-0 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="搜索项目"
              placeholder="搜索项目..."
              className="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} aria-label="清空搜索" className="shrink-0 text-zinc-500 hover:text-zinc-300">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {!isSearching && (
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
            {currentFolderId !== null && (
              <button
                type="button"
                onClick={() => setCurrentFolderId(parentFolderId)}
                aria-label="返回上级项目文件夹"
                className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
              <button type="button" onClick={() => setCurrentFolderId(null)} className="shrink-0 text-sky-400 transition hover:text-sky-300">
                项目
              </button>
              {breadcrumb.map((folder, index) => {
                const isLast = index === breadcrumb.length - 1;
                return (
                  <span key={folder.id} className="flex items-center gap-1">
                    <ChevronRight className="size-3 text-zinc-600" />
                    {isLast ? (
                      <span className="shrink-0 text-zinc-200">{folder.name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="shrink-0 text-sky-400 transition hover:text-sky-300"
                      >
                        {folder.name}
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭项目选择器"
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {visibleProjects.length === 0 && subFolders.length === 0 && !(clearable && value) ? (
            <div className="flex items-center justify-center py-12 text-xs text-zinc-600">
              {isSearching ? "无匹配项目" : "空目录"}
            </div>
          ) : (
            <div className="space-y-1">
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
                  style={{ minHeight: 40 }}
                >
                  <X className="size-4 shrink-0 text-zinc-500" />
                  <span className="flex-1 truncate text-xs">{clearLabel}</span>
                </button>
              )}
              {!isSearching && subFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-zinc-300 transition hover:bg-white/[0.04]"
                  style={{ minHeight: 40 }}
                >
                  <Folder className="size-4 shrink-0 text-amber-400/70" />
                  <span className="flex-1 truncate text-xs">{folder.name}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                </button>
              ))}
              {visibleProjects.map((project) => {
                const isSelected = project.id === value;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => selectProject(project)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected ? "bg-sky-500/10 text-sky-300" : "text-zinc-300 hover:bg-white/[0.04]"
                    }`}
                    style={{ minHeight: 40 }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{project.title}</span>
                      {isSearching && <span className="block truncate text-[10px] text-zinc-600">{folderPathLabel(project.folderId)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        aria-label="选择项目"
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm outline-none transition hover:bg-white/[0.06] focus:border-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          selectedProject ? "text-zinc-100" : "text-zinc-500"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{selectedProject?.title ?? placeholder}</span>
        <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
      </button>

      {pickerDialog}
    </>
  );
}
