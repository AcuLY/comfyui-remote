"use client";

import s from "./select-like.module.css";
import { FloatingSelect } from "../floating-select";

export function SelectLike({
  label,
  value,
  defaultValue,
  options,
  readOnly = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  options?: string[];
  readOnly?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const fallbackValue = value ?? defaultValue ?? "";
  const selectOptions = (options?.length ? options : [fallbackValue]).map((option) => ({ value: option }));

  return (
    <div className={s.root} data-demo-ui-field="true">
      <label>{label}</label>
      <FloatingSelect
        ariaLabel={label}
        buttonClassName={s.control}
        className={s.shell}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={onChange}
        options={selectOptions}
        readOnly={readOnly}
        value={value}
      />
    </div>
  );
}
