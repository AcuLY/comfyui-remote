"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { updateProject, type UpdateProjectInput } from "@/lib/actions";
import { toast } from "sonner";
import type { ProjectEditData, ProjectFormCategory } from "@/lib/server-data";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { UpscaleFactorQuickFill } from "@/components/upscale-factor-quick-fill";
import { DEFAULT_KSAMPLER1, DEFAULT_KSAMPLER2 } from "@/lib/lora-types";

type Props = {
  project: ProjectEditData;
  categories: ProjectFormCategory[];
};

export function ProjectEditForm({ project, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(project.title);
  const [notes, setNotes] = useState(project.notes ?? "");

  // Initialize selections from presetBindings
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const cat of categories) init[cat.id] = "";
    for (const binding of project.presetBindings) {
      if (init[binding.categoryId] !== undefined) init[binding.categoryId] = binding.presetId;
    }
    return init;
  });

  // 小节默认值
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(project.defaultAspectRatio);
  const [defaultShortSidePx, setDefaultShortSidePx] = useState(project.defaultShortSidePx.toString());
  const [defaultBatchSize, setDefaultBatchSize] = useState(project.defaultBatchSize.toString());
  const [defaultUpscaleFactor, setDefaultUpscaleFactor] = useState(project.defaultUpscaleFactor?.toString() ?? "2");
  const [defaultSeedPolicy, setDefaultSeedPolicy] = useState(project.defaultSeedPolicy1);

  // KSampler 默认值
  const ks1Init = (project.defaultKsampler1 ?? {}) as Record<string, string | number | undefined>;
  const ks2Init = (project.defaultKsampler2 ?? {}) as Record<string, string | number | undefined>;
  const [ks1Steps, setKs1Steps] = useState(String(ks1Init.steps ?? DEFAULT_KSAMPLER1.steps));
  const [ks1Cfg, setKs1Cfg] = useState(String(ks1Init.cfg ?? DEFAULT_KSAMPLER1.cfg));
  const [ks1Sampler, setKs1Sampler] = useState(ks1Init.sampler_name ?? DEFAULT_KSAMPLER1.sampler_name);
  const [ks1Scheduler, setKs1Scheduler] = useState(ks1Init.scheduler ?? DEFAULT_KSAMPLER1.scheduler);
  const [ks1Denoise, setKs1Denoise] = useState(String(ks1Init.denoise ?? DEFAULT_KSAMPLER1.denoise));
  const [ks2Steps, setKs2Steps] = useState(String(ks2Init.steps ?? DEFAULT_KSAMPLER2.steps));
  const [ks2Cfg, setKs2Cfg] = useState(String(ks2Init.cfg ?? DEFAULT_KSAMPLER2.cfg));
  const [ks2Sampler, setKs2Sampler] = useState(ks2Init.sampler_name ?? DEFAULT_KSAMPLER2.sampler_name);
  const [ks2Scheduler, setKs2Scheduler] = useState(ks2Init.scheduler ?? DEFAULT_KSAMPLER2.scheduler);
  const [ks2Denoise, setKs2Denoise] = useState(String(ks2Init.denoise ?? DEFAULT_KSAMPLER2.denoise));

  function setSelection(categoryId: string, presetId: string) {
    setSelections((prev) => ({ ...prev, [categoryId]: presetId }));
  }

  function handleSubmit() {
    if (!title.trim()) return;

    const presetBindings = Object.entries(selections)
      .filter(([, presetId]) => presetId)
      .map(([categoryId, presetId]) => ({ categoryId, presetId }));

    const input: UpdateProjectInput = {
      projectId: project.id,
      title: title.trim(),
      presetBindings,
      notes: notes.trim() || null,
      projectLevelOverrides: {
        defaultAspectRatio,
        defaultShortSidePx: parseInt(defaultShortSidePx, 10) || 512,
        defaultBatchSize: parseInt(defaultBatchSize, 10) || 2,
        defaultUpscaleFactor: parseFloat(defaultUpscaleFactor) || 2,
        defaultSeedPolicy1: defaultSeedPolicy,
        defaultKsampler1: {
          steps: parseInt(ks1Steps, 10) || DEFAULT_KSAMPLER1.steps,
          cfg: parseFloat(ks1Cfg) || DEFAULT_KSAMPLER1.cfg,
          sampler_name: ks1Sampler,
          scheduler: ks1Scheduler,
          denoise: parseFloat(ks1Denoise) ?? DEFAULT_KSAMPLER1.denoise,
        },
        defaultKsampler2: {
          steps: parseInt(ks2Steps, 10) || DEFAULT_KSAMPLER2.steps,
          cfg: parseFloat(ks2Cfg) || DEFAULT_KSAMPLER2.cfg,
          sampler_name: ks2Sampler,
          scheduler: ks2Scheduler,
          denoise: parseFloat(ks2Denoise) ?? DEFAULT_KSAMPLER2.denoise,
        },
      },
    };

    startTransition(async () => {
      try {
        await updateProject(input);
        toast.success("项目已保存");
        router.push(`/projects/${project.id}`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
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

  const selectClass = "w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40";
  const inputClass = "input-number w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/40";

  return (
    <div className="space-y-5">
      {/* 基础信息 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">基础信息</h3>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">项目标题</label>
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
            return (
              <div key={cat.id} className="space-y-2">
                <label className={`text-xs ${labelClass}`}>{cat.name}（可选）</label>
                <div className="relative">
                  <select
                    value={selections[cat.id]}
                    onChange={(e) => setSelection(cat.id, e.target.value)}
                    className={`w-full appearance-none rounded-2xl bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none ${colorClass}`}
                  >
                    <option value="" className="bg-zinc-900">不选择{cat.name}</option>
                    {cat.presets.map((preset) => (
                      <option key={preset.id} value={preset.id} className="bg-zinc-900">{preset.name}</option>
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
              <select value={defaultAspectRatio} onChange={(e) => setDefaultAspectRatio(e.target.value)} className={selectClass}>
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
            <input type="number" min={256} max={4096} step={8} value={defaultShortSidePx} onChange={(e) => setDefaultShortSidePx(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认 Batch Size</label>
            <input type="number" min={1} max={100} value={defaultBatchSize} onChange={(e) => setDefaultBatchSize(e.target.value)} className={inputClass} />
            <BatchSizeQuickFill onSelect={(val) => setDefaultBatchSize(String(val))} currentValue={defaultBatchSize ? parseInt(defaultBatchSize, 10) : null} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认放大倍数</label>
            <input type="number" min={1} max={4} step={0.5} value={defaultUpscaleFactor} onChange={(e) => setDefaultUpscaleFactor(e.target.value)} className={inputClass} />
            <UpscaleFactorQuickFill onSelect={(val) => setDefaultUpscaleFactor(String(val))} currentValue={defaultUpscaleFactor ? parseFloat(defaultUpscaleFactor) : null} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认 Seed 策略</label>
            <div className="relative">
              <select value={defaultSeedPolicy} onChange={(e) => setDefaultSeedPolicy(e.target.value)} className={selectClass}>
                <option value="random" className="bg-zinc-900">随机 (random)</option>
                <option value="fixed" className="bg-zinc-900">固定 (fixed)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        </div>
      </div>

      {/* KSampler 默认参数 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">KSampler 默认参数</h3>
        <p className="text-[11px] text-zinc-500">创建新小节时自动应用的采样器参数</p>

        <div className="grid grid-cols-2 gap-4">
          {/* KSampler1 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
            <div className="text-xs font-medium text-zinc-300">KSampler1（第一阶段）</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Steps</span>
                <input type="number" min={1} max={150} value={ks1Steps} onChange={(e) => setKs1Steps(e.target.value)} className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">CFG</span>
                <input type="number" min={1} max={30} step={0.5} value={ks1Cfg} onChange={(e) => setKs1Cfg(e.target.value)} className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Sampler</span>
                <div className="relative">
                  <select value={ks1Sampler} onChange={(e) => setKs1Sampler(e.target.value)} className={selectClass}>
                    <option value="euler_ancestral" className="bg-zinc-900">euler_ancestral</option>
                    <option value="euler" className="bg-zinc-900">euler</option>
                    <option value="dpmpp_2m" className="bg-zinc-900">dpmpp_2m</option>
                    <option value="dpmpp_2m_sde" className="bg-zinc-900">dpmpp_2m_sde</option>
                    <option value="dpmpp_sde" className="bg-zinc-900">dpmpp_sde</option>
                    <option value="ddim" className="bg-zinc-900">ddim</option>
                    <option value="uni_pc" className="bg-zinc-900">uni_pc</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Scheduler</span>
                <div className="relative">
                  <select value={ks1Scheduler} onChange={(e) => setKs1Scheduler(e.target.value)} className={selectClass}>
                    <option value="karras" className="bg-zinc-900">karras</option>
                    <option value="normal" className="bg-zinc-900">normal</option>
                    <option value="simple" className="bg-zinc-900">simple</option>
                    <option value="ddim_uniform" className="bg-zinc-900">ddim_uniform</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Denoise</span>
                <input type="number" min={0} max={1} step={0.05} value={ks1Denoise} onChange={(e) => setKs1Denoise(e.target.value)} className={inputClass} />
              </label>
            </div>
          </div>

          {/* KSampler2 */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-3 space-y-2">
            <div className="text-xs font-medium text-zinc-300">KSampler2（高清修复）</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Steps</span>
                <input type="number" min={1} max={150} value={ks2Steps} onChange={(e) => setKs2Steps(e.target.value)} className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">CFG</span>
                <input type="number" min={1} max={30} step={0.5} value={ks2Cfg} onChange={(e) => setKs2Cfg(e.target.value)} className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Sampler</span>
                <div className="relative">
                  <select value={ks2Sampler} onChange={(e) => setKs2Sampler(e.target.value)} className={selectClass}>
                    <option value="euler_ancestral" className="bg-zinc-900">euler_ancestral</option>
                    <option value="euler" className="bg-zinc-900">euler</option>
                    <option value="dpmpp_2m" className="bg-zinc-900">dpmpp_2m</option>
                    <option value="dpmpp_2m_sde" className="bg-zinc-900">dpmpp_2m_sde</option>
                    <option value="dpmpp_sde" className="bg-zinc-900">dpmpp_sde</option>
                    <option value="ddim" className="bg-zinc-900">ddim</option>
                    <option value="uni_pc" className="bg-zinc-900">uni_pc</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Scheduler</span>
                <div className="relative">
                  <select value={ks2Scheduler} onChange={(e) => setKs2Scheduler(e.target.value)} className={selectClass}>
                    <option value="karras" className="bg-zinc-900">karras</option>
                    <option value="normal" className="bg-zinc-900">normal</option>
                    <option value="simple" className="bg-zinc-900">simple</option>
                    <option value="ddim_uniform" className="bg-zinc-900">ddim_uniform</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-zinc-500">Denoise</span>
                <input type="number" min={0} max={1} step={0.05} value={ks2Denoise} onChange={(e) => setKs2Denoise(e.target.value)} className={inputClass} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 保存 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !title.trim()}
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
