"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "scroll:";

export function ScrollRestorer({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement | null>(null);
  const restoringRef = useRef(false);
  const prevPathRef = useRef<string | null>(null);
  const pathname = usePathname();

  // Find the <main> scroll container
  useEffect(() => {
    mainRef.current = document.querySelector("main");
  }, []);

  // Save scroll position on scroll
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
        } catch { /* noop */ }
        ticking = false;
      });
    }

    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Restore scroll position with retries (content may stream in after navigation)
  const restore = useCallback((path: string) => {
    const main = mainRef.current;
    if (!main) return;
    try {
      const saved = sessionStorage.getItem(STORAGE_PREFIX + path);
      if (saved) {
        restoringRef.current = true;
        main.scrollTop = Number(saved);
        // Unblock saving after a tick so the restore itself doesn't get saved
        requestAnimationFrame(() => {
          restoringRef.current = false;
        });
      }
    } catch { /* noop */ }
  }, []);

  // On pathname change, restore with multiple attempts to handle streaming
  useEffect(() => {
    // Only restore when coming back (navigating to a previously visited path)
    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    // Check if we have a saved position for this path
    try {
      if (!sessionStorage.getItem(STORAGE_PREFIX + pathname)) return;
    } catch { return; }

    // First attempt: after a short delay
    const t1 = setTimeout(() => restore(pathname), 50);
    // Second attempt: after content likely settled
    const t2 = setTimeout(() => restore(pathname), 200);
    // Third attempt: for slow loads
    const t3 = setTimeout(() => restore(pathname), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname, restore]);

  return <>{children}</>;
}
