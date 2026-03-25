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

const ORIENTATION_ORDER: OrientationKey[] = ["portrait", "square", "landscape"];

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
}: {
  name: string;
  shortSidePxName?: string;
  defaultValue: string | null;
  defaultShortSidePx?: number | null;
  disabled?: boolean;
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
                    onClick={() => setSelected(isSelected ? "" : opt.value)}
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

      {/* Short side px input */}
      {selected && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            短边像素
            <input
              type="number"
              min={256}
              max={4096}
              step={8}
              disabled={disabled}
              value={shortSidePx}
              onChange={(e) => setShortSidePx(e.target.value)}
              placeholder={builtinShort ? String(builtinShort) : "默认"}
              className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30 disabled:opacity-70"
            />
          </label>
          <div className="text-[10px] text-zinc-500">
            {resolved
              ? `→ ${resolved.width}×${resolved.height} px`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}
