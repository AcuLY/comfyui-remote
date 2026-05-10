"use client";

import type { CSSProperties } from "react";
import { Children, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cx } from "../design-demo-utils";
import s from "./ui.module.css";

type ImageListMediumStyle = CSSProperties & {
  "--demo-image-list-gap"?: string;
  "--demo-image-list-max-height"?: string;
  "--demo-image-list-max-width"?: string;
};

export function ImageListMedium({
  actionPanel,
  children,
  className,
  defaultExpanded = false,
  emptyLabel = "没有可用图片",
  gap,
  maxHeight,
  maxWidth,
  selectPanel,
  summary,
}: {
  actionPanel?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
  emptyLabel?: string;
  gap?: number;
  maxHeight?: number | string;
  maxWidth?: number | string;
  selectPanel?: React.ReactNode;
  summary?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const childrenArray = Children.toArray(children).filter(Boolean);
  const hasItems = childrenArray.length > 0;
  const collapsible = maxHeight !== undefined;
  const style: ImageListMediumStyle = {};
  if (gap !== undefined) style["--demo-image-list-gap"] = `${gap}px`;
  if (maxHeight !== undefined) style["--demo-image-list-max-height"] = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
  if (maxWidth !== undefined) style["--demo-image-list-max-width"] = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  if (!hasItems) return <div className={s.empty}>{emptyLabel}</div>;

  return (
    <div className={cx(s.imageListMedium, className)} style={style}>
      <div className={s.imageListMediumMain}>
        {summary || selectPanel ? (
          <div className={s.imageListMediumHeader}>
            {summary ? <div className={s.imageListMediumSummary}>{summary}</div> : <span />}
            {selectPanel ? <div className={s.imageListMediumSelectPanel}>{selectPanel}</div> : null}
          </div>
        ) : null}
        <div className={s.imageListMediumViewport} data-expanded={!collapsible || expanded}>
          <div className={s.imageListMediumGrid}>
            {childrenArray}
          </div>
          {collapsible && !expanded ? <div className={s.imageListMediumFade} aria-hidden="true" /> : null}
        </div>
        {collapsible ? (
          <button className={s.imageListMediumExpand} type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronUp className={s.icon} /> : <ChevronDown className={s.icon} />}
            {expanded ? "收起" : "展开全部"}
          </button>
        ) : null}
      </div>
      {actionPanel ? (
        <div className={s.imageListMediumActionTrack}>
          <div className={s.imageListMediumActionPanel}>{actionPanel}</div>
        </div>
      ) : null}
    </div>
  );
}
