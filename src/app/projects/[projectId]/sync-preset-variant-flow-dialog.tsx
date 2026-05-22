"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RefreshCw, Shuffle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  buildSyncPresetVariantFlowPayload,
  extractSyncPresetVariantFlowError,
  summarizeSyncPresetVariantFlowPlan,
} from "@/lib/sync-preset-variant-flow-ui";

type ProjectOption = { id: string; title: string };

type FlowPlanItem = Record<string, unknown>;

type FlowDryRunResult = {
  dryRun: boolean;
  sourceProject?: { id?: string; title?: string; updatedAt?: string | Date };
  targetProject?: { id?: string; title?: string; updatedAt?: string | Date };
  sourcePresetName?: string;
  targetPresetName?: string;
  initialDryRun?: {
    plannedUpdateCount?: number;
    plan?: FlowPlanItem[];
  };
};

type FlowApplyResult = FlowDryRunResult & {
  apply?: {
    plannedUpdateCount?: number;
    execution?: { total?: number; successCount?: number; failureCount?: number };
  };
  verification?: {
    passed?: boolean;
    plannedUpdateCount?: number;
    variantDistribution?: Record<string, number>;
    loraConfig?: { totalSections?: number; okCount?: number; missingCount?: number };
    sampleBlocks?: Array<{
      sectionNumber?: number;
      sectionName?: string | null;
      variantName?: string | null;
      label?: string | null;
    }>;
  };
};

type FlowApiResponse =
  | { ok: true; data: FlowDryRunResult | FlowApplyResult }
  | { ok: false; error?: { message?: string; details?: unknown } };

function asPlan(plan: FlowPlanItem[] | undefined) {
  return Array.isArray(plan) ? plan : [];
}

function formatProject(project: FlowDryRunResult["sourceProject"]) {
  if (!project?.title) return "未返回";
  return project.id ? `${project.title}（${project.id.slice(0, 8)}）` : project.title;
}

function TopPlanRows({ plan }: { plan: FlowPlanItem[] }) {
  const rows = plan.slice(0, 8);
  if (rows.length === 0) {
    return <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-zinc-500">暂无计划明细</div>;
  }
  return (
    <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
      {rows.map((item, index) => (
        <div key={index} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-zinc-200">{String(item.sectionName ?? item.sectionId ?? `#${index + 1}`)}</span>
            <span className={item.action === "switch" ? "text-sky-300" : "text-zinc-500"}>{String(item.action ?? "unknown")}</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {item.action === "switch"
              ? `${String(item.sourceVariantName ?? "?")} → ${String(item.targetVariantName ?? "?")}`
              : String(item.reason ?? "")}
          </div>
        </div>
      ))}
      {plan.length > rows.length && <div className="text-center text-[11px] text-zinc-500">另有 {plan.length - rows.length} 条未显示</div>}
    </div>
  );
}

function Distribution({ distribution }: { distribution?: Record<string, number> }) {
  const entries = Object.entries(distribution ?? {}).sort((left, right) => right[1] - left[1]);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-2.5">
      <div className="mb-1.5 text-xs font-medium text-emerald-300">应用后变体分布</div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([name, count]) => (
          <span key={name} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-zinc-300">
            {name}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SyncPresetVariantFlowDialog({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [sourceProjectId, setSourceProjectId] = useState("");
  const [sourcePresetName, setSourcePresetName] = useState("");
  const [targetPresetName, setTargetPresetName] = useState("");
  const [sampleSectionNumbersText, setSampleSectionNumbersText] = useState("1,33,65");
  const [dryRunResult, setDryRunResult] = useState<FlowDryRunResult | null>(null);
  const [applyResult, setApplyResult] = useState<FlowApplyResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch project list when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((result: { ok?: boolean; data?: ProjectOption[] }) => {
        if (result.ok && Array.isArray(result.data)) {
          setProjects(result.data.filter((p) => p.id !== projectId));
        }
      })
      .catch(() => {});
  }, [isOpen, projectId]);

  // Lock body scroll + Escape key
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting]);

  const sourceProjectTitle = projects.find((p) => p.id === sourceProjectId)?.title ?? "";
  const plan = useMemo(() => asPlan((applyResult ?? dryRunResult)?.initialDryRun?.plan), [applyResult, dryRunResult]);
  const planSummary = useMemo(() => summarizeSyncPresetVariantFlowPlan(plan), [plan]);

  function resetResults() {
    setDryRunResult(null);
    setApplyResult(null);
  }

  async function requestFlow(
    dryRun: boolean,
    expectedIds: { expectedSourceProjectId?: string; expectedTargetProjectId?: string } = {},
  ) {
    const payload = buildSyncPresetVariantFlowPayload({
      sourceProjectTitle,
      targetProjectTitle: projectTitle,
      expectedSourceProjectId: expectedIds.expectedSourceProjectId ?? sourceProjectId,
      expectedTargetProjectId: expectedIds.expectedTargetProjectId ?? projectId,
      sourcePresetName,
      targetPresetName,
      sampleSectionNumbersText,
      dryRun,
    });

    const response = await fetch("/api/agent/projects/sync-preset-variant-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as FlowApiResponse | null;
    if (!response.ok || !result?.ok) {
      throw new Error(extractSyncPresetVariantFlowError(result, dryRun ? "Dry Run 失败" : "Apply 失败"));
    }
    return result.data;
  }

  async function handleDryRun() {
    if (!sourceProjectId) { toast.error("请选择参考项目"); return; }
    setIsSubmitting(true);
    try {
      const result = await requestFlow(true, { expectedSourceProjectId: sourceProjectId, expectedTargetProjectId: projectId });
      setDryRunResult(result as FlowDryRunResult);
      setApplyResult(null);
      toast.success(`Dry Run 完成：计划切换 ${result.initialDryRun?.plannedUpdateCount ?? 0} 段`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dry Run 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApply() {
    if (!dryRunResult) return;
    const expectedSourceProjectId = dryRunResult.sourceProject?.id ?? sourceProjectId;
    const expectedTargetProjectId = dryRunResult.targetProject?.id ?? projectId;
    if (!expectedSourceProjectId || !expectedTargetProjectId) {
      toast.error("Dry Run 未返回项目 ID，请重新预览后再 Apply");
      return;
    }
    const plannedUpdateCount = dryRunResult.initialDryRun?.plannedUpdateCount ?? 0;
    if (!confirm(`确认按「${sourceProjectTitle}」同步「${projectTitle}」角色变体？计划切换 ${plannedUpdateCount} 段。`)) return;

    setIsSubmitting(true);
    try {
      const result = await requestFlow(false, { expectedSourceProjectId, expectedTargetProjectId });
      const applyData = result as FlowApplyResult;
      setApplyResult(applyData);
      router.refresh();
      const passed = applyData.verification?.passed === true;
      toast[passed ? "success" : "warning"](
        passed
          ? "Apply 完成，复查 plannedUpdateCount = 0"
          : `Apply 完成但复查未通过：plannedUpdateCount=${applyData.verification?.plannedUpdateCount ?? "?"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Apply 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeDialog() {
    if (!isSubmitting) setIsOpen(false);
  }

  const dialogContent = isOpen ? createPortal(
    <>
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="参考项目同步角色变体"
        className="fixed left-1/2 top-[50dvh] z-[210] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),44rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-100">参考项目同步角色变体</div>
            <div className="mt-0.5 text-xs text-zinc-500">先 Dry Run 预览计划，再二次确认 Apply；目标为当前项目「{projectTitle}」。</div>
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
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-400">
              <span>参考项目</span>
              <div className="relative">
                <select
                  value={sourceProjectId}
                  onChange={(event) => { setSourceProjectId(event.target.value); resetResults(); }}
                  className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 pr-8 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                >
                  <option value="" className="bg-zinc-900">选择参考项目…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">{p.title}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              </div>
            </label>
            <label className="space-y-1 text-xs text-zinc-400">
              <span>目标项目</span>
              <input
                value={projectTitle}
                disabled
                className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-zinc-500 outline-none"
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-400">
              <span>参考角色预设名（可空自动推断）</span>
              <input
                value={sourcePresetName}
                onChange={(event) => { setSourcePresetName(event.target.value); resetResults(); }}
                placeholder="例如：西施"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-400">
              <span>目标角色预设名（可空自动推断）</span>
              <input
                value={targetPresetName}
                onChange={(event) => { setTargetPresetName(event.target.value); resetResults(); }}
                placeholder="例如：尼可·莱恩"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
              />
            </label>
            <label className="space-y-1 text-xs text-zinc-400 sm:col-span-2">
              <span>抽查小节编号</span>
              <input
                value={sampleSectionNumbersText}
                onChange={(event) => { setSampleSectionNumbersText(event.target.value); resetResults(); }}
                placeholder="1,33,65"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
              />
            </label>
          </div>

          {(dryRunResult || applyResult) && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">参考项目 / 预设</div>
                  <div className="mt-1 truncate text-zinc-200">{formatProject((applyResult ?? dryRunResult)?.sourceProject)}</div>
                  <div className="mt-0.5 text-zinc-400">{(applyResult ?? dryRunResult)?.sourcePresetName ?? "自动推断"}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">目标项目 / 预设</div>
                  <div className="mt-1 truncate text-zinc-200">{formatProject((applyResult ?? dryRunResult)?.targetProject)}</div>
                  <div className="mt-0.5 text-zinc-400">{(applyResult ?? dryRunResult)?.targetPresetName ?? "自动推断"}</div>
                </div>
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] p-2">
                  <div className="text-zinc-500">计划切换</div>
                  <div className="mt-1 text-xl font-semibold text-sky-300">{(applyResult ?? dryRunResult)?.initialDryRun?.plannedUpdateCount ?? 0}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">switch / skip</div>
                  <div className="mt-1 text-zinc-200">{planSummary.switchCount} / {planSummary.skipCount}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-zinc-500">匹配方式</div>
                  <div className="mt-1 text-zinc-200">section=name, variant=name</div>
                </div>
              </div>

              {Object.keys(planSummary.skipReasons).length > 0 && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                  <div className="mb-1 text-zinc-500">跳过原因</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(planSummary.skipReasons).map(([reason, count]) => (
                      <span key={reason} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">{reason}: {count}</span>
                    ))}
                  </div>
                </div>
              )}

              <TopPlanRows plan={plan} />

              {applyResult?.verification && (
                <div className={`rounded-lg border p-2.5 ${applyResult.verification.passed ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-amber-500/20 bg-amber-500/[0.05]"}`}>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {applyResult.verification.passed ? <CheckCircle2 className="size-4 text-emerald-300" /> : <AlertTriangle className="size-4 text-amber-300" />}
                    <span className={applyResult.verification.passed ? "text-emerald-300" : "text-amber-300"}>
                      复查 {applyResult.verification.passed ? "通过" : "未通过"}：plannedUpdateCount = {applyResult.verification.plannedUpdateCount ?? "?"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    loraConfig {applyResult.verification.loraConfig?.okCount ?? 0}/{applyResult.verification.loraConfig?.totalSections ?? 0}，缺失 {applyResult.verification.loraConfig?.missingCount ?? 0}
                  </div>
                </div>
              )}

              <Distribution distribution={applyResult?.verification?.variantDistribution} />

              {applyResult?.verification?.sampleBlocks?.length ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                  <div className="mb-1.5 text-xs font-medium text-zinc-300">抽查 Prompt Block</div>
                  <div className="space-y-1 text-[11px] text-zinc-500">
                    {applyResult.verification.sampleBlocks.map((sample) => (
                      <div key={sample.sectionNumber} className="truncate">
                        #{sample.sectionNumber} {sample.sectionName ?? ""}: {sample.label ?? sample.variantName ?? "未找到角色块"}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 p-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleDryRun}
            disabled={isSubmitting || !sourceProjectId}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Dry Run 预览
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isSubmitting || !dryRunResult}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            确认 Apply 并复查
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
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] px-2 py-2 text-[11px] text-amber-300 transition hover:bg-amber-500/[0.08] sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
      >
        <Shuffle className="size-3.5" /> 同步变体
      </button>
      {dialogContent}
    </>
  );
}
