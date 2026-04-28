"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { AddSectionButton, ImportTemplateButton } from "./section-actions";
import { AppSidebar } from "./app-sidebar";
import { SectionCards, type Section } from "./section-cards";

type ProjectDetailClientProps = {
  projectId: string;
  projectTitle: string;
  sections: Section[];
};

const PROJECT_SECTION_ANCHOR_PREFIX = "comfyui-manager:project-section-anchor:";

type StoredSectionAnchor = {
  sectionId: string;
  offsetTop: number;
};

/** Get the scroll container — SidebarInset if it has overflow, else window */
function getScrollContainer(): Element | Window {
  const inset = document.querySelector('[data-slot="sidebar-inset"]');
  if (inset && getComputedStyle(inset).overflowY !== "visible") return inset;
  return window;
}

export function ProjectDetailClient({ projectId, projectTitle, sections }: ProjectDetailClientProps) {
  const [compact, setCompact] = useState(false);
  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const activeSectionId = useScrollSpy(sectionIds, {
    rootSelector: '[data-slot="sidebar-inset"]',
  });

  // Ref map: section id → DOM node, for scroll anchoring
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  // Toggle compact with scroll anchoring
  function findAnchorId(): string | null {
    const container = getScrollContainer();
    const viewportHeight = container instanceof Window ? window.innerHeight : container.clientHeight;
    const viewportCenter = (container instanceof Window ? 0 : container.getBoundingClientRect().top) + viewportHeight / 2;
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const [id, el] of cardRefs.current) {
      const rect = el.getBoundingClientRect();
      const cardCenter = rect.top + rect.height / 2;
      const dist = Math.abs(cardCenter - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = id;
      }
    }
    return bestId;
  }

  function handleToggleCompact() {
    const anchorId = findAnchorId();
    setCompact((prev) => !prev);

    if (anchorId) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = cardRefs.current.get(anchorId);
          if (!el) return;
          const container = getScrollContainer();
          if (container instanceof Window) {
            const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
            window.scrollTo({ top: y, behavior: "instant" });
          } else {
            const y = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientHeight / 2;
            container.scrollTo({ top: y, behavior: "instant" });
          }
        });
      });
    }
  }

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(`section-${id}`);
    if (!element) return;

    const container = getScrollContainer();
    if (container instanceof Window) {
      const y = element.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top: y, behavior: "smooth" });
    } else {
      const y = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
      container.scrollTo({ top: y, behavior: "smooth" });
    }

    window.history.replaceState(null, "", `#section-${id}`);
  }, []);

  // Scroll to section card when arriving via hash fragment
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const id = hash.slice(1);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) return;
        const container = getScrollContainer();
        if (container instanceof Window) {
          const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3;
          window.scrollTo({ top: y, behavior: "instant" });
        } else {
          const y = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientHeight / 3;
          container.scrollTo({ top: y, behavior: "instant" });
        }
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      });
    });
  }, []);

  // Preserve the top visible section on project detail pages
  useEffect(() => {
    if (window.location.hash) return;

    const anchorStorageKey = `${PROJECT_SECTION_ANCHOR_PREFIX}${projectId}`;

    const saveAnchor = () => {
      let bestAnchor: StoredSectionAnchor | null = null;
      const container = getScrollContainer();
      const containerTop = container instanceof Window ? 0 : container.getBoundingClientRect().top;
      const containerHeight = container instanceof Window ? window.innerHeight : container.clientHeight;

      for (const [sectionId, element] of cardRefs.current) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.bottom > containerTop && rect.top < containerTop + containerHeight;

        if (!isVisible) continue;

        if (!bestAnchor || rect.top < bestAnchor.offsetTop) {
          bestAnchor = {
            sectionId,
            offsetTop: rect.top,
          };
        }
      }

      if (bestAnchor) {
        window.sessionStorage.setItem(anchorStorageKey, JSON.stringify(bestAnchor));
      }
    };

    const restoreAnchor = () => {
      const rawAnchor = window.sessionStorage.getItem(anchorStorageKey);
      if (!rawAnchor) return;

      let anchor: StoredSectionAnchor | null = null;
      try {
        anchor = JSON.parse(rawAnchor) as StoredSectionAnchor;
      } catch {
        window.sessionStorage.removeItem(anchorStorageKey);
        return;
      }

      const element = cardRefs.current.get(anchor.sectionId);
      if (!element) return;

      const container = getScrollContainer();
      if (container instanceof Window) {
        const y = element.getBoundingClientRect().top + window.scrollY - anchor.offsetTop;
        window.scrollTo({ top: y, behavior: "instant" });
      } else {
        const y = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - anchor.offsetTop;
        container.scrollTo({ top: y, behavior: "instant" });
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(restoreAnchor);
    });

    const container = getScrollContainer();
    container.addEventListener("scroll", saveAnchor, { passive: true });

    return () => {
      saveAnchor();
      container.removeEventListener("scroll", saveAnchor);
    };
  }, [projectId]);

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "14rem",
        "--sidebar-width-icon": "3rem",
      } as React.CSSProperties}
      className="min-h-0 -mx-5 w-[calc(100%+2.5rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]"
    >
      <AppSidebar
        projectId={projectId}
        projectTitle={projectTitle}
        sections={sections}
        compact={compact}
        onToggleCompact={handleToggleCompact}
        activeSectionId={activeSectionId}
        onNavigateToSection={scrollToSection}
      />

      <SidebarInset className="flex-1 overflow-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 pb-24 sm:px-6">
          <MobileSectionNavigator
            sections={sections}
            activeSectionId={activeSectionId}
            onNavigateToSection={scrollToSection}
          />

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <div className="flex-1" />
            <div className="grid grid-cols-3 gap-2" style={{ maxWidth: "28rem" }}>
              <AddSectionButton projectId={projectId} />
              <ImportTemplateButton projectId={projectId} />
              <Link
                href={`/projects/${projectId}/batch-create`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-500/20 bg-sky-500/[0.03] px-3 py-3 text-xs text-sky-400 transition hover:bg-sky-500/[0.08]"
              >
                <Plus className="size-3.5" /> 批量创建
              </Link>
            </div>
          </div>

          {/* Section cards or empty state */}
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
              暂无小节，点击上方按钮添加
            </div>
          ) : (
            <SectionCards
              projectId={projectId}
              sections={sections}
              compact={compact}
              setCardRef={setCardRef}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function MobileSectionNavigator({
  sections,
  activeSectionId,
  onNavigateToSection,
}: {
  sections: Section[];
  activeSectionId: string | null;
  onNavigateToSection: (id: string) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeSectionId) return;

    const container = scrollContainerRef.current;
    const activeButton = container?.querySelector<HTMLElement>(
      `[data-mobile-nav-section-id="${activeSectionId}"]`,
    );

    if (!container || !activeButton) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const targetLeft =
      container.scrollLeft +
      buttonRect.left -
      containerRect.left -
      (containerRect.width - buttonRect.width) / 2;

    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [activeSectionId]);

  if (sections.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-white/10 bg-background/95 px-4 py-2 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="shrink-0" />
        <div
          ref={scrollContainerRef}
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none"
        >
          {sections.map((section, index) => (
            <button
              key={section.id}
              type="button"
              data-mobile-nav-section-id={section.id}
              onClick={() => onNavigateToSection(section.id)}
              className={`flex h-8 max-w-32 shrink-0 items-center gap-1 rounded-md border px-2 text-xs transition ${
                activeSectionId === section.id
                  ? "border-sky-500/40 bg-sky-500/15 text-sky-200"
                  : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
              }`}
            >
              <span className="text-[11px] text-zinc-500">{index + 1}</span>
              <span className="truncate">{section.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
