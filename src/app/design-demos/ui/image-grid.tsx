"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Check, Eye, Star, Trash2 } from "lucide-react";

import type { DemoImage } from "../design-demo-data";
import s from "./ui.module.css";
import { Button } from "./button";
import { ImageListMedium } from "./image-list-medium";
import { ImagePreviewLarge } from "./image-preview-large";
import { ImageThumbMedium } from "./image-thumb-medium";

export function ImageGrid({
  images,
  showStatus = true,
  selectable = false,
}: {
  images: DemoImage[];
  showStatus?: boolean;
  selectable?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex] ?? null;

  useEffect(() => {
    if (activeIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current === null ? 0 : Math.max(current - 1, 0)));
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current === null ? 0 : Math.min(current + 1, images.length - 1)));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length]);

  if (images.length === 0) return <div className={s.empty}>没有可用图片</div>;
  const portalTarget = activeImage && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>("[data-design-demo-shell]") ?? document.body
    : null;
  return (
    <>
      <ImageListMedium>
        {images.map((image, index) => (
          <ImageThumbMedium
            image={image}
            key={`${image.id}-${index}`}
            onOpen={() => setActiveIndex(index)}
            priority={index === 0}
            selectable={selectable}
            showStatus={showStatus}
            tags={[]}
          />
        ))}
      </ImageListMedium>
      {activeImage && portalTarget ? createPortal(
        <ImagePreviewLarge
          image={activeImage}
          meta={`${activeIndex! + 1} / ${images.length}`}
          onClose={() => setActiveIndex(null)}
          onNext={() => setActiveIndex((current) => (current === null ? 0 : Math.min(current + 1, images.length - 1)))}
          onPrevious={() => setActiveIndex((current) => (current === null ? 0 : Math.max(current - 1, 0)))}
          nextDisabled={activeIndex === images.length - 1}
          previousDisabled={activeIndex === 0}
          actions={(
            <>
              <Button icon={Check} feedback={{ title: "图片已加入保留队列", detail: activeImage.label }}>
                保留
              </Button>
              <Button tone="pink" icon={Star} feedback={{ title: "图片已加入精选队列", detail: activeImage.label }}>
                精选
              </Button>
              <Button tone="pink" icon={Eye} feedback={{ title: "图片已加入预览队列", detail: activeImage.label }}>
                预览
              </Button>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "图片已加入删除队列", detail: activeImage.label }}>
                删除
              </Button>
              <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销</Button>
            </>
          )}
        />,
        portalTarget,
      ) : null}
    </>
  );
}
