"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { KSamplerParams } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SAMPLER_OPTIONS = [
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

export const SCHEDULER_OPTIONS = [
  { value: "normal", label: "normal" },
  { value: "karras", label: "karras" },
  { value: "exponential", label: "exponential" },
  { value: "sgm_uniform", label: "sgm_uniform" },
  { value: "simple", label: "simple" },
  { value: "ddim_uniform", label: "ddim_uniform" },
  { value: "beta", label: "beta" },
];

export const SEED_OPTIONS = [
  { value: "random", label: "随机 (random)" },
  { value: "fixed", label: "固定 (fixed)" },
  { value: "increment", label: "递增 (increment)" },
];

// ---------------------------------------------------------------------------
// KSampler Panel
// ---------------------------------------------------------------------------

export type KSamplerPanelProps = {
  label: string;
  subtitle: string;
  params: KSamplerParams;
  defaults: Required<KSamplerParams>;
  onChange: (params: KSamplerParams) => void;
  onFieldBlur: () => void;
  disabled?: boolean;
};

export function KSamplerPanel({ label, subtitle, params, defaults, onChange, onFieldBlur, disabled }: KSamplerPanelProps) {
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

export function parseInitialKSampler(raw: unknown, defaults: Required<KSamplerParams>): KSamplerParams {
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
