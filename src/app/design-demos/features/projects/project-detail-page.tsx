"use client";

import { useEffect, useState } from "react";

import type { DemoProject, DemoSection } from "../../data";
import { cx, filterImages } from "../../routing";
import type { ProjectCardView, ResultDemoFilter } from "../../routing";
import s from "./project-detail-page.projects.module.css";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { ProjectResultsToolbar, ProjectSectionResultCard } from "./project-result-card";
import { ProjectSectionCard } from "./project-section-card";
import { ProjectSectionShell } from "./project-section-shell";

type ProjectSectionViewMode = "standard" | "compact";

const PROJECT_SECTION_VIEW_MODE_EVENT = "design-demo:projects:section-view-mode";
const PROJECT_SECTION_VIEW_MODE_STORAGE_KEY = "design-demo:projects:section-view-mode";

function isProjectSectionViewMode(value: unknown): value is ProjectSectionViewMode {
  return value === "standard" || value === "compact";
}

function readProjectSectionViewMode(): ProjectSectionViewMode {
  if (typeof window === "undefined") return "standard";
  const stored = window.localStorage.getItem(PROJECT_SECTION_VIEW_MODE_STORAGE_KEY);
  return isProjectSectionViewMode(stored) ? stored : "standard";
}

export function ProjectDetailPage({
  project,
  initialView = "sections",
}: {
  project: DemoProject | undefined;
  initialView?: ProjectCardView;
}) {
  const [compact, setCompact] = useState(() => readProjectSectionViewMode() === "compact");
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [localSections, setLocalSections] = useState<DemoSection[]>(project?.sections ?? []);

  useEffect(() => {
    function handleSectionViewModeChange(event: Event) {
      const detail = (event as CustomEvent<{ compact?: unknown; mode?: unknown }>).detail;
      if (isProjectSectionViewMode(detail?.mode)) {
        setCompact(detail.mode === "compact");
      } else if (typeof detail?.compact === "boolean") {
        setCompact(detail.compact);
      }
    }

    window.addEventListener(PROJECT_SECTION_VIEW_MODE_EVENT, handleSectionViewModeChange);
    return () => window.removeEventListener(PROJECT_SECTION_VIEW_MODE_EVENT, handleSectionViewModeChange);
  }, []);

  if (!project) return <EmptyPage title="没有项目数据" />;
  const sections = localSections;
  const projectImages = sections.flatMap((section) => section.images);
  const isResultView = initialView === "results";

  function handleCopySection(section: DemoSection) {
    const copy: DemoSection = {
      ...section,
      id: `${section.id}-copy-${Date.now()}`,
      name: `${section.name} (副本)`,
      sortOrder: localSections.length,
    };
    setLocalSections(prev => [...prev, copy]);
  }

  function handleDeleteSection(sectionId: string) {
    setLocalSections(prev => prev.filter(sec => sec.id !== sectionId));
  }

  function toggleCollapsed(sectionId: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <ProjectSectionShell
        project={project}
        mode={isResultView ? "project-results" : "detail"}
      >
        <div className={s.sectionContentGrid}>
          {isResultView ? (
            <ProjectResultsToolbar images={projectImages} filter={filter} onFilterChange={setFilter} />
          ) : null}
          <div className={cx(s.sectionCardList, compact && !isResultView && s.sectionCardListCompact)}>
            {sections.map((section, index) => (
              isResultView ? (
                <ProjectSectionResultCard
                  collapsed={collapsedSections.has(section.id)}
                  images={filterImages(section.images, filter)}
                  index={index}
                  key={section.id}
                  onDelete={handleDeleteSection}
                  onToggleCollapsed={() => toggleCollapsed(section.id)}
                  section={section}
                />
              ) : (
                <ProjectSectionCard
                  compact={compact}
                  index={index}
                  key={section.id}
                  onCopy={handleCopySection}
                  onDelete={handleDeleteSection}
                  project={project}
                  section={section}
                />
              )
            ))}
          </div>
        </div>
      </ProjectSectionShell>
    </div>
  );
}
