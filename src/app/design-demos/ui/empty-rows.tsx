"use client";

import s from "./ui.module.css";

export function EmptyRows({ label }: { label: string }) {
  return <div className={s.empty}>{label}</div>;
}
