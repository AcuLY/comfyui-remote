"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */
import type { SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";

import type { DemoImage } from "@/app/design-demos/data";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import s from "../image/image.module.css";

export function ImageThumbSmall({
  image,
  priority = false,
  wide = false,
}: {
  image: DemoImage;
  priority?: boolean;
  wide?: boolean;
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

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    if (event.currentTarget.naturalWidth === 0) {
      setLoadFailedSrc(imageKey);
    }
  }

  return (
    <span
      className={cx(s.thumbSmall, wide && s.thumbSmallWide)}
      data-demo-ui-image-thumb-small="true"
      data-demo-ui-image-thumb-small-wide={wide ? "true" : undefined}
    >
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
        <ImageIcon className={s.iconLg} aria-hidden="true" />
      )}
    </span>
  );
}
