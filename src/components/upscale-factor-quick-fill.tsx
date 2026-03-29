"use client";

import { X } from "lucide-react";

const QUICK_VALUES = [1, 1.5, 2, 2.5, 3];

type UpscaleFactorQuickFillProps = {
  onSelect: (value: number) => void;
  disabled?: boolean;
  currentValue?: number | null;
  size?: "sm" | "md";
  showClear?: boolean;
  onClear?: () => void;
};

export function UpscaleFactorQuickFill({
  onSelect,
  disabled,
  currentValue,
  size = "md",
  showClear,
  onClear,
}: UpscaleFactorQuickFillProps) {
  const sizeClasses =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px] rounded-md"
      : "px-2 py-1 text-xs rounded-lg";

  const iconSize = size === "sm" ? "size-2.5" : "size-3";

  return (
    <div className="flex items-center gap-1">
      {QUICK_VALUES.map((val) => {
        const isActive = currentValue === val;
        return (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(val)}
            className={`${sizeClasses} border transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                : "border-white/10 bg-white/[0.03] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
            }`}
          >
            {val === 1 ? "1×" : `${val}×`}
          </button>
        );
      })}
      {showClear && onClear && (
        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          title="清空"
          className={`${sizeClasses} border border-white/10 bg-white/[0.03] text-zinc-500 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <X className={iconSize} />
        </button>
      )}
    </div>
  );
}
