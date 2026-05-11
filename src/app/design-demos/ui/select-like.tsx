"use client";

import s from "./ui.module.css";
import { FloatingSelect } from "./floating-select";

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
    <div className={s.field}>
      <label>{label}</label>
      <FloatingSelect
        ariaLabel={label}
        buttonClassName={s.select}
        className={s.selectShell}
        onChange={onChange}
        options={selectOptions}
        value={value}
      />
    </div>
  );
}
