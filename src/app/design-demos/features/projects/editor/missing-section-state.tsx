"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import s from "./missing-section-state.editor.module.css";
import { demoHref } from "../../../routing";

export function MissingSectionState() {
  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <Link href={demoHref("/projects")} className={s.pageBackLink}>
          <ChevronLeft className={s.iconMd} />
          返回项目
        </Link>
        <div className={s.pageTitleBlock}>
          <span className={s.eyebrow}>小节</span>
          <h1 className={s.pageTitle}>未找到小节</h1>
        </div>
      </div>
    </div>
  );
}
