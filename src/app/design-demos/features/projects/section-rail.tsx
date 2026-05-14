"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { ListChecks } from "lucide-react";

import type { DemoProject, DemoSection } from "../../data";
import { cx, demoHref, rawSectionId, sectionAnchorId } from "../../routing";
import type { SectionNavMode } from "../../routing";
import s from "./section-rail.projects.module.css";
import { Button } from "../../shared/primitives/button";

function sectionNavHref(project: DemoProject, section: DemoSection, mode: SectionNavMode) {
  if (mode === "detail") return `${demoHref(`/projects/${project.id}`)}#${sectionAnchorId(section)}`;
  if (mode === "project-results") return `${demoHref(`/projects/${project.id}/results`)}#${sectionAnchorId(section)}`;
  return demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`);
}

export const SectionRail = forwardRef<HTMLElement, {
  project: DemoProject;
  activeSection?: DemoSection;
  activeSectionId?: string | null;
  compact?: boolean;
  mode?: SectionNavMode;
  onNavigateSection?: (section: DemoSection) => void;
  onToggleCompact?: () => void;
}>(function SectionRail(
  {
    project,
    activeSection,
    activeSectionId,
    compact,
    mode = "editor",
    onNavigateSection,
    onToggleCompact,
  },
  ref,
) {
  const resolvedActiveId = activeSectionId ?? activeSection?.id ?? project.sections[0]?.id ?? null;
  const showCompactToggle = mode === "detail" && onToggleCompact;
  const showReviewCounts = mode === "project-results";
  return (
    <nav className={s.sectionRail} ref={ref} aria-label="小节导航">
      <div className={s.railHeading}>
        <div>
          <strong>小节导航</strong>
          <span>{project.sections.length} 小节</span>
        </div>
        {showCompactToggle ? (
          <Button tone="subtle" pressed={compact} onClick={onToggleCompact} icon={ListChecks}>
            {compact ? "标准" : "紧凑"}
          </Button>
        ) : null}
      </div>
      {project.sections.map((section) => {
        const pendingCount = section.images.filter((image) => image.status === "pending").length;
        return (
          <Link
            className={cx(s.railItem, resolvedActiveId === section.id && s.railItemActive)}
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
            {showReviewCounts ? <span className={s.small}>待审核 {pendingCount}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
});
