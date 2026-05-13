"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cx } from "../design-demo-utils";
import { Button } from "../ui/button";
import s from "./demo-pager.runs.module.css";

const SIBLING_COUNT = 2;

type GapKey = "left-gap" | "right-gap";

type PageItem =
  | { kind: "page"; page: number }
  | { kind: "gap"; key: GapKey; from: number; to: number };

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), totalPages);
}

function pageRange(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 1) return [{ kind: "page", page: 1 }];

  const windowStart = Math.max(2, currentPage - SIBLING_COUNT);
  const windowEnd = Math.min(totalPages - 1, currentPage + SIBLING_COUNT);
  const items: PageItem[] = [{ kind: "page", page: 1 }];

  if (windowStart > 2) {
    items.push({ kind: "gap", key: "left-gap", from: 2, to: windowStart - 1 });
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push({ kind: "page", page });
  }

  if (windowEnd < totalPages - 1) {
    items.push({ kind: "gap", key: "right-gap", from: windowEnd + 1, to: totalPages - 1 });
  }

  items.push({ kind: "page", page: totalPages });
  return items;
}

export function DemoPager({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
}) {
  const pageCount = Math.max(1, totalPages);
  const activePage = clampPage(currentPage, pageCount);
  const [openGap, setOpenGap] = useState<GapKey | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const pagerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pages = useMemo(() => buildPageItems(activePage, pageCount), [activePage, pageCount]);

  useEffect(() => {
    if (!openGap) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenGap(null);
        setMenuPosition(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGap(null);
        setMenuPosition(null);
      }
    }

    function handleResize() {
      setOpenGap(null);
      setMenuPosition(null);
    }

    function handleScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpenGap(null);
      setMenuPosition(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [openGap]);

  function requestPage(page: number) {
    const nextPage = clampPage(page, pageCount);
    setOpenGap(null);
    setMenuPosition(null);
    if (nextPage !== activePage) {
      onPageChange?.(nextPage);
    }
  }

  function toggleGap(key: GapKey, event: ReactMouseEvent<HTMLButtonElement>) {
    if (openGap === key) {
      setOpenGap(null);
      setMenuPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPosition({
      left: key === "right-gap" ? rect.right : rect.left,
      top: rect.bottom + 6,
    });
    setOpenGap(key);
  }

  return (
    <div ref={rootRef} className={s.pagerControls} aria-label="分页">
      <Button className={s.pagerButton} tone="subtle" icon={ArrowLeft} iconOnly disabled={activePage <= 1} ariaLabel="上一页" onClick={() => requestPage(activePage - 1)} />
      {pages.map((item) => {
        if (item.kind === "page") {
          const isActive = item.page === activePage;

          return (
            <button
              key={item.page}
              type="button"
              data-demo-ui-button="true"
              className={cx(s.pagerButton, isActive && s.pagerButtonActive)}
              aria-current={isActive ? "page" : undefined}
              onClick={() => requestPage(item.page)}
            >
              {item.page}
            </button>
          );
        }

        const isOpen = openGap === item.key;
        const menuId = `${pagerId}-${item.key}`;

        return (
          <span className={cx(s.pagerGap, item.key === "right-gap" && s.pagerGapEnd)} key={item.key}>
            <button
              type="button"
              data-demo-ui-button="true"
              className={cx(s.pagerButton, isOpen && s.pagerButtonActive)}
              aria-controls={menuId}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              aria-label={`跳转到 ${item.from}-${item.to} 页`}
              onClick={(event) => toggleGap(item.key, event)}
            >
              ...
            </button>
            {isOpen && menuPosition ? (
              <div
                id={menuId}
                className={s.pagerMenu}
                role="menu"
                aria-label={`${item.from}-${item.to} 页`}
                style={{ left: menuPosition.left, top: menuPosition.top }}
              >
                {pageRange(item.from, item.to).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={s.pagerMenuItem}
                    role="menuitem"
                    onClick={() => requestPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            ) : null}
          </span>
        );
      })}
      <Button className={s.pagerButton} tone="subtle" icon={ArrowRight} iconOnly disabled={activePage >= pageCount} ariaLabel="下一页" onClick={() => requestPage(activePage + 1)} />
    </div>
  );
}
