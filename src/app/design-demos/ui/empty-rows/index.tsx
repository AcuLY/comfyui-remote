"use client";

import s from "./empty-rows.module.css";

export function EmptyRows({ label }: { label: string }) {
  return <div className={s.empty}>{label}</div>;
}
