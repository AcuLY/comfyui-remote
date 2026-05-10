"use client";

import Link from "next/link";
import type * as React from "react";

import { cx, demoHref } from "../design-demo-utils";
import s from "./ui.module.css";
import type { ButtonTone, RouteIcon } from "./types";
import { controlLabel } from "./utils";

export function ButtonLink({
  href,
  children,
  tone = "default",
  icon: Icon,
  iconOnly = false,
  ariaLabel,
  className,
  size = "md",
}: {
  href: string;
  children?: React.ReactNode;
  tone?: ButtonTone;
  icon?: RouteIcon;
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const label = iconOnly ? controlLabel(children, ariaLabel) : undefined;

  return (
    <Link
      href={demoHref(href)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cx(
        s.button,
        size === "sm" && s.buttonSmall,
        tone === "subtle" && s.buttonSubtle,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
        iconOnly && s.buttonIconOnly,
        className,
      )}
    >
      {Icon ? <Icon className={s.buttonIcon} /> : null}
      {iconOnly ? null : children}
    </Link>
  );
}
