"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";

import type { DemoProject, DemoSection } from "../../data";
import { sectionAnchorId } from "../../routing";
import type { SectionNavMode } from "../../routing";
import s from "./project-section-shell.projects.module.css";
import { SectionRail } from "./section-rail";

export function ProjectSectionShell({
  project,
  activeSection,
  mode,
  children,
  compact,
  onToggleCompact,
}: {
  project: DemoProject;
  activeSection?: DemoSection;
  mode: SectionNavMode;
  children: React.ReactNode;
  compact?: boolean;
  onToggleCompact?: () => void;
}) {
  const defaultActiveSectionId = activeSection?.id ?? project.sections[0]?.id ?? null;
  const [activeSectionState, setActiveSectionState] = useState({
    projectId: project.id,
    sectionId: defaultActiveSectionId,
  });
  const activeSectionId = activeSectionState.projectId === project.id ? activeSectionState.sectionId : defaultActiveSectionId;
  const displayedActiveSectionId =
    mode === "editor" && activeSection
      ? activeSection.id
      : activeSectionId ?? defaultActiveSectionId;
  const contentRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const syncSourceRef = useRef<"content" | "rail" | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  const syncScroll = useCallback((source: "content" | "rail", targetTop: number) => {
    syncSourceRef.current = source;
    const target = source === "content" ? railRef.current : contentRef.current;
    if (target) target.scrollTop = targetTop;
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => {
      syncSourceRef.current = null;
      unlockTimerRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current;
    const railElement = railRef.current;
    if (!contentElement || !railElement) return;
    const contentNode = contentElement;
    const railNode = railElement;

    function progress(element: HTMLElement) {
      const max = Math.max(element.scrollHeight - element.clientHeight, 0);
      return max === 0 ? 0 : element.scrollTop / max;
    }

    function maxTop(element: HTMLElement) {
      return Math.max(element.scrollHeight - element.clientHeight, 0);
    }

    function handleContentScroll() {
      if (syncSourceRef.current === "rail") return;
      syncScroll("content", progress(contentNode) * maxTop(railNode));

      const cards = Array.from(contentNode.querySelectorAll<HTMLElement>("[data-section-card]"));
      const containerTop = contentNode.getBoundingClientRect().top;
      let nextId = cards[0]?.dataset.sectionCard ?? null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const card of cards) {
        const distance = Math.abs(card.getBoundingClientRect().top - containerTop - 8);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextId = card.dataset.sectionCard ?? nextId;
        }
      }
      if (nextId) setActiveSectionState({ projectId: project.id, sectionId: nextId });
    }

    function handleRailScroll() {
      if (syncSourceRef.current === "content") return;
      syncScroll("rail", progress(railNode) * maxTop(contentNode));
    }

    contentNode.addEventListener("scroll", handleContentScroll, { passive: true });
    railNode.addEventListener("scroll", handleRailScroll, { passive: true });
    handleContentScroll();

    return () => {
      contentNode.removeEventListener("scroll", handleContentScroll);
      railNode.removeEventListener("scroll", handleRailScroll);
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    };
  }, [project.id, syncScroll]);

  function handleNavigateSection(section: DemoSection) {
    setActiveSectionState({ projectId: project.id, sectionId: section.id });
    if (mode !== "detail" && mode !== "project-results") return;
    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>(`#${CSS.escape(sectionAnchorId(section))}`);
    if (!content || !target) return;
    const targetTop = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
    content.scrollTop = targetTop;
  }

  return (
    <div className={s.projectSectionShell}>
      <div className={s.projectScrollPane} ref={contentRef}>
        {children}
      </div>
      <SectionRail
        ref={railRef}
        project={project}
        activeSectionId={displayedActiveSectionId}
        compact={compact}
        mode={mode}
        onNavigateSection={handleNavigateSection}
        onToggleCompact={onToggleCompact}
      />
    </div>
  );
}
