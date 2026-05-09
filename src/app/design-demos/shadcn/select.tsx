"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "./utils";

type SelectOption = {
  label: string;
  value: string;
};

export function ShadcnDemoSelect({
  className,
  disabled = false,
  onValueChange,
  options,
  placeholder = "请选择",
  value,
}: {
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    function close(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  return (
    <div className={cn("demoShadcnSelect relative", className)} ref={ref}>
      <button
        aria-expanded={open}
        className="demoShadcnSelectTrigger flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={cn("truncate", !selected && "opacity-70")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="demoShadcnSelectContent absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-md">
          {options.map((option) => (
            <button
              className="demoShadcnSelectItem relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none"
              data-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
              type="button"
            >
              <span className="absolute left-2 flex size-3.5 items-center justify-center">
                {option.value === value ? <Check /> : null}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
