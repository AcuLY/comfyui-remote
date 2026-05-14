import type { ReactNode } from "react";

import s from "./showcase-item.module.css";

export function ShowcaseItem({
  children,
  desc,
  name,
}: {
  children: ReactNode;
  desc: ReactNode;
  name: ReactNode;
}) {
  return (
    <section className={s.item}>
      <header className={s.header}>
        <strong>{name}</strong>
        <span>{desc}</span>
      </header>
      <div className={s.body}>{children}</div>
    </section>
  );
}
