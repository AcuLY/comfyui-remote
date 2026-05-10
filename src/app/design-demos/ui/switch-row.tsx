"use client";

import s from "../design-demo-styles";
import { Switch } from "./switch";

export function SwitchRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={s.switchRow}>
      <div className={s.switchText}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <Switch ariaLabel={title} />
    </div>
  );
}
