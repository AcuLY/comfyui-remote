"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { updateJob, type UpdateJobInput } from "@/lib/actions";
import type { JobEditData, JobFormCategory } from "@/lib/server-data";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";

type Props = {
  job: JobEditData;
  categories: JobFormCategory[];
  // Legacy props (kept so old callers don't break)
  characters?: unknown[];
  scenes?: unknown[];
  styles?: unknown[];
};

export function JobEditForm({ job, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(job.title);
  const [notes, setNotes] = useState(job.notes ?? "");

  // Initialize selections from presetBindings or legacy fields
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const cat of categories) {
      init[cat.id] = "";
    }
    // Fill from presetBindings
    for (const binding of job.presetBindings) {
      if (init[binding.categoryId] !== undefined) {
        init[binding.categoryId] = binding.presetId;
      }
    }
    return init;
  });

  // 小节默认值
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(job.defaultAspectRatio);
  const [defaultShortSidePx, setDefaultShortSidePx] = useState(job.defaultShortSidePx.toString());
  const [defaultBatchSize, setDefaultBatchSize] = useState(job.defaultBatchSize.toString());
  const [defaultSeedPolicy, setDefaultSeedPolicy] = useState(job.defaultSeedPolicy1);

  function setSelection(categoryId: string, presetId: string) {
    setSelections((prev) => ({ ...prev, [categoryId]: presetId }));
  }

  // Find if there's a character category and it's required
  const characterCategory = categories.find((c) => c.slug === "character");
  const hasCharacterSelected = characterCategory
    ? !!selections[characterCategory.id]
    : true;

  function handleSubmit() {
    if (!title.trim() || !hasCharacterSelected) return;

    const presetBindings = Object.entries(selections)
      .filter(([, presetId]) => presetId)
      .map(([categoryId, presetId]) => ({ categoryId, presetId }));

    const input: UpdateJobInput = {
      jobId: job.id,
      title: title.trim(),
      presetBindings,
      notes: notes.trim() || null,
      // 小节默认值
      jobLevelOverrides: {
        defaultAspectRatio,
        defaultShortSidePx: parseInt(defaultShortSidePx, 10) || 512,
        defaultBatchSize: parseInt(defaultBatchSize, 10) || 2,
        defaultSeedPolicy1: defaultSeedPolicy,
      },
    };

    startTransition(async () => {
      await updateJob(input);
      router.push(`/jobs/${job.id}`);
    });
  }

  const CATEGORY_COLORS: Record<string, string> = {
    sky: "border-sky-500/20 focus:border-sky-500/40",
    emerald: "border-emerald-500/20 focus:border-emerald-500/40",
    violet: "border-violet-500/20 focus:border-violet-500/40",
    amber: "border-amber-500/20 focus:border-amber-500/40",
  };

  const CATEGORY_LABELS: Record<string, string> = {
    sky: "text-sky-400",
    emerald: "text-emerald-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
  };

  return (
    <div className="space-y-5">
      {/* 基础信息 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">基础信息</h3>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">任务标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
          />
        </div>

        {/* Dynamic category selectors */}
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => {
            const colorClass = CATEGORY_COLORS[cat.color ?? ""] ?? "border-white/10 focus:border-sky-500/40";
            const labelClass = CATEGORY_LABELS[cat.color ?? ""] ?? "text-zinc-400";
            const isRequired = cat.slug === "character";

            return (
              <div key={cat.id} className="space-y-2">
                <label className={`text-xs ${labelClass}`}>
                  {cat.name}{isRequired ? " *" : ""}
                </label>
                <div className="relative">
                  <select
                    value={selections[cat.id]}
                    onChange={(e) => setSelection(cat.id, e.target.value)}
                    className={`w-full appearance-none rounded-2xl bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none ${colorClass}`}
                  >
                    <option value="" className="bg-zinc-900">
                      {isRequired ? `选择${cat.name}...` : "无"}
                    </option>
                    {cat.presets.map((preset) => (
                      <option key={preset.id} value={preset.id} className="bg-zinc-900">
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">备注</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
          />
        </div>
      </div>

      {/* 小节默认值设置 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">新建小节默认值</h3>
        <p className="text-[11px] text-zinc-500">创建新小节时自动应用这些默认值</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认画幅</label>
            <div className="relative">
              <select
                value={defaultAspectRatio}
                onChange={(e) => setDefaultAspectRatio(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
              >
                <option value="1:1" className="bg-zinc-900">1:1 方形</option>
                <option value="2:3" className="bg-zinc-900">2:3 竖图</option>
                <option value="3:4" className="bg-zinc-900">3:4 竖图</option>
                <option value="9:16" className="bg-zinc-900">9:16 竖图</option>
                <option value="3:2" className="bg-zinc-900">3:2 横图</option>
                <option value="4:3" className="bg-zinc-900">4:3 横图</option>
                <option value="16:9" className="bg-zinc-900">16:9 横图</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认短边像素</label>
            <input
              type="number"
              min={256}
              max={4096}
              step={8}
              value={defaultShortSidePx}
              onChange={(e) => setDefaultShortSidePx(e.target.value)}
              className="input-number w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认 Batch Size</label>
            <input
              type="number"
              min={1}
              max={100}
              value={defaultBatchSize}
              onChange={(e) => setDefaultBatchSize(e.target.value)}
              className="input-number w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/40"
            />
            <BatchSizeQuickFill
              onSelect={(val) => setDefaultBatchSize(String(val))}
              currentValue={defaultBatchSize ? parseInt(defaultBatchSize, 10) : null}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认 Seed 策略</label>
            <div className="relative">
              <select
                value={defaultSeedPolicy}
                onChange={(e) => setDefaultSeedPolicy(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
              >
                <option value="random" className="bg-zinc-900">随机 (random)</option>
                <option value="fixed" className="bg-zinc-900">固定 (fixed)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 保存 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !title.trim() || !hasCharacterSelected}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> 保存中...</>
        ) : (
          <><Save className="size-4" /> 保存修改</>
        )}
      </button>
    </div>
  );
}
