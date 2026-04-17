"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Folder, Search, ChevronRight, ChevronLeft, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FolderDef = { id: string; name: string; parentId: string | null };
type VariantDef = { id: string; name: string };
type PresetDef = {
  id: string;
  name: string;
  folderId?: string | null;
  variants: VariantDef[];
};
type CategoryDef = {
  id: string;
  name: string;
  color: string | null;
  type: string;
  folders?: FolderDef[];
  presets: PresetDef[];
};

export type PresetCascadePickerValue = {
  presetId: string;
  variantId: string;
  presetName: string;
  variantName: string;
  categoryId: string;
} | null;

type PresetCascadePickerProps = {
  categories: CategoryDef[];
  value: { presetId: string; variantId: string } | null;
  onChange: (value: PresetCascadePickerValue) => void;
  placeholder?: string;
  disabled?: boolean;
  /** If set, locks to this category (used for slot template members) */
  lockedCategoryId?: string;
  /** Filter to only show preset-type categories */
  presetCategoriesOnly?: boolean;
  /** If true, the picker modal opens automatically on mount */
  defaultOpen?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresetCascadePicker({
  categories,
  value,
  onChange,
  placeholder = "选择预制…",
  disabled = false,
  lockedCategoryId,
  presetCategoriesOnly = false,
  defaultOpen = false,
}: PresetCascadePickerProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter categories
  const filteredCats = useMemo(
    () => presetCategoriesOnly ? categories.filter((c) => c.type === "preset") : categories,
    [categories, presetCategoriesOnly],
  );

  // Resolve display name for current value
  const displayName = useMemo(() => {
    if (!value) return null;
    for (const cat of categories) {
      const preset = cat.presets.find((p) => p.id === value.presetId);
      if (preset) {
        const variant = preset.variants.find((v) => v.id === value.variantId);
        if (preset.variants.length <= 1) return preset.name;
        return variant ? `${preset.name} / ${variant.name}` : preset.name;
      }
    }
    return null;
  }, [value, categories]);

  // Set initial category on open
  useEffect(() => {
    if (open) {
      const catId = lockedCategoryId ?? (value ? findCategoryForPreset(categories, value.presetId) : "") ?? filteredCats[0]?.id ?? "";
      setSelectedCatId(catId);
      setCurrentFolderId(null);
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset folder when category changes
  useEffect(() => {
    setCurrentFolderId(null);
  }, [selectedCatId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  const selectedCat = filteredCats.find((c) => c.id === selectedCatId);
  const folders = selectedCat?.folders ?? [];

  // Breadcrumb path
  const breadcrumb = useMemo(() => {
    const path: FolderDef[] = [];
    let fid = currentFolderId;
    while (fid) {
      const f = folders.find((x) => x.id === fid);
      if (!f) break;
      path.unshift(f);
      fid = f.parentId;
    }
    return path;
  }, [currentFolderId, folders]);

  const parentFolderId = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null;

  // Visible items
  const subFolders = folders.filter((f) => f.parentId === currentFolderId);
  const visiblePresets = useMemo(() => {
    if (!selectedCat) return [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return selectedCat.presets.filter((p) => p.name.toLowerCase().includes(q));
    }
    return selectedCat.presets.filter((p) => (p.folderId ?? null) === currentFolderId);
  }, [selectedCat, currentFolderId, searchQuery]);

  function handleSelectPreset(preset: PresetDef) {
    if (preset.variants.length === 0) return;
    if (preset.variants.length === 1) {
      const v = preset.variants[0];
      onChange({ presetId: preset.id, variantId: v.id, presetName: preset.name, variantName: v.name, categoryId: selectedCatId });
      setOpen(false);
    } else {
      // Show variant sub-menu — handled by expanding inline
      setExpandedPresetId(preset.id === expandedPresetId ? null : preset.id);
    }
  }

  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);

  function handleSelectVariant(preset: PresetDef, variant: VariantDef) {
    onChange({ presetId: preset.id, variantId: variant.id, presetName: preset.name, variantName: variant.name, categoryId: selectedCatId });
    setOpen(false);
  }

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-left outline-none transition hover:bg-white/[0.06] focus:border-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          displayName ? "text-zinc-200" : "text-zinc-500"
        }`}
      >
        <span className="flex-1 min-w-0 truncate">{displayName ?? placeholder}</span>
        <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === backdropRef.current) setOpen(false); }}
        >
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl" style={{ maxHeight: "75vh" }}>
            {/* Category tabs (skip if locked) */}
            {!lockedCategoryId && filteredCats.length > 1 && (
              <div className="flex flex-wrap gap-1 border-b border-white/5 px-4 pt-3 pb-2">
                {filteredCats.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition ${
                      selectedCatId === cat.id ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {cat.color && (
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${cat.color})` }} />
                    )}
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Search bar */}
            <div className="border-b border-white/5 px-4 pt-2 pb-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <Search className="size-3.5 shrink-0 text-zinc-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setExpandedPresetId(null); }}
                  placeholder="搜索预制…"
                  className="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 text-zinc-500 hover:text-zinc-300">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Breadcrumb (hidden during search) */}
            {!isSearching && (
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
                {currentFolderId !== null && (
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(parentFolderId)}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(null)}
                    className="shrink-0 text-sky-400 transition hover:text-sky-300"
                  >
                    {selectedCat?.name ?? "根目录"}
                  </button>
                  {breadcrumb.map((seg, i) => {
                    const isLast = i === breadcrumb.length - 1;
                    return (
                      <span key={seg.id} className="flex items-center gap-1">
                        <ChevronRight className="size-3 text-zinc-600" />
                        {isLast ? (
                          <span className="shrink-0 text-zinc-200">{seg.name}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCurrentFolderId(seg.id)}
                            className="shrink-0 text-sky-400 transition hover:text-sky-300"
                          >
                            {seg.name}
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
              {!selectedCat ? (
                <div className="flex items-center justify-center py-12 text-xs text-zinc-600">选择一个分类</div>
              ) : visiblePresets.length === 0 && subFolders.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-xs text-zinc-600">
                  {isSearching ? "无匹配预制" : "空目录"}
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Folders (hidden during search) */}
                  {!isSearching && subFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => { setCurrentFolderId(folder.id); setExpandedPresetId(null); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition text-zinc-300 hover:bg-white/[0.04]"
                      style={{ minHeight: 40 }}
                    >
                      <Folder className="size-4 shrink-0 text-amber-400/70" />
                      <span className="flex-1 truncate text-xs">{folder.name}</span>
                      <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                    </button>
                  ))}
                  {/* Presets */}
                  {visiblePresets.map((preset) => {
                    const isSelected = value?.presetId === preset.id;
                    const isExpanded = expandedPresetId === preset.id;
                    return (
                      <div key={preset.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                            isSelected ? "bg-sky-500/10 text-sky-300" : "text-zinc-300 hover:bg-white/[0.04]"
                          }`}
                          style={{ minHeight: 40 }}
                        >
                          <span className="flex-1 min-w-0 truncate text-xs">{preset.name}</span>
                          {preset.variants.length > 1 && (
                            <span className="shrink-0 text-[10px] text-zinc-500">{preset.variants.length} 变体</span>
                          )}
                          {preset.variants.length > 1 && (
                            <ChevronRight className={`size-3 shrink-0 text-zinc-600 transition ${isExpanded ? "rotate-90" : ""}`} />
                          )}
                        </button>
                        {/* Variant sub-list */}
                        {isExpanded && preset.variants.length > 1 && (
                          <div className="ml-6 mt-0.5 space-y-0.5">
                            {preset.variants.map((v) => {
                              const vSelected = value?.variantId === v.id && value?.presetId === preset.id;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => handleSelectVariant(preset, v)}
                                  className={`w-full rounded-lg px-3 py-1.5 text-left text-[11px] transition ${
                                    vSelected ? "bg-sky-500/10 text-sky-300" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                                  }`}
                                >
                                  {v.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findCategoryForPreset(categories: CategoryDef[], presetId: string): string | null {
  for (const cat of categories) {
    if (cat.presets.some((p) => p.id === presetId)) return cat.id;
  }
  return null;
}
