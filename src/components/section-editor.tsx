"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, Unlink, Package, ChevronDown, ClipboardCopy, Folder, ChevronLeft, Search, X, ExternalLink } from "lucide-react";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import type { PromptBlockData } from "@/lib/actions";
import {
  deleteSectionBlock,
  importPresetToSection,
  flattenGroup,
  switchBindingVariant,
} from "@/lib/actions";
import type { LoraEntry } from "@/lib/lora-types";
import type { PresetLibraryV2 } from "@/components/prompt-block-editor";

/** 2-partition LoRA config (lora1 + lora2 only) */
type LoraConfig2 = {
  lora1: LoraEntry[];
  lora2: LoraEntry[];
};

/** A preset binding record (derived from blocks + loras with same bindingId) */
type PresetBindingInfo = {
  bindingId: string;
  presetName: string;  // from block label
  groupName: string | undefined;  // group name if preset belongs to a group
  sourceId: string | null;  // preset ID
  variantId: string | null;  // current variant ID
  categoryName?: string;
  categoryColor?: string;
  groupBindingId: string | null;
  blockCount: number;
  loraCount: number;
  availableVariants: Array<{ id: string; name: string }>;  // from library data
};

type SectionEditorProps = {
  sectionId: string;
  initialBlocks: PromptBlockData[];
  initialLoraConfig: LoraConfig2;
  libraryV2?: PresetLibraryV2;
  onLoraChange: (config: LoraConfig2) => Promise<void>;
  onRename?: (name: string) => void;
};

export function SectionEditor({
  sectionId,
  initialBlocks,
  initialLoraConfig,
  libraryV2,
  onLoraChange,
  onRename,
}: SectionEditorProps) {
  const [blocks, setBlocks] = useState<PromptBlockData[]>(initialBlocks);
  const [lora1, setLora1] = useState<LoraEntry[]>(initialLoraConfig.lora1);
  const [lora2, setLora2] = useState<LoraEntry[]>(initialLoraConfig.lora2);
  const [isPending, startTransition] = useTransition();
  const [showImportPanel, setShowImportPanel] = useState(false);

  // Derive preset binding list from blocks + loras
  const presetBindings = useMemo(() => {
    const map = new Map<string, PresetBindingInfo>();
    for (const b of blocks) {
      if (b.bindingId && b.type === "preset") {
        const existing = map.get(b.bindingId);
        if (existing) {
          existing.blockCount++;
        } else {
          // Look up available variants and category info from library data
          let availableVariants: Array<{ id: string; name: string }> = [];
          let categoryName: string | undefined;
          let categoryColor: string | undefined;
          if (b.sourceId && libraryV2) {
            for (const cat of libraryV2.categories) {
              const preset = cat.presets.find((p) => p.id === b.sourceId);
              if (preset) {
                availableVariants = preset.variants.map((v) => ({ id: v.id, name: v.name }));
                categoryName = cat.name;
                categoryColor = cat.color ?? undefined;
                break;
              }
            }
          }
          // Fallback: look up category info by categoryId (for template-imported blocks without sourceId)
          if (!categoryName && b.categoryId && libraryV2) {
            const cat = libraryV2.categories.find((c) => c.id === b.categoryId);
            if (cat) {
              categoryName = cat.name;
              categoryColor = cat.color ?? undefined;
            }
          }
          // Look up group name if preset belongs to a group
          let groupName: string | undefined;
          if (b.sourceId && libraryV2) {
            for (const cat of libraryV2.categories) {
              for (const g of cat.groups ?? []) {
                if (g.members.some((m) => m.presetId === b.sourceId)) {
                  groupName = g.name;
                  break;
                }
              }
              if (groupName) break;
            }
          }
          map.set(b.bindingId, {
            bindingId: b.bindingId,
            presetName: b.label,
            groupName,
            sourceId: b.sourceId,
            variantId: b.variantId,
            categoryName,
            categoryColor,
            groupBindingId: b.groupBindingId,
            blockCount: 1,
            loraCount: 0,
            availableVariants,
          });
        }
      }
    }
    for (const e of [...lora1, ...lora2]) {
      if (e.bindingId) {
        const existing = map.get(e.bindingId);
        if (existing) {
          existing.loraCount++;
        }
      }
    }
    return [...map.values()];
  }, [blocks, lora1, lora2, libraryV2]);

  // ── Switch variant for an imported preset ──
  function handleSwitchVariant(bindingId: string, newVariantId: string) {
    startTransition(async () => {
      const result = await switchBindingVariant(sectionId, bindingId, newVariantId);
      if (!result) return;

      // Update the block in state
      setBlocks((prev) =>
        prev.map((b) => (b.bindingId === bindingId ? { ...b, ...result.block } : b)),
      );

      // Replace LoRAs for this bindingId at the same position
      const newL1 = result.lora1.map((l) => ({ ...l, source: "preset" as const }));
      const newL2 = result.lora2.map((l) => ({ ...l, source: "preset" as const }));

      const idx1 = lora1.findIndex((e) => e.bindingId === bindingId);
      const filtered1 = lora1.filter((e) => e.bindingId !== bindingId);
      const insertAt1 = idx1 >= 0 ? Math.min(idx1, filtered1.length) : filtered1.length;
      filtered1.splice(insertAt1, 0, ...newL1);

      const idx2 = lora2.findIndex((e) => e.bindingId === bindingId);
      const filtered2 = lora2.filter((e) => e.bindingId !== bindingId);
      const insertAt2 = idx2 >= 0 ? Math.min(idx2, filtered2.length) : filtered2.length;
      filtered2.splice(insertAt2, 0, ...newL2);

      setLora1(filtered1);
      setLora2(filtered2);
      await onLoraChange({ lora1: filtered1, lora2: filtered2 });
    });
  }

  // ── Import a preset (server-side resolution of linkedVariants) ──
  function handlePresetImport(
    presetId: string,
    _presetName: string,
    variantId: string,
    _variantName: string,
    _prompt: string,
    _negativePrompt: string | null,
    _lora1Bindings: unknown,
    _lora2Bindings: unknown,
    _categoryId: string,
    _categoryName: string,
    _categoryColor: string | null,
  ) {
    startTransition(async () => {
      const result = await importPresetToSection(sectionId, presetId, variantId);
      if (!result) return;

      // Insert block at the correct position (server already bumped sortOrders via updateMany)
      setBlocks((prev) => {
        const updated = prev.map((b) =>
          b.sortOrder >= result.block.sortOrder
            ? { ...b, sortOrder: b.sortOrder + 1 }
            : b,
        );
        updated.push(result.block);
        updated.sort((a, b) => a.sortOrder - b.sortOrder);
        return updated;
      });

      // Insert LoRAs at correct position based on category lora1Order/lora2Order
      let updatedLora1 = [...lora1];
      let updatedLora2 = [...lora2];
      let loraChanged = false;

      if (result.lora1.length > 0) {
        // Find insertion index by category lora1Order
        const myOrder = result.categoryOrders.lora1Order;
        let insertIdx = updatedLora1.length;
        for (let i = 0; i < updatedLora1.length; i++) {
          const entry = updatedLora1[i];
          // Compare by looking up source category order from libraryV2
          const entryCatOrder = getCategoryLoraOrder(entry, "lora1");
          if (entryCatOrder > myOrder) {
            insertIdx = i;
            break;
          }
        }
        updatedLora1.splice(insertIdx, 0, ...result.lora1.map((l) => ({ ...l, source: "preset" as const })));
        loraChanged = true;
      }

      if (result.lora2.length > 0) {
        const myOrder = result.categoryOrders.lora2Order;
        let insertIdx = updatedLora2.length;
        for (let i = 0; i < updatedLora2.length; i++) {
          const entry = updatedLora2[i];
          const entryCatOrder = getCategoryLoraOrder(entry, "lora2");
          if (entryCatOrder > myOrder) {
            insertIdx = i;
            break;
          }
        }
        updatedLora2.splice(insertIdx, 0, ...result.lora2.map((l) => ({ ...l, source: "preset" as const })));
        loraChanged = true;
      }

      if (loraChanged) {
        setLora1(updatedLora1);
        setLora2(updatedLora2);
        await onLoraChange({ lora1: updatedLora1, lora2: updatedLora2 });
      }

      setShowImportPanel(false);
    });
  }

  // ── Import a preset group (flatten → import each member) ──
  function handleGroupImport(groupId: string) {
    startTransition(async () => {
      const members = await flattenGroup(groupId);
      const groupBid = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newBlocks: PromptBlockData[] = [];
      let updatedLora1 = [...lora1];
      let updatedLora2 = [...lora2];
      let loraChanged = false;

      for (const m of members) {
        if (!m.presetId) continue;
        // Use default variant if none specified
        let variantId = m.variantId;
        if (!variantId) {
          for (const cat of libraryV2?.categories ?? []) {
            const preset = cat.presets.find((p) => p.id === m.presetId);
            if (preset && preset.variants.length > 0) {
              variantId = preset.variants[0].id;
              break;
            }
          }
        }
        if (!variantId) continue;

        const result = await importPresetToSection(sectionId, m.presetId, variantId, groupBid);
        if (!result) continue;

        newBlocks.push(result.block);

        // Insert LoRAs at correct position based on category order
        if (result.lora1.length > 0) {
          const myOrder = result.categoryOrders.lora1Order;
          let insertIdx = updatedLora1.length;
          for (let i = 0; i < updatedLora1.length; i++) {
            const entryCatOrder = getCategoryLoraOrder(updatedLora1[i], "lora1");
            if (entryCatOrder > myOrder) { insertIdx = i; break; }
          }
          updatedLora1.splice(insertIdx, 0, ...result.lora1.map((l) => ({ ...l, source: "preset" as const })));
          loraChanged = true;
        }
        if (result.lora2.length > 0) {
          const myOrder = result.categoryOrders.lora2Order;
          let insertIdx = updatedLora2.length;
          for (let i = 0; i < updatedLora2.length; i++) {
            const entryCatOrder = getCategoryLoraOrder(updatedLora2[i], "lora2");
            if (entryCatOrder > myOrder) { insertIdx = i; break; }
          }
          updatedLora2.splice(insertIdx, 0, ...result.lora2.map((l) => ({ ...l, source: "preset" as const })));
          loraChanged = true;
        }
      }

      if (newBlocks.length > 0) {
        setBlocks((prev) => {
          // Server already bumped sortOrders for each insertion; rebuild local state
          // by collecting all sortOrders used by new blocks and incrementing old blocks accordingly
          const newSortOrders = newBlocks.map((b) => b.sortOrder).sort((a, b) => a - b);
          const updated = prev.map((b) => {
            let bump = 0;
            for (const ns of newSortOrders) {
              if (b.sortOrder >= ns - bump) bump++;
            }
            return bump > 0 ? { ...b, sortOrder: b.sortOrder + bump } : b;
          });
          updated.push(...newBlocks);
          updated.sort((a, b) => a.sortOrder - b.sortOrder);
          return updated;
        });
      }

      if (loraChanged) {
        setLora1(updatedLora1);
        setLora2(updatedLora2);
        await onLoraChange({ lora1: updatedLora1, lora2: updatedLora2 });
      }

      setShowImportPanel(false);
    });
  }

  /** Look up a LoRA entry's category order from libraryV2 data */
  function getCategoryLoraOrder(entry: LoraEntry, dimension: "lora1" | "lora2"): number {
    if (!libraryV2 || entry.source !== "preset") return 999;
    // Find category by sourceLabel (category name)
    const cat = libraryV2.categories.find((c) => c.name === entry.sourceLabel);
    if (!cat) return 999;
    return dimension === "lora1" ? (cat.lora1Order ?? 999) : (cat.lora2Order ?? 999);
  }

  // ── Delete an entire preset binding (and cascade to group if part of one) ──
  function handleDeleteBinding(bindingId: string) {
    const info = presetBindings.find((b) => b.bindingId === bindingId);
    if (!info) return;

    // Check if this binding is part of a group import
    const block = blocks.find((b) => b.bindingId === bindingId);
    const groupBid = block?.groupBindingId;

    if (groupBid) {
      // Collect all bindings in the same group
      const groupBindingIds = new Set(
        blocks.filter((b) => b.groupBindingId === groupBid).map((b) => b.bindingId).filter(Boolean) as string[],
      );
      const groupNames = presetBindings
        .filter((b) => groupBindingIds.has(b.bindingId))
        .map((b) => b.presetName);

      if (!confirm(`此预制属于预制组导入。删除将同时移除整组内容：\n${groupNames.map(n => `  · ${n}`).join("\n")}\n\n确认删除？`)) return;

      startTransition(async () => {
        // Delete all blocks in the group
        const blocksToDelete = blocks.filter((b) => b.groupBindingId === groupBid);
        for (const b of blocksToDelete) {
          await deleteSectionBlock(b.id);
        }
        setBlocks((prev) => prev.filter((b) => b.groupBindingId !== groupBid));

        // Remove all LoRAs whose bindingId belongs to this group
        const updatedLora1 = lora1.filter((e) => !e.bindingId || !groupBindingIds.has(e.bindingId));
        const updatedLora2 = lora2.filter((e) => !e.bindingId || !groupBindingIds.has(e.bindingId));
        setLora1(updatedLora1);
        setLora2(updatedLora2);
        await onLoraChange({ lora1: updatedLora1, lora2: updatedLora2 });
      });
    } else {
      if (!confirm(`删除「${info.presetName}」的绑定？将同时删除 ${info.blockCount} 个提示词块和 ${info.loraCount} 个 LoRA。`)) return;

      startTransition(async () => {
        const blocksToDelete = blocks.filter((b) => b.bindingId === bindingId);
        for (const b of blocksToDelete) {
          await deleteSectionBlock(b.id);
        }
        setBlocks((prev) => prev.filter((b) => b.bindingId !== bindingId));

        const updatedLora1 = lora1.filter((e) => e.bindingId !== bindingId);
        const updatedLora2 = lora2.filter((e) => e.bindingId !== bindingId);
        setLora1(updatedLora1);
        setLora2(updatedLora2);
        await onLoraChange({ lora1: updatedLora1, lora2: updatedLora2 });
      });
    }
  }

  // ── Standalone delete: remove only this binding's blocks/LoRAs, keep group siblings ──
  function handleStandaloneDeleteBinding(bindingId: string) {
    const info = presetBindings.find((b) => b.bindingId === bindingId);
    if (!info) return;

    if (!confirm(`独立删除「${info.presetName}」？仅删除该预制的 ${info.blockCount} 个提示词块和 ${info.loraCount} 个 LoRA，不影响同组其他预制。`)) return;

    startTransition(async () => {
      const blocksToDelete = blocks.filter((b) => b.bindingId === bindingId);
      for (const b of blocksToDelete) {
        await deleteSectionBlock(b.id);
      }
      setBlocks((prev) => prev.filter((b) => b.bindingId !== bindingId));

      const updatedLora1 = lora1.filter((e) => e.bindingId !== bindingId);
      const updatedLora2 = lora2.filter((e) => e.bindingId !== bindingId);
      setLora1(updatedLora1);
      setLora2(updatedLora2);
      await onLoraChange({ lora1: updatedLora1, lora2: updatedLora2 });
    });
  }

  // ── Delete a single block with binding protection ──
  function handleDeleteBlock(blockId: string): boolean {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return true; // allow delete
    if (block.bindingId) {
      const groupBid = block.groupBindingId;
      if (groupBid) {
        // Part of a group import — confirm group-level delete
        const groupBindingIds = new Set(
          blocks.filter((b) => b.groupBindingId === groupBid).map((b) => b.bindingId).filter(Boolean) as string[],
        );
        const groupNames = presetBindings
          .filter((b) => groupBindingIds.has(b.bindingId))
          .map((b) => b.presetName);
        return confirm(`此提示词块属于预制组导入。删除将同时移除整组内容：\n${groupNames.map(n => `  · ${n}`).join("\n")}\n\n确认删除？`);
      }
      const info = presetBindings.find((b) => b.bindingId === block.bindingId);
      if (info) {
        return confirm(
          `此提示词块属于预制「${info.presetName}」的绑定。\n删除将同时移除该绑定的所有 ${info.blockCount} 个提示词块和 ${info.loraCount} 个 LoRA。\n确认删除？`,
        );
      }
    }
    return true; // no binding, allow delete
  }

  // When a block delete is confirmed and it has a bindingId, delete the entire binding (or group)
  function handleBlockDeleted(blockId: string) {
    const block = blocks.find((b) => b.id === blockId);
    if (block?.bindingId) {
      const groupBid = block.groupBindingId;
      if (groupBid) {
        // Delete entire group
        const groupBindingIds = new Set(
          blocks.filter((b) => b.groupBindingId === groupBid).map((b) => b.bindingId).filter(Boolean) as string[],
        );
        startTransition(async () => {
          const blocksToDelete = blocks.filter((b) => b.groupBindingId === groupBid && b.id !== blockId);
          for (const b of blocksToDelete) {
            await deleteSectionBlock(b.id);
          }
          setBlocks((prev) => prev.filter((b) => b.groupBindingId !== groupBid));
          const updatedLora1 = lora1.filter((e) => !e.bindingId || !groupBindingIds.has(e.bindingId));
          const updatedLora2 = lora2.filter((e) => !e.bindingId || !groupBindingIds.has(e.bindingId));
          setLora1(updatedLora1);
          setLora2(updatedLora2);
          await onLoraChange({ lora1: updatedLora1, lora2: updatedLora2 });
        });
      } else {
        // Delete single binding
        const bid = block.bindingId;
        startTransition(async () => {
          const otherBlocks = blocks.filter((b) => b.bindingId === bid && b.id !== blockId);
          for (const b of otherBlocks) {
            await deleteSectionBlock(b.id);
          }
          setBlocks((prev) => prev.filter((b) => b.bindingId !== bid));
          const updatedLora1 = lora1.filter((e) => e.bindingId !== bid);
          const updatedLora2 = lora2.filter((e) => e.bindingId !== bid);
          setLora1(updatedLora1);
          setLora2(updatedLora2);
          await onLoraChange({ lora1: updatedLora1, lora2: updatedLora2 });
        });
      }
    } else {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    }
  }

  // ── Standalone block delete: just this one block, no cascade ──
  function handleStandaloneDeleteBlock(blockId: string): boolean {
    return confirm("独立删除此提示词块？不影响同绑定的其他块和 LoRA。");
  }

  function handleStandaloneBlockDeleted(blockId: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }

  // ── LoRA delete with binding protection ──
  function handleLora1Change(entries: LoraEntry[]) {
    setLora1(entries);
    startTransition(async () => {
      await onLoraChange({ lora1: entries, lora2 });
    });
  }

  function handleLora2Change(entries: LoraEntry[]) {
    setLora2(entries);
    startTransition(async () => {
      await onLoraChange({ lora1, lora2: entries });
    });
  }

  // Get categories for import panel (preset cats with variants + group cats with groups)
  const categoriesForImport = useMemo(
    () => (libraryV2?.categories ?? []).filter((c) =>
      c.type === "group"
        ? (c.groups ?? []).length > 0
        : c.presets.some((p) => p.variants.length > 0)
    ),
    [libraryV2],
  );

  return (
    <div className="space-y-4">
      {/* ── Preset binding list ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Package className="size-3.5" />
            <span>已导入预制</span>
            {presetBindings.length > 0 && (
              <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
                {presetBindings.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowImportPanel(!showImportPanel)}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/20"
          >
            <Plus className="size-3" /> 导入预制
          </button>
        </div>

        {/* Binding cards */}
        {presetBindings.length > 0 && (
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            {presetBindings.map((binding) => (
              <div
                key={binding.bindingId}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Category tag */}
                  {binding.categoryName && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
                      style={binding.categoryColor ? {
                        backgroundColor: `hsl(${binding.categoryColor} / 0.15)`,
                        color: `hsl(${binding.categoryColor})`,
                      } : {
                        backgroundColor: "rgba(255,255,255,0.06)",
                        color: "#a1a1aa",
                      }}
                    >
                      {binding.categoryName}
                    </span>
                  )}
                  {/* Group indicator */}
                  {binding.groupBindingId && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1 py-px text-[8px] text-amber-400">组</span>
                  )}
                  <span className="text-[11px] text-zinc-300 truncate">{binding.presetName}</span>
                  {binding.sourceId && (
                    <Link
                      href={`/assets/presets#preset-${binding.sourceId}`}
                      target="_blank"
                      className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-sky-400"
                      title="在预制管理中打开"
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                  {/* Variant switcher — show only if preset has multiple variants */}
                  {binding.availableVariants.length > 1 && (
                    <div className="relative">
                      <select
                        value={binding.variantId ?? ""}
                        onChange={(e) => {
                          if (e.target.value && e.target.value !== binding.variantId) {
                            handleSwitchVariant(binding.bindingId, e.target.value);
                          }
                        }}
                        disabled={isPending}
                        className="appearance-none rounded border border-white/10 bg-white/[0.04] py-0.5 pl-1.5 pr-5 text-[10px] text-zinc-300 outline-none focus:border-sky-500/30 disabled:opacity-50"
                      >
                        {binding.availableVariants.map((v) => (
                          <option key={v.id} value={v.id} className="bg-zinc-900">{v.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 size-2.5 -translate-y-1/2 text-zinc-500" />
                    </div>
                  )}
                  <span className="text-[9px] text-zinc-500">
                    {binding.blockCount} 块 · {binding.loraCount} LoRA
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {onRename && (
                    <button
                      type="button"
                      onClick={() => onRename(binding.groupName ?? binding.presetName)}
                      title="用预制名作为小节名"
                      className="rounded p-1 text-zinc-600 hover:bg-sky-500/10 hover:text-sky-400"
                    >
                      <ClipboardCopy className="size-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStandaloneDeleteBinding(binding.bindingId)}
                    disabled={isPending}
                    title="独立删除（仅此预制）"
                    className="rounded p-1 text-zinc-600 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-50"
                  >
                    <Unlink className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBinding(binding.bindingId)}
                    disabled={isPending}
                    title="级联删除（含同组预制）"
                    className="rounded p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {presetBindings.length === 0 && !showImportPanel && (
          <div className="rounded-lg border border-dashed border-white/5 px-3 py-2 text-center text-[10px] text-zinc-600">
            暂无导入的预制
          </div>
        )}

        {/* Import panel */}
        {showImportPanel && (
          <ImportPresetPanel
            categories={categoriesForImport}
            onImport={handlePresetImport}
            onImportGroup={handleGroupImport}
            onClose={() => setShowImportPanel(false)}
            isPending={isPending}
          />
        )}
      </div>

      {/* ── Prompt blocks ── */}
      <PromptBlockEditor
        sectionId={sectionId}
        initialBlocks={blocks}
        libraryV2={libraryV2}
        onDeleteConfirm={handleDeleteBlock}
        onBlockDeleted={handleBlockDeleted}
        onStandaloneDeleteConfirm={handleStandaloneDeleteBlock}
        onStandaloneBlockDeleted={handleStandaloneBlockDeleted}
      />

      {/* ── LoRA lists ── */}
      <div className="border-t border-white/5 pt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 1</div>
          <LoraListEditor
            entries={lora1}
            onChange={handleLora1Change}
            disabled={isPending}
            presetBindings={presetBindings}
            enableStandaloneDelete
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 2</div>
          <LoraListEditor
            entries={lora2}
            onChange={handleLora2Change}
            disabled={isPending}
            presetBindings={presetBindings}
            enableStandaloneDelete
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportPresetPanel — select a preset+variant or a group to import
// ---------------------------------------------------------------------------

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
    presetName: string,
    variantId: string,
    variantName: string,
    prompt: string,
    negativePrompt: string | null,
    lora1: unknown,
    lora2: unknown,
    categoryId: string,
    categoryName: string,
    categoryColor: string | null,
  ) => void;
  onImportGroup: (groupId: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedCat = categories.find((c) => c.id === selectedCatId);

  // Reset folder and search when category changes
  useEffect(() => {
    setCurrentFolderId(null);
    setSearchQuery("");
  }, [selectedCatId]);

  const isGroupCat = selectedCat?.type === "group";

  // Subfolders of current folder
  const subFolders = useMemo(() => {
    if (!selectedCat?.folders) return [];
    return selectedCat.folders.filter((f) => f.parentId === currentFolderId);
  }, [selectedCat, currentFolderId]);

  // Get folder name for breadcrumb
  const currentFolderName = useMemo(() => {
    if (!currentFolderId || !selectedCat?.folders) return null;
    return selectedCat.folders.find((f) => f.id === currentFolderId)?.name ?? null;
  }, [currentFolderId, selectedCat]);

  // Get parent folder id for "go back"
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

  // Groups filtered by folder and search
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

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
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

      {/* Content: presets or groups depending on category type */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {/* Breadcrumb / back button (hidden during search) */}
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

        {/* Subfolders (hidden during search) */}
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
          // Group category — show groups to import
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
          // Preset category — show preset/variant list
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
                    item.presetName,
                    item.variantId,
                    item.variantName,
                    item.prompt,
                    item.negativePrompt,
                    item.lora1,
                    item.lora2,
                    selectedCat.id,
                    selectedCat.name,
                    selectedCat.color,
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
