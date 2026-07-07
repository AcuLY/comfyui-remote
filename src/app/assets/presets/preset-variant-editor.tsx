"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { LoraBindingEditor } from "@/components/lora-binding-editor";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import type {
  PresetCategoryFull,
  PresetFull,
} from "@/lib/server-data";
import { parseLoraBindings } from "@/lib/lora-types";
import type { LinkedVariantRef, VariantDraft } from "./preset-types";
import { PRESET_HISTORY_TABS } from "./preset-types";
import { PresetChangeHistoryPanel } from "./change-history-panel";
import { PresetVariantBulkEditDialog } from "./preset-variant-bulk-edit-dialog";

type LoraBindingDraft = VariantDraft["lora1"][number];

function LinkedVariantsEditor({
  linkedVariants,
  onChange,
  currentPresetId,
  allCategories,
}: {
  linkedVariants: LinkedVariantRef[];
  onChange: (lv: LinkedVariantRef[]) => void;
  currentPresetId?: string;
  allCategories: PresetCategoryFull[];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categoriesFiltered = useMemo(() => {
    return allCategories
      .map((cat) => ({
        ...cat,
        presets: cat.presets.filter((p) => p.id !== currentPresetId),
      }))
      .filter((cat) => cat.presets.length > 0);
  }, [allCategories, currentPresetId]);

  const allItems = useMemo(() => {
    const items: Array<{
      presetId: string;
      presetName: string;
      variantId: string;
      variantName: string;
      categoryName: string;
      displayName: string;
      prompt: string;
      negativePrompt: string | null;
      lora1: ReturnType<typeof parseLoraBindings>;
      lora2: ReturnType<typeof parseLoraBindings>;
    }> = [];
    for (const cat of categoriesFiltered) {
      for (const preset of cat.presets) {
        for (const v of preset.variants) {
          items.push({
            presetId: preset.id,
            variantId: v.id,
            presetName: preset.name,
            variantName: v.name,
            categoryName: cat.name,
            displayName: preset.variants.length === 1
              ? `${cat.name} / ${preset.name}`
              : `${cat.name} / ${preset.name} / ${v.name}`,
            prompt: v.prompt ?? "",
            negativePrompt: v.negativePrompt,
            lora1: parseLoraBindings(v.lora1),
            lora2: parseLoraBindings(v.lora2),
          });
        }
      }
    }
    return items;
  }, [categoriesFiltered]);

  const linkedDisplay = linkedVariants.map((ref) => {
    const item = allItems.find((a) => a.variantId === ref.variantId);
    return {
      ...ref,
      displayName: item?.displayName ?? `未知变体 (${ref.variantId.slice(0, 8)}...)`,
      prompt: item?.prompt ?? "",
      negativePrompt: item?.negativePrompt,
      lora1: item?.lora1 ?? [],
      lora2: item?.lora2 ?? [],
    };
  });

  function handleAdd(val: { presetId: string; variantId: string }) {
    if (linkedVariants.some((lv) => lv.variantId === val.variantId)) return;
    onChange([...linkedVariants, { presetId: val.presetId, variantId: val.variantId }]);
  }

  function handleRemove(variantId: string) {
    onChange(linkedVariants.filter((lv) => lv.variantId !== variantId));
  }

  const pickerCategories = useMemo(() => {
    return categoriesFiltered.map((cat) => ({
      ...cat,
      presets: cat.presets.map((p) => ({
        ...p,
        variants: p.variants.filter((v) => !linkedVariants.some((lv) => lv.variantId === v.id)),
      })).filter((p) => p.variants.length > 0),
    })).filter((cat) => cat.presets.length > 0);
  }, [categoriesFiltered, linkedVariants]);

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-zinc-500">关联变体</span>

      {linkedDisplay.length > 0 && (
        <div className="space-y-1">
          {linkedDisplay.map((item) => {
            const isExpanded = expandedId === item.variantId;
            const hasContent = item.prompt || item.negativePrompt || item.lora1.length > 0 || item.lora2.length > 0;
            return (
              <div
                key={item.variantId}
                className="rounded-lg border border-white/5 bg-white/[0.02]"
              >
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.variantId)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    {hasContent && (
                      <ChevronDown className={`size-3 shrink-0 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    )}
                    <span className="truncate text-xs text-zinc-300">{item.displayName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.variantId)}
                    className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                {isExpanded && hasContent && (
                  <div className="space-y-1.5 border-t border-white/5 px-2.5 py-2">
                    {item.prompt && (
                      <div>
                        <span className="text-[10px] text-zinc-600">正面提示词</span>
                        <div className="mt-0.5 max-h-24 overflow-y-auto rounded bg-black/20 px-2 py-1.5 text-xs text-zinc-400 whitespace-pre-wrap break-all">
                          {item.prompt}
                        </div>
                      </div>
                    )}
                    {item.negativePrompt && (
                      <div>
                        <span className="text-[10px] text-zinc-600">负面提示词</span>
                        <div className="mt-0.5 max-h-24 overflow-y-auto rounded bg-black/20 px-2 py-1.5 text-xs text-zinc-400 whitespace-pre-wrap break-all">
                          {item.negativePrompt}
                        </div>
                      </div>
                    )}
                    {item.lora1.length > 0 && (
                      <div>
                        <span className="text-[10px] text-zinc-600">LoRA 1</span>
                        <div className="mt-0.5 space-y-0.5">
                          {item.lora1.map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <span className="truncate">{l.path.split(/[\\/]/).pop()}</span>
                              <span className="shrink-0 text-zinc-600">{l.weight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.lora2.length > 0 && (
                      <div>
                        <span className="text-[10px] text-zinc-600">LoRA 2</span>
                        <div className="mt-0.5 space-y-0.5">
                          {item.lora2.map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <span className="truncate">{l.path.split(/[\\/]/).pop()}</span>
                              <span className="shrink-0 text-zinc-600">{l.weight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {linkedVariants.length === 0 && !showPicker && (
        <div className="text-xs text-zinc-600">无关联变体</div>
      )}

      {showPicker ? (
        <PresetCascadePicker
          categories={pickerCategories}
          value={null}
          onChange={(val) => {
            if (val) handleAdd({ presetId: val.presetId, variantId: val.variantId });
          }}
          placeholder="选择关联变体…"
          presetCategoriesOnly
          defaultOpen
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-xs text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
        >
          <Plus className="mr-1 inline-block size-3 -mt-0.5" />添加关联变体
        </button>
      )}
    </div>
  );
}

export function PresetVariantEditor({
  current,
  currentVariantKey,
  variants,
  preset,
  allCategories,
  onVariantNameChange,
  onLinkedVariantsChange,
  onPromptChange,
  onNegativePromptChange,
  onLoraChange,
  onAutoSave,
  onApplyPromptToAllVariants,
  onApplyBulkTextVariants,
  onApplyLoraToAllVariants,
}: {
  current: VariantDraft;
  currentVariantKey: string;
  variants: VariantDraft[];
  preset: PresetFull | null;
  allCategories: PresetCategoryFull[];
  onVariantNameChange: (value: string) => void;
  onLinkedVariantsChange: (linkedVariants: LinkedVariantRef[]) => void;
  onPromptChange: (value: string) => void;
  onNegativePromptChange: (value: string) => void;
  onLoraChange: (key: "lora1" | "lora2", value: VariantDraft["lora1"]) => void;
  onAutoSave: () => void;
  onApplyPromptToAllVariants: (key: "prompt" | "negativePrompt") => void;
  onApplyBulkTextVariants: (updated: VariantDraft[]) => void;
  onApplyLoraToAllVariants: (key: "lora1" | "lora2", entry: LoraBindingDraft) => void;
}) {
  const applyAllButtonClass = "inline-flex shrink-0 items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400 transition hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-300";

  function renderLoraApplyActions(key: "lora1" | "lora2") {
    const bindings = current[key].filter((entry) => entry.path.trim());
    if (bindings.length === 0) return null;

    return (
      <div className="space-y-1">
        {bindings.map((entry, index) => {
          const path = entry.path.trim();
          return (
            <div
              key={`${path}:${index}`}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5"
            >
              <div className="min-w-0 text-[11px] text-zinc-500">
                <span className="block truncate text-zinc-400">{path.split(/[\\/]/).pop() || path}</span>
                <span className="text-zinc-600">
                  {entry.enabled ? "enabled" : "disabled"} / {entry.weight.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onApplyLoraToAllVariants(key, entry)}
                className={applyAllButtonClass}
                title="Apply to all variants"
              >
                应用到所有变体
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">变体名称</span>
          <input
            type="text"
            value={current.name}
            onChange={(e) => onVariantNameChange(e.target.value)}
            onBlur={onAutoSave}
            placeholder="变体名称"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
      </div>

      <LinkedVariantsEditor
        linkedVariants={current.linkedVariants}
        onChange={onLinkedVariantsChange}
        currentPresetId={preset?.id}
        allCategories={allCategories}
      />

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-zinc-500">正面提示词</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <PresetVariantBulkEditDialog
              variants={variants}
              defaultField="prompt"
              onApply={onApplyBulkTextVariants}
            />
            <button
              type="button"
              onClick={() => onApplyPromptToAllVariants("prompt")}
              className={applyAllButtonClass}
              title="Apply to all variants"
            >
              应用到所有变体
            </button>
          </div>
        </div>
        <textarea
          value={current.prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onBlur={onAutoSave}
          rows={3}
          placeholder="positive prompt..."
          className="cm-text-editor w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-zinc-500">负面提示词</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <PresetVariantBulkEditDialog
              variants={variants}
              defaultField="negativePrompt"
              onApply={onApplyBulkTextVariants}
            />
            <button
              type="button"
              onClick={() => onApplyPromptToAllVariants("negativePrompt")}
              className={applyAllButtonClass}
              title="Apply to all variants"
            >
              应用到所有变体
            </button>
          </div>
        </div>
        <textarea
          value={current.negativePrompt}
          onChange={(e) => onNegativePromptChange(e.target.value)}
          onBlur={onAutoSave}
          rows={2}
          placeholder="negative prompt..."
          className="cm-text-editor w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-zinc-500">LoRA 1（第一阶段）</span>
        <LoraBindingEditor
          key={`${currentVariantKey}:lora1`}
          bindings={current.lora1}
          onChange={(v) => onLoraChange("lora1", v)}
        />
        {renderLoraApplyActions("lora1")}
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-zinc-500">LoRA 2（高清修复）</span>
        <LoraBindingEditor
          key={`${currentVariantKey}:lora2`}
          bindings={current.lora2}
          onChange={(v) => onLoraChange("lora2", v)}
        />
        {renderLoraApplyActions("lora2")}
      </div>

      {preset && (
        <PresetChangeHistoryPanel
          history={preset.changeHistory}
          tabs={PRESET_HISTORY_TABS}
        />
      )}
    </>
  );
}
