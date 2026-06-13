"use client";

import Link from "next/link";
import type { MouseEvent as ReactMouseEvent } from "react";
import type * as React from "react";
import { Activity } from "lucide-react";

import type { DemoButtonFeedback } from "../../../routing";
import { cx, demoHref } from "../../../routing";
import { useDemoFeedback } from "../../feedback/context";
import type { ButtonTone, RouteIcon } from "../shared/types";
import { controlLabel } from "../shared/utils";
import s from "./button.module.css";

function buttonClassName({ tone, pending, iconOnly, size, className }: { tone: ButtonTone; pending?: boolean; iconOnly?: boolean; size: "sm" | "md"; className?: string }) {
  return cx(
    s.root,
    size === "sm" && s.small,
    tone === "subtle" && s.subtle,
    tone === "primary" && s.primary,
    tone === "pink" && s.pink,
    tone === "danger" && s.danger,
    pending && s.pending,
    iconOnly && s.iconOnly,
    className,
  );
}

export function Button({
  children,
  tone = "default",
  icon: Icon,
  iconOnly = false,
  ariaLabel,
  ariaControls,
  ariaCurrent,
  ariaExpanded,
  ariaHasPopup,
  onClick,
  pressed,
  pending = false,
  disabled = false,
  feedback,
  className,
  size = "md",
}: {
  children?: React.ReactNode;
  tone?: ButtonTone;
  icon?: RouteIcon;
  iconOnly?: boolean;
  ariaLabel?: string;
  ariaControls?: string;
  ariaCurrent?: React.AriaAttributes["aria-current"];
  ariaExpanded?: boolean;
  ariaHasPopup?: React.AriaAttributes["aria-haspopup"];
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
  feedback?: DemoButtonFeedback;
  className?: string;
  size?: "sm" | "md";
}) {
  const { pushToast } = useDemoFeedback();
  const label = iconOnly ? controlLabel(children, ariaLabel) : ariaLabel;

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (disabled || pending) return;
    onClick?.(event);
    if (feedback) {
      if (typeof feedback === "string") {
        pushToast({ tone: "success", title: feedback });
      } else {
        pushToast({ tone: feedback.tone ?? "success", title: feedback.title, detail: feedback.detail });
      }
    }
  }

  return (
    <button
      type="button"
      data-demo-ui-button="true"
      data-demo-ui-button-icon-only={iconOnly ? "true" : undefined}
      data-demo-ui-button-size={size}
      data-demo-ui-button-tone={tone}
      onClick={handleClick}
      aria-controls={ariaControls}
      aria-current={ariaCurrent}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-label={label}
      aria-pressed={pressed}
      aria-busy={pending || undefined}
      title={iconOnly ? label : undefined}
      disabled={disabled || pending}
      className={buttonClassName({ tone, pending, iconOnly, size, className })}
    >
      {pending ? <Activity className={cx(s.icon, s.spinner)} data-demo-ui-button-icon="true" aria-hidden="true" /> : Icon ? <Icon className={s.icon} data-demo-ui-button-icon="true" aria-hidden="true" /> : null}
      {iconOnly ? null : <span data-demo-ui-button-label="true">{children}</span>}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  tone = "default",
  icon: Icon,
  iconOnly = false,
  ariaLabel,
  className,
  size = "md",
  scroll,
}: {
  href: string;
  children?: React.ReactNode;
  tone?: ButtonTone;
  icon?: RouteIcon;
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
  scroll?: boolean;
}) {
  const label = controlLabel(children, ariaLabel);

  return (
    <Link
      href={demoHref(href)}
      scroll={scroll}
      data-demo-ui-button="true"
      data-demo-ui-button-icon-only={iconOnly ? "true" : undefined}
      data-demo-ui-button-size={size}
      data-demo-ui-button-tone={tone}
      aria-label={ariaLabel ?? (iconOnly ? label : undefined)}
      title={iconOnly ? label : undefined}
      className={buttonClassName({ tone, iconOnly, size, className })}
    >
      {Icon ? <Icon className={s.icon} data-demo-ui-button-icon="true" aria-hidden="true" /> : null}
      {iconOnly ? null : <span data-demo-ui-button-label="true">{children}</span>}
    </Link>
  );
}
