"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
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
  const imageKey = image.src;
  const [loadFailedSrc, setLoadFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const loadFailed = imageKey !== "" && loadFailedSrc === imageKey;
  const shouldRenderImage = Boolean(imageKey) && !loadFailed;

  useEffect(() => {
    const node = imageRef.current;
    if (!node || !shouldRenderImage) return;
    const markBroken = () => {
      if (node.complete && node.naturalWidth === 0) {
        setLoadFailedSrc(imageKey);
      }
    };
    const frameId = window.requestAnimationFrame(markBroken);
    const intervalId = window.setInterval(markBroken, 250);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 2500);
    node.addEventListener("error", markBroken);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      node.removeEventListener("error", markBroken);
    };
  }, [imageKey, shouldRenderImage]);

  function handleImageError() {
    setLoadFailedSrc(imageKey);
  }

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    if (event.currentTarget.naturalWidth === 0) {
      setLoadFailedSrc(imageKey);
    }
  }

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
      <button className={s.imageThumbImageButton} type="button" onClick={onOpen} aria-label={`查看图片：${image.label}`}>
        {shouldRenderImage ? (
          <img
            src={image.src}
            alt={image.label}
            width={image.width ?? 1}
            height={image.height ?? 1}
            fetchPriority={priority ? "high" : "auto"}
            loading="eager"
            onError={handleImageError}
            onLoad={handleImageLoad}
            ref={imageRef}
          />
        ) : (
          <ImageIcon className={s.iconXl} aria-hidden="true" />
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
