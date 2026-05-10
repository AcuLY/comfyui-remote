"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import type * as React from "react";
import { Activity } from "lucide-react";

import type { DemoButtonFeedback } from "../design-demo-utils";
import { cx } from "../design-demo-utils";
import s from "./ui.module.css";
import { useDemoFeedback } from "./feedback-context";
import type { ButtonTone, RouteIcon } from "./types";
import { controlLabel } from "./utils";

export function Button({
  children,
  tone = "default",
  icon: Icon,
  iconOnly = false,
  ariaLabel,
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
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
  feedback?: DemoButtonFeedback;
  className?: string;
  size?: "sm" | "md";
}) {
  const { pushToast } = useDemoFeedback();
  const label = iconOnly ? controlLabel(children, ariaLabel) : undefined;

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
      onClick={handleClick}
      aria-label={iconOnly ? label : undefined}
      aria-pressed={pressed}
      aria-busy={pending || undefined}
      title={iconOnly ? label : undefined}
      disabled={disabled || pending}
      className={cx(
        s.button,
        size === "sm" && s.buttonSmall,
        tone === "subtle" && s.buttonSubtle,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
        pending && s.buttonPending,
        iconOnly && s.buttonIconOnly,
        className,
      )}
    >
      {pending ? <Activity className={cx(s.buttonIcon, s.buttonSpinner)} /> : Icon ? <Icon className={s.buttonIcon} /> : null}
      {iconOnly ? null : children}
    </button>
  );
}
