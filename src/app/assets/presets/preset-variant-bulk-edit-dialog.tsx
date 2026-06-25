"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { VariantDraft } from "./preset-types";
import {
  buildVariantBulkTextPlan,
  type VariantBulkTextField,
  type VariantBulkTextPlan,
  type VariantBulkTextStatus,
  type VariantBulkTextVariant,
} from "./preset-variant-bulk-text";

const FIELD_LABELS: Record<VariantBulkTextField, string> = {
  prompt: "正面提示词",
  negativePrompt: "负面提示词",
};

const STATUS_LABELS: Record<VariantBulkTextStatus, string> = {
  planned: "计划修改",
  "no-match": "未命中",
  unchanged: "无变化",
  unselected: "未选择",
};

function variantKey(variant: VariantDraft, index: number) {
  return variant.clientId ?? variant.id ?? `draft-${index}`;
}

function variantName(variant: VariantDraft, index: number) {
  return variant.name.trim() || `变体 ${index + 1}`;
}

function statusClassName(status: VariantBulkTextStatus) {
  if (status === "planned") return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  if (status === "no-match") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (status === "unchanged") return "border-white/10 bg-white/[0.04] text-zinc-400";
  return "border-white/10 bg-black/20 text-zinc-500";
}

function previewText(value: string) {
  return value || "空";
}

export function PresetVariantBulkEditDialog({
  variants,
  defaultField,
  onApply,
  disabled,
  buttonClassName,
}: {
  variants: VariantDraft[];
  defaultField: VariantBulkTextField;
  onApply: (variants: VariantDraft[]) => void;
  disabled?: boolean;
  buttonClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [field, setField] = useState<VariantBulkTextField>(defaultField);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [planState, setPlanState] = useState<{ signature: string; plan: VariantBulkTextPlan } | null>(null);
  const [applyResult, setApplyResult] = useState<{ signature: string; text: string } | null>(null);

  const variantRows = useMemo(() => variants.map((variant, index) => ({
    key: variantKey(variant, index),
    name: variantName(variant, index),
    prompt: variant.prompt,
    negativePrompt: variant.negativePrompt,
  } satisfies VariantBulkTextVariant)), [variants]);
  const allVariantKeys = useMemo(() => variantRows.map((variant) => variant.key), [variantRows]);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectedSignature = selectedKeys.join("\u0001");
  const variantSignature = variantRows
    .map((variant) => [variant.key, variant.prompt, variant.negativePrompt ?? ""].join("\u0002"))
    .join("\u0001");
  const inputSignature = JSON.stringify({ field, findText, replaceText, selectedSignature, variantSignature });
  const plan = planState?.signature === inputSignature ? planState.plan : null;
  const plannedItems = plan?.items.filter((item) => item.status !== "unselected") ?? [];
  const canApply = Boolean(plan?.summary.canApply);
  const applyResultText = applyResult?.signature === inputSignature ? applyResult.text : null;

  function openDialog() {
    setField(defaultField);
    setSelectedKeys(allVariantKeys);
    setPlanState(null);
    setApplyResult(null);
    setIsOpen(true);
  }

  function closeDialog() {
    setIsOpen(false);
  }

  function selectAll() {
    setSelectedKeys(allVariantKeys);
  }

  function clearSelection() {
    setSelectedKeys([]);
  }

  function toggleVariant(key: string) {
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function handleDryRun() {
    const nextPlan = buildVariantBulkTextPlan({
      variants: variantRows,
      selectedVariantKeys: selectedKeySet,
      field,
      findText,
      replaceText,
    });

    setPlanState({ signature: inputSignature, plan: nextPlan });
    setApplyResult(null);
    if (nextPlan.blockers.length > 0) {
      toast.error(nextPlan.blockers[0]);
    } else if (nextPlan.summary.planned > 0) {
      toast.success(`Dry Run 完成：计划修改 ${nextPlan.summary.planned} 个变体`);
    } else {
      toast.warning("Dry Run 完成：没有可应用的变更");
    }
  }

  function handleApply() {
    if (!plan?.summary.canApply) return;

    const plannedByKey = new Map(
      plan.items
        .filter((item) => item.status === "planned")
        .map((item) => [item.key, item.after]),
    );

    const updated = variants.map((variant, index) => {
      const after = plannedByKey.get(variantKey(variant, index));
      return after === undefined ? variant : { ...variant, [field]: after };
    });

    onApply(updated);
    setApplyResult({ signature: inputSignature, text: `已应用 ${plan.summary.planned} 个变体，保存队列会继续处理。` });
    toast.success(`已应用 ${plan.summary.planned} 个变体`);
  }

  const dialog = isOpen ? createPortal(
    <>
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="批量编辑变体提示词"
        className="fixed left-1/2 top-[50dvh] z-[210] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),52rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-100">批量编辑变体提示词</div>
            <div className="mt-0.5 text-xs text-zinc-500">{FIELD_LABELS[field]} · {variants.length} 个变体</div>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"
            aria-label="关闭"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
            <div className="space-y-3">
              <label className="space-y-1 text-xs text-zinc-400">
                <span>字段</span>
                <select
                  value={field}
                  onChange={(event) => setField(event.target.value as VariantBulkTextField)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-sky-500/40"
                >
                  <option value="prompt" className="bg-zinc-900">正面提示词</option>
                  <option value="negativePrompt" className="bg-zinc-900">负面提示词</option>
                </select>
              </label>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400">变体</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={selectAll} className="text-[11px] text-sky-300 hover:text-sky-200">全选</button>
                    <span className="text-zinc-700">/</span>
                    <button type="button" onClick={clearSelection} className="text-[11px] text-zinc-500 hover:text-zinc-300">清空</button>
                  </div>
                </div>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                  {variantRows.map((variant) => (
                    <label
                      key={variant.key}
                      className="flex min-w-0 items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5 text-xs text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedKeySet.has(variant.key)}
                        onChange={() => toggleVariant(variant.key)}
                        className="size-3 shrink-0 accent-sky-500"
                      />
                      <span className="min-w-0 truncate">{variant.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="space-y-1 text-xs text-zinc-400">
                <span>查找文本</span>
                <textarea
                  value={findText}
                  onChange={(event) => setFindText(event.target.value)}
                  rows={3}
                  placeholder="black hair, blue eyes"
                  className="cm-text-editor w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-sky-500/40"
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-400">
                <span>替换为</span>
                <textarea
                  value={replaceText}
                  onChange={(event) => setReplaceText(event.target.value)}
                  rows={3}
                  placeholder="black hair, long hair, blue eyes"
                  className="cm-text-editor w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-sky-500/40"
                />
              </label>
            </div>
          </div>

          {plan && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] p-2">
                  <div className="text-zinc-500">计划修改</div>
                  <div className="mt-1 text-xl font-semibold text-sky-300">{plan.summary.planned}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">命中次数</div>
                  <div className="mt-1 text-zinc-200">{plan.summary.totalMatches}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">未命中</div>
                  <div className="mt-1 text-zinc-200">{plan.summary.noMatch}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">未选择</div>
                  <div className="mt-1 text-zinc-200">{plan.summary.unselected}</div>
                </div>
              </div>

              {plan.blockers.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-2.5 text-xs text-amber-200">
                  <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" /> 无法应用</div>
                  <div className="mt-1 text-amber-100/70">{plan.blockers[0]}</div>
                </div>
              )}

              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {plannedItems.map((item) => (
                  <div key={item.key} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium text-zinc-200">{item.name}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${statusClassName(item.status)}`}>
                        {STATUS_LABELS[item.status]} · {item.matchCount}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="min-w-0 rounded-md border border-white/5 bg-white/[0.02] p-2 text-[11px] text-zinc-500">
                        <div className="mb-1 text-zinc-600">Before</div>
                        <div className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words">{previewText(item.before)}</div>
                      </div>
                      <div className="min-w-0 rounded-md border border-sky-500/10 bg-sky-500/[0.03] p-2 text-[11px] text-zinc-400">
                        <div className="mb-1 text-sky-400/70">After</div>
                        <div className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words">{previewText(item.after)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {plannedItems.length === 0 && (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-500">
                    没有选中变体或没有命中查找文本。
                  </div>
                )}
              </div>

              {applyResultText && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5 text-xs text-emerald-200">
                  <div className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="size-4" /> Apply 结果</div>
                  <div className="mt-1 text-emerald-100/70">{applyResultText}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 p-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleDryRun}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20"
          >
            <RefreshCw className="size-3.5" />
            Dry Run 预览
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <CheckCircle2 className="size-3.5" />
            确认 Apply
          </button>
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={disabled || variants.length === 0}
        className={
          buttonClassName ??
          "inline-flex shrink-0 items-center gap-1 rounded-md border border-teal-500/20 bg-teal-500/[0.04] px-2 py-1 text-[10px] text-teal-300 transition hover:bg-teal-500/[0.1] disabled:opacity-40"
        }
        title="批量编辑变体提示词"
      >
        <Search className="size-3" />
        批量编辑
      </button>
      {dialog}
    </>
  );
}
