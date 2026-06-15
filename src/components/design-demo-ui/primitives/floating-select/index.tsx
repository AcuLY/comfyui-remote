"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cx } from "@/app/design-demos/routing";
import s from "./floating-select.module.css";

export type FloatingSelectOption = {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
};

type FloatingSelectProps = {
  value?: string;
  defaultValue?: string;
  label?: string;
  options?: Array<FloatingSelectOption | string>;
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
  readOnly?: boolean;
};

export function FloatingSelect({
  value,
  defaultValue,
  label,
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
  disabled = false,
  readOnly = false,
}: FloatingSelectProps) {
  const baseId = useId();
  const buttonId = `${baseId}-button`;
  const listboxId = `${baseId}-listbox`;
  const fallbackValue = value ?? defaultValue ?? "";
  const normalizedOptions = normalizeFloatingSelectOptions(options?.length ? options : [fallbackValue]);
  const resolvedValue = value ?? defaultValue ?? normalizedOptions[0]?.value ?? "";
  const [selectedValueState, setSelectedValueState] = useState(() => ({
    sourceValue: resolvedValue,
    selectedValue: resolvedValue,
  }));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isReadOnly = readOnly;
  const isControlled = value !== undefined && onChange !== undefined;
  const optionId = useCallback((optionValue: string) => (
    `${baseId}-option-${optionValue.replace(/[^a-zA-Z0-9_-]/g, "-")}`
  ), [baseId]);
  const selectedValue = isControlled
    ? resolvedValue
    : selectedValueState.sourceValue === resolvedValue
      ? selectedValueState.selectedValue
      : resolvedValue;
  const selected = normalizedOptions.find((option) => option.value === selectedValue) ?? normalizedOptions[0];
  const selectedIndex = Math.max(0, normalizedOptions.findIndex((option) => option.value === selected?.value));
  const activeOption = normalizedOptions[activeIndex] ?? selected ?? normalizedOptions[0];
  const activeOptionId = activeOption ? optionId(activeOption.value) : undefined;

  useEffect(() => {
    setSelectedValueState((current) => (
      current.sourceValue === resolvedValue
        ? current
        : { sourceValue: resolvedValue, selectedValue: resolvedValue }
    ));
  }, [resolvedValue]);

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

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
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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

  function openMenu(nextActiveIndex = selectedIndex) {
    if (disabled || isReadOnly || normalizedOptions.length === 0) return;
    setActiveIndex(nextActiveIndex);
    setOpen(true);
  }

  function commitValue(nextValue: string) {
    if (disabled || isReadOnly) return;
    onChange?.(nextValue);
    if (!isControlled) setSelectedValue(nextValue);
    setOpen(false);
  }

  function setSelectedValue(nextValue: string) {
    setSelectedValueState({ sourceValue: resolvedValue, selectedValue: nextValue });
  }

  function moveActive(delta: number) {
    if (normalizedOptions.length === 0) return;
    setActiveIndex((current) => (current + delta + normalizedOptions.length) % normalizedOptions.length);
  }

  function handleButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (open && activeOption) {
          commitValue(activeOption.value);
          return;
        }
        openMenu(selectedIndex);
        return;
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          openMenu(selectedIndex);
          return;
        }
        moveActive(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          openMenu(selectedIndex);
          return;
        }
        moveActive(-1);
        return;
      case "Escape":
        if (!open) return;
        event.preventDefault();
        setOpen(false);
        return;
      case "Home":
        event.preventDefault();
        openMenu(0);
        return;
      case "End":
        event.preventDefault();
        openMenu(Math.max(0, normalizedOptions.length - 1));
        return;
    }
  }

  const portalTarget = open && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>("[data-app-shell]") ?? document.body
    : null;

  return (
    <div className={cx(s.floatingSelect, label && s.fieldRoot, className)} data-demo-ui-field={label ? "true" : undefined} ref={wrapRef}>
      {label ? <label htmlFor={buttonId}>{label}</label> : null}
      <button
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-controls={listboxId}
        aria-disabled={disabled ? "true" : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel ?? label}
        aria-readonly={isReadOnly ? "true" : undefined}
        className={cx(s.floatingSelectBtn, label && s.fieldButton, buttonClassName)}
        disabled={disabled}
        id={buttonId}
        onClick={() => {
          if (isReadOnly) return;
          setOpen((current) => {
            if (current) return false;
            if (normalizedOptions.length === 0) return false;
            setActiveIndex(selectedIndex);
            return true;
          });
        }}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        role="combobox"
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
          id={listboxId}
          ref={menuRef}
          role="listbox"
          style={menuStyle}
        >
          {normalizedOptions.map((option) => (
            <button
              aria-selected={option.value === selectedValue}
              className={cx(s.floatingSelectOption, optionClassName)}
              data-selected={option.value === selectedValue}
              id={optionId(option.value)}
              key={option.value}
              onClick={() => commitValue(option.value)}
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

function normalizeFloatingSelectOptions(options: Array<FloatingSelectOption | string>): FloatingSelectOption[] {
  return options.map((option) => (typeof option === "string" ? { value: option } : option));
}
