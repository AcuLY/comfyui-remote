"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Folder, Search, X } from "lucide-react";

type FolderDef = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
};

type GroupDef = {
  id: string;
  name: string;
  folderId?: string | null;
};

type CategoryDef = {
  id: string;
  name: string;
  color: string | null;
  type?: string;
  folders?: FolderDef[];
  groups?: GroupDef[];
};

export type PresetGroupCascadePickerValue = {
  groupId: string;
  groupName: string;
  categoryId: string;
} | null;

type PresetGroupCascadePickerProps = {
  categories: CategoryDef[];
  value: string | null;
  onChange: (value: PresetGroupCascadePickerValue) => void;
  placeholder?: string;
  disabled?: boolean;
  lockedCategoryId?: string;
  allowedGroupIds?: string[];
  clearable?: boolean;
  clearLabel?: string;
};

export function PresetGroupCascadePicker({
  categories,
  value,
  onChange,
  placeholder = "选择预制组...",
  disabled = false,
  lockedCategoryId,
  allowedGroupIds,
  clearable = false,
  clearLabel = "不选择预制组",
}: PresetGroupCascadePickerProps) {
  const allowedGroupIdSet = useMemo(
    () => allowedGroupIds ? new Set(allowedGroupIds) : null,
    [allowedGroupIds],
  );
  const filteredCats = useMemo(
    () => categories
      .filter((category) => !lockedCategoryId || category.id === lockedCategoryId)
      .map((category) => ({
        ...category,
        groups: (category.groups ?? []).filter((group) => !allowedGroupIdSet || allowedGroupIdSet.has(group.id)),
      }))
      .filter((category) => category.groups.length > 0),
    [categories, lockedCategoryId, allowedGroupIdSet],
  );
  const getInitialCategoryId = () =>
    lockedCategoryId ??
    (value ? findCategoryForGroup(filteredCats, value) : "") ??
    filteredCats[0]?.id ??
    "";

  const [open, setOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>(getInitialCategoryId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedGroup = useMemo(() => {
    for (const category of filteredCats) {
      const group = category.groups.find((item) => item.id === value);
      if (group) return group;
    }
    return null;
  }, [filteredCats, value]);

  function openPicker() {
    const categoryId = getInitialCategoryId();
    const groupFolderId = selectedGroup?.folderId ?? null;
    setSelectedCatId(categoryId);
    setCurrentFolderId(groupFolderId);
    setSearchQuery("");
    setOpen(true);
  }

  function handleSelectCategory(categoryId: string) {
    setSelectedCatId(categoryId);
    setCurrentFolderId(null);
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

  const selectedCat = filteredCats.find((category) => category.id === selectedCatId) ?? filteredCats[0];
  const activeCategoryId = selectedCat?.id ?? "";
  const folders = useMemo(() => selectedCat?.folders ?? [], [selectedCat]);
  const folderIds = useMemo(() => new Set(folders.map((folder) => folder.id)), [folders]);
  const safeCurrentFolderId = currentFolderId && folderIds.has(currentFolderId) ? currentFolderId : null;

  const breadcrumb = useMemo(() => {
    const path: FolderDef[] = [];
    let folderId = safeCurrentFolderId;
    while (folderId) {
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parentId;
    }
    return path;
  }, [safeCurrentFolderId, folders]);

  const parentFolderId = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null;
  const subFolders = folders.filter((folder) => (folder.parentId ?? null) === safeCurrentFolderId);
  const visibleGroups = useMemo(() => {
    if (!selectedCat) return [];
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      return selectedCat.groups.filter((group) => group.name.toLowerCase().includes(query));
    }
    return selectedCat.groups.filter((group) => (group.folderId ?? null) === safeCurrentFolderId);
  }, [selectedCat, searchQuery, safeCurrentFolderId]);
  const isSearching = searchQuery.trim().length > 0;

  function handleSelectGroup(group: GroupDef) {
    onChange({ groupId: group.id, groupName: group.name, categoryId: activeCategoryId });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-left text-xs outline-none transition hover:bg-white/[0.06] focus:border-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          selectedGroup ? "text-zinc-200" : "text-zinc-500"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{selectedGroup?.name ?? placeholder}</span>
        <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
      </button>

      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === backdropRef.current) setOpen(false);
          }}
        >
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl" style={{ maxHeight: "75vh" }}>
            {!lockedCategoryId && filteredCats.length > 1 && (
              <div className="flex flex-wrap gap-1 border-b border-white/5 px-4 pt-3 pb-2">
                {filteredCats.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelectCategory(category.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition ${
                      activeCategoryId === category.id ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {category.color && (
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${category.color})` }} />
                    )}
                    {category.name}
                  </button>
                ))}
              </div>
            )}

            <div className="border-b border-white/5 px-4 pt-2 pb-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <Search className="size-3.5 shrink-0 text-zinc-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索预制组..."
                  className="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 text-zinc-500 hover:text-zinc-300">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!isSearching && (
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
                {safeCurrentFolderId !== null && (
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(parentFolderId)}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
                  <button type="button" onClick={() => setCurrentFolderId(null)} className="shrink-0 text-sky-400 transition hover:text-sky-300">
                    {selectedCat?.name ?? "预制组"}
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
                  className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2">
              {!selectedCat ? (
                <div className="flex items-center justify-center py-12 text-xs text-zinc-600">没有可选预制组</div>
              ) : visibleGroups.length === 0 && subFolders.length === 0 && !(clearable && value) ? (
                <div className="flex items-center justify-center py-12 text-xs text-zinc-600">
                  {isSearching ? "无匹配预制组" : "空目录"}
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
                  {visibleGroups.map((group) => {
                    const isSelected = group.id === value;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => handleSelectGroup(group)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          isSelected ? "bg-sky-500/10 text-sky-300" : "text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                        style={{ minHeight: 40 }}
                      >
                        <span className="min-w-0 flex-1 truncate text-xs">{group.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function findCategoryForGroup(
  categories: Array<CategoryDef & { groups: GroupDef[] }>,
  groupId: string,
) {
  for (const category of categories) {
    if (category.groups.some((group) => group.id === groupId)) return category.id;
  }
  return null;
}
