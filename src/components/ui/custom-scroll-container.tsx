"use client";

import { useRef, useState, useCallback, useEffect, type ReactNode, type HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Render as a different HTML element (e.g. "main"). The ref will still work. */
  as?: "div" | "main" | "section" | "article" | "aside";
};

const MIN_THUMB_PX = 32;
const HIDE_DELAY_MS = 1200;

export function CustomScrollContainer({
  as: As = "div",
  children,
  className,
  onScroll,
  ...rest
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const [showTrack, setShowTrack] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);

  const hideTimerRef = useRef<number>(0);

  // ── Thumb geometry (direct DOM writes, no re-render) ──────────────

  const updateThumb = useCallback(() => {
    const el = containerRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight) {
      thumb.style.height = "0px";
      setShowTrack(false);
      return;
    }

    const ratio = clientHeight / scrollHeight;
    const tH = Math.max(ratio * clientHeight, MIN_THUMB_PX);
    thumb.style.height = `${tH}px`;

    const maxScroll = scrollHeight - clientHeight;
    const maxThumbY = clientHeight - tH;
    const tY = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbY : 0;
    thumb.style.transform = `translateY(${tY}px)`;

    setShowTrack(true);
  }, []);

  // ── Visibility ──────────────────────────────────────────────────────

  const showThumb = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimerRef.current);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
  }, []);

  // ── Scroll handler ──────────────────────────────────────────────────

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      updateThumb();
      showThumb();
      scheduleHide();
      onScroll?.(e);
    },
    [updateThumb, showThumb, scheduleHide, onScroll],
  );

  // ── Hover ───────────────────────────────────────────────────────────

  const handlePointerEnter = useCallback(() => {
    updateThumb();
    showThumb();
  }, [updateThumb, showThumb]);

  const handlePointerLeave = useCallback(() => {
    if (!dragging) scheduleHide();
  }, [dragging, scheduleHide]);

  // ── Drag-to-scroll ──────────────────────────────────────────────────

  const dragStartRef = useRef({ scrollStart: 0, pointerStart: 0 });

  const handleThumbPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const el = containerRef.current;
      if (!el) return;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStartRef.current = { scrollStart: el.scrollTop, pointerStart: e.clientY };
      setDragging(true);
      showThumb();
    },
    [showThumb],
  );

  const handleThumbPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const el = containerRef.current;
      if (!el) return;

      const deltaPx = e.clientY - dragStartRef.current.pointerStart;
      const trackH = el.clientHeight - MIN_THUMB_PX;
      const scrollRange = el.scrollHeight - el.clientHeight;
      const deltaScroll = trackH > 0 ? (deltaPx / trackH) * scrollRange : 0;
      el.scrollTop = dragStartRef.current.scrollStart + deltaScroll;
    },
    [dragging],
  );

  const handleThumbPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDragging(false);
      scheduleHide();
    },
    [scheduleHide],
  );

  // ── ResizeObserver to recalc on content size change ─────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateThumb());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateThumb]);

  // Initial calculation
  useEffect(() => {
    updateThumb();
  }, [updateThumb]);

  // ── Track click (jump to position) ──────────────────────────────────

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target !== trackRef.current) return;
      const el = containerRef.current;
      if (!el || el.scrollHeight <= el.clientHeight) return;

      const rect = trackRef.current!.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const trackH = rect.height;
      const scrollRange = el.scrollHeight - el.clientHeight;
      el.scrollTop = (clickY / trackH) * scrollRange;
    },
    [],
  );

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <As
      {...rest}
      ref={containerRef}
      className={`custom-scroll-container relative ${className ?? ""}`}
      onScroll={handleScroll}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {children}
      {showTrack && (
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          className="pointer-events-auto absolute right-0 top-0 bottom-0 w-2"
          style={{
            opacity: visible ? 1 : 0,
            transition: dragging ? "none" : "opacity 200ms ease",
          }}
        >
          <div
            ref={thumbRef}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            className="rounded-full"
            style={{
              position: "absolute",
              right: 2,
              width: 6,
              height: 0,
              transform: "translateY(0px)",
              background: "rgba(113, 113, 122, 0.72)",
              transition: dragging ? "none" : "transform 80ms ease-out, background 150ms ease",
              cursor: "grab",
              contain: "layout paint",
            }}
            onPointerEnter={(e) => {
              (e.target as HTMLElement).style.background = "rgba(161, 161, 170, 0.82)";
            }}
            onPointerLeave={(e) => {
              (e.target as HTMLElement).style.background = "rgba(113, 113, 122, 0.72)";
            }}
          />
        </div>
      )}
    </As>
  );
}
