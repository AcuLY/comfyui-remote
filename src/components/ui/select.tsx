"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  className?: string;
};

export function Select({
  value,
  onChange,
  options,
  placeholder = "请选择…",
  disabled = false,
  size = "md",
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  const sizeClasses = size === "sm"
    ? "px-2 py-1 text-xs"
    : "px-3 py-2 text-sm";

  const dropdownItemClasses = size === "sm"
    ? "px-2 py-1.5 text-xs"
    : "px-3 py-2 text-sm";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] ${sizeClasses} text-left outline-none transition hover:bg-white/[0.06] focus:border-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? "border-sky-500/30" : ""
        }`}
      >
        <span className={`truncate ${selectedOption ? "text-zinc-200" : "text-zinc-500"}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className={`size-3.5 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl">
          {options.length === 0 ? (
            <div className={`${dropdownItemClasses} text-zinc-500`}>无可选项</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
                className={`flex w-full items-center gap-2 ${dropdownItemClasses} text-left transition hover:bg-white/[0.06] ${
                  opt.value === value ? "text-sky-300" : "text-zinc-300"
                }`}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {opt.value === value && <Check className="size-3 shrink-0 text-sky-400" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
