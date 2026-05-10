"use client";

import s from "./ui.module.css";
import { FloatingSelect } from "./floating-select";

export function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <FloatingSelect
        ariaLabel={label}
        buttonClassName={s.select}
        className={s.selectShell}
        onChange={() => undefined}
        options={[{ value }]}
        value={value}
      />
    </div>
  );
}
