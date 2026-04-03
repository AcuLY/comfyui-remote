"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import type { PromptBlockData } from "@/lib/actions";
import {
  deleteSectionBlock,
  importPresetToSection,
} from "@/lib/actions";
import type { LoraEntry } from "@/lib/lora-types";
import type { PromptLibraryV2 } from "@/components/prompt-block-editor";

/** 2-partition LoRA config (lora1 + lora2 only) */
type LoraConfig2 = {
  lora1: LoraEntry[];
  lora2: LoraEntry[];
};

/** A preset binding record (derived from blocks + loras with same bindingId) */
type PresetBindingInfo = {
  bindingId: string;
  presetName: string;  // from block label
  categoryName?: string;
  blockCount: number;
  loraCount: number;
};

type SectionEditorProps = {
  sectionId: string;
  initialBlocks: PromptBlockData[];
  initialLoraConfig: LoraConfig2;
  libraryV2?: PromptLibraryV2;
  onLoraChange: (config: LoraConfig2) => Promise<void>;
};

export function SectionEditor({
  sectionId,
  initialBlocks,
  initialLoraConfig,
  libraryV2,
  onLoraChange,
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
          map.set(b.bindingId, {
            bindingId: b.bindingId,
            presetName: b.label,
            blockCount: 1,
            loraCount: 0,
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
  }, [blocks, lora1, lora2]);

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

      setBlocks((prev) => [...prev, result.block]);

      // Add LoRAs
      let updatedLora1 = [...lora1];
      let updatedLora2 = [...lora2];
      let loraChanged = false;

      for (const l of result.lora1) {
        updatedLora1.push({ ...l, source: "preset" as const });
        loraChanged = true;
      }
      for (const l of result.lora2) {
        updatedLora2.push({ ...l, source: "preset" as const });
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

  // ── Delete an entire preset binding ──
  function handleDeleteBinding(bindingId: string) {
    const info = presetBindings.find((b) => b.bindingId === bindingId);
    if (!info) return;
    if (!confirm(`删除「${info.presetName}」的绑定？将同时删除 ${info.blockCount} 个提示词块和 ${info.loraCount} 个 LoRA。`)) return;

    startTransition(async () => {
      // Delete prompt blocks with this bindingId
      const blocksToDelete = blocks.filter((b) => b.bindingId === bindingId);
      for (const b of blocksToDelete) {
        await deleteSectionBlock(b.id);
      }
      setBlocks((prev) => prev.filter((b) => b.bindingId !== bindingId));

      // Remove LoRAs with this bindingId
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
      const info = presetBindings.find((b) => b.bindingId === block.bindingId);
      if (info) {
        return confirm(
          `此提示词块属于预制「${info.presetName}」的绑定。\n删除将同时移除该绑定的所有 ${info.blockCount} 个提示词块和 ${info.loraCount} 个 LoRA。\n确认删除？`,
        );
      }
    }
    return true; // no binding, allow delete
  }

  // When a block delete is confirmed and it has a bindingId, delete the entire binding
  function handleBlockDeleted(blockId: string) {
    const block = blocks.find((b) => b.id === blockId);
    if (block?.bindingId) {
      // Also remove all other blocks and LoRAs with the same bindingId
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
    } else {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    }
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

  // Get categories for import panel
  const categoriesWithPresets = useMemo(
    () => (libraryV2?.categories ?? []).filter((c) => c.presets.some((p) => p.variants.length > 0)),
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
          <div className="space-y-1">
            {presetBindings.map((binding) => (
              <div
                key={binding.bindingId}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] text-zinc-300 truncate">{binding.presetName}</span>
                  <span className="text-[9px] text-zinc-500">
                    {binding.blockCount} 块 · {binding.loraCount} LoRA
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBinding(binding.bindingId)}
                  disabled={isPending}
                  className="rounded p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="size-3" />
                </button>
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
            categories={categoriesWithPresets}
            onImport={handlePresetImport}
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
      />

      {/* ── LoRA lists ── */}
      <div className="border-t border-white/5 pt-4 space-y-4">
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 1</div>
          <LoraListEditor
            entries={lora1}
            onChange={handleLora1Change}
            disabled={isPending}
            presetBindings={presetBindings}
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 2</div>
          <LoraListEditor
            entries={lora2}
            onChange={handleLora2Change}
            disabled={isPending}
            presetBindings={presetBindings}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportPresetPanel — select a preset+variant to import
// ---------------------------------------------------------------------------

type ImportCategory = PromptLibraryV2["categories"][number];

function ImportPresetPanel({
  categories,
  onImport,
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
  onClose: () => void;
  isPending: boolean;
}) {
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id ?? "");
  const selectedCat = categories.find((c) => c.id === selectedCatId);

  const items = useMemo(() => {
    if (!selectedCat) return [];
    return selectedCat.presets.flatMap((preset) =>
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
  }, [selectedCat]);

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
            className={`rounded-lg px-2 py-1 text-[10px] transition ${
              selectedCatId === cat.id
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Preset/variant list */}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {items.length === 0 ? (
          <div className="py-2 text-center text-[10px] text-zinc-600">暂无可导入的预制</div>
        ) : (
          items.map((item) => (
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
        )}
      </div>
    </div>
  );
}
