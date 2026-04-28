"use client";

import { useEffect, useState } from "react";
import { isScrollableElement } from "@/lib/scroll-container";

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
    const selectedRoot = options?.rootSelector
      ? document.querySelector(options.rootSelector)
      : null;
    const root = options?.root ?? (
      selectedRoot instanceof HTMLElement && isScrollableElement(selectedRoot)
        ? selectedRoot
        : null
    );
    const sectionElements = ids
      .map((id) => ({
        id,
        element: document.getElementById(`section-${id}`),
      }))
      .filter((item): item is { id: string; element: HTMLElement } => item.element instanceof HTMLElement);

    if (sectionElements.length === 0) {
      setActiveId(null);
      return;
    }

    let frameId: number | null = null;

    const getRootBounds = () => {
      if (root) {
        const rect = root.getBoundingClientRect();
        return {
          top: rect.top,
          height: rect.height,
        };
      }

      return {
        top: 0,
        height: window.innerHeight,
      };
    };

    const updateActiveSection = () => {
      frameId = null;

      const { top, height } = getRootBounds();
      const triggerY = top + height * 0.25;
      let bestId = sectionElements[0]?.id ?? null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const { id, element } of sectionElements) {
        const rect = element.getBoundingClientRect();
        const intersectsViewport = rect.bottom >= top && rect.top <= top + height;
        const containsTrigger = rect.top <= triggerY && rect.bottom >= triggerY;
        const distance = rect.top <= triggerY ? triggerY - rect.top : rect.top - triggerY;

        if (containsTrigger) {
          bestId = id;
          break;
        }

        if (!intersectsViewport && rect.top > triggerY && bestDistance !== Number.POSITIVE_INFINITY) {
          continue;
        }

        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = id;
        }
      }

      setActiveId((current) => (current === bestId ? current : bestId));
    };

    const scheduleUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateActiveSection);
    };

    const observer = new IntersectionObserver(scheduleUpdate, {
      rootMargin,
      threshold,
      root,
    });

    for (const { element } of sectionElements) {
      observer.observe(element);
    }

    const scrollTarget: Element | Window = root ?? window;
    scrollTarget.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [ids, options?.rootMargin, options?.threshold, options?.root, options?.rootSelector]);

  return activeId;
}
