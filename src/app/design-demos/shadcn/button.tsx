"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { Activity } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { demoHref } from "../design-demo-utils";
import { cn } from "./utils";

type DemoIcon = ComponentType<{ className?: string }>;

export const shadcnDemoButtonVariants = cva(
  "demoShadcnButton inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "demoShadcnButtonDefault shadow",
        secondary: "demoShadcnButtonSecondary shadow-sm",
        outline: "demoShadcnButtonOutline border shadow-sm",
        ghost: "demoShadcnButtonGhost",
        primary: "demoShadcnButtonPrimary border shadow-sm",
        pink: "demoShadcnButtonPink border shadow-sm",
        danger: "demoShadcnButtonDanger border shadow-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ShadcnDemoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof shadcnDemoButtonVariants> & {
    icon?: DemoIcon;
    iconOnly?: boolean;
    loading?: boolean;
  };

export function ShadcnDemoButton({
  className,
  children,
  icon: Icon,
  iconOnly = false,
  loading = false,
  size,
  variant,
  disabled,
  ...props
}: ShadcnDemoButtonProps) {
  const label = props["aria-label"] ?? (typeof children === "string" ? children : undefined);

  return (
    <button
      className={cn(shadcnDemoButtonVariants({ variant, size: iconOnly ? "icon" : size, className }))}
      disabled={disabled || loading}
      title={iconOnly && typeof label === "string" ? label : props.title}
      {...props}
    >
      {loading ? <Activity className="animate-spin" /> : Icon ? <Icon /> : null}
      {iconOnly ? null : children}
    </button>
  );
}

export function ShadcnDemoButtonLink({
  className,
  children,
  href,
  icon: Icon,
  iconOnly = false,
  size,
  variant,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  VariantProps<typeof shadcnDemoButtonVariants> & {
    children?: ReactNode;
    href: string;
    icon?: DemoIcon;
    iconOnly?: boolean;
  }) {
  const label = props["aria-label"] ?? (typeof children === "string" ? children : undefined);

  return (
    <Link
      className={cn(shadcnDemoButtonVariants({ variant, size: iconOnly ? "icon" : size, className }))}
      href={demoHref(href)}
      title={iconOnly && typeof label === "string" ? label : props.title}
      {...props}
    >
      {Icon ? <Icon /> : null}
      {iconOnly ? null : children}
    </Link>
  );
}
