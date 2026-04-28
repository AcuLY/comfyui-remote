"use client";

import { useState } from "react";
import {
  ASPECT_RATIOS,
  resolveResolution,
  getDefaultShortSidePx,
} from "@/lib/aspect-ratio-utils";

// ---------------------------------------------------------------------------
// Aspect ratio data — derived from shared utils
// ---------------------------------------------------------------------------

type OrientationKey = "portrait" | "landscape" | "square";

type AspectRatioOption = {
  value: string;
  label: string;
  width: number;
  height: number;
  orientation: OrientationKey;
};

const ASPECT_OPTIONS: AspectRatioOption[] = Object.entries(ASPECT_RATIOS).map(
  ([key, entry]) => {
    const orientation: OrientationKey =
      entry.width === entry.height
        ? "square"
        : entry.height > entry.width
          ? "portrait"
          : "landscape";
    return {
      value: key,
      label: key,
      width: entry.width,
      height: entry.height,
      orientation,
    };
  },
);

const ORIENTATION_LABELS: Record<OrientationKey, string> = {
  portrait: "竖图",
  landscape: "横图",
  square: "方图",
};

const ORIENTATION_ORDER: OrientationKey[] = ["square", "portrait", "landscape"];

function getPreviewSize(opt: AspectRatioOption) {
  const maxDim = 28;
  const scale = maxDim / Math.max(opt.width, opt.height);
  return {
    w: Math.round(opt.width * scale),
    h: Math.round(opt.height * scale),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AspectRatioPicker({
  name,
  shortSidePxName = "shortSidePx",
  defaultValue,
  defaultShortSidePx,
  disabled,
  onChange,
  onValueChange,
}: {
  name: string;
  shortSidePxName?: string;
  defaultValue: string | null;
  defaultShortSidePx?: number | null;
  disabled?: boolean;
  /** Called when aspect ratio or short-side px changes (for auto-save) */
  onChange?: () => void;
  /** Called with the new values when they change (for controlled usage outside forms) */
  onValueChange?: (aspectRatio: string, shortSidePx: number | null) => void;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [shortSidePx, setShortSidePx] = useState<string>(
    defaultShortSidePx ? String(defaultShortSidePx) : "",
  );

  const grouped = ORIENTATION_ORDER.map((orientation) => ({
    key: orientation,
    label: ORIENTATION_LABELS[orientation],
    items: ASPECT_OPTIONS.filter((o) => o.orientation === orientation),
  }));

  // Resolved dimensions for display
  const shortPx = shortSidePx ? parseInt(shortSidePx, 10) : null;
  const resolved = selected
    ? resolveResolution(selected, shortPx && shortPx > 0 ? shortPx : null)
    : null;
  const builtinShort = selected ? getDefaultShortSidePx(selected) : null;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selected} />
      <input
        type="hidden"
        name={shortSidePxName}
        value={shortSidePx || ""}
      />

      <div className="flex flex-wrap gap-3">
        {grouped.map((group) => (
          <div key={group.key} className="space-y-1">
            <div className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
              {group.label}
            </div>
            <div className="flex gap-1">
              {group.items.map((opt) => {
                const isSelected = selected === opt.value;
                const preview = getPreviewSize(opt);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = isSelected ? "" : opt.value;
                      setSelected(next);
                      onChange?.();
                      const px = shortSidePx ? parseInt(shortSidePx, 10) : null;
                      onValueChange?.(next, px && px > 0 ? px : null);
                    }}
                    title={`${opt.label} (${opt.width}×${opt.height})`}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition ${
                      isSelected
                        ? "border border-sky-500/40 bg-sky-500/15 text-sky-300"
                        : "border border-white/5 bg-white/[0.02] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <div
                      className={`rounded-[3px] ${
                        isSelected ? "bg-sky-400/50" : "bg-zinc-600/50"
                      }`}
                      style={{ width: preview.w, height: preview.h }}
                    />
                    <span className="font-medium leading-none">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Short side px input - 始终显示 */}
      <div className="max-w-[15rem] space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="short-side-px" className="text-[11px] text-zinc-500">
            短边像素
          </label>
          {selected && resolved && (
            <div className="text-[10px] text-zinc-500">
              {resolved.width}×{resolved.height} px
            </div>
          )}
        </div>
        <input
          id="short-side-px"
          type="number"
          min={256}
          max={4096}
          step={8}
          disabled={disabled}
          value={shortSidePx}
          onChange={(e) => setShortSidePx(e.target.value)}
          onBlur={(ev) => {
            onChange?.();
            const px = ev.target.value ? parseInt(ev.target.value, 10) : null;
            onValueChange?.(selected, px && px > 0 ? px : null);
          }}
          placeholder={builtinShort ? String(builtinShort) : "1024"}
          className="input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30 disabled:opacity-70"
        />
        <div className="flex items-center gap-1">
          {[256, 512, 1024].map((value) => {
            const isActive = parseInt(shortSidePx, 10) === value;
            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setShortSidePx(String(value));
                  setTimeout(() => {
                    onChange?.();
                    onValueChange?.(selected, value);
                  }, 0);
                }}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                    : "border-white/10 bg-white/[0.03] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
