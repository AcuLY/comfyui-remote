"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Check, Square } from "lucide-react";

import { cx } from "../../../routing";
import s from "./checkbox.module.css";

export function Checkbox({
  checked,
  className,
  disabled = false,
  label,
  onCheckedChange,
  stopPropagation = false,
  variant = "default",
}: {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  stopPropagation?: boolean;
  variant?: "default" | "compact" | "overlay";
}) {
  const Icon = checked ? Check : Square;

  function handleClick(event: MouseEvent<HTMLLabelElement>) {
    if (stopPropagation) event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLabelElement>) {
    if (stopPropagation) event.stopPropagation();
  }

  return (
    <label
      className={cx(
        s.checkbox,
        variant === "compact" && s.checkboxCompact,
        variant === "overlay" && s.checkboxOverlay,
        checked && s.checkboxChecked,
        disabled && s.checkboxDisabled,
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={label}
    >
      <input
        aria-label={label}
        checked={checked}
        className={s.checkboxInput}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" className={s.checkboxGlyph}>
        <Icon className={s.checkboxIcon} />
      </span>
    </label>
  );
}
