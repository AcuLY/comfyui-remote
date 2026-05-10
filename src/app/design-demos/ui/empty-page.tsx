"use client";

import s from "./ui.module.css";
import { PageHeader } from "./page-header";

export function EmptyPage({ title }: { title: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="空状态" title={title} subtitle="当前没有可用数据。" />
      <div className={s.empty}>{title}</div>
    </div>
  );
}
