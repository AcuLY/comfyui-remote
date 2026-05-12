"use client";

import s from "./text-area-field.module.css";
import { preventReadonlyEdit } from "../_shared/utils";

export function TextAreaField({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.root} data-demo-ui-field="true">
      <label>{label}</label>
      <textarea
        aria-readonly="true"
        className={s.control}
        onBeforeInput={preventReadonlyEdit}
        onChange={() => undefined}
        onDrop={preventReadonlyEdit}
        onPaste={preventReadonlyEdit}
        value={value}
      />
    </div>
  );
}
