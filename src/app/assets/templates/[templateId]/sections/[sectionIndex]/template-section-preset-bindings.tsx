"use client";

import Link from "next/link";
import {
  ChevronDown,
  ClipboardCopy,
  Download,
  ExternalLink,
  Package,
  Trash2,
  Unlink,
} from "lucide-react";
import { ImportPresetPanel, type ImportCategory } from "@/components/section-editor";

export type TemplateSectionPresetBindingInfo = {
  bindingId: string;
  presetName: string;
  groupName: string | undefined;
  sourceId: string | null;
  variantId: string | null;
  presetGroupId: string | null;
  categoryId: string | null;
  categoryName?: string;
  categoryColor?: string;
  groupBindingId: string | null;
  blockCount: number;
  loraCount: number;
  sortOrder: number;
  availableVariants: Array<{ id: string; name: string }>;
};

export function TemplateSectionPresetBindings({
  presetBindings,
  importCategories,
  showImport,
  isPending,
  getDetailHref,
  onToggleImport,
  onCloseImport,
  onImportPreset,
  onImportGroup,
  onUseBindingName,
  onSwitchVariant,
  onStandaloneDeleteBinding,
  onDeleteBinding,
}: {
  presetBindings: TemplateSectionPresetBindingInfo[];
  importCategories: ImportCategory[];
  showImport: boolean;
  isPending: boolean;
  getDetailHref: (binding: TemplateSectionPresetBindingInfo) => string;
  onToggleImport: () => void;
  onCloseImport: () => void;
  onImportPreset: (presetId: string, variantId: string) => void;
  onImportGroup: (groupId: string) => void;
  onUseBindingName: (binding: TemplateSectionPresetBindingInfo) => void;
  onSwitchVariant: (bindingId: string, variantId: string) => void;
  onStandaloneDeleteBinding: (bindingId: string) => void;
  onDeleteBinding: (bindingId: string) => void;
}) {
  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
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
        {importCategories.length > 0 && (
          <button
            type="button"
            onClick={onToggleImport}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
          >
            <Download className="size-3" /> 导入预制
          </button>
        )}
      </div>

      {presetBindings.length > 0 ? (
        <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
          {presetBindings.map((binding) => {
            const detailHref = (binding.sourceId || binding.presetGroupId) ? getDetailHref(binding) : null;

            return (
              <div
                key={binding.bindingId}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
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
                  {(binding.presetGroupId || binding.groupBindingId) && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1 py-px text-[8px] text-amber-400">组</span>
                  )}
                  {detailHref ? (
                    <Link
                      href={detailHref}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 pr-1 transition hover:text-sky-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500/60"
                      title="在预制详情中打开"
                    >
                      <span className="truncate text-[11px] text-zinc-300">{binding.presetName}</span>
                      <span className="text-[9px] text-zinc-500">
                        {binding.blockCount} 块 · {binding.loraCount} LoRA
                      </span>
                    </Link>
                  ) : (
                    <span className="truncate text-[11px] text-zinc-300">{binding.presetName}</span>
                  )}
                  {detailHref && (
                    <Link
                      href={detailHref}
                      className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-sky-400"
                      title="在预制详情中打开"
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                  {binding.sourceId && binding.availableVariants.length > 1 && (
                    <div className="relative">
                      <select
                        value={binding.variantId ?? ""}
                        onChange={(event) => {
                          if (event.target.value && event.target.value !== binding.variantId) {
                            onSwitchVariant(binding.bindingId, event.target.value);
                          }
                        }}
                        disabled={isPending}
                        className="appearance-none rounded border border-white/10 bg-white/[0.04] py-0.5 pl-1.5 pr-5 text-[10px] text-zinc-300 outline-none focus:border-sky-500/30 disabled:opacity-50"
                      >
                        {binding.availableVariants.map((variant) => (
                          <option key={variant.id} value={variant.id} className="bg-zinc-900">
                            {variant.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 size-2.5 -translate-y-1/2 text-zinc-500" />
                    </div>
                  )}
                  {!detailHref && (
                    <span className="text-[9px] text-zinc-500">
                      {binding.blockCount} 块 · {binding.loraCount} LoRA
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onUseBindingName(binding)}
                    title="用预制名作为小节名"
                    className="rounded p-1 text-zinc-600 hover:bg-sky-500/10 hover:text-sky-400"
                  >
                    <ClipboardCopy className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStandaloneDeleteBinding(binding.bindingId)}
                    disabled={isPending}
                    title="独立删除（仅此预制）"
                    className="rounded p-1 text-zinc-600 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-50"
                  >
                    <Unlink className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBinding(binding.bindingId)}
                    disabled={isPending}
                    title="级联删除（含同组预制）"
                    className="rounded p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !showImport ? (
        <div className="rounded-lg border border-dashed border-white/5 px-3 py-2 text-center text-[10px] text-zinc-600">
          暂无导入的预制
        </div>
      ) : null}

      {showImport && (
        <ImportPresetPanel
          categories={importCategories}
          onImport={onImportPreset}
          onImportGroup={onImportGroup}
          onClose={onCloseImport}
          isPending={isPending}
        />
      )}
    </div>
  );
}
