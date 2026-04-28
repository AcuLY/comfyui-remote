"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which element is currently active in the scroll container
 * using IntersectionObserver with a rootMargin that defines the
 * trigger zone (top 25% of the container by default).
 *
 * @param ids - Array of section IDs (will look up `section-${id}` in the DOM)
 * @param options - Optional IntersectionObserver options including root element or selector
 * @returns The ID of the currently active section, or null
 */
export function useScrollSpy(
  ids: string[],
  options?: {
    rootMargin?: string;
    threshold?: number;
    /** An Element to use as the IntersectionObserver root, or null for viewport */
    root?: Element | null;
    /** A CSS selector to find the root element (resolved on each effect run) */
    rootSelector?: string;
  }
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const rootMargin = options?.rootMargin ?? "-0% 0% -75% 0%";
    const threshold = options?.threshold ?? 0;
    const root = options?.root ?? (options?.rootSelector ? document.querySelector(options.rootSelector) : null);
    const observers: IntersectionObserver[] = [];

    for (const id of ids) {
      const el = document.getElementById(`section-${id}`);
      if (!el) continue;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveId(id);
          }
        },
        { rootMargin, threshold, root }
      );
      observer.observe(el);
      observers.push(observer);
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [ids, options?.rootMargin, options?.threshold, options?.root, options?.rootSelector]);

  return activeId;
}
