"use client";

import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, X, ChevronDown, ChevronLeft, Search,
  Folder, RotateCw, ClipboardCopy, Check, Package, Replace,
} from "lucide-react";
import { toast } from "sonner";
import { createSectionFromTemplate, flattenGroup } from "@/lib/actions";
import type { PromptLibraryV2 } from "@/components/prompt-block-editor";
import { ASPECT_RATIOS, resolveResolution } from "@/lib/aspect-ratio-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PresetBinding = { categoryId: string; presetId: string; variantId?: string };

type ImportItem = {
  /** Unique key for this slot */
  key: string;
  presetId: string;
  variantId: string;
  groupBindingId?: string;
  /** Display label (preset name / variant name) */
  label: string;
  /** Group name if preset belongs to a group */
  groupName?: string;
  /** Category info for locating in browser */
  categoryId: string;
  folderId: string | null;
  /** All available variants */
  variants: Array<{ id: string; name: string }>;
};

type CreatedSection = {
  id: string;
  name: string;
  index: number;
};

// ---------------------------------------------------------------------------
// Aspect ratio options
// ---------------------------------------------------------------------------

const RATIO_OPTIONS = Object.keys(ASPECT_RATIOS);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  projectId: string;
  projectTitle: string;
  presetBindings: PresetBinding[];
  defaultAspectRatio: string;
  defaultShortSidePx: number;
  library: PromptLibraryV2;
};

export function BatchCreateClient({
  projectId,
  projectTitle,
  presetBindings,
  defaultAspectRatio,
  defaultShortSidePx,
  library,
}: Props) {
  // --- State ---
  const [importList, setImportList] = useState<ImportItem[]>([]);
  const [bindingOverrides, setBindingOverrides] = useState<Record<string, string>>({});
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [shortSidePx, setShortSidePx] = useState(String(defaultShortSidePx));
  const [sectionName, setSectionName] = useState("");
  const [createdSections, setCreatedSections] = useState<CreatedSection[]>([]);
  const [isPending, startTransition] = useTransition();

  // Browser state (left panel)
  const [selectedCatId, setSelectedCatId] = useState(library.categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedCat = library.categories.find((c) => c.id === selectedCatId);
  const isGroupCat = selectedCat?.type === "group";

  // Reset folder/search when category changes
  useEffect(() => {
    setCurrentFolderId(null);
    setSearchQuery("");
  }, [selectedCatId]);

  // --- Computed: subfolders ---
  const subFolders = useMemo(() => {
    if (!selectedCat?.folders) return [];
    return selectedCat.folders.filter((f) => f.parentId === currentFolderId);
  }, [selectedCat, currentFolderId]);

  const currentFolderName = useMemo(() => {
    if (!currentFolderId || !selectedCat?.folders) return null;
    return selectedCat.folders.find((f) => f.id === currentFolderId)?.name ?? null;
  }, [currentFolderId, selectedCat]);

  const parentFolderId = useMemo(() => {
    if (!currentFolderId || !selectedCat?.folders) return null;
    return selectedCat.folders.find((f) => f.id === currentFolderId)?.parentId ?? null;
  }, [currentFolderId, selectedCat]);

  // --- Computed: preset items in current view ---
  const presetItems = useMemo(() => {
    if (!selectedCat || isGroupCat) return [];
    const q = searchQuery.trim().toLowerCase();
    const presetsInScope = q
      ? selectedCat.presets.filter((p) => p.name.toLowerCase().includes(q))
      : selectedCat.presets.filter((p) => p.folderId === currentFolderId);
    return presetsInScope.flatMap((preset) =>
      preset.variants.map((v) => ({
        presetId: preset.id,
        presetName: preset.name,
        folderId: preset.folderId ?? null,
        variantId: v.id,
        variantName: preset.variants.length === 1 ? "" : v.name,
        displayName: preset.variants.length === 1 ? preset.name : `${preset.name} / ${v.name}`,
        variants: preset.variants.map((vv) => ({ id: vv.id, name: vv.name })),
      })),
    );
  }, [selectedCat, isGroupCat, currentFolderId, searchQuery]);

  // --- Computed: groups in current view ---
  const filteredGroups = useMemo(() => {
    if (!selectedCat || !isGroupCat) return [];
    const q = searchQuery.trim().toLowerCase();
    if (q) return (selectedCat.groups ?? []).filter((g) => g.name.toLowerCase().includes(q));
    return (selectedCat.groups ?? []).filter((g) => (g.folderId ?? null) === currentFolderId);
  }, [selectedCat, isGroupCat, currentFolderId, searchQuery]);

  // --- Computed: resolved dimensions ---
  const shortPx = shortSidePx ? parseInt(shortSidePx, 10) : null;
  const resolved = aspectRatio ? resolveResolution(aspectRatio, shortPx && shortPx > 0 ? shortPx : null) : null;

  // --- Computed: project binding info with resolved names ---
  const projectBindingInfos = useMemo(() => {
    return presetBindings.map((binding) => {
      let presetName = "";
      let categoryName = "";
      let variants: Array<{ id: string; name: string }> = [];
      let folderId: string | null = null;
      for (const cat of library.categories) {
        const preset = cat.presets.find((p) => p.id === binding.presetId);
        if (preset) {
          presetName = preset.name;
          categoryName = cat.name;
          variants = preset.variants.map((v) => ({ id: v.id, name: v.name }));
          folderId = preset.folderId ?? null;
          break;
        }
      }
      return { ...binding, presetName, categoryName, variants, folderId };
    });
  }, [presetBindings, library]);

  // --- Helpers: navigate browser to a preset's location ---
  const navigateToPreset = useCallback(
    (presetId: string, categoryId?: string) => {
      // Find which category and folder this preset is in
      for (const cat of library.categories) {
        if (categoryId && cat.id !== categoryId) continue;
        const preset = cat.presets.find((p) => p.id === presetId);
        if (preset) {
          setSelectedCatId(cat.id);
          setCurrentFolderId(preset.folderId ?? null);
          setSearchQuery("");
          return;
        }
      }
    },
    [library],
  );

  // --- Actions ---
  const addPresetToImportList = useCallback(
    (presetId: string, presetName: string, variantId: string, variantName: string, folderId: string | null, categoryId: string, variants: Array<{ id: string; name: string }>) => {
      // Check if already imported
      if (importList.some((item) => item.presetId === presetId)) return;
      setImportList((prev) => [
        ...prev,
        {
          key: `imp-${presetId}`,
          presetId,
          variantId,
          label: variantName ? `${presetName} / ${variantName}` : presetName,
          categoryId,
          folderId,
          variants,
        },
      ]);
    },
    [importList],
  );

  const overrideAddPreset = useCallback(
    (presetId: string, presetName: string, variantId: string, variantName: string, folderId: string | null, categoryId: string, variants: Array<{ id: string; name: string }>) => {
      const label = variantName ? `${presetName} / ${variantName}` : presetName;
      // Remove all imports from the same category
      setImportList((prev) => [
        ...prev.filter((i) => i.categoryId !== categoryId),
        {
          key: `imp-${presetId}`,
          presetId,
          variantId,
          label,
          categoryId,
          folderId,
          variants,
        },
      ]);
      // Remove binding overrides for presets in the same category
      setBindingOverrides((prev) => {
        const catPresetIds = new Set(projectBindingInfos.filter((b) => b.categoryId === categoryId).map((b) => b.presetId));
        const next = { ...prev };
        for (const pid of catPresetIds) delete next[pid];
        return next;
      });
      // Fill section name
      setSectionName(presetName);
      toast.success(`已覆盖 ${presetName}`);
    },
    [projectBindingInfos],
  );

  const addGroupToImportList = useCallback(
    async (groupId: string) => {
      const members = await flattenGroup(groupId);
      const newItems: ImportItem[] = [];
      const groupBindingId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Look up the group name directly from the group that was clicked
      let resolvedGroupName: string | undefined;
      let groupCategoryId = "";
      for (const cat of library.categories) {
        const g = (cat.groups ?? []).find((gg) => gg.id === groupId);
        if (g) { resolvedGroupName = g.name; groupCategoryId = cat.id; break; }
      }

      for (const m of members) {
        if (importList.some((item) => item.presetId === m.presetId)) continue;
        // Find preset info
        let presetName = "";
        let folderId: string | null = null;
        let categoryId = "";
        let variantId = m.variantId ?? "";
        let variants: Array<{ id: string; name: string }> = [];
        for (const cat of library.categories) {
          const preset = cat.presets.find((p) => p.id === m.presetId);
          if (preset) {
            presetName = preset.name;
            folderId = preset.folderId ?? null;
            categoryId = cat.id;
            variants = preset.variants.map((v) => ({ id: v.id, name: v.name }));
            if (!variantId && preset.variants.length > 0) variantId = preset.variants[0].id;
            break;
          }
        }
        if (!presetName) continue;
        const variantName = variants.length > 1 ? variants.find((v) => v.id === variantId)?.name ?? "" : "";
        newItems.push({
          key: `imp-${m.presetId}`,
          presetId: m.presetId,
          variantId,
          groupBindingId,
          label: variantName ? `${presetName} / ${variantName}` : presetName,
          groupName: resolvedGroupName,
          categoryId,
          folderId,
          variants,
        });
      }
      if (newItems.length > 0) {
        setImportList((prev) => [...prev, ...newItems]);
      }
    },
    [importList, library],
  );

  const overrideAddGroup = useCallback(
    async (groupId: string) => {
      const members = await flattenGroup(groupId);
      const newItems: ImportItem[] = [];
      const groupBindingId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Look up the group name and category
      let resolvedGroupName: string | undefined;
      let groupCategoryId = "";
      for (const cat of library.categories) {
        const g = (cat.groups ?? []).find((gg) => gg.id === groupId);
        if (g) { resolvedGroupName = g.name; groupCategoryId = cat.id; break; }
      }

      // Build new items
      for (const m of members) {
        let presetName = "";
        let folderId: string | null = null;
        let categoryId = "";
        let variantId = m.variantId ?? "";
        let variants: Array<{ id: string; name: string }> = [];
        for (const cat of library.categories) {
          const preset = cat.presets.find((p) => p.id === m.presetId);
          if (preset) {
            presetName = preset.name;
            folderId = preset.folderId ?? null;
            categoryId = cat.id;
            variants = preset.variants.map((v) => ({ id: v.id, name: v.name }));
            if (!variantId && preset.variants.length > 0) variantId = preset.variants[0].id;
            break;
          }
        }
        if (!presetName) continue;
        const variantName = variants.length > 1 ? variants.find((v) => v.id === variantId)?.name ?? "" : "";
        newItems.push({
          key: `imp-${m.presetId}`,
          presetId: m.presetId,
          variantId,
          groupBindingId,
          label: variantName ? `${presetName} / ${variantName}` : presetName,
          groupName: resolvedGroupName,
          categoryId,
          folderId,
          variants,
        });
      }

      // Clear same-category items, keep only new group items
      setImportList(newItems);
      // Clear binding overrides for the group's category
      setBindingOverrides((prev) => {
        const catPresetIds = new Set(projectBindingInfos.filter((b) => b.categoryId === groupCategoryId).map((b) => b.presetId));
        const next = { ...prev };
        for (const pid of catPresetIds) delete next[pid];
        return next;
      });
      // Fill section name with group name
      if (resolvedGroupName) setSectionName(resolvedGroupName);
      toast.success(`已覆盖 ${resolvedGroupName}`);
    },
    [library, projectBindingInfos],
  );

  const removeImportItem = useCallback((key: string) => {
    setImportList((prev) => {
      const item = prev.find((i) => i.key === key);
      if (!item) return prev;
      // If part of a group, remove all members with same groupBindingId
      if (item.groupBindingId) {
        return prev.filter((i) => i.groupBindingId !== item.groupBindingId);
      }
      return prev.filter((i) => i.key !== key);
    });
  }, []);

  const updateImportVariant = useCallback((key: string, newVariantId: string) => {
    setImportList((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const vName = item.variants.find((v) => v.id === newVariantId)?.name ?? "";
        const baseName = item.label.includes("/") ? item.label.split(" / ")[0] : item.label;
        return { ...item, variantId: newVariantId, label: vName ? `${baseName} / ${vName}` : baseName };
      }),
    );
  }, []);

  const fillNameFromImport = useCallback(
    (key: string) => {
      const item = importList.find((i) => i.key === key);
      if (!item) return;
      // If part of a group, use the group name
      if (item.groupBindingId && item.groupName) {
        setSectionName(item.groupName);
      } else if (item.groupBindingId) {
        // Fallback: concatenate all group member names
        const groupMembers = importList.filter((i) => i.groupBindingId === item.groupBindingId);
        const names = groupMembers.map((m) => m.label.split(" / ")[0]);
        setSectionName(names.join(" · "));
      } else {
        setSectionName(item.label.split(" / ")[0]);
      }
    },
    [importList],
  );

  const handleCreate = useCallback(() => {
    startTransition(async () => {
      const extraImports = importList.map((item) => ({
        presetId: item.presetId,
        variantId: item.variantId,
        groupBindingId: item.groupBindingId,
      }));
      const bindingVariantOverrides = Object.entries(bindingOverrides)
        .filter(([_, variantId]) => !!variantId)
        .map(([presetId, variantId]) => ({ presetId, variantId }));

      const sectionId = await createSectionFromTemplate({
        projectId,
        name: sectionName.trim() || undefined,
        aspectRatio,
        shortSidePx: shortPx && shortPx > 0 ? shortPx : undefined,
        extraImports,
        bindingVariantOverrides,
      });

      setCreatedSections((prev) => [
        { id: sectionId, name: sectionName.trim() || `小节`, index: prev.length + 1 },
        ...prev,
      ]);
      setSectionName("");
      toast.success("小节已创建");
    });
  }, [projectId, sectionName, aspectRatio, shortPx, importList, bindingOverrides]);

  // --- Check if preset is already in import list ---
  const isPresetInList = useCallback(
    (presetId: string) => importList.some((item) => item.presetId === presetId),
    [importList],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" /> 返回
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">批量创建小节</h1>
          <p className="text-xs text-zinc-500">{projectTitle}</p>
        </div>
      </div>

      {/* Main layout: left browser + right config */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        {/* Left: Preset browser */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <span className="text-[11px] font-medium text-sky-300">预制浏览器</span>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1">
            {library.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatId(cat.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition ${
                  selectedCatId === cat.id
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {cat.name}
                {cat.type === "group" && (
                  <span className="rounded bg-amber-500/20 px-1 py-px text-[9px] text-amber-300">组</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
            <Search className="size-3 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索预制…"
              className="flex-1 bg-transparent text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 text-zinc-500 hover:text-zinc-300">
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[calc(100vh-300px)] min-h-48 overflow-y-auto space-y-1">
            {/* Back button */}
            {!searchQuery.trim() && currentFolderId !== null && (
              <button
                type="button"
                onClick={() => setCurrentFolderId(parentFolderId)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-sky-400/70 hover:text-sky-300 hover:bg-white/[0.04] w-full text-left"
              >
                <ChevronLeft className="size-3" />
                ← 返回上级{currentFolderName ? ` (${currentFolderName})` : ""}
              </button>
            )}

            {/* Subfolders */}
            {!searchQuery.trim() && subFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setCurrentFolderId(folder.id)}
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] p-2 text-left transition hover:border-white/10 flex items-center gap-1.5"
              >
                <Folder className="size-3.5 text-amber-400/70" />
                <span className="text-[11px] font-medium text-zinc-200">{folder.name}</span>
              </button>
            ))}

            {isGroupCat ? (
              filteredGroups.length === 0 && subFolders.length === 0 ? (
                <div className="py-2 text-center text-[10px] text-zinc-600">暂无可导入的预制组</div>
              ) : (
                filteredGroups.map((group) => {
                  const hasGroupCategoryItems = importList.some((i) => i.categoryId === selectedCat!.id)
                    || projectBindingInfos.some((b) => b.categoryId === selectedCat!.id);
                  return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => addGroupToImportList(group.id)}
                    className="w-full rounded-lg border border-white/5 bg-white/[0.02] p-2 text-left transition hover:border-sky-500/30"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-amber-500/15 px-1 py-px text-[9px] text-amber-400">组</span>
                        <span className="text-[11px] font-medium text-zinc-200">{group.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasGroupCategoryItems && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              overrideAddGroup(group.id);
                            }}
                            className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] text-amber-400/80 hover:bg-amber-500/10 transition"
                            title="覆盖添加：清除同分类预制，只保留此组"
                          >
                            <Replace className="size-2.5" />
                          </span>
                        )}
                        <Plus className="size-3 text-zinc-600" />
                      </div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {group.members.length} 个成员
                    </div>
                  </button>
                  );
                })
              )
            ) : (
              presetItems.length === 0 && subFolders.length === 0 ? (
                <div className="py-2 text-center text-[10px] text-zinc-600">暂无可导入的预制</div>
              ) : (
                presetItems.map((item) => {
                  const inList = isPresetInList(item.presetId);
                  const hasCategoryItems = importList.some((i) => i.categoryId === selectedCat!.id)
                    || projectBindingInfos.some((b) => b.categoryId === selectedCat!.id);
                  return (
                    <button
                      key={`${item.presetId}-${item.variantId}`}
                      type="button"
                      onClick={() =>
                        addPresetToImportList(
                          item.presetId, item.presetName, item.variantId,
                          item.variantName, item.folderId, selectedCat!.id, item.variants,
                        )
                      }
                      disabled={inList}
                      className={`w-full rounded-lg border p-2 text-left transition disabled:opacity-40 ${
                        inList
                          ? "border-white/5 bg-white/[0.01]"
                          : "border-white/5 bg-white/[0.02] hover:border-sky-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="text-[11px] font-medium text-zinc-200 truncate">{item.displayName}</div>
                        {inList ? (
                          <Check className="size-3 shrink-0 text-sky-400" />
                        ) : (
                          <div className="flex items-center gap-1">
                            {hasCategoryItems && (
                              <span
                                role="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  overrideAddPreset(
                                    item.presetId, item.presetName, item.variantId,
                                    item.variantName, item.folderId, selectedCat!.id, item.variants,
                                  );
                                }}
                                className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] text-amber-400/80 hover:bg-amber-500/10 transition"
                                title="覆盖添加：清除同分类预制，只保留此预制"
                              >
                                <Replace className="size-2.5" />
                              </span>
                            )}
                            <Plus className="size-3 shrink-0 text-zinc-600" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Right: Configuration panel */}
        <div className="space-y-3">
          {/* Import list */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <span className="text-[11px] font-medium text-zinc-300">导入列表</span>
            {importList.length === 0 && (
              <div className="text-[10px] text-zinc-600">从左侧浏览器点击添加预制</div>
            )}
            <div className="space-y-1.5">
              {importList.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5"
                >
                  {/* Name & variant */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {item.groupBindingId && (
                        <span className="rounded bg-amber-500/15 px-1 py-px text-[8px] text-amber-400 shrink-0">组</span>
                      )}
                      <span className="text-[11px] text-zinc-200 truncate">{item.label}</span>
                    </div>
                    {/* Variant selector if multiple */}
                    {item.variants.length > 1 && (
                      <div className="relative mt-1">
                        <select
                          value={item.variantId}
                          onChange={(e) => updateImportVariant(item.key, e.target.value)}
                          className="w-full rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-300 outline-none appearance-none pr-5"
                        >
                          {item.variants.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 size-2.5 -translate-y-1/2 text-zinc-500" />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Fill name from this preset */}
                    <button
                      type="button"
                      onClick={() => fillNameFromImport(item.key)}
                      title="用预制名填充小节名"
                      className="rounded p-1 text-zinc-600 hover:bg-sky-500/10 hover:text-sky-400"
                    >
                      <ClipboardCopy className="size-3" />
                    </button>
                    {/* Navigate to this preset in browser */}
                    <button
                      type="button"
                      onClick={() => navigateToPreset(item.presetId, item.categoryId)}
                      title="在浏览器中定位"
                      className="rounded p-1 text-zinc-600 hover:bg-amber-500/10 hover:text-amber-400"
                    >
                      <Search className="size-3" />
                    </button>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeImportItem(item.key)}
                      title="移除"
                      className="rounded p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Project bindings (variant override) */}
          {projectBindingInfos.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <span className="text-[11px] font-medium text-zinc-300">项目绑定（切换变体）</span>
              <div className="space-y-1.5">
                {projectBindingInfos.map((b) => (
                  <div key={b.presetId} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-zinc-200 truncate">{b.presetName || b.presetId}</div>
                      {b.categoryName && (
                        <div className="text-[9px] text-zinc-500">{b.categoryName}</div>
                      )}
                    </div>
                    {b.variants.length > 1 ? (
                      <div className="relative shrink-0">
                        <select
                          value={bindingOverrides[b.presetId] ?? ""}
                          onChange={(e) =>
                            setBindingOverrides((prev) => ({
                              ...prev,
                              [b.presetId]: e.target.value || undefined as unknown as string,
                            }))
                          }
                          className="w-28 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-300 outline-none appearance-none pr-5"
                        >
                          <option value="">默认</option>
                          {b.variants.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 size-2.5 -translate-y-1/2 text-zinc-500" />
                      </div>
                    ) : (
                      <span className="text-[9px] text-zinc-600">单变体</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Canvas size */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <span className="text-[11px] font-medium text-zinc-300">画幅</span>
            <div className="flex flex-wrap gap-1.5">
              {RATIO_OPTIONS.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                    aspectRatio === ratio
                      ? "border border-sky-500/40 bg-sky-500/15 text-sky-300"
                      : "border border-white/5 bg-white/[0.02] text-zinc-500 hover:bg-white/[0.06]"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                短边 px
                <input
                  type="number"
                  min={256}
                  max={4096}
                  step={8}
                  value={shortSidePx}
                  onChange={(e) => setShortSidePx(e.target.value)}
                  className="input-number w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600"
                />
              </label>
              {resolved && (
                <span className="text-[10px] text-zinc-600">
                  {resolved.width}×{resolved.height}
                </span>
              )}
            </div>
          </div>

          {/* Section name + create */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <span className="text-[11px] font-medium text-zinc-300">小节名称</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="可选，留空自动编号"
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={handleCreate}
                className="shrink-0 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "创建中…" : "创建小节"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recently created sections */}
      {createdSections.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] font-medium text-zinc-400 mb-2">
            最近创建 ({createdSections.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {createdSections.map((s) => (
              <Link
                key={s.id}
                href={`/projects/${projectId}/sections/${s.id}/blocks`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-[10px] text-zinc-300 hover:border-white/10 transition"
              >
                <span>{s.name}</span>
                <ChevronDown className="size-2.5 -rotate-90 text-zinc-600" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
