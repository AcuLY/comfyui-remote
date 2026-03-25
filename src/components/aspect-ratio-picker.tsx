"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Aspect ratio data — mirrors ASPECT_RATIOS in server code
// ---------------------------------------------------------------------------

type OrientationKey = "portrait" | "landscape" | "square";

type AspectRatioOption = {
  value: string;
  label: string;
  width: number;
  height: number;
  orientation: OrientationKey;
};

const ASPECT_OPTIONS: AspectRatioOption[] = [
  { value: "1:1",  label: "1:1",  width: 1024, height: 1024, orientation: "square" },
  { value: "3:4",  label: "3:4",  width: 896,  height: 1152, orientation: "portrait" },
  { value: "2:3",  label: "2:3",  width: 832,  height: 1216, orientation: "portrait" },
  { value: "9:16", label: "9:16", width: 768,  height: 1344, orientation: "portrait" },
  { value: "4:3",  label: "4:3",  width: 1152, height: 896,  orientation: "landscape" },
  { value: "3:2",  label: "3:2",  width: 1216, height: 832,  orientation: "landscape" },
  { value: "16:9", label: "16:9", width: 1344, height: 768,  orientation: "landscape" },
];

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
  defaultValue,
  disabled,
}: {
  name: string;
  defaultValue: string | null;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");

  const grouped = ORIENTATION_ORDER.map((orientation) => ({
    key: orientation,
    label: ORIENTATION_LABELS[orientation],
    items: ASPECT_OPTIONS.filter((o) => o.orientation === orientation),
  }));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selected} />

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

      {selected && (
        <div className="text-[10px] text-zinc-500">
          {ASPECT_OPTIONS.find((o) => o.value === selected)?.width}×
          {ASPECT_OPTIONS.find((o) => o.value === selected)?.height} px
        </div>
      )}
    </div>
  );
}
