"use client";

import Link from "next/link";
import { CheckSquare, GripVertical, Square, Trash2 } from "lucide-react";

import type { DemoProject } from "../design-demo-data";
import { cx, demoHref } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { Button } from "../ui/button";
import { ImageListSmall } from "../ui/image-list-small";
import { StatusBadge } from "../ui/status-badge";

export function ProjectListItem({
  project,
  selected,
  onToggleSelected,
}: {
  project: DemoProject;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const projectHref = demoHref(`/projects/${project.id}`);
  const sectionCountLabel = `${project.sectionCount} 小节`;

  return (
    <article className={cx(s.projectListCard, selected && s.projectListCardSelected)}>
      <div className={s.projectItemControls}>
        <Button
          ariaLabel={selected ? `取消选择项目：${project.title}` : `选择项目：${project.title}`}
          className={s.projectSelectButton}
          icon={selected ? CheckSquare : Square}
          iconOnly
          onClick={onToggleSelected}
          pressed={selected}
        />
        <Button className={s.projectDragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel={`拖拽排序项目：${project.title}`} />
      </div>
      <div className={s.projectListContent}>
        <div className={s.projectListTitleRow}>
          <Link className={s.projectListTitleLink} href={projectHref}>
            <strong>{project.title}</strong>
            <span>{sectionCountLabel}</span>
          </Link>
          <div className={s.projectItemActions}>
            <Button
              tone="danger"
              icon={Trash2}
              size="sm"
              feedback={{ tone: "warning", title: "删除项目需要确认", detail: project.title }}
            >
              删除
            </Button>
          </div>
        </div>
        <Link aria-label={`打开项目最近结果：${project.title}`} className={s.projectListRecentResult} href={projectHref}>
          <ImageListSmall className={s.recentResultImages} images={project.images} limit={project.images.length} showCounts />
        </Link>
        <div className={s.projectListMeta}>
          <span className={cx(s.small, s.faint, s.projectUpdateDate)}>更新：{project.updatedAt}</span>
          <span className={s.projectStatusGroup}>
            <StatusBadge status={project.status} />
          </span>
        </div>
      </div>
    </article>
  );
}
