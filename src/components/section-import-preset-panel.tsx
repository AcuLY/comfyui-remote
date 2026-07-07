"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Folder, Search, X } from "lucide-react";

import type { PresetLibraryV2 } from "@/components/prompt-block-editor";

export type ImportCategory = PresetLibraryV2["categories"][number];

export function ImportPresetPanel({
  categories,
  onImport,
  onImportGroup,
  onClose,
  isPending,
}: {
  categories: ImportCategory[];
  onImport: (
    presetId: string,
    variantId: string,
  ) => void;
  onImportGroup: (groupId: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedCat = categories.find((c) => c.id === selectedCatId);

  const isGroupCat = selectedCat?.type === "group";

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
    const folder = selectedCat.folders.find((f) => f.id === currentFolderId);
    return folder?.parentId ?? null;
  }, [currentFolderId, selectedCat]);

  const presetItems = useMemo(() => {
    if (!selectedCat || isGroupCat) return [];
    const q = searchQuery.trim().toLowerCase();
    const presetsInScope = q
      ? selectedCat.presets.filter((p) => p.name.toLowerCase().includes(q))
      : selectedCat.presets.filter((preset) => preset.folderId === currentFolderId);
    return presetsInScope
      .flatMap((preset) =>
        preset.variants.map((v) => ({
          presetId: preset.id,
          presetName: preset.name,
          variantId: v.id,
          variantName: preset.variants.length === 1 ? "" : v.name,
          displayName: preset.variants.length === 1 ? preset.name : `${preset.name} / ${v.name}`,
          prompt: v.prompt,
          negativePrompt: v.negativePrompt,
          lora1: v.lora1,
          lora2: v.lora2,
        })),
      );
  }, [selectedCat, isGroupCat, currentFolderId, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!selectedCat || !isGroupCat) return [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return (selectedCat.groups ?? []).filter((g) => g.name.toLowerCase().includes(q));
    }
    return (selectedCat.groups ?? []).filter((g) => (g.folderId ?? null) === currentFolderId);
  }, [selectedCat, isGroupCat, currentFolderId, searchQuery]);

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-sky-300">导入预制</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-zinc-500 hover:text-white"
        >
          <span className="text-[10px]">✕</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setSelectedCatId(cat.id);
              setCurrentFolderId(null);
              setSearchQuery("");
            }}
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

      <div className="max-h-64 overflow-y-auto space-y-1">
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
            filteredGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                disabled={isPending}
                onClick={() => onImportGroup(group.id)}
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] p-2 text-left transition hover:border-white/10 disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-amber-500/15 px-1 py-px text-[9px] text-amber-400">组</span>
                  <span className="text-[11px] font-medium text-zinc-200">{group.name}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-500">
                  {group.members.length} 个成员：
                  {group.members
                    .slice(0, 3)
                    .map((m) => m.subGroupName ?? m.presetName ?? "?")
                    .join("、")}
                  {group.members.length > 3 ? "…" : ""}
                </div>
              </button>
            ))
          )
        ) : (
          presetItems.length === 0 && subFolders.length === 0 ? (
            <div className="py-2 text-center text-[10px] text-zinc-600">暂无可导入的预制</div>
          ) : (
            presetItems.map((item) => (
              <button
                key={`${item.presetId}-${item.variantId}`}
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!selectedCat) return;
                  onImport(
                    item.presetId,
                    item.variantId,
                  );
                }}
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] p-2 text-left transition hover:border-white/10 disabled:opacity-50"
              >
                <div className="text-[11px] font-medium text-zinc-200">{item.displayName}</div>
                <div className="mt-0.5 text-[10px] text-zinc-500 truncate">
                  {item.prompt.slice(0, 60)}{item.prompt.length > 60 ? "..." : ""}
                </div>
              </button>
            ))
          )
        )}
      </div>
    </div>
  );
}
