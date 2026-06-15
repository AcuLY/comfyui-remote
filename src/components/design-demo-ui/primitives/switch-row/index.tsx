"use client";

import s from "./switch-row.module.css";
import { Switch } from "../switch";

export function SwitchRow({
  checked,
  defaultChecked,
  onCheckedChange,
  subtitle,
  title,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className={s.switchRow}>
      <div className={s.switchText}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <Switch ariaLabel={title} checked={checked} defaultChecked={defaultChecked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
