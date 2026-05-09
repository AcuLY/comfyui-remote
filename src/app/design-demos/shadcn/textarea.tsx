import type { TextareaHTMLAttributes } from "react";

import { cn } from "./utils";

export function ShadcnDemoTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "demoShadcnTextarea flex min-h-[60px] w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:opacity-70 focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
