"use client";

import { cn } from "./utils";

type ToggleItem = {
  label: string;
  value: string;
};

export function ShadcnDemoToggleGroup({
  className,
  items,
  onValueChange,
  value,
}: {
  className?: string;
  items: ToggleItem[];
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className={cn("demoShadcnToggleGroup flex flex-wrap items-center gap-1", className)} role="group">
      {items.map((item) => (
        <button
          aria-pressed={item.value === value}
          className="demoShadcnToggleItem inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
          data-state={item.value === value ? "on" : "off"}
          key={item.value}
          onClick={() => onValueChange(item.value)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
