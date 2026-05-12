"use client";

import type * as React from "react";

import s from "./panel.module.css";

export function Panel({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHeader}>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className={s.inlineControls}>{actions}</div> : null}
      </div>
      <div className={s.panelBody}>{children}</div>
    </section>
  );
}
