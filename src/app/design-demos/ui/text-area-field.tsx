"use client";

import s from "./ui.module.css";
import { preventReadonlyEdit } from "./utils";

export function TextAreaField({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.textAreaField}>
      <label>{label}</label>
      <textarea
        aria-readonly="true"
        className={s.textarea}
        onBeforeInput={preventReadonlyEdit}
        onChange={() => undefined}
        onDrop={preventReadonlyEdit}
        onPaste={preventReadonlyEdit}
        value={value}
      />
    </div>
  );
}
