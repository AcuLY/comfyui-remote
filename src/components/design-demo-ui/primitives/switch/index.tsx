"use client";

import { useState } from "react";

import { cx } from "@/app/design-demos/routing";
import s from "./switch.module.css";

export function Switch({
  checked,
  defaultChecked = true,
  ariaLabel = "切换开关",
  className,
  onCheckedChange,
  size = "md",
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  ariaLabel?: string;
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
  size?: "sm" | "md";
}) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isChecked = checked ?? internalChecked;

  function toggleSwitch() {
    const next = !isChecked;
    if (checked === undefined) setInternalChecked(next);
    onCheckedChange?.(next);
  }

  return (
    <button
      aria-label={ariaLabel}
      aria-checked={isChecked}
      className={cx(s.root, className)}
      data-size={size}
      data-state={isChecked ? "checked" : "unchecked"}
      onClick={toggleSwitch}
      role="switch"
      type="button"
    >
      <span className={s.track} aria-hidden="true">
        <span data-demo-ui-switch-thumb="true" className={s.thumb} />
      </span>
    </button>
  );
}
