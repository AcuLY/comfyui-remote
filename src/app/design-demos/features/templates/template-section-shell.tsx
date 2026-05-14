"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";

import type { DemoTemplate } from "../../data";
import { cx, demoHref } from "../../routing";
import type { DemoTemplateSection, TemplateSectionMode } from "../../routing";
import s from "./template-section-shell.library.module.css";

export function templateSectionAnchorId(section: DemoTemplateSection) {
  return `template-section-${section.id}`;
}

function templateSectionHref(template: DemoTemplate, section: DemoTemplateSection, index: number, mode: TemplateSectionMode) {
  if (mode === "template-edit") return `${demoHref(`/templates/${template.id}/edit`)}#${templateSectionAnchorId(section)}`;
  return demoHref(`/templates/${template.id}/sections/${index}`);
}

export function TemplateSectionShell({
  activeSection,
  children,
  mode,
  template,
}: {
  activeSection?: DemoTemplateSection;
  children: React.ReactNode;
  mode: TemplateSectionMode;
  template: DemoTemplate;
}) {
  const defaultActiveSectionId = activeSection?.id ?? template.sections[0]?.id ?? null;
  const [activeSectionState, setActiveSectionState] = useState({
    templateId: template.id,
    sectionId: defaultActiveSectionId,
  });
  const activeSectionId = activeSectionState.templateId === template.id ? activeSectionState.sectionId : defaultActiveSectionId;
  const displayedActiveSectionId = mode === "template-section" && activeSection ? activeSection.id : activeSectionId;
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
      if (nextId) setActiveSectionState({ templateId: template.id, sectionId: nextId });
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
  }, [template.id, syncScroll]);

  function handleNavigateSection(section: DemoTemplateSection) {
    setActiveSectionState({ templateId: template.id, sectionId: section.id });
    if (mode !== "template-edit") return;
    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>(`#${CSS.escape(templateSectionAnchorId(section))}`);
    if (!content || !target) return;
    const targetTop = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
    content.scrollTop = targetTop;
  }

  return (
    <div className={s.projectSectionShell}>
      <div className={s.projectScrollPane} ref={contentRef}>
        {children}
      </div>
      <TemplateSectionRail
        activeSectionId={displayedActiveSectionId}
        mode={mode}
        onNavigateSection={handleNavigateSection}
        ref={railRef}
        template={template}
      />
    </div>
  );
}

const TemplateSectionRail = forwardRef<HTMLElement, {
  activeSectionId?: string | null;
  mode: TemplateSectionMode;
  onNavigateSection?: (section: DemoTemplateSection) => void;
  template: DemoTemplate;
}>(function TemplateSectionRail(
  {
    activeSectionId,
    mode,
    onNavigateSection,
    template,
  },
  ref,
) {
  const resolvedActiveId = activeSectionId ?? template.sections[0]?.id ?? null;

  return (
    <nav className={s.sectionRail} ref={ref} aria-label="模板小节导航">
      <div className={s.railHeading}>
        <strong>小节导航</strong>
        <span>{template.sections.length} 小节</span>
      </div>
      {template.sections.map((section, index) => (
        <Link
          className={cx(s.railItem, resolvedActiveId === section.id && s.railItemActive)}
          href={templateSectionHref(template, section, index, mode)}
          key={section.id}
          onClick={(event) => {
            if (mode === "template-edit") event.preventDefault();
            onNavigateSection?.(section);
          }}
        >
          <strong>{section.name}</strong>
          <span className={cx(s.small, s.muted)}>{section.aspectRatio} / 批量 {section.batchSize}</span>
        </Link>
      ))}
    </nav>
  );
});
