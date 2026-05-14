"use client";

import s from "./field.module.css";
import { preventReadonlyEdit } from "../shared/utils";

export function Field({ label, value, disabled = false }: { label: string; value: string | number; disabled?: boolean }) {
  return (
    <div className={s.root} data-demo-ui-field="true">
      <label>{label}</label>
      <input
        aria-readonly="true"
        className={s.control}
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
