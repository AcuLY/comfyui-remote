"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import type { LoraTrainingProject, LoraTrainingSection } from "@/features/training/types";

import s from "./training-project-pages.module.css";

function TrainingSectionRail({
  activeSectionId,
  project,
  sections = project.sections,
}: {
  activeSectionId?: string;
  project: LoraTrainingProject;
  sections?: LoraTrainingSection[];
}) {
  const hrefForRoute = useRouteHref();

  return (
    <nav className={s.trainingSectionRail} aria-label="训练小节导航">
      <div className={s.trainingSectionRailHeader}>
        <strong>小节导航</strong>
        <span>{sections.length} 小节</span>
      </div>
      <div className={s.trainingSectionRailList}>
        {sections.map((section) => {
          const resultCount = project.resultPool.filter((result) => result.sectionId === section.id).length;

          return (
            <Link
              aria-current={activeSectionId === section.id ? "page" : undefined}
              className={cx(s.trainingSectionRailItem, activeSectionId === section.id && s.trainingSectionRailItemActive)}
              href={hrefForRoute(`/training/projects/${project.id}/sections/${section.id}`)}
              key={section.id}
            >
              <strong>{section.title}</strong>
              <span>{resultCount} 张结果</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TrainingSectionWorkspace({
  activeSectionId,
  children,
  project,
  sections,
}: {
  activeSectionId?: string;
  children: ReactNode;
  project: LoraTrainingProject;
  sections?: LoraTrainingSection[];
}) {
  return (
    <div className={s.trainingSectionWorkspace}>
      <div className={s.sectionScrollPane}>{children}</div>
      <TrainingSectionRail activeSectionId={activeSectionId} project={project} sections={sections} />
    </div>
  );
}
