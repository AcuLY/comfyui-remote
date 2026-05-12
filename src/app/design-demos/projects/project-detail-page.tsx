"use client";

import { useState } from "react";

import type { DemoProject } from "../design-demo-data";
import { cx, filterImages } from "../design-demo-utils";
import type { ProjectCardView, ResultDemoFilter } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { EmptyPage } from "../ui/empty-page";
import { ProjectDetailHeader } from "./project-detail-header";
import { ProjectResultsToolbar, ProjectSectionResultCard } from "./project-result-card";
import { ProjectSectionCard } from "./project-section-card";
import { ProjectSectionShell } from "./project-section-shell";

export function ProjectDetailPage({
  project,
  initialView = "sections",
}: {
  project: DemoProject | undefined;
  initialView?: ProjectCardView;
}) {
  const [compact, setCompact] = useState(false);
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  if (!project) return <EmptyPage title="没有项目数据" />;
  const sections = project.sections;
  const projectImages = sections.flatMap((section) => section.images);
  const isResultView = initialView === "results";
  const sectionSummary = `${project.sectionCount} 个小节`;

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
      <ProjectDetailHeader
        isResultView={isResultView}
        project={project}
        subtitle={project.notes ? `${project.notes} · ${sectionSummary}` : sectionSummary}
        view={initialView}
      />
      <ProjectSectionShell
        compact={compact}
        onToggleCompact={() => setCompact((value) => !value)}
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
                  onToggleCollapsed={() => toggleCollapsed(section.id)}
                  section={section}
                />
              ) : (
                <ProjectSectionCard
                  compact={compact}
                  index={index}
                  key={section.id}
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
