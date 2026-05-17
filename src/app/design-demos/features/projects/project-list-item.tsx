"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GripVertical, Trash2 } from "lucide-react";

import type { DemoProject } from "../../data";
import { cx, demoHref } from "../../routing";
import s from "./project-list-item.projects.module.css";
import { Button } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { ImageListSmall } from "../../shared/media/image-list-small";
import { UnitRowShell } from "../../shared/patterns";
import { StatusBadge } from "../../shared/primitives/status-badge";

export function ProjectListCardShell({
  body,
  className,
  compact = false,
  leading,
  selected = false,
  title,
}: {
  body: ReactNode;
  className?: string;
  compact?: boolean;
  leading?: ReactNode;
  selected?: boolean;
  title: ReactNode;
}) {
  return (
    <UnitRowShell
      className={cx(s.projectListCard, compact && s.projectListCardCompact, selected && s.projectListCardSelected, className)}
      leadingClassName={leading ? s.projectItemControls : undefined}
      mainClassName={s.projectListContent}
      bodyClassName={s.projectListBody}
      titleClassName={s.projectListTitleSlot}
      leading={leading}
      title={title}
      body={body}
    />
  );
}

export function ProjectListItem({
  compact = false,
  project,
  selected,
  onToggleSelected,
}: {
  compact?: boolean;
  project: DemoProject;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const projectHref = demoHref(`/projects/${project.id}`);
  const sectionCountLabel = `${project.sectionCount} 小节`;

  return (
    <ProjectListCardShell
      compact={compact}
      selected={selected}
      leading={(
        <>
          <Checkbox
            className={s.projectSelectCheckbox}
            checked={selected}
            label={selected ? `取消选择项目：${project.title}` : `选择项目：${project.title}`}
            onCheckedChange={() => onToggleSelected()}
          />
          <Button className={s.projectDragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel={`拖拽排序项目：${project.title}`} />
        </>
      )}
      title={(
        <div className={s.projectListTitleRow}>
          <Link className={s.projectListTitleLink} href={projectHref}>
            <strong>{project.title}</strong>
            <span>{sectionCountLabel}</span>
          </Link>
          <div className={s.projectItemActions}>
            <Button
              tone="danger"
              icon={Trash2}
              iconOnly
              ariaLabel={`删除项目：${project.title}`}
              size="sm"
              feedback={{ tone: "warning", title: "删除项目需要确认", detail: project.title }}
            />
          </div>
        </div>
      )}
      body={(
        <>
          <Link aria-label={`打开项目最近结果：${project.title}`} className={s.projectListRecentResult} href={projectHref}>
            <ImageListSmall className={s.recentResultImages} images={project.images} limit={project.images.length} showCounts />
          </Link>
          <div className={s.projectListMeta}>
            <span className={cx(s.small, s.faint, s.projectUpdateDate)}>更新：{project.updatedAt}</span>
            <span className={s.projectStatusGroup}>
              <StatusBadge status={project.status} />
            </span>
          </div>
        </>
      )}
    />
  );
}
