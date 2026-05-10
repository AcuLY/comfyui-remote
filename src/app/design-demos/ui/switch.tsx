"use client";

import { useState } from "react";

import s from "../design-demo-styles";

export function Switch({
  checked,
  defaultChecked = true,
  ariaLabel = "切换开关",
  onCheckedChange,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  ariaLabel?: string;
  onCheckedChange?: (checked: boolean) => void;
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
      className={s.switch}
      data-state={isChecked ? "checked" : "unchecked"}
      onClick={toggleSwitch}
      role="switch"
      type="button"
    >
      <span className={s.switchThumb} aria-hidden="true" />
    </button>
  );
}
