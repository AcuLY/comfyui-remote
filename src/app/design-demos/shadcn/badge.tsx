import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

export const shadcnDemoBadgeVariants = cva(
  "demoShadcnBadge inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-1",
  {
    variants: {
      variant: {
        default: "demoShadcnBadgeDefault",
        secondary: "demoShadcnBadgeSecondary",
        success: "demoShadcnBadgeSuccess",
        warning: "demoShadcnBadgeWarning",
        danger: "demoShadcnBadgeDanger",
        sky: "demoShadcnBadgeSky",
        pink: "demoShadcnBadgePink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function ShadcnDemoBadge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof shadcnDemoBadgeVariants>) {
  return <div className={cn(shadcnDemoBadgeVariants({ variant, className }))} {...props} />;
}
