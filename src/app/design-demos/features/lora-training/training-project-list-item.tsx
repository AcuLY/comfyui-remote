"use client";

import Link from "next/link";
import { GripVertical, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { cx, demoHref } from "../../routing";
import { ImageListSmall } from "../../shared/media/image-list-small";
import { Button } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { useDemoSortable } from "../../shared/primitives/sortable";
import { UnitRowShell } from "../../shared/patterns";
import type { LoraTrainingProject } from "./types";
import s from "./training-projects-page.module.css";

function projectStatusLabel(status: LoraTrainingProject["status"]) {
  if (status === "ready") return "可训练";
  if (status === "training") return "训练中";
  if (status === "draft") return "待补齐";
  return "已归档";
}

function projectStatusTone(status: LoraTrainingProject["status"]) {
  if (status === "ready") return "ready";
  if (status === "training") return "running";
  if (status === "draft") return "draft";
  return "archived";
}

export function TrainingProjectCardShell({
  body,
  compact = false,
  leading,
  selected = false,
  title,
}: {
  body: ReactNode;
  compact?: boolean;
  leading?: ReactNode;
  selected?: boolean;
  title: ReactNode;
}) {
  return (
    <UnitRowShell
      className={cx(s.projectCard, compact && s.projectCardCompact, selected && s.projectCardSelected)}
      leadingClassName={leading ? s.projectControls : undefined}
      mainClassName={s.projectContent}
      bodyClassName={s.projectBody}
      titleClassName={s.projectTitleSlot}
      leading={leading}
      title={title}
      body={body}
    />
  );
}

export function TrainingProjectListItem({
  compact = false,
  onDelete,
  onToggleSelected,
  project,
  selected,
}: {
  compact?: boolean;
  onDelete?: () => void;
  onToggleSelected: () => void;
  project: LoraTrainingProject;
  selected: boolean;
}) {
  const projectHref = demoHref(`/training/projects/${project.id}`);
  const sectionCountLabel = `${project.sectionCount} 小节`;
  const { ref, style, handleProps } = useDemoSortable(project.id);

  return (
    <div ref={ref} style={style}>
      <TrainingProjectCardShell
        compact={compact}
        selected={selected}
        leading={(
          <>
            <Checkbox
              className={s.projectSelectCheckbox}
              checked={selected}
              label={selected ? `取消选择训练项目：${project.title}` : `选择训练项目：${project.title}`}
              onCheckedChange={() => onToggleSelected()}
            />
            <button
              type="button"
              className={s.projectDragHandle}
              aria-label={`拖拽排序训练项目：${project.title}`}
              {...handleProps}
            >
              <GripVertical aria-hidden="true" />
            </button>
          </>
        )}
        title={(
          <div className={s.projectTitleRow}>
            <Link className={s.projectTitleLink} href={projectHref}>
              <strong>{project.title}</strong>
              <span>{sectionCountLabel}</span>
            </Link>
            <div className={s.projectActions}>
              <Button
                tone="danger"
                icon={Trash2}
                iconOnly
                ariaLabel={`删除训练项目：${project.title}`}
                size="sm"
                onClick={onDelete}
                feedback={{ tone: "warning", title: "训练项目已从列表移除", detail: project.title }}
              />
            </div>
          </div>
        )}
        body={(
          <>
            <Link aria-label={`打开训练项目最近结果：${project.title}`} className={s.projectRecentResults} href={projectHref}>
              <ImageListSmall className={s.recentResultImages} images={project.images} limit={project.images.length} showCounts />
            </Link>
            <div className={s.projectMeta}>
              <span className={s.projectMetaText}>更新：{project.updatedAt}</span>
              <span className={s.projectStatusGroup}>
                <StatusBadge status={projectStatusTone(project.status)} label={projectStatusLabel(project.status)} />
              </span>
            </div>
          </>
        )}
      />
    </div>
  );
}
