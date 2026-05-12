"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, GripVertical, ImageIcon, Play, Trash2 } from "lucide-react";

import type { DemoProject, DemoSection } from "../design-demo-data";
import { cx, demoHref, rawSectionId, sectionAnchorId } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { Button } from "../ui/button";
import { ImageListSmall } from "../ui/image-list-small";
import { SegmentedControl } from "../ui/segmented-control";

const BATCH_SIZE_OPTIONS = [1, 2, 4, 8, 16];

export function ProjectSectionCard({
  compact,
  index,
  project,
  section,
}: {
  compact: boolean;
  index: number;
  project: DemoProject;
  section: DemoSection;
}) {
  const defaultBatchSize = BATCH_SIZE_OPTIONS.includes(section.batchSize) ? section.batchSize : 2;
  const [batchSize, setBatchSize] = useState(defaultBatchSize);
  const sectionHref = demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`);

  return (
    <article
      className={cx(s.sectionCard, compact && s.sectionCardCompact)}
      data-section-card={section.id}
      id={sectionAnchorId(section)}
    >
      <Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel={`拖拽排序小节：${section.name}`} />
      <div className={s.sectionCardContentPane}>
        <div className={s.sectionCardHeader}>
          <Link className={s.sectionCardTitleLink} href={sectionHref}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{section.name}</strong>
          </Link>
          <div className={s.sectionHeaderActions}>
            <Button tone="subtle" icon={Copy} iconOnly ariaLabel={`复制小节：${section.name}`} feedback={{ title: "小节已复制", detail: section.name }} />
            <Button tone="danger" icon={Trash2} iconOnly ariaLabel={`删除小节：${section.name}`} feedback={{ tone: "warning", title: "删除小节需要确认", detail: section.name }} />
          </div>
        </div>
        <Link aria-label={`打开第 ${index + 1} 小节最近结果：${section.name}`} className={s.sectionRecentResult} href={sectionHref}>
          <span className={s.sectionRecentHeader}>
            <ImageIcon aria-hidden="true" size={12} />
            <span>最近结果</span>
          </span>
          <ImageListSmall className={s.recentResultImages} images={section.images} limit={section.images.length} showCounts wide />
        </Link>
        <div className={s.sectionCardActions}>
          <SegmentedControl
            ariaLabel="运行批次"
            className={s.sectionBatchTabs}
            compact
            items={BATCH_SIZE_OPTIONS.map((option) => ({ value: option, label: option }))}
            onChange={setBatchSize}
            role="tablist"
            value={batchSize}
          />
          <Button tone="primary" icon={Play} feedback={{ title: "小节运行已加入任务", detail: `${section.name} · batch ${batchSize}` }}>运行</Button>
        </div>
      </div>
    </article>
  );
}
