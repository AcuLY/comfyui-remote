import type { ReactNode } from "react";

import s from "./showcase-item.showcase.module.css";

export function ShowcaseItem({ name, desc, children }: {
  name: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className={s.showcaseItem}>
      <div className={s.showcaseItemHeader}>
        <span className={s.showcaseItemName}>{name}</span>
        <span className={s.showcaseItemDesc}>{desc}</span>
      </div>
      <div className={s.showcaseItemBody}>{children}</div>
    </div>
  );
}
