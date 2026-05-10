"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckSquare, Copy, GripVertical, Play, Square, Trash2 } from "lucide-react";

import type { DemoProject, DemoSection } from "../design-demo-data";
import { cx, demoHref, rawSectionId, sectionAnchorId, sectionRunStatus } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { Button } from "../ui/button";
import { ImageStrip } from "../ui/image-strip";
import { StatusBadge } from "../ui/status-badge";
import { BATCH_SIZE_OPTIONS, BatchSizeSelector } from "./batch-size-selector";

export function ProjectSectionCard({
  compact,
  index,
  project,
  section,
  selected,
  onToggleSelection,
}: {
  compact: boolean;
  index: number;
  project: DemoProject;
  section: DemoSection;
  selected: boolean;
  onToggleSelection: () => void;
}) {
  const runStatus = sectionRunStatus(section, index);
  const defaultBatchSize = BATCH_SIZE_OPTIONS.includes(section.batchSize) ? section.batchSize : 2;
  const [batchSize, setBatchSize] = useState(defaultBatchSize);

  return (
    <article
      className={cx(s.sectionCard, compact && s.sectionCardCompact, selected && s.sectionCardSelected)}
      data-section-card={section.id}
      id={sectionAnchorId(section)}
    >
      <div className={s.sectionCardMain}>
        <Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
        <Button
          ariaLabel={selected ? "取消选择小节" : "选择小节"}
          className={s.sectionSelectButton}
          icon={selected ? CheckSquare : Square}
          iconOnly
          onClick={onToggleSelection}
          pressed={selected}
        />
        <Link className={s.sectionCardContent} href={demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`)}>
          <div className={s.sectionCardHeader}>
            <div className={s.sectionCardTitle}>
              <div className={s.sectionCardTitleLine}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{section.name}</strong>
              </div>
            </div>
            <StatusBadge status={runStatus.status} label={runStatus.label} />
          </div>
          {!compact ? (
            <div className={s.sectionCardBody}>
              <ImageStrip images={section.images} wide />
            </div>
          ) : null}
        </Link>
      </div>
      <div className={s.sectionCardActions}>
        <div className={s.sectionRunControl}>
          <Button icon={Play} feedback={{ title: "小节运行已加入任务", detail: `${section.name} · batch ${batchSize}` }}>运行</Button>
          <BatchSizeSelector value={batchSize} onChange={setBatchSize} />
        </div>
        <Button tone="subtle" icon={Copy} feedback={{ title: "小节已复制", detail: section.name }}>复制</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "删除小节需要确认", detail: section.name }}>删除</Button>
      </div>
    </article>
  );
}
