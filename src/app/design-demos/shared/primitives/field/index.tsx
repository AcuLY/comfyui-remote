"use client";

import { useEffect, useState } from "react";

import s from "./field.module.css";
import { preventReadonlyEdit } from "../shared/utils";

type FieldProps = {
  label: string;
  value?: string | number;
  defaultValue?: string | number;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
};

export function Field({ label, value, defaultValue, disabled = false, readOnly = false, onChange }: FieldProps) {
  const resolvedValue = stringifyFieldValue(value ?? defaultValue ?? "");
  const [fieldValue, setFieldValue] = useState(() => ({
    sourceValue: resolvedValue,
    draftValue: resolvedValue,
  }));
  const isReadOnly = readOnly;
  const isControlled = value !== undefined && onChange !== undefined;

  useEffect(() => {
    setFieldValue((current) => (
      current.sourceValue === resolvedValue
        ? current
        : { sourceValue: resolvedValue, draftValue: resolvedValue }
    ));
  }, [resolvedValue]);

  const displayValue = isControlled
    ? resolvedValue
    : fieldValue.sourceValue === resolvedValue
      ? fieldValue.draftValue
      : resolvedValue;

  function updateValue(nextValue: string) {
    if (isReadOnly || disabled) return;
    onChange?.(nextValue);
    if (isControlled) return;

    setFieldValue({ sourceValue: resolvedValue, draftValue: nextValue });
  }

  return (
    <div className={s.root} data-demo-ui-field="true">
      <label>{label}</label>
      <input
        aria-readonly={isReadOnly ? "true" : undefined}
        className={s.control}
        disabled={disabled}
        onBeforeInput={isReadOnly ? preventReadonlyEdit : undefined}
        onChange={(event) => updateValue(event.currentTarget.value)}
        onDrop={isReadOnly ? preventReadonlyEdit : undefined}
        onPaste={isReadOnly ? preventReadonlyEdit : undefined}
        readOnly={isReadOnly}
        value={displayValue}
      />
    </div>
  );
}

function stringifyFieldValue(value: string | number) {
  return String(value);
}
