import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { HardNavigationLink } from "@/components/hard-navigation-link";
import { cn } from "@/lib/utils";

type NeighborNavigationDataAttributes = Record<`data-${string}`, string | number | boolean | undefined>;

export type NeighborNavigationLinkRenderProps = {
  direction: "previous" | "next";
  href: string;
  title?: string;
  ariaLabel?: string;
  className: string;
  dataAttributes?: NeighborNavigationDataAttributes;
  children: ReactNode;
};

type NeighborNavigationControlProps = {
  direction: "previous" | "next";
  href?: string | null;
  onClick?: () => void;
  onNavigate?: (href: string, direction: "previous" | "next") => void;
  renderLink?: (props: NeighborNavigationLinkRenderProps) => ReactNode;
  hardNavigation?: boolean;
  label?: ReactNode;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  disabledClassName?: string;
  iconClassName?: string;
  dataAttributes?: NeighborNavigationDataAttributes;
};

export type NeighborNavigationProps = {
  previousHref?: string | null;
  nextHref?: string | null;
  previousOnClick?: () => void;
  nextOnClick?: () => void;
  onNavigate?: (href: string, direction: "previous" | "next") => void;
  renderLink?: (props: NeighborNavigationLinkRenderProps) => ReactNode;
  hardNavigation?: boolean;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  previousTitle?: string;
  nextTitle?: string;
  previousAriaLabel?: string;
  nextAriaLabel?: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  previousDataAttributes?: NeighborNavigationDataAttributes;
  nextDataAttributes?: NeighborNavigationDataAttributes;
  positionText?: ReactNode;
  className?: string;
  controlClassName?: string;
  disabledControlClassName?: string;
  iconClassName?: string;
};

const defaultControlClassName =
  "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white";
const defaultDisabledControlClassName =
  "inline-flex items-center gap-1 rounded-lg border border-white/5 px-2 py-1 text-xs text-zinc-600";

function NeighborNavigationControl({
  direction,
  href,
  onClick,
  onNavigate,
  renderLink,
  hardNavigation,
  label,
  title,
  ariaLabel,
  disabled,
  className,
  disabledClassName,
  iconClassName,
  dataAttributes,
}: NeighborNavigationControlProps) {
  const icon = direction === "previous"
    ? <ChevronLeft className={cn("size-3", iconClassName)} />
    : <ChevronRight className={cn("size-3", iconClassName)} />;
  const content = direction === "previous" ? (
    <>
      {icon}
      {label ? <span className="truncate">{label}</span> : null}
    </>
  ) : (
    <>
      {label ? <span className="truncate">{label}</span> : null}
      {icon}
    </>
  );

  if (disabled || (!href && !onClick)) {
    return (
      <span
        aria-disabled="true"
        aria-label={ariaLabel}
        title={title}
        {...dataAttributes}
        className={cn(defaultDisabledControlClassName, disabledClassName)}
      >
        {content}
      </span>
    );
  }

  if (href) {
    const resolvedClassName = cn(defaultControlClassName, className);

    if (renderLink) {
      return renderLink({
        direction,
        href,
        title,
        ariaLabel,
        className: resolvedClassName,
        dataAttributes,
        children: content,
      });
    }

    function handleNavigate(event: MouseEvent<HTMLAnchorElement>) {
      if (
        !href ||
        !onNavigate ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      onNavigate(href, direction);
    }

    const navigateProps = onNavigate ? { onClick: handleNavigate } : {};

    const NavigationLink = hardNavigation ? HardNavigationLink : Link;

    return (
      <NavigationLink
        href={href}
        title={title}
        aria-label={ariaLabel}
        className={resolvedClassName}
        {...dataAttributes}
        {...navigateProps}
      >
        {content}
      </NavigationLink>
    );
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(defaultControlClassName, className)}
      {...dataAttributes}
    >
      {content}
    </button>
  );
}

export function NeighborNavigation({
  previousHref,
  nextHref,
  previousOnClick,
  nextOnClick,
  onNavigate,
  renderLink,
  hardNavigation = false,
  previousLabel = "上一项",
  nextLabel = "下一项",
  previousTitle,
  nextTitle,
  previousAriaLabel,
  nextAriaLabel,
  previousDisabled = false,
  nextDisabled = false,
  previousDataAttributes,
  nextDataAttributes,
  positionText,
  className,
  controlClassName,
  disabledControlClassName,
  iconClassName,
}: NeighborNavigationProps) {
  return (
    <nav aria-label="Neighbor navigation" className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <NeighborNavigationControl
        direction="previous"
        href={previousHref}
        onClick={previousOnClick}
        onNavigate={onNavigate}
        renderLink={renderLink}
        hardNavigation={hardNavigation}
        label={previousLabel}
        title={previousTitle}
        ariaLabel={previousAriaLabel}
        disabled={previousDisabled}
        className={controlClassName}
        disabledClassName={disabledControlClassName}
        iconClassName={iconClassName}
        dataAttributes={previousDataAttributes}
      />
      {positionText ? (
        <span className="shrink-0 px-1 text-xs tabular-nums text-zinc-400">{positionText}</span>
      ) : null}
      <NeighborNavigationControl
        direction="next"
        href={nextHref}
        onClick={nextOnClick}
        onNavigate={onNavigate}
        renderLink={renderLink}
        hardNavigation={hardNavigation}
        label={nextLabel}
        title={nextTitle}
        ariaLabel={nextAriaLabel}
        disabled={nextDisabled}
        className={controlClassName}
        disabledClassName={disabledControlClassName}
        iconClassName={iconClassName}
        dataAttributes={nextDataAttributes}
      />
    </nav>
  );
}
