"use client";

import s from "../design-demo-styles";

export function EmptyRows({ label }: { label: string }) {
  return <div className={s.empty}>{label}</div>;
}
