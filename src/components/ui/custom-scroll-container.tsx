"use client";

import { useRef, useCallback, useEffect, type ReactNode, type HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Render as a different HTML element (e.g. "main"). The ref will still work. */
  as?: "div" | "main" | "section" | "article" | "aside";
};

export function CustomScrollContainer({
  as: As = "div",
  children,
  className,
  onScroll,
  ...rest
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <As
      {...rest}
      ref={containerRef}
      className={`custom-scroll-container relative ${className ?? ""}`}
      onScroll={onScroll}
    >
      {children}
    </As>
  );
}
