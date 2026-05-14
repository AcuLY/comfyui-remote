"use client";

import s from "./field.module.css";
import { preventReadonlyEdit } from "../shared/utils";

type FieldProps = {
  label: string;
  value: string | number;
  disabled?: boolean;
  onChange?: (value: string) => void;
};

export function Field({ label, value, disabled = false, onChange }: FieldProps) {
  const isInteractive = Boolean(onChange);

  return (
    <div className={s.root} data-demo-ui-field="true">
      <label>{label}</label>
      <input
        aria-readonly={isInteractive ? undefined : "true"}
        className={s.control}
        disabled={disabled}
        onBeforeInput={isInteractive ? undefined : preventReadonlyEdit}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        onDrop={isInteractive ? undefined : preventReadonlyEdit}
        onPaste={isInteractive ? undefined : preventReadonlyEdit}
        readOnly={!isInteractive}
        value={value}
      />
    </div>
  );
}
