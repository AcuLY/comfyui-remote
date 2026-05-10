"use client";

import { cx } from "../design-demo-utils";
import s from "./ui.module.css";
import { statusLabel, statusTone } from "./utils";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cx(s.status, statusTone(status))}>{label ?? statusLabel(status)}</span>;
}
