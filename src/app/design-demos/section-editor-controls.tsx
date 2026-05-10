"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type * as React from "react";
import { ChevronDown, AlertCircle } from "lucide-react";

import { FloatingSelect } from "./ui/floating-select";
import { SegmentedControl } from "./ui/segmented-control";
import s from "./styles/section-editor.module.css";
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
    <SegmentedControl
      ariaLabel="切换分区"
      items={tabs.map((tab) => ({ value: tab.value, label: tab.label, count: tab.count }))}
      onChange={onChange}
      panel
      role="tablist"
      value={value}
    />
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
        <ChevronDown className={s.iconMd} />
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
    <SegmentedControl
      ariaLabel="选择画幅比例"
      compact
      items={ASPECT_PRESETS.map((preset) => ({ value: preset, label: preset }))}
      onChange={onChange}
      value={value}
    />
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
  width = 92,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
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
      <SegmentedControl
        ariaLabel="选择放大倍率"
        compact
        items={UPSCALE_PRESETS.map((preset) => ({ value: preset, label: `${preset}×` }))}
        onChange={onChange}
        value={value}
      />
      {value === 1 ? (
        <p className={s.upscaleWarning}>
          <AlertCircle className={s.iconSm} />
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
  return (
    <FloatingSelect
      ariaLabel="Select option"
      buttonClassName={s.select}
      className={s.selectShell}
      onChange={onChange}
      options={options.map((opt) => ({ value: opt }))}
      value={value}
    />
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
  const current = variants.find((v) => v.id === currentVariantId);

  return (
    <FloatingSelect
      ariaLabel="Select variant"
      buttonClassName={s.variantSwitcherBtn}
      className={s.variantSwitcher}
      displayValue={current?.name ?? "切换"}
      menuClassName={s.variantSwitcherMenu}
      onChange={(variantId) => onChange?.(variantId)}
      optionClassName={s.variantSwitcherOption}
      options={variants.map((variant) => ({ value: variant.id, label: variant.name }))}
      value={currentVariantId}
    />
  );
}

// ============================================================================
// Preset binding row
// ============================================================================
