"use client";

import type * as React from "react";
import { ArrowLeft } from "lucide-react";

import { cx } from "../design-demo-utils";
import s from "../design-demo-styles";
import { ButtonLink } from "./button-link";

export function PageHeader({
  back,
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  back?: { href: string; label: string };
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cx(s.pageHeader, className)}>
      <div className={s.pageTitleBlock}>
        {back ? (
          <ButtonLink href={back.href} tone="subtle" icon={ArrowLeft} className={s.pageBackLink}>
            {back.label}
          </ButtonLink>
        ) : null}
        <span className={s.eyebrow}>{eyebrow}</span>
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle ? <div className={s.pageSubtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={s.toolbar}>{actions}</div> : null}
    </header>
  );
}
