"use client";

import Link from "next/link";
import { CheckSquare, Square, Trash2 } from "lucide-react";

import type { DemoProject, DemoProjectFolder } from "../design-demo-data";
import { compactFileName, cx, demoHref, projectPresetSummary } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { Button } from "../ui/button";
import { ImageStrip } from "../ui/image-strip";
import { StatusBadge } from "../ui/status-badge";
import { ProjectMoveMenu } from "./project-folders";

export function ProjectListItem({
  folders,
  project,
  selected,
  onMove,
  onToggleSelected,
}: {
  folders: DemoProjectFolder[];
  project: DemoProject;
  selected: boolean;
  onMove: (folderId: string | null) => void;
  onToggleSelected: () => void;
}) {
  return (
    <article className={cx(s.projectListCard, selected && s.projectListCardSelected)}>
      <Button
        ariaLabel={selected ? `取消选择项目：${project.title}` : `选择项目：${project.title}`}
        className={s.projectSelectButton}
        icon={selected ? CheckSquare : Square}
        iconOnly
        onClick={onToggleSelected}
        pressed={selected}
      />
      <Link className={s.projectListOpenArea} href={demoHref(`/projects/${project.id}`)}>
        <ImageStrip images={project.images} />
        <div className={s.cardHeader}>
          <div className={s.projectCardTitle}>
            <strong>{project.title}</strong>
            <span>{projectPresetSummary(project)}</span>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className={s.projectCardStats}>
          <StatusBadge status="sections" label={`${project.sectionCount} 小节`} />
          <StatusBadge status="checkpoint" label={compactFileName(project.checkpointName)} />
        </div>
        <div className={cx(s.small, s.faint)}>更新：{project.updatedAt}</div>
      </Link>
      <div className={s.projectItemActions}>
        <ProjectMoveMenu folders={folders} currentFolderId={project.folderId} onMove={onMove} />
        <Button tone="danger" icon={Trash2} iconOnly ariaLabel={`删除项目：${project.title}`} />
      </div>
    </article>
  );
}
