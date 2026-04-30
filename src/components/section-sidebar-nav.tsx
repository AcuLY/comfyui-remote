"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  addScrollListener,
  getMaxScrollTop,
  getPreferredScrollContainer,
  getScrollProgress,
  scrollContainerTo,
} from "@/lib/scroll-container";
import { cn } from "@/lib/utils";

export type SidebarNavSection = {
  id: string;
  name: string | null;
};

type ScrollLockSource = "main" | "sidebar";

function findNavItem(container: HTMLElement, sectionId: string) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-nav-section-id]"),
  ).find((item) => item.dataset.navSectionId === sectionId);
}

export function useSyncedSidebarContent({
  activeSectionId,
  itemCount,
  mainScrollerSelector = '[data-slot="sidebar-inset"]',
}: {
  activeSectionId: string | null;
  itemCount: number;
  mainScrollerSelector?: string;
}) {
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const syncLockRef = useRef<ScrollLockSource | null>(null);
  const syncUnlockTimerRef = useRef<number | null>(null);

  const runWithSyncLock = useCallback(
    (source: ScrollLockSource, callback: () => void, duration = 180) => {
      syncLockRef.current = source;
      callback();

      if (syncUnlockTimerRef.current !== null) {
        window.clearTimeout(syncUnlockTimerRef.current);
      }

      syncUnlockTimerRef.current = window.setTimeout(() => {
        syncLockRef.current = null;
        syncUnlockTimerRef.current = null;
      }, duration);
    },
    [],
  );

  useEffect(() => {
    const mainScroller = getPreferredScrollContainer(mainScrollerSelector);
    const sidebarScroller = sidebarContentRef.current;
    if (!sidebarScroller) return;

    let mainFrame: number | null = null;
    let sidebarFrame: number | null = null;

    const syncFromMain = () => {
      mainFrame = null;
      if (syncLockRef.current === "sidebar") return;

      const progress = getScrollProgress(mainScroller);
      const targetTop = progress * getMaxScrollTop(sidebarScroller);
      runWithSyncLock("main", () => {
        scrollContainerTo(sidebarScroller, targetTop, "instant");
      });
    };

    const syncFromSidebar = () => {
      sidebarFrame = null;
      if (syncLockRef.current === "main") return;

      const progress = getScrollProgress(sidebarScroller);
      const targetTop = progress * getMaxScrollTop(mainScroller);
      runWithSyncLock("sidebar", () => {
        scrollContainerTo(mainScroller, targetTop, "instant");
      });
    };

    const handleMainScroll = () => {
      if (mainFrame !== null) return;
      mainFrame = window.requestAnimationFrame(syncFromMain);
    };

    const handleSidebarScroll = () => {
      if (sidebarFrame !== null) return;
      sidebarFrame = window.requestAnimationFrame(syncFromSidebar);
    };

    const removeMainScrollListener = addScrollListener(
      mainScroller,
      handleMainScroll,
      { passive: true },
    );
    const removeSidebarScrollListener = addScrollListener(
      sidebarScroller,
      handleSidebarScroll,
      { passive: true },
    );
    handleMainScroll();

    return () => {
      removeMainScrollListener();
      removeSidebarScrollListener();

      if (mainFrame !== null) window.cancelAnimationFrame(mainFrame);
      if (sidebarFrame !== null) window.cancelAnimationFrame(sidebarFrame);
      if (syncUnlockTimerRef.current !== null) {
        window.clearTimeout(syncUnlockTimerRef.current);
        syncUnlockTimerRef.current = null;
      }
    };
  }, [itemCount, mainScrollerSelector, runWithSyncLock]);

  useEffect(() => {
    if (!activeSectionId) return;
    const sidebarScroller = sidebarContentRef.current;
    if (!sidebarScroller) return;

    const navItem = findNavItem(sidebarScroller, activeSectionId);
    if (!navItem) return;

    const containerRect = sidebarScroller.getBoundingClientRect();
    const itemRect = navItem.getBoundingClientRect();
    const isVisible =
      itemRect.top >= containerRect.top &&
      itemRect.bottom <= containerRect.bottom;

    if (isVisible) return;

    const targetTop =
      sidebarScroller.scrollTop +
      itemRect.top -
      containerRect.top -
      (containerRect.height - itemRect.height) / 2;

    runWithSyncLock(
      "main",
      () => {
        scrollContainerTo(sidebarScroller, targetTop, "smooth");
      },
      700,
    );
  }, [activeSectionId, runWithSyncLock]);

  return sidebarContentRef;
}

export function SidebarSectionNav({
  label,
  sections,
  activeSectionId,
  onNavigateToSection,
  labelAction,
  renderTrailing,
  menuClassName,
  itemClassName,
  buttonClassName,
}: {
  label: ReactNode;
  sections: SidebarNavSection[];
  activeSectionId: string | null;
  onNavigateToSection: (id: string) => void;
  labelAction?: ReactNode;
  renderTrailing?: (section: SidebarNavSection, index: number) => ReactNode;
  menuClassName?: string;
  itemClassName?:
    | string
    | ((section: SidebarNavSection, index: number) => string | undefined);
  buttonClassName?:
    | string
    | ((
        section: SidebarNavSection,
        index: number,
        isActive: boolean,
      ) => string | undefined);
}) {
  if (sections.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className={labelAction ? "justify-between pr-1" : undefined}
      >
        <span>{label}</span>
        {labelAction}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className={menuClassName}>
          {sections.map((section, index) => {
            const isActive = activeSectionId === section.id;
            const resolvedItemClassName =
              typeof itemClassName === "function"
                ? itemClassName(section, index)
                : itemClassName;
            const resolvedButtonClassName =
              typeof buttonClassName === "function"
                ? buttonClassName(section, index, isActive)
                : buttonClassName;
            const labelText = section.name?.trim() || "未命名小节";

            return (
              <SidebarMenuItem
                key={section.id}
                data-nav-section-id={section.id}
                className={resolvedItemClassName}
              >
                <SidebarMenuButton
                  tooltip={`${index + 1}. ${labelText}`}
                  isActive={isActive}
                  onClick={() => onNavigateToSection(section.id)}
                  className={cn("h-auto py-2", resolvedButtonClassName)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-[11px] text-zinc-500">
                    {index + 1}
                  </span>
                  <span className="line-clamp-2 !whitespace-normal text-xs">
                    {labelText}
                  </span>
                </SidebarMenuButton>
                {renderTrailing?.(section, index)}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
