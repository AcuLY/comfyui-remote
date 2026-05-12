"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Star, Trash2 } from "lucide-react";

import type { DemoData } from "../design-demo-data";
import s from "./images-page.showcase.module.css";
import { Button } from "../ui/button";
import { ImageGrid } from "../ui/image-grid";
import { ImageListMedium } from "../ui/image-list-medium";
import { ImageListSmall } from "../ui/image-list-small";
import { ImagePreviewLarge } from "../ui/image-preview-large";
import { ImageThumbMedium } from "../ui/image-thumb-medium";
import { ImageThumbSmall } from "../ui/image-thumb-small";
import { PageHeader } from "../ui/page-header";
import { ReviewImageBoard } from "../ui/review-image-board";
import { makeImages } from "./helpers";
import { ShowcaseItem } from "./showcase-item";

function MediumThumbActions() {
  return (
    <>
      <Button icon={Check} iconOnly size="sm" ariaLabel="保留" />
      <Button tone="pink" icon={Star} iconOnly size="sm" ariaLabel="精选" />
      <Button tone="pink" icon={Eye} iconOnly size="sm" ariaLabel="预览" />
      <Button tone="danger" icon={Trash2} iconOnly size="sm" ariaLabel="删除" />
    </>
  );
}

export function ComponentShowcaseImages({ data }: { data: DemoData }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const images = useMemo(() => {
    const fromData = data.projects.flatMap((project) => project.sections.flatMap((section) => section.images));
    const sourceImages = fromData.length >= 6 ? fromData.slice(0, 12) : makeImages(12);
    return sourceImages.map((image, index) => ({ ...image, id: `${image.id}-${index}` }));
  }, [data.projects]);

  const mediumThumbImages = useMemo(() => (
    images.slice(0, 4).map((image, index) => (
      index === 0
        ? { ...image, status: "kept" as const, featured: true, featured2: true, cover: true }
        : image
    ))
  ), [images]);

  const previewImage = previewIndex !== null ? images[previewIndex] ?? null : null;

  function toggleImage(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="图片组件" subtitle="7 个图片相关组件" />

      {/* 3.1 ImageThumbSmall */}
      <ShowcaseItem name="ImageThumbSmall" desc="小缩略图">
        <div className={s.showcaseRow}>
          {images.slice(0, 5).map((img, index) => (
            <ImageThumbSmall key={`${img.id}-small-${index}`} image={img} />
          ))}
        </div>
      </ShowcaseItem>

      {/* 3.2 ImageThumbMedium */}
      <ShowcaseItem name="ImageThumbMedium" desc="中缩略图（选择、状态、操作槽）">
        <div className={s.showcaseRow}>
          {mediumThumbImages.map((img, i) => (
            <ImageThumbMedium
              actionSlot={<MediumThumbActions />}
              actionsAlwaysVisible={i === 0}
              key={`${img.id}-medium-${i}`}
              image={img}
              selectable
              selected={selectedIds.has(img.id)}
              onSelect={() => toggleImage(img.id)}
              onOpen={() => setPreviewIndex(i)}
              showStatus
            />
          ))}
        </div>
      </ShowcaseItem>

      {/* 3.3 ImageListSmall */}
      <ShowcaseItem name="ImageListSmall" desc="横向滚动小图列表，项目 / 小节图片条直接复用它">
        <div className={s.showcaseImageList}>
          <ImageListSmall images={images} limit={8} maxWidth={420} showCounts />
        </div>
        <hr className={s.showcaseDivider} />
        <ImageListSmall images={images} limit={12} maxWidth={640} showCounts />
      </ShowcaseItem>

      {/* 3.4 ImageListMedium */}
      <ShowcaseItem name="ImageListMedium" desc="中图网格列表（可折叠）">
        <ImageListMedium images={images.slice(0, 8)} maxHeight={320} showCounts summary={`已选 ${selectedIds.size} 张`}>
          {images.slice(0, 8).map((img, i) => (
            <ImageThumbMedium
              key={`${img.id}-list-medium-${i}`}
              image={img}
              selectable
              selected={selectedIds.has(img.id)}
              onSelect={() => toggleImage(img.id)}
              onOpen={() => setPreviewIndex(i)}
              showStatus={img.status !== "pending"}
            />
          ))}
        </ImageListMedium>
      </ShowcaseItem>

      {/* 3.5 ImageGrid */}
      <ShowcaseItem name="ImageGrid" desc="图片网格 + Lightbox 预览">
        <ImageGrid images={images.slice(0, 6)} showStatus selectable />
      </ShowcaseItem>

      {/* 3.6 ReviewImageBoard */}
      <ShowcaseItem name="ReviewImageBoard" desc="审核图片面板">
        <ReviewImageBoard images={images.slice(0, 6)} />
      </ShowcaseItem>

      {/* 3.7 ImagePreviewFrame (internal - shown through Lightbox) */}

      {/* 3.8 ImagePreviewLarge (Lightbox) */}
      <ShowcaseItem name="ImagePreviewLarge" desc="全屏 Lightbox 预览">
        <Button icon={Eye} onClick={() => setPreviewIndex(0)}>打开 Lightbox</Button>
      </ShowcaseItem>

      {previewImage && (
        <ImagePreviewLarge
          actions={<>
            <Button icon={Check}>保留</Button>
            <Button tone="pink" icon={Star}>精选</Button>
            <Button tone="danger" icon={Trash2}>删除</Button>
          </>}
          image={previewImage}
          meta={`${previewIndex! + 1} / ${images.length}`}
          onClose={() => setPreviewIndex(null)}
          onNext={() => setPreviewIndex((c) => c === null ? 0 : (c + 1) % images.length)}
          onPrevious={() => setPreviewIndex((c) => c === null ? 0 : (c + images.length - 1) % images.length)}
        />
      )}
    </div>
  );
}
