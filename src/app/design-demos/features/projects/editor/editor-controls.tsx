"use client";

import { useState, useRef, useMemo } from "react";
import type * as React from "react";
import { AlertCircle } from "lucide-react";

import { FloatingSelect } from "../../../shared/primitives/floating-select";
import { SegmentedControl } from "../../../shared/primitives/segmented-control";
import s from "./editor-controls.module.css";
import { cx } from "../../../routing";
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
  const inherited = !value && projectCheckpoint;
  const display = value || projectCheckpoint || "选择 checkpoint";
  const checkpointOptions = [
    ...(projectCheckpoint
      ? [{ value: "", label: "继承项目设置", description: projectCheckpoint }]
      : []),
    ...options.map((opt) => ({ value: opt })),
  ];

  return (
    <FloatingSelect
      ariaLabel="选择 checkpoint"
      buttonClassName={s.select}
      className={s.cpPicker}
      displayValue={display}
      endSlot={inherited ? <span className={s.cpInheritTag}>继承项目</span> : null}
      onChange={(next) => onChange?.(next)}
      options={checkpointOptions}
      value={value}
      valueClassName={s.cpPickerValue}
    />
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
      dense
      items={ASPECT_PRESETS.map((preset) => ({ value: preset, label: preset }))}
      onChange={onChange}
      value={value}
    />
  );
}

// ============================================================================
// Compact number input with stepper
// ============================================================================

function normalizeStepOptions(options: number[] | undefined, fallback: number) {
  const normalized = (options?.length ? options : [fallback])
    .map((option) => Math.abs(option))
    .filter((option) => Number.isFinite(option) && option > 0);

  return normalized.length ? normalized : [1];
}

function countDecimals(value: number) {
  const text = `${value}`;
  if (!text.includes("e")) {
    return text.includes(".") ? text.split(".")[1]?.length ?? 0 : 0;
  }

  const [base, exponent] = text.split("e-");
  return (base.split(".")[1]?.length ?? 0) + Number(exponent ?? 0);
}

function compactNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  return `${Number.parseFloat(value.toFixed(8))}`;
}

function isPartialNumber(value: string) {
  return value === "" || value === "-" || value === "+" || value === "." || value === "-." || value === "+.";
}

export function StepperInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  width,
  decrementSteps,
  incrementSteps,
  ariaLabel = "数值",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  decrementSteps?: number[];
  incrementSteps?: number[];
  ariaLabel?: string;
}) {
  const decrementOptions = normalizeStepOptions(decrementSteps, step);
  const incrementOptions = normalizeStepOptions(incrementSteps, step);
  const controlCount = decrementOptions.length + incrementOptions.length;
  const isMultiStep = controlCount > 2;
  const precision = Math.min(
    8,
    Math.max(
      countDecimals(value),
      countDecimals(step),
      ...decrementOptions.map(countDecimals),
      ...incrementOptions.map(countDecimals),
    ),
  );
  const [draftValue, setDraftValue] = useState(() => compactNumber(value));
  const [isEditing, setIsEditing] = useState(false);
  const skipCommitRef = useRef(false);

  const clamp = (n: number) => {
    if (typeof min === "number" && n < min) return min;
    if (typeof max === "number" && n > max) return max;
    return n;
  };
  const normalizeValue = (n: number) => Number.parseFloat(clamp(n).toFixed(precision));
  const displayDelta = (delta: number) => compactNumber(Math.abs(delta));
  const controlLabel = (delta: number) => {
    const sign = delta < 0 ? "−" : "+";
    return isMultiStep ? `${sign}${displayDelta(delta)}` : sign;
  };
  const applyDelta = (delta: number) => {
    const nextValue = normalizeValue(value + delta);
    onChange(nextValue);
    if (isEditing) setDraftValue(compactNumber(nextValue));
  };
  const commitDraft = (inputValue: string) => {
    if (isPartialNumber(inputValue)) {
      setDraftValue(compactNumber(value));
      return;
    }

    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed)) {
      setDraftValue(compactNumber(value));
      return;
    }

    const nextValue = clamp(parsed);
    onChange(nextValue);
    setDraftValue(compactNumber(nextValue));
  };
  const inputValue = isEditing ? draftValue : compactNumber(value);

  return (
    <div
      className={s.stepper}
      data-stepper-multistep={isMultiStep ? "true" : undefined}
      style={typeof width === "number" ? { minWidth: width } : undefined}
    >
      <div className={s.stepperControls}>
        {decrementOptions.map((option, index) => (
          <button
            key={`decrement-${option}-${index}`}
            type="button"
            className={s.stepperBtn}
            data-stepper-direction="decrement"
            onClick={() => applyDelta(-option)}
            aria-label={`减少 ${displayDelta(option)}`}
          >
            {controlLabel(-option)}
          </button>
        ))}
      </div>
      <input
        aria-label={ariaLabel}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={Number.isFinite(value) ? value : undefined}
        className={s.stepperInput}
        inputMode={precision > 0 ? "decimal" : "numeric"}
        onBlur={(event) => {
          if (skipCommitRef.current) {
            skipCommitRef.current = false;
            setIsEditing(false);
            setDraftValue(compactNumber(value));
            return;
          }
          setIsEditing(false);
          commitDraft(event.currentTarget.value);
        }}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          setDraftValue(nextDraft);
          if (isPartialNumber(nextDraft)) return;

          const parsed = Number(nextDraft);
          if (Number.isFinite(parsed)) onChange(clamp(parsed));
        }}
        onFocus={() => {
          setDraftValue(compactNumber(value));
          setIsEditing(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            applyDelta(-step);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            applyDelta(step);
          }
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            skipCommitRef.current = true;
            setDraftValue(compactNumber(value));
            event.currentTarget.blur();
          }
        }}
        role="spinbutton"
        type="text"
        value={inputValue}
      />
      <div className={s.stepperControls}>
        {incrementOptions.map((option, index) => (
          <button
            key={`increment-${option}-${index}`}
            type="button"
            className={s.stepperBtn}
            data-stepper-direction="increment"
            onClick={() => applyDelta(option)}
            aria-label={`增加 ${displayDelta(option)}`}
          >
            {controlLabel(option)}
          </button>
        ))}
      </div>
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
        dense
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

export function ImageSizeControlGroup({
  aspectRatio,
  onAspectRatioChange,
  onShortSideChange,
  onUpscaleChange,
  shortSidePx,
  upscaleFactor,
}: {
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  onShortSideChange: (value: number) => void;
  onUpscaleChange: (value: number) => void;
  shortSidePx: number;
  upscaleFactor: number;
}) {
  return (
    <SpecSection title="图像输出" hint="决定最终画幅尺寸与批量数。">
      <SpecRow label="画幅比例">
        <AspectChips value={aspectRatio} onChange={onAspectRatioChange} />
      </SpecRow>
      <SpecRow label="短边像素" description="小于最终像素维度的一侧">
        <StepperInput
          value={shortSidePx}
          onChange={onShortSideChange}
          min={256}
          max={2048}
          step={64}
          width={130}
        />
        <DimensionsReadout aspect={aspectRatio} shortSide={shortSidePx} upscale={upscaleFactor} />
      </SpecRow>
      <SpecRow label="放大倍数">
        <UpscaleControl value={upscaleFactor} onChange={onUpscaleChange} />
      </SpecRow>
    </SpecSection>
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
  ariaLabel = "Select option",
  displayValue,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  ariaLabel?: string;
  displayValue?: React.ReactNode;
}) {
  return (
    <FloatingSelect
      ariaLabel={ariaLabel}
      buttonClassName={s.select}
      className={s.selectShell}
      displayValue={displayValue}
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
