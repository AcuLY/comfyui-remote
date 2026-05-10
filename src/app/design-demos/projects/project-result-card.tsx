"use client";

import { Archive, Check, ChevronDown, ChevronUp, Eye, Square, Star, Trash2 } from "lucide-react";

import type { DemoImage, DemoSection } from "../design-demo-data";
import { sectionAnchorId } from "../design-demo-utils";
import type { ResultDemoFilter } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { Button } from "../ui/button";
import { DemoTabs } from "../ui/demo-tabs";
import { ImageGrid } from "../ui/image-grid";
import { StatusBadge } from "../ui/status-badge";

export function ProjectResultsToolbar({
  images,
  filter,
  onFilterChange,
}: {
  images: DemoImage[];
  filter: ResultDemoFilter;
  onFilterChange: (filter: ResultDemoFilter) => void;
}) {
  return (
    <div className={s.projectSectionToolbar}>
      <div>
        <strong>小节结果</strong>
        <span>{images.length} 张图片 · {images.filter((image) => image.status === "pending").length} 张待审</span>
      </div>
      <div className={s.toolbar}>
        <DemoTabs
          tabs={[
            { key: "all", label: "全部", count: images.length },
            { key: "pending", label: "待审", count: images.filter((image) => image.status === "pending").length },
            { key: "kept", label: "保留", count: images.filter((image) => image.status === "kept").length },
            { key: "pstation", label: "p站", count: images.filter((image) => image.featured).length },
            { key: "preview", label: "预览", count: images.filter((image) => image.featured2).length },
            { key: "cover", label: "封面", count: images.filter((image) => image.cover).length },
          ]}
          value={filter}
          onChange={onFilterChange}
        />
      </div>
    </div>
  );
}

export function ProjectSectionResultCard({
  collapsed,
  images,
  index,
  onToggleCollapsed,
  section,
}: {
  collapsed: boolean;
  images: DemoImage[];
  index: number;
  onToggleCollapsed: () => void;
  section: DemoSection;
}) {
  const visibleImages = collapsed ? images.slice(0, 4) : images;
  const pendingCount = images.filter((image) => image.status === "pending").length;
  const keptCount = images.filter((image) => image.status === "kept").length;
  const featuredCount = images.filter((image) => image.featured || image.featured2).length;
  const canCollapse = images.length > 4;

  return (
    <section className={s.resultSectionBlock} data-section-card={section.id} id={sectionAnchorId(section)}>
      <div className={s.resultSectionHeader}>
        <div className={s.resultSectionTitle}>
          <div className={s.sectionCardTitleLine}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{section.name}</strong>
          </div>
        </div>
        <div className={s.resultSectionActions}>
          <StatusBadge status="pending" label={`${pendingCount} 待审`} />
          <StatusBadge status="kept" label={`${keptCount} 保留`} />
          <StatusBadge status="review" label={`${featuredCount} p站/预览`} />
          {canCollapse ? (
            <Button tone="subtle" icon={collapsed ? ChevronDown : ChevronUp} onClick={onToggleCollapsed}>
              {collapsed ? "展开" : "折叠"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className={s.resultActionBar}>
        <Button tone="subtle" icon={Square}>选择本节</Button>
        <Button icon={Check} feedback={{ title: "本节图片已加入保留队列" }}>保留</Button>
        <Button tone="pink" icon={Star} feedback={{ title: "本节图片已加入 p站 标记队列" }}>p站</Button>
        <Button tone="pink" icon={Eye} feedback={{ title: "本节图片已加入预览标记队列" }}>预览</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "本节图片已加入删除队列" }}>删除</Button>
        <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近结果操作已撤销" }}>撤销</Button>
      </div>
      <ImageGrid images={visibleImages} />
    </section>
  );
}
