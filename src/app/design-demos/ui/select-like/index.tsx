"use client";

import s from "./select-like.module.css";
import { FloatingSelect } from "../floating-select";

export function SelectLike({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options?: string[];
  onChange?: (value: string) => void;
}) {
  const selectOptions = (options?.length ? options : [value]).map((option) => ({ value: option }));

  return (
    <div className={s.root} data-demo-ui-field="true">
      <label>{label}</label>
      <FloatingSelect
        ariaLabel={label}
        buttonClassName={s.control}
        className={s.shell}
        onChange={onChange}
        options={selectOptions}
        value={value}
      />
    </div>
  );
}
