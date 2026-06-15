"use client";

import type * as React from "react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import s from "./segmented-control.module.css";

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
  dense = false,
  fitItems = false,
  fitItemWidth,
  className,
}: {
  items: Array<SegmentedControlItem<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  role?: "tablist" | "radiogroup";
  panel?: boolean;
  compact?: boolean;
  dense?: boolean;
  fitItems?: boolean;
  fitItemWidth?: number | string;
  className?: string;
}) {
  const style = fitItemWidth === undefined
    ? undefined
    : ({ "--segmented-fit-item-width": typeof fitItemWidth === "number" ? `${fitItemWidth}px` : fitItemWidth } as React.CSSProperties);

  return (
    <div
      aria-label={ariaLabel}
      className={cx(
        s.root,
        panel && s.panel,
        compact && s.compact,
        dense && s.dense,
        className,
      )}
      data-fit-items={fitItems ? "true" : undefined}
      data-panel={panel ? "card-header" : undefined}
      role={role}
      style={style}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            aria-checked={role === "radiogroup" ? active : undefined}
            aria-selected={role === "tablist" ? active : undefined}
            className={cx(s.item, active && s.itemActive)}
            data-demo-ui-segmented-item="true"
            data-demo-ui-segmented-item-active={active ? "true" : undefined}
            disabled={item.disabled}
            key={String(item.value)}
            onClick={() => onChange(item.value)}
            role={role === "tablist" ? "tab" : "radio"}
            type="button"
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? <span className={s.count} data-demo-ui-segmented-count="true">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
