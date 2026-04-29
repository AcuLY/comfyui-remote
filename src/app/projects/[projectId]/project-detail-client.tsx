"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { getPreferredScrollContainer } from "@/lib/scroll-container";
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
  return getPreferredScrollContainer('[data-slot="sidebar-inset"]');
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
      className="-mx-5 min-h-[calc(100dvh-5rem)] w-[calc(100%+2.5rem)] bg-transparent sm:-mx-6 sm:w-[calc(100%+3rem)]"
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

      <SidebarInset className="flex-1 overflow-auto bg-transparent">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pb-24 pt-4 sm:px-6">
          {/* Toolbar */}
          <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-white/[0.06] bg-[var(--bg)]/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <div className="flex-1" />
            <div className="grid w-full grid-cols-1 gap-1.5 sm:w-auto sm:grid-cols-3 sm:gap-2" style={{ maxWidth: "28rem" }}>
              <AddSectionButton projectId={projectId} />
              <ImportTemplateButton projectId={projectId} />
              <Link
                href={`/projects/${projectId}/batch-create`}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-500/20 bg-sky-500/[0.03] px-2 py-2 text-[11px] text-sky-400 transition hover:bg-sky-500/[0.08] sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
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
