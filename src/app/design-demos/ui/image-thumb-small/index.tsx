"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */
import { ImageIcon } from "lucide-react";

import type { DemoImage } from "../../design-demo-data";
import { cx } from "../../design-demo-utils";
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
  return (
    <span
      className={cx(s.thumbSmall, wide && s.thumbSmallWide)}
      data-demo-ui-image-thumb-small="true"
      data-demo-ui-image-thumb-small-wide={wide ? "true" : undefined}
    >
      {image.src ? (
        <img
          src={image.src}
          alt=""
          fetchPriority={priority ? "high" : "auto"}
          loading="eager"
        />
      ) : (
        <ImageIcon className={s.iconLg} />
      )}
    </span>
  );
}
