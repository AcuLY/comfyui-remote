"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which element is currently active in the viewport
 * using IntersectionObserver with a rootMargin that defines the
 * trigger zone (top 25% of the viewport by default).
 *
 * @param ids - Array of section IDs (will look up `section-${id}` in the DOM)
 * @param options - Optional IntersectionObserver options
 * @returns The ID of the currently active section, or null
 */
export function useScrollSpy(
  ids: string[],
  options?: { rootMargin?: string; threshold?: number }
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const rootMargin = options?.rootMargin ?? "-0% 0% -75% 0%";
    const threshold = options?.threshold ?? 0;
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
        { rootMargin, threshold }
      );
      observer.observe(el);
      observers.push(observer);
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [ids, options?.rootMargin, options?.threshold]);

  return activeId;
}
