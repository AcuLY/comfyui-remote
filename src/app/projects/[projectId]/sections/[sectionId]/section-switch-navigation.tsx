"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SectionSwitchNavigationProps = {
  projectId: string;
  sectionId: string;
  prevSectionId: string | null;
  nextSectionId: string | null;
};

const SWIPE_THRESHOLD_PX = 80;
const SWIPE_AXIS_RATIO = 1.4;
const RESTORE_TTL_MS = 15_000;

function storageKey(projectId: string) {
  return `section-switch-scroll:${projectId}`;
}

function shouldIgnoreSwipeTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "a,button,input,textarea,select,[contenteditable='true'],[data-no-section-swipe='true']",
    ),
  );
}

export function SectionSwitchNavigation({
  projectId,
  sectionId,
  prevSectionId,
  nextSectionId,
}: SectionSwitchNavigationProps) {
  const router = useRouter();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const prevHref = prevSectionId ? `/projects/${projectId}/sections/${prevSectionId}` : null;
  const nextHref = nextSectionId ? `/projects/${projectId}/sections/${nextSectionId}` : null;

  useEffect(() => {
    const raw = window.sessionStorage.getItem(storageKey(projectId));
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { y?: number; at?: number };
      if (
        typeof parsed.y === "number" &&
        typeof parsed.at === "number" &&
        Date.now() - parsed.at < RESTORE_TTL_MS
      ) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: parsed.y, left: 0, behavior: "instant" });
        });
      }
    } catch {
      window.sessionStorage.removeItem(storageKey(projectId));
    }
  }, [projectId, sectionId]);

  const navigate = useCallback(
    (href: string | null) => {
      if (!href) return;
      window.sessionStorage.setItem(
        storageKey(projectId),
        JSON.stringify({ y: window.scrollY, at: Date.now() }),
      );
      router.push(href, { scroll: false });
    },
    [projectId, router],
  );

  useEffect(() => {
    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1 || shouldIgnoreSwipeTarget(event.target)) {
        touchStartRef.current = null;
        return;
      }
      const touch = event.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchEnd(event: TouchEvent) {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;

      if (dx < 0) {
        navigate(nextHref);
      } else {
        navigate(prevHref);
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [navigate, nextHref, prevHref]);

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(prevHref)}
        disabled={!prevHref}
        aria-label="Previous section"
        className="fixed left-0 top-0 z-30 hidden h-dvh w-14 items-center justify-center border-r border-white/5 bg-black/10 text-zinc-500 opacity-50 backdrop-blur-sm transition hover:bg-sky-500/10 hover:text-sky-200 hover:opacity-100 disabled:pointer-events-none disabled:opacity-10 lg:flex xl:w-20"
      >
        <ChevronLeft className="size-7" />
      </button>
      <button
        type="button"
        onClick={() => navigate(nextHref)}
        disabled={!nextHref}
        aria-label="Next section"
        className="fixed right-0 top-0 z-30 hidden h-dvh w-14 items-center justify-center border-l border-white/5 bg-black/10 text-zinc-500 opacity-50 backdrop-blur-sm transition hover:bg-sky-500/10 hover:text-sky-200 hover:opacity-100 disabled:pointer-events-none disabled:opacity-10 lg:flex xl:w-20"
      >
        <ChevronRight className="size-7" />
      </button>
    </>
  );
}
