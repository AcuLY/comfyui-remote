"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cx } from "../../design-demo-utils";
import s from "./floating-select.module.css";

export type FloatingSelectOption = {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
};

export function FloatingSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
  menuClassName,
  optionClassName,
  valueClassName,
  displayValue,
  leadingIcon,
  endSlot,
  disabled,
}: {
  value: string;
  options: FloatingSelectOption[];
  onChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  valueClassName?: string;
  displayValue?: ReactNode;
  leadingIcon?: ReactNode;
  endSlot?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;
    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.max(rect.width, 160);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    const maxHeight = Math.max(160, window.innerHeight - rect.bottom - viewportPadding - 6);
    setMenuStyle({
      left,
      maxHeight,
      top: rect.bottom + 4,
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const portalTarget = open && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>("[data-design-demo-shell]") ?? document.body
    : null;

  return (
    <div className={cx(s.floatingSelect, className)} ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cx(s.floatingSelectBtn, buttonClassName)}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        {leadingIcon}
        <span className={cx(s.floatingSelectValue, valueClassName)}>
          {displayValue ?? selected?.label ?? selected?.value ?? value}
        </span>
        {endSlot}
        <ChevronDown aria-hidden="true" />
      </button>
      {open && portalTarget ? createPortal(
        <div
          className={cx(s.floatingSelectMenu, menuClassName)}
          ref={menuRef}
          role="listbox"
          style={menuStyle}
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={cx(s.floatingSelectOption, optionClassName)}
              data-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <span>{option.label ?? option.value}</span>
              {option.description ? <em>{option.description}</em> : null}
            </button>
          ))}
        </div>,
        portalTarget,
      ) : null}
    </div>
  );
}
