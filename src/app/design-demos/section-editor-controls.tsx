"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type * as React from "react";
import { ChevronDown, AlertCircle, Wand2 } from "lucide-react";

import s from "./design-demo-styles";
import { cx } from "./design-demo-utils";
export type SectionTabValue = "params" | "presets" | "prompts" | "lora" | "history" | "results";

type TabDef = { value: SectionTabValue; label: string; count?: number; tone?: "default" | "primary" };

export function SectionTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef[];
  value: SectionTabValue;
  onChange: (value: SectionTabValue) => void;
}) {
  return (
    <div
      className={s.sectionTabs}
      data-panel="surface"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          className={cx(s.sectionTab, tab.value === value && s.sectionTabActive)}
          onClick={() => onChange(tab.value)}
        >
          <span>{tab.label}</span>
          {typeof tab.count === "number" ? (
            <span className={s.sectionTabCount}>{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Spec-sheet primitives — used by params tab
// ============================================================================

export function SpecSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.specSection}>
      <header className={s.specSectionHead}>
        <h3>{title}</h3>
        {hint ? <p>{hint}</p> : null}
      </header>
      <div className={s.specRows}>{children}</div>
    </section>
  );
}

export function SpecRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.specRow}>
      <div className={s.specRowLabel}>
        <span>{label}</span>
        {description ? <em>{description}</em> : null}
      </div>
      <div className={s.specRowControl}>{children}</div>
    </div>
  );
}

// ============================================================================
// Checkpoint Picker — simplified to inline select-like
// ============================================================================

type CheckpointPickerProps = {
  value: string;
  projectCheckpoint?: string | null;
  options: string[];
  onChange?: (value: string) => void;
};

export function CheckpointPicker({
  value,
  projectCheckpoint,
  options,
  onChange,
}: CheckpointPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen]);

  const inherited = !value && projectCheckpoint;
  const display = value || projectCheckpoint || "选择 checkpoint";

  return (
    <div className={s.cpPicker} ref={wrap}>
      <button
        type="button"
        className={s.cpPickerBtn}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className={s.cpPickerValue}>{display}</span>
        {inherited ? <span className={s.cpInheritTag}>继承项目</span> : null}
        <ChevronDown className="size-4" />
      </button>
      {isOpen ? (
        <div className={s.cpPickerMenu}>
          {projectCheckpoint ? (
            <button
              type="button"
              className={s.cpPickerOption}
              data-selected={!value}
              onClick={() => {
                onChange?.("");
                setIsOpen(false);
              }}
            >
              <span>继承项目设置</span>
              <em>{projectCheckpoint}</em>
            </button>
          ) : null}
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={s.cpPickerOption}
              data-selected={value === opt}
              onClick={() => {
                onChange?.(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Aspect ratio picker — inline chip group
// ============================================================================

const ASPECT_PRESETS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"] as const;

export function AspectChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={s.aspectChips}>
      {ASPECT_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className={cx(s.aspectChip, value === preset && s.aspectChipActive)}
          onClick={() => onChange(preset)}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Compact number input with stepper
// ============================================================================

export function StepperInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  width = 92,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: number;
}) {
  const clamp = (n: number) => {
    if (typeof min === "number" && n < min) return min;
    if (typeof max === "number" && n > max) return max;
    return n;
  };
  return (
    <div className={s.stepper} style={{ width }}>
      <button
        type="button"
        className={s.stepperBtn}
        onClick={() => onChange(clamp(value - step))}
        aria-label="减"
      >
        −
      </button>
      <span className={s.stepperValue}>
        {value}
        {suffix ? <em>{suffix}</em> : null}
      </span>
      <button
        type="button"
        className={s.stepperBtn}
        onClick={() => onChange(clamp(value + step))}
        aria-label="加"
      >
        +
      </button>
    </div>
  );
}

// ============================================================================
// Image dimensions readout — derived from aspect & short side & upscale
// ============================================================================

export function DimensionsReadout({
  aspect,
  shortSide,
  upscale,
}: {
  aspect: string;
  shortSide: number;
  upscale: number;
}) {
  const dims = useMemo(() => computeDimensions(aspect, shortSide, upscale), [aspect, shortSide, upscale]);
  return (
    <div className={s.dimReadout}>
      <span className={s.dimReadoutBase}>
        {dims.baseW} × {dims.baseH}
      </span>
      <span className={s.dimReadoutArrow}>→</span>
      <span className={s.dimReadoutFinal}>
        {dims.finalW} × {dims.finalH}
        <em>最终</em>
      </span>
    </div>
  );
}

function computeDimensions(aspect: string, shortSide: number, upscale: number) {
  const [a, b] = aspect.split(":").map((s) => parseInt(s, 10));
  if (!a || !b || !shortSide) return { baseW: 0, baseH: 0, finalW: 0, finalH: 0 };
  const r = a / b;
  let baseW: number;
  let baseH: number;
  if (r >= 1) {
    baseH = shortSide;
    baseW = Math.round(shortSide * r);
  } else {
    baseW = shortSide;
    baseH = Math.round(shortSide / r);
  }
  const factor = Math.max(1, upscale);
  return {
    baseW,
    baseH,
    finalW: Math.round(baseW * factor),
    finalH: Math.round(baseH * factor),
  };
}

// ============================================================================
// Upscale slider with chips and 1x warning
// ============================================================================

const UPSCALE_PRESETS = [1, 1.5, 2, 2.5, 3, 4];

export function UpscaleControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={s.upscaleControl}>
      <div className={s.upscaleChips}>
        {UPSCALE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={cx(s.aspectChip, value === preset && s.aspectChipActive)}
            onClick={() => onChange(preset)}
          >
            {preset}×
          </button>
        ))}
      </div>
      {value === 1 ? (
        <p className={s.upscaleWarning}>
          <AlertCircle className="size-3.5" />
          1× 模式跳过 Upscale Latent 与 KSampler 2
        </p>
      ) : null}
    </div>
  );
}

// ============================================================================
// KSampler card — denoise + seed policy added; flat by default, no collapse
// ============================================================================

export type KSamplerFull = {
  steps: number;
  cfg: number;
  sampler_name: string;
  scheduler: string;
  denoise: number;
  seedPolicy: string;
};

const SAMPLER_NAMES = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpmpp_2m",
  "dpmpp_2m_sde",
  "dpmpp_3m_sde",
];
const SCHEDULER_NAMES = ["normal", "karras", "exponential", "simple", "sgm_uniform"];
const SEED_POLICIES = ["random", "fixed", "increment"];

export function KSamplerCard({
  label,
  hint,
  params,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  params: KSamplerFull;
  disabled?: boolean;
  onChange?: (next: KSamplerFull) => void;
}) {
  const set = <K extends keyof KSamplerFull>(key: K, val: KSamplerFull[K]) => {
    if (disabled) return;
    onChange?.({ ...params, [key]: val });
  };
  return (
    <div className={cx(s.ksCard, disabled && s.ksCardDisabled)}>
      <header className={s.ksCardHead}>
        <h4>{label}</h4>
        {hint ? <span>{hint}</span> : null}
      </header>
      <div className={s.ksGrid}>
        <SpecRow label="Steps">
          <StepperInput
            value={params.steps}
            onChange={(v) => set("steps", v)}
            min={1}
            max={150}
            step={1}
          />
        </SpecRow>
        <SpecRow label="CFG">
          <StepperInput
            value={params.cfg}
            onChange={(v) => set("cfg", Math.round(v * 10) / 10)}
            min={0}
            max={30}
            step={0.5}
          />
        </SpecRow>
        <SpecRow label="Denoise">
          <StepperInput
            value={params.denoise}
            onChange={(v) => set("denoise", Math.max(0, Math.min(1, Math.round(v * 100) / 100)))}
            min={0}
            max={1}
            step={0.05}
          />
        </SpecRow>
        <SpecRow label="Sampler">
          <SelectChip
            value={params.sampler_name}
            options={SAMPLER_NAMES}
            onChange={(v) => set("sampler_name", v)}
          />
        </SpecRow>
        <SpecRow label="Scheduler">
          <SelectChip
            value={params.scheduler}
            options={SCHEDULER_NAMES}
            onChange={(v) => set("scheduler", v)}
          />
        </SpecRow>
        <SpecRow label="Seed">
          <SelectChip
            value={params.seedPolicy}
            options={SEED_POLICIES}
            onChange={(v) => set("seedPolicy", v)}
          />
        </SpecRow>
      </div>
    </div>
  );
}

export function SelectChip({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={s.selectChip} ref={wrap}>
      <button
        type="button"
        className={s.selectChipBtn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{value}</span>
        <ChevronDown className="size-3.5" />
      </button>
      {open ? (
        <div className={s.selectChipMenu}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={s.selectChipOption}
              data-selected={opt === value}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Variant Switcher — used by preset rows
// ============================================================================

type VariantSwitcherProps = {
  variants: Array<{ id: string; name: string }>;
  currentVariantId: string;
  onChange?: (variantId: string) => void;
};

export function VariantSwitcher({ variants, currentVariantId, onChange }: VariantSwitcherProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const current = variants.find((v) => v.id === currentVariantId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={s.variantSwitcher} ref={wrap}>
      <button
        type="button"
        className={s.variantSwitcherBtn}
        onClick={() => setOpen((v) => !v)}
      >
        <Wand2 className="size-3" />
        <span>{current?.name ?? "切换"}</span>
        <ChevronDown className="size-3" />
      </button>
      {open ? (
        <div className={s.variantSwitcherMenu}>
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              data-selected={variant.id === currentVariantId}
              className={s.variantSwitcherOption}
              onClick={() => {
                onChange?.(variant.id);
                setOpen(false);
              }}
            >
              {variant.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Preset binding row
// ============================================================================
