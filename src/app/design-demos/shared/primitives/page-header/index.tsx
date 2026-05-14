"use client";

import type * as React from "react";
import { ArrowLeft } from "lucide-react";

import { cx } from "../../../routing";
import s from "./page-header.module.css";
import { ButtonLink } from "../button";

export function PageHeaderBack({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <ButtonLink href={href} tone="subtle" icon={ArrowLeft} size="sm" className={s.pageBackLink}>
      {label}
    </ButtonLink>
  );
}

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
    <header className={cx(s.pageHeader, className)} data-demo-page-header>
      <div className={s.pageTitleBlock}>
        {back ? (
          <PageHeaderBack href={back.href} label={back.label} />
        ) : null}
        <span className={s.eyebrow}>{eyebrow}</span>
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle ? <div className={s.pageSubtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={s.toolbar}>{actions}</div> : null}
    </header>
  );
}
