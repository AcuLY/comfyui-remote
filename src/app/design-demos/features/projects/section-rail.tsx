"use client";

import Link from "next/link";
import { forwardRef } from "react";

import type { DemoProject, DemoSection } from "../../data";
import { cx, demoHref, rawSectionId, sectionAnchorId } from "../../routing";
import type { SectionNavMode } from "../../routing";
import s from "./section-rail.projects.module.css";

function sectionNavHref(project: DemoProject, section: DemoSection, mode: SectionNavMode) {
  if (mode === "detail") return `${demoHref(`/projects/${project.id}`)}#${sectionAnchorId(section)}`;
  if (mode === "project-results") return `${demoHref(`/projects/${project.id}/results`)}#${sectionAnchorId(section)}`;
  return demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`);
}

export const SectionRail = forwardRef<HTMLDivElement, {
  project: DemoProject;
  activeSection?: DemoSection;
  activeSectionId?: string | null;
  mode?: SectionNavMode;
  onNavigateSection?: (section: DemoSection) => void;
}>(function SectionRail(
  {
    project,
    activeSection,
    activeSectionId,
    mode = "editor",
    onNavigateSection,
  },
  ref,
) {
  const resolvedActiveId = activeSectionId ?? activeSection?.id ?? project.sections[0]?.id ?? null;
  return (
    <nav className={s.sectionRail} aria-label="小节导航">
      <div className={s.railHeading}>
        <div>
          <strong>小节导航</strong>
          <span>{project.sections.length} 小节</span>
        </div>
      </div>
      <div className={s.railList} ref={ref}>
        {project.sections.map((section) => {
          const pendingCount = section.images.filter((image) => image.status === "pending").length;
          const hasPending = pendingCount > 0;
          return (
            <Link
              className={cx(
                s.railItem,
                hasPending && s.railItemPending,
                resolvedActiveId === section.id && s.railItemActive,
              )}
              href={sectionNavHref(project, section, mode)}
              key={section.id}
              onClick={(event) => {
                if (mode === "detail" || mode === "project-results") {
                  event.preventDefault();
                }
                onNavigateSection?.(section);
              }}
            >
              <strong>{section.name}</strong>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});
