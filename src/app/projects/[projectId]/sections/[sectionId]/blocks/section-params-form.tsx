"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useActionState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { UpscaleFactorQuickFill } from "@/components/upscale-factor-quick-fill";
import { saveSectionEditAction } from "@/app/projects/actions";
import { initialProjectSaveState } from "@/app/projects/action-types";
import { AspectRatioPicker } from "@/components/aspect-ratio-picker";
import { Select } from "@/components/ui/select";
import type { KSamplerParams } from "@/lib/lora-types";
import { DEFAULT_KSAMPLER1, DEFAULT_KSAMPLER2 } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLER_OPTIONS = [
  { value: "euler", label: "euler" },
  { value: "euler_ancestral", label: "euler_ancestral" },
  { value: "heun", label: "heun" },
  { value: "heunpp2", label: "heunpp2" },
  { value: "dpm_2", label: "dpm_2" },
  { value: "dpm_2_ancestral", label: "dpm_2_ancestral" },
  { value: "lms", label: "lms" },
  { value: "dpm_fast", label: "dpm_fast" },
  { value: "dpm_adaptive", label: "dpm_adaptive" },
  { value: "dpmpp_2s_ancestral", label: "dpmpp_2s_ancestral" },
  { value: "dpmpp_sde", label: "dpmpp_sde" },
  { value: "dpmpp_2m", label: "dpmpp_2m" },
  { value: "dpmpp_2m_sde", label: "dpmpp_2m_sde" },
  { value: "dpmpp_3m_sde", label: "dpmpp_3m_sde" },
  { value: "ddpm", label: "ddpm" },
  { value: "lcm", label: "lcm" },
  { value: "ddim", label: "ddim" },
  { value: "uni_pc", label: "uni_pc" },
  { value: "uni_pc_bh2", label: "uni_pc_bh2" },
];

const SCHEDULER_OPTIONS = [
  { value: "normal", label: "normal" },
  { value: "karras", label: "karras" },
  { value: "exponential", label: "exponential" },
  { value: "sgm_uniform", label: "sgm_uniform" },
  { value: "simple", label: "simple" },
  { value: "ddim_uniform", label: "ddim_uniform" },
  { value: "beta", label: "beta" },
];

const SEED_OPTIONS = [
  { value: "random", label: "随机 (random)" },
  { value: "fixed", label: "固定 (fixed)" },
  { value: "increment", label: "递增 (increment)" },
];


/** Debounce delay for auto-save (ms) */
const AUTO_SAVE_DELAY = 600;

// ---------------------------------------------------------------------------
// KSampler Panel
// ---------------------------------------------------------------------------

type KSamplerPanelProps = {
  label: string;
  subtitle: string;
  params: KSamplerParams;
  defaults: Required<KSamplerParams>;
  onChange: (params: KSamplerParams) => void;
  onFieldBlur: () => void;
  disabled?: boolean;
};

function KSamplerPanel({ label, subtitle, params, defaults, onChange, onFieldBlur, disabled }: KSamplerPanelProps) {
  const [open, setOpen] = useState(false);

  function update(key: keyof KSamplerParams, value: unknown) {
    onChange({ ...params, [key]: value });
  }

  /** For Select fields — update value and trigger save immediately */
  function updateAndSave(key: keyof KSamplerParams, value: unknown) {
    onChange({ ...params, [key]: value });
    // Schedule save on next tick so the state has updated
    setTimeout(onFieldBlur, 0);
  }

  const inputCls =
    "input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30 disabled:opacity-70";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left disabled:opacity-70"
      >
        <div>
          <div className="text-[11px] font-medium text-zinc-300">{label}</div>
          <div className="text-[10px] text-zinc-600">{subtitle}</div>
        </div>
        <ChevronDown
          className={`size-3.5 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-white/5 px-3 pb-3 pt-2.5">
          {/* Row 1: steps + cfg */}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <div className="text-[10px] text-zinc-500">Steps</div>
              <input
                type="number"
                min={1}
                max={150}
                disabled={disabled}
                value={params.steps ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  update("steps", v ? Number(v) : undefined);
                }}
                onBlur={onFieldBlur}
                placeholder={String(defaults.steps)}
                className={inputCls}
              />
            </label>
            <label className="space-y-1">
              <div className="text-[10px] text-zinc-500">CFG</div>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                disabled={disabled}
                value={params.cfg ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  update("cfg", v ? Number(v) : undefined);
                }}
                onBlur={onFieldBlur}
                placeholder={String(defaults.cfg)}
                className={inputCls}
              />
            </label>
          </div>

          {/* Row 2: sampler + scheduler */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-500">Sampler</div>
              <Select
                value={params.sampler_name ?? defaults.sampler_name}
                onChange={(v) => updateAndSave("sampler_name", v)}
                options={SAMPLER_OPTIONS}
                disabled={disabled}
                size="sm"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-500">Scheduler</div>
              <Select
                value={params.scheduler ?? defaults.scheduler}
                onChange={(v) => updateAndSave("scheduler", v)}
                options={SCHEDULER_OPTIONS}
                disabled={disabled}
                size="sm"
              />
            </div>
          </div>

          {/* Row 3: denoise + seed */}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <div className="text-[10px] text-zinc-500">Denoise</div>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                disabled={disabled}
                value={params.denoise ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  update("denoise", v ? Number(v) : undefined);
                }}
                onBlur={onFieldBlur}
                placeholder={String(defaults.denoise)}
                className={inputCls}
              />
            </label>
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-500">Seed 策略</div>
              <Select
                value={params.seedPolicy ?? defaults.seedPolicy}
                onChange={(v) => updateAndSave("seedPolicy", v)}
                options={SEED_OPTIONS}
                disabled={disabled}
                size="sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseInitialKSampler(raw: unknown, defaults: Required<KSamplerParams>): KSamplerParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...defaults };
  }
  const obj = raw as Record<string, unknown>;
  return {
    steps: typeof obj.steps === "number" ? obj.steps : defaults.steps,
    cfg: typeof obj.cfg === "number" ? obj.cfg : defaults.cfg,
    sampler_name: typeof obj.sampler_name === "string" ? obj.sampler_name : defaults.sampler_name,
    scheduler: typeof obj.scheduler === "string" ? obj.scheduler : defaults.scheduler,
    denoise: typeof obj.denoise === "number" ? obj.denoise : defaults.denoise,
    seedPolicy:
      typeof obj.seedPolicy === "string" &&
      ["random", "fixed", "increment"].includes(obj.seedPolicy)
        ? (obj.seedPolicy as KSamplerParams["seedPolicy"])
        : defaults.seedPolicy,
  };
}

// ---------------------------------------------------------------------------
// Main Form
// ---------------------------------------------------------------------------

type SectionParamsFormProps = {
  projectId: string;
  sectionId: string;
  initialParams: {
    batchSize: number | null;
    aspectRatio: string | null;
    shortSidePx: number | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    ksampler1: unknown;
    ksampler2: unknown;
    upscaleFactor: number | null;
  };
};

export function SectionParamsForm({ projectId, sectionId, initialParams }: SectionParamsFormProps) {
  const [state, formAction, pending] = useActionState(saveSectionEditAction, initialProjectSaveState);
  const [batchSize, setBatchSize] = useState<string>(initialParams.batchSize?.toString() ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ks1, setKs1] = useState<KSamplerParams>(() =>
    parseInitialKSampler(initialParams.ksampler1, DEFAULT_KSAMPLER1),
  );
  const [ks2, setKs2] = useState<KSamplerParams>(() =>
    parseInitialKSampler(initialParams.ksampler2, DEFAULT_KSAMPLER2),
  );
  const [upscaleFactor, setUpscaleFactor] = useState<string>(
    String(initialParams.upscaleFactor ?? 2),
  );

  // Auto-save: debounced form submit
  const scheduleAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      formRef.current?.requestSubmit();
    }, AUTO_SAVE_DELAY);
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      {/* 提交空值让 API 保持原 prompt 不变 */}
      <input type="hidden" name="positivePrompt" value="" />
      <input type="hidden" name="negativePrompt" value="" />
      {/* KSampler params as JSON */}
      <input type="hidden" name="ksampler1" value={JSON.stringify(ks1)} />
      <input type="hidden" name="ksampler2" value={JSON.stringify(ks2)} />
      <input type="hidden" name="upscaleFactor" value={upscaleFactor} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-400">运行参数</div>
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Loader2 className="size-3 animate-spin" />
              保存中…
            </span>
          )}
          {!pending && state.status === "success" && (
            <span className="text-[11px] text-emerald-400/70">已保存</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500">画幅比例</div>
            <AspectRatioPicker
              name="aspectRatio"
              defaultValue={initialParams.aspectRatio}
              defaultShortSidePx={initialParams.shortSidePx}
              disabled={pending}
              onChange={scheduleAutoSave}
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500">Batch Size</div>
            <input
              name="batchSize"
              type="number"
              min={1}
              disabled={pending}
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              onBlur={scheduleAutoSave}
              placeholder="默认"
              className="input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30 disabled:opacity-70"
            />
            <BatchSizeQuickFill
              onSelect={(val) => {
                setBatchSize(String(val));
                // Schedule save after state update
                setTimeout(scheduleAutoSave, 0);
              }}
              currentValue={batchSize ? parseInt(batchSize, 10) : null}
              disabled={pending}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500">放大倍数</div>
            <input
              type="number"
              min={1}
              max={4}
              step={0.5}
              value={upscaleFactor}
              onChange={(v) => {
                setUpscaleFactor(v.target.value);
                setTimeout(scheduleAutoSave, 0);
              }}
              disabled={pending}
              className="input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-sky-500/30 disabled:opacity-50"
            />
            <UpscaleFactorQuickFill
              onSelect={(val) => {
                setUpscaleFactor(String(val));
                setTimeout(scheduleAutoSave, 0);
              }}
              currentValue={upscaleFactor ? parseFloat(upscaleFactor) : null}
              disabled={pending}
              size="sm"
            />
            {upscaleFactor === "1" && (
              <p className="text-[10px] text-amber-400/70">
                1x 模式将跳过 Upscale Latent 和 KSampler2（无高清修复）
              </p>
            )}
          </div>
        </div>

          {/* KSampler panels */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <KSamplerPanel
              label="KSampler1（第一阶段）"
              subtitle={`steps ${ks1.steps ?? DEFAULT_KSAMPLER1.steps} · cfg ${ks1.cfg ?? DEFAULT_KSAMPLER1.cfg} · ${ks1.sampler_name ?? DEFAULT_KSAMPLER1.sampler_name}`}
              params={ks1}
              defaults={DEFAULT_KSAMPLER1}
              onChange={setKs1}
              onFieldBlur={scheduleAutoSave}
              disabled={pending}
            />
            <KSamplerPanel
              label="KSampler2（高清修复）"
              subtitle={upscaleFactor === "1" ? "1x 模式下不使用" : `steps ${ks2.steps ?? DEFAULT_KSAMPLER2.steps} · cfg ${ks2.cfg ?? DEFAULT_KSAMPLER2.cfg} · ${ks2.sampler_name ?? DEFAULT_KSAMPLER2.sampler_name}`}
              params={ks2}
              defaults={DEFAULT_KSAMPLER2}
              onChange={setKs2}
              onFieldBlur={scheduleAutoSave}
              disabled={pending || upscaleFactor === "1"}
            />
          </div>

        {state.status === "error" && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] leading-5 text-rose-200">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
