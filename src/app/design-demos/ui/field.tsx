"use client";

import s from "../design-demo-styles";
import { preventReadonlyEdit } from "./utils";

export function Field({ label, value, disabled = false }: { label: string; value: string | number; disabled?: boolean }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <input
        aria-readonly="true"
        className={s.input}
        disabled={disabled}
        onBeforeInput={preventReadonlyEdit}
        onChange={() => undefined}
        onDrop={preventReadonlyEdit}
        onPaste={preventReadonlyEdit}
        value={value}
      />
    </div>
  );
}
