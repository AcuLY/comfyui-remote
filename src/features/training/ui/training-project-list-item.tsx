"use client";

import Link from "next/link";
import { GripVertical, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { ImageListSmall } from "@/components/design-demo-ui/media/image-list-small";
import { UnitRowShell } from "@/components/design-demo-ui/patterns";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import type { LoraTrainingProject } from "@/features/training/types";
import s from "./training-project-list-item.module.css";

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
      className={cx(s.trainingProjectCard, compact && s.trainingProjectCardCompact, selected && s.trainingProjectCardSelected)}
      leadingClassName={leading ? s.trainingProjectControls : undefined}
      mainClassName={s.trainingProjectContent}
      bodyClassName={s.trainingProjectBody}
      titleClassName={s.trainingProjectTitleSlot}
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
  const hrefForRoute = useRouteHref();
  const projectHref = hrefForRoute(`/training/projects/${project.id}`);
  const sectionCountLabel = `${project.sectionCount} 小节`;
  const recentResultImages = project.resultPool.map((result) => result.image);
  const { ref, style, handleProps } = useDemoSortable(project.id);

  return (
    <div ref={ref} style={style}>
      <TrainingProjectCardShell
        compact={compact}
        selected={selected}
        leading={(
          <>
            <Checkbox
              className={s.trainingProjectSelectCheckbox}
              checked={selected}
              label={selected ? `取消选择训练项目：${project.title}` : `选择训练项目：${project.title}`}
              onCheckedChange={() => onToggleSelected()}
            />
            <button
              type="button"
              className={s.trainingProjectDragHandle}
              aria-label={`拖拽排序训练项目：${project.title}`}
              {...handleProps}
            >
              <GripVertical aria-hidden="true" />
            </button>
          </>
        )}
        title={(
          <div className={s.trainingProjectTitleRow}>
            <Link className={s.trainingProjectTitleLink} href={projectHref}>
              <strong>{project.title}</strong>
              <span>{sectionCountLabel}</span>
            </Link>
            <div className={s.trainingProjectActions}>
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
            <Link aria-label={`打开训练项目最近结果：${project.title}`} className={s.trainingProjectRecentResults} href={projectHref}>
              <ImageListSmall className={s.recentResultImages} images={recentResultImages} limit={recentResultImages.length} showCounts />
            </Link>
            <div className={s.trainingProjectMeta}>
              <span className={s.trainingProjectMetaText}>更新：{project.updatedAt}</span>
              <span className={s.trainingProjectStatusGroup}>
                <StatusBadge status={projectStatusTone(project.status)} label={projectStatusLabel(project.status)} />
              </span>
            </div>
          </>
        )}
      />
    </div>
  );
}
