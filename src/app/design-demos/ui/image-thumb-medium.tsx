"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */
import type * as React from "react";
import { Check, ImageIcon, Square } from "lucide-react";

import type { DemoImage } from "../design-demo-data";
import { cx } from "../design-demo-utils";
import s from "./ui.module.css";
import { StatusBadge } from "./status-badge";
import { imageReviewLabel, imageTagLabels } from "./utils";

export function ImageThumbMedium({
  actionSlot,
  image,
  onOpen,
  onSelect,
  priority = false,
  selectable = false,
  selected = false,
  showStatus = true,
  tags = imageTagLabels(image),
}: {
  actionSlot?: React.ReactNode;
  image: DemoImage;
  onOpen?: () => void;
  onSelect?: () => void;
  priority?: boolean;
  selectable?: boolean;
  selected?: boolean;
  showStatus?: boolean;
  tags?: string[];
}) {
  return (
    <article className={cx(s.imageThumbMedium, selected && s.imageThumbMediumSelected)}>
      {selectable ? (
        <button
          className={s.imageThumbSelect}
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={selected ? "取消选择" : "选择图片"}
        >
          {selected ? <Check className={s.icon} /> : <Square className={s.icon} />}
        </button>
      ) : null}
      {tags.length > 0 ? (
        <div className={s.imageThumbTags}>
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      ) : null}
      <button className={s.imageThumbImageButton} type="button" onClick={onOpen} aria-label="查看图片">
        {image.src ? (
          <img
            src={image.src}
            alt=""
            fetchPriority={priority ? "high" : "auto"}
            loading="eager"
          />
        ) : (
          <ImageIcon className={s.iconXl} />
        )}
      </button>
      {showStatus ? (
        <div className={s.imageThumbOverlay}>
          <StatusBadge status={image.status} label={imageReviewLabel(image.status)} />
        </div>
      ) : null}
      {actionSlot ? <div className={cx(s.imageThumbActions, !showStatus && s.imageThumbActionsFlush)}>{actionSlot}</div> : null}
    </article>
  );
}
