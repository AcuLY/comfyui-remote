"use client";

import type * as React from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import type { DemoImage } from "../../design-demo-data";
import s from "../image/image.module.css";
import { Button } from "../button";
import { ImagePreviewFrame } from "../image-preview-frame";

export function ImagePreviewLarge({
  actions,
  image,
  meta,
  onClose,
  onNext,
  onPrevious,
  nextDisabled = false,
  previousDisabled = false,
  title,
}: {
  actions?: React.ReactNode;
  image: DemoImage;
  meta?: string;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  nextDisabled?: boolean;
  previousDisabled?: boolean;
  title?: string;
}) {
  const hasNavigation = Boolean(onPrevious || onNext);
  const hasFooter = hasNavigation || Boolean(actions);

  return (
    <div className={s.lightboxOverlay} role="dialog" aria-modal="true" aria-label="图片预览">
      <div className={s.lightboxPanel}>
        <div className={s.lightboxChrome}>
          <div>
            <strong>{title ?? image.label}</strong>
            {meta ? <span>{meta}</span> : null}
          </div>
          <Button tone="subtle" icon={X} iconOnly size="sm" onClick={onClose} ariaLabel="关闭预览" />
        </div>
        <div className={s.lightboxImage}>
          <ImagePreviewFrame image={image} interactive key={image.id} priority />
        </div>
        {hasFooter ? (
          <div className={s.lightboxFooter}>
            {hasNavigation ? (
              <div className={s.lightboxNavigation}>
                <Button icon={ArrowLeft} onClick={onPrevious} disabled={!onPrevious || previousDisabled}>
                  上一张
                </Button>
                <Button icon={ArrowRight} onClick={onNext} disabled={!onNext || nextDisabled}>
                  下一张
                </Button>
              </div>
            ) : null}
            {actions ? <div className={s.lightboxActions}>{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
