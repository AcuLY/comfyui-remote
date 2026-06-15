"use client";

import type * as React from "react";
import { ArrowLeft } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
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
    <ButtonLink ariaLabel={label} href={href} tone="subtle" icon={ArrowLeft} iconOnly size="sm" className={s.pageBackLink} scroll={false}>
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
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(s.pageHeader, className)}
      data-demo-page-header
      data-demo-page-header-has-actions={actions ? "true" : undefined}
    >
      <div className={s.pageTitleBlock} data-demo-page-header-title-block>
        {back ? (
          <PageHeaderBack href={back.href} label={back.label} />
        ) : null}
        {eyebrow ? <span className={s.eyebrow}>{eyebrow}</span> : null}
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle ? <div className={s.pageSubtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={s.toolbar} data-demo-page-header-actions>{actions}</div> : null}
    </header>
  );
}
