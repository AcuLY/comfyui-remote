"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import type { DemoImage } from "../../../data";
import { cx } from "../../../routing";
import s from "../image/image.module.css";
import { ImageListStats } from "../image-list-stats";
import { ImageThumbSmall } from "../image-thumb-small";

export function ImageListSmall({
  className,
  images,
  limit = 10,
  maxWidth,
  showCounts = false,
  wide = false,
}: {
  className?: string;
  images: DemoImage[];
  limit?: number;
  maxWidth?: number | string;
  showCounts?: boolean;
  wide?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const visibleImages = images.slice(0, limit);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    let rafId = 0;
    const updateOverflow = () => {
      rafId = 0;
      const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
      const next = {
        left: node.scrollLeft > 1,
        right: node.scrollLeft < maxScrollLeft - 1,
      };
      setOverflow((current) => current.left === next.left && current.right === next.right ? current : next);
    };
    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateOverflow);
    };

    scheduleUpdate();
    node.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(node);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      node.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [visibleImages.length, maxWidth, wide]);

  if (images.length === 0) {
    return <div className={s.empty}>没有可用图片</div>;
  }
  const style: CSSProperties | undefined = maxWidth === undefined
    ? undefined
    : { maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth };
  return (
    <div
      className={cx(s.imageListSmallFrame, className)}
      data-overflow-left={overflow.left}
      data-overflow-right={overflow.right}
      style={style}
    >
      {showCounts ? <ImageListStats images={visibleImages} className={s.imageListSmallStats} /> : null}
      <div className={cx(s.imageListSmall, s.imageStrip)} ref={scrollRef}>
        {visibleImages.map((image, index) => (
          <ImageThumbSmall image={image} key={`${image.id}-${index}`} priority={index === 0} wide={wide} />
        ))}
      </div>
    </div>
  );
}
