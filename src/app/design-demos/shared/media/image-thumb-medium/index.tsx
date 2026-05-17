"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */
import type * as React from "react";
import { ImageIcon } from "lucide-react";

import type { DemoImage } from "../../../data";
import { cx } from "../../../routing";
import { Checkbox } from "../../primitives/checkbox";
import s from "../image/image.module.css";
import { StatusBadge } from "../../primitives/status-badge";
import { imageReviewLabel } from "../../primitives/shared/utils";

export function ImageThumbMedium({
  actionSlot,
  actionsAlwaysVisible = false,
  image,
  onOpen,
  onSelect,
  priority = false,
  selectable = false,
  selected = false,
  showStatus = true,
  tags = [],
}: {
  actionSlot?: React.ReactNode;
  actionsAlwaysVisible?: boolean;
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
        <Checkbox
          checked={selected}
          label={selected ? "取消选择图片" : "选择图片"}
          onCheckedChange={() => onSelect?.()}
          stopPropagation
          variant="overlay"
        />
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
          <StatusBadge className={s.imageThumbStatusBadge} status={image.status} label={imageReviewLabel(image.status)} />
        </div>
      ) : null}
      {actionSlot ? (
        <div className={cx(s.imageThumbActions, !showStatus && s.imageThumbActionsFlush, actionsAlwaysVisible && s.imageThumbActionsVisible)}>
          {actionSlot}
        </div>
      ) : null}
    </article>
  );
}
