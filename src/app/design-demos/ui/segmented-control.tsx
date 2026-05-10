"use client";

import type * as React from "react";

import { cx } from "../design-demo-utils";
import s from "./ui.module.css";

export type SegmentedControlItem<T extends string | number> = {
  value: T;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
};

export function SegmentedControl<T extends string | number>({
  items,
  value,
  onChange,
  ariaLabel,
  role = "radiogroup",
  panel = false,
  compact = false,
  className,
}: {
  items: Array<SegmentedControlItem<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  role?: "tablist" | "radiogroup";
  panel?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cx(
        s.segmentedControl,
        panel && s.segmentedControlPanel,
        compact && s.segmentedControlCompact,
        className,
      )}
      data-panel={panel ? "surface" : undefined}
      role={role}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            aria-checked={role === "radiogroup" ? active : undefined}
            aria-selected={role === "tablist" ? active : undefined}
            className={cx(s.segmentedItem, active && s.segmentedItemActive)}
            disabled={item.disabled}
            key={String(item.value)}
            onClick={() => onChange(item.value)}
            role={role === "tablist" ? "tab" : "radio"}
            type="button"
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? <span className={s.segmentedCount}>{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
