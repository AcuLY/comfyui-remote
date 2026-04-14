"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "scroll:";

export function ScrollRestorer({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement | null>(null);
  const restoringRef = useRef(false);
  const pathname = usePathname();

  // Find the <main> scroll container (parent of this component)
  useEffect(() => {
    mainRef.current = document.querySelector("main");
  }, []);

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    let ticking = false;
    function onScroll() {
      if (ticking || restoringRef.current) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(STORAGE_PREFIX + pathname, String(main!.scrollTop));
        } catch {
          // sessionStorage may be unavailable
        }
        ticking = false;
      });
    }

    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Restore scroll position on mount (navigating back)
  const restore = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;
    try {
      const saved = sessionStorage.getItem(STORAGE_PREFIX + pathname);
      if (saved) {
        restoringRef.current = true;
        main.scrollTop = Number(saved);
        // Allow scroll events to fire before unblocking
        requestAnimationFrame(() => {
          restoringRef.current = false;
        });
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  // Restore on pathname change
  useEffect(() => {
    // Defer to let the DOM render first
    requestAnimationFrame(() => {
      requestAnimationFrame(restore);
    });
  }, [pathname, restore]);

  return <>{children}</>;
}
