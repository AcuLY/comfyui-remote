"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Plus, RefreshCw, Repeat2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  buildPresetSectionReplacementPayload,
  extractPresetSectionReplacementError,
  summarizePresetSectionReplacementPlan,
  type PresetSectionReplacementFormRule,
} from "@/lib/preset-section-replacement-ui";
import type { PresetLibraryV2 } from "@/lib/server-data";

type TargetType = "project" | "template";

type RuleDraft = PresetSectionReplacementFormRule & {
  id: string;
};

type ApiResponse =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error?: { message?: string; details?: unknown } };

type PlanRule = {
  index?: number;
  status?: string;
  fromPresetName?: string | null;
  toPresetName?: string | null;
  blockers?: Array<{ message?: string }>;
  updates?: Array<{ ownerName?: string; bindingKey?: string; toVariantId?: string }>;
};

function createRuleDraft(): RuleDraft {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fromPresetId: "",
    toPresetId: "",
    toVariantId: "",
  };
}

function replacementEndpoint(targetType: TargetType, targetId: string) {
  return targetType === "project"
    ? `/api/projects/${targetId}/preset-replacements`
    : `/api/templates/${targetId}/preset-replacements`;
}

function planFromResult(result: Record<string, unknown> | null) {
  if (!result) return null;
  const verification = result.verification;
  if (verification && typeof verification === "object") return verification as Record<string, unknown>;
  const initialDryRun = result.initialDryRun;
  return initialDryRun && typeof initialDryRun === "object" ? initialDryRun as Record<string, unknown> : null;
}

function planRules(plan: Record<string, unknown> | null): PlanRule[] {
  return Array.isArray(plan?.rules) ? plan.rules as PlanRule[] : [];
}

function hasBlockers(plan: Record<string, unknown> | null) {
  return Boolean(plan && (plan.hasBlockers === true || summarizePresetSectionReplacementPlan(plan).blockers > 0));
}

function allPresets(library: PresetLibraryV2) {
  return library.categories.flatMap((category) =>
    category.presets.map((preset) => ({
      ...preset,
      categoryId: category.id,
      categoryName: category.name,
    })),
  );
}

export function PresetSectionReplacementDialog({
  targetType,
  targetId,
  targetName,
  library,
  buttonClassName,
}: {
  targetType: TargetType;
  targetId: string;
  targetName: string;
  library: PresetLibraryV2;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [rules, setRules] = useState<RuleDraft[]>([createRuleDraft()]);
  const [dryRunResult, setDryRunResult] = useState<Record<string, unknown> | null>(null);
  const [applyResult, setApplyResult] = useState<Record<string, unknown> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const presets = useMemo(() => allPresets(library), [library]);
  const presetById = useMemo(() => new Map(presets.map((preset) => [preset.id, preset])), [presets]);
  const endpoint = replacementEndpoint(targetType, targetId);
  const isTemplateTarget = targetType === "template";
  const scopeText = targetType === "project" ? "当前项目全部小节" : isTemplateTarget ? "当前模板全部小节" : "当前范围全部小节";
  const activeResult = applyResult ?? dryRunResult;
  const activePlan = planFromResult(activeResult);
  const summary = summarizePresetSectionReplacementPlan(activePlan);
  const canApply = Boolean(dryRunResult && !hasBlockers(planFromResult(dryRunResult)) && !isSubmitting);

  function resetResults() {
    setDryRunResult(null);
    setApplyResult(null);
  }

  function updateRule(id: string, patch: Partial<RuleDraft>) {
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== id) return rule;
        const next = { ...rule, ...patch };
        if (patch.fromPresetId !== undefined) {
          next.toPresetId = "";
          next.toVariantId = "";
        }
        if (patch.toPresetId !== undefined) {
          next.toVariantId = "";
        }
        return next;
      }),
    );
    resetResults();
  }

  function addRule() {
    setRules((current) => [...current, createRuleDraft()]);
    resetResults();
  }

  function removeRule(id: string) {
    setRules((current) => current.length <= 1 ? current : current.filter((rule) => rule.id !== id));
    resetResults();
  }

  async function requestReplacement(dryRun: boolean) {
    const payload = buildPresetSectionReplacementPayload({ dryRun, rules });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null) as ApiResponse | null;
    if (!response.ok || !result?.ok) {
      throw new Error(extractPresetSectionReplacementError(result, dryRun ? "Dry Run 失败" : "Apply 失败"));
    }
    return result.data;
  }

  async function handleDryRun() {
    setIsSubmitting(true);
    try {
      const result = await requestReplacement(true);
      setDryRunResult(result);
      setApplyResult(null);
      const plan = planFromResult(result);
      const nextSummary = summarizePresetSectionReplacementPlan(plan);
      toast.success(`Dry Run 完成：计划替换 ${nextSummary.planned} 处`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dry Run 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApply() {
    if (!dryRunResult) return;
    if (!confirm(`确认 Apply 到「${targetName}」的${scopeText}？计划替换 ${summary.planned} 处。`)) return;
    setIsSubmitting(true);
    try {
      const result = await requestReplacement(false);
      setApplyResult(result);
      router.refresh();
      const verification = planFromResult(result);
      const passed = !hasBlockers(verification) && summarizePresetSectionReplacementPlan(verification).planned === 0;
      toast[passed ? "success" : "warning"](passed ? "Apply 完成，复查无剩余替换" : "Apply 完成，但复查仍有剩余计划");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Apply 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeDialog() {
    if (!isSubmitting) setIsOpen(false);
  }

  const dialog = isOpen ? createPortal(
    <>
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="批量替换预制"
        className="fixed left-1/2 top-[50dvh] z-[210] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),48rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-100">批量替换预制</div>
            <div className="mt-0.5 text-xs text-zinc-500">{targetName} · {scopeText}</div>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={isSubmitting}
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200 disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <div className="space-y-2">
            {rules.map((rule, index) => {
              const fromPreset = rule.fromPresetId ? presetById.get(rule.fromPresetId) ?? null : null;
              const targetPresets = fromPreset ? presets.filter((preset) => preset.categoryId === fromPreset.categoryId) : presets;
              const toPreset = rule.toPresetId ? presetById.get(rule.toPresetId) ?? null : null;
              return (
                <div key={rule.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <label className="space-y-1 text-xs text-zinc-400">
                    <span>A 预制</span>
                    <div className="relative">
                      <select
                        value={rule.fromPresetId}
                        onChange={(event) => updateRule(rule.id, { fromPresetId: event.target.value })}
                        className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 pr-7 text-xs text-zinc-100 outline-none focus:border-sky-500/40"
                      >
                        <option value="" className="bg-zinc-900">选择来源...</option>
                        {presets.map((preset) => (
                          <option key={preset.id} value={preset.id} className="bg-zinc-900">
                            {preset.categoryName} / {preset.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
                    </div>
                  </label>

                  <label className="space-y-1 text-xs text-zinc-400">
                    <span>B 预制</span>
                    <div className="relative">
                      <select
                        value={rule.toPresetId}
                        onChange={(event) => updateRule(rule.id, { toPresetId: event.target.value })}
                        className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 pr-7 text-xs text-zinc-100 outline-none focus:border-sky-500/40"
                      >
                        <option value="" className="bg-zinc-900">选择目标...</option>
                        {targetPresets.map((preset) => (
                          <option key={preset.id} value={preset.id} className="bg-zinc-900">
                            {preset.categoryName} / {preset.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
                    </div>
                  </label>

                  <label className="space-y-1 text-xs text-zinc-400">
                    <span>B 变体</span>
                    <div className="relative">
                      <select
                        value={rule.toVariantId ?? ""}
                        onChange={(event) => updateRule(rule.id, { toVariantId: event.target.value })}
                        disabled={!toPreset}
                        className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 pr-7 text-xs text-zinc-100 outline-none focus:border-sky-500/40 disabled:opacity-50"
                      >
                        <option value="" className="bg-zinc-900">默认可用变体</option>
                        {(toPreset?.variants ?? []).map((variant) => (
                          <option key={variant.id} value={variant.id} className="bg-zinc-900">{variant.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
                    </div>
                  </label>

                  <div className="flex items-end justify-between gap-2 sm:justify-end">
                    <span className="text-[11px] text-zinc-600">#{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      disabled={rules.length <= 1 || isSubmitting}
                      className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                      aria-label="删除替换规则"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addRule}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-zinc-400 transition hover:border-sky-500/30 hover:text-sky-300 disabled:opacity-50"
            >
              <Plus className="size-3.5" /> 添加替换组
            </button>
          </div>

          {activePlan && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] p-2">
                  <div className="text-zinc-500">计划替换</div>
                  <div className="mt-1 text-xl font-semibold text-sky-300">{summary.planned}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">No-op 规则</div>
                  <div className="mt-1 text-zinc-200">{summary.noopRules}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">阻塞规则</div>
                  <div className="mt-1 text-zinc-200">{summary.blockedRules}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">阻塞项</div>
                  <div className="mt-1 text-zinc-200">{summary.blockers}</div>
                </div>
              </div>

              {hasBlockers(activePlan) && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-2.5 text-xs text-amber-200">
                  <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" /> 存在阻塞项</div>
                  <div className="mt-1 text-amber-100/70">修正替换规则后重新 Dry Run。</div>
                </div>
              )}

              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {planRules(activePlan).map((rule, index) => (
                  <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-zinc-200">
                        {rule.fromPresetName ?? "?"}{" -> "}{rule.toPresetName ?? "?"}
                      </span>
                      <span className={rule.status === "blocked" ? "text-amber-300" : rule.status === "planned" ? "text-sky-300" : "text-zinc-500"}>
                        {rule.status ?? "unknown"} · {rule.updates?.length ?? 0}
                      </span>
                    </div>
                    {rule.blockers?.length ? (
                      <div className="mt-1 space-y-0.5 text-[11px] text-amber-300">
                        {rule.blockers.map((blocker, blockerIndex) => <div key={blockerIndex}>{blocker.message ?? "规则阻塞"}</div>)}
                      </div>
                    ) : null}
                    {rule.updates?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {rule.updates.slice(0, 8).map((update, updateIndex) => (
                          <span key={updateIndex} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                            {update.ownerName ?? update.bindingKey}
                          </span>
                        ))}
                        {rule.updates.length > 8 && <span className="text-[11px] text-zinc-500">+{rule.updates.length - 8}</span>}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {applyResult && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5 text-xs text-emerald-200">
                  <div className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="size-4" /> Apply 结果</div>
                  <div className="mt-1 text-emerald-100/70">已刷新当前页面数据。</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 p-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleDryRun}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Dry Run 预览
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
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
          onClick={() => setIsOpen(true)}
          className={
            buttonClassName ??
            "flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.03] px-2 py-2 text-[11px] text-teal-300 transition hover:bg-teal-500/[0.08] sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
          }
        >
        <Repeat2 className="size-3.5" /> 批量替换预制
      </button>
      {dialog}
    </>
  );
}
