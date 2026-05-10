"use client";

import { useState } from "react";

import { cx } from "../design-demo-utils";
import s from "./ui.module.css";

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
      className={cx(s.switch, className)}
      data-size={size}
      data-state={isChecked ? "checked" : "unchecked"}
      onClick={toggleSwitch}
      role="switch"
      type="button"
    >
      <span className={s.switchTrack} aria-hidden="true">
        <span className={s.switchThumb} />
      </span>
    </button>
  );
}
