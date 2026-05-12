import type { ReactNode } from "react";

import type { DemoImage } from "../../design-demo-data";
import { cx } from "../../design-demo-utils";
import s from "../image/image.module.css";

function getImageStats(images: DemoImage[]) {
  return {
    total: images.length,
    pending: images.filter((image) => image.status === "pending").length,
    kept: images.filter((image) => image.status === "kept").length,
    featured: images.filter((image) => image.featured || image.featured2 || image.cover).length,
  };
}

export function ImageListStats({
  className,
  images,
  lead,
}: {
  className?: string;
  images: DemoImage[];
  lead?: ReactNode;
}) {
  const stats = getImageStats(images);

  return (
    <div
      className={cx(s.imageListStats, className)}
      aria-label={`共 ${stats.total} 张，待审 ${stats.pending} 张，保留 ${stats.kept} 张，精选 ${stats.featured} 张`}
    >
      {lead ? <span className={s.imageListStatsLead}>{lead}</span> : null}
      <span>共 {stats.total} 张</span>
      <span>待审 {stats.pending}</span>
      <span>保留 {stats.kept}</span>
      <span>精选 {stats.featured}</span>
    </div>
  );
}
