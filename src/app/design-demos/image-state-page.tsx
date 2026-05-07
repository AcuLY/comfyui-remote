"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Star, Trash2 } from "lucide-react";

import type { DemoData, DemoImage } from "./design-demo-data";
import {
  Button,
  ImagePreviewFrame,
  ImagePreviewLarge,
  ImageThumbMedium,
  ImageThumbSmall,
  PageHeader,
} from "./design-demo-ui";
import s from "./design-demo.module.css";

const SAMPLE_COLORS = [
  ["#4f46e5", "#14b8a6", "#f8fafc"],
  ["#0f766e", "#f59e0b", "#ecfeff"],
  ["#be185d", "#2563eb", "#fff7ed"],
  ["#047857", "#7c3aed", "#f0fdf4"],
  ["#b45309", "#0891b2", "#fffbeb"],
  ["#4338ca", "#db2777", "#eef2ff"],
  ["#0e7490", "#65a30d", "#f7fee7"],
  ["#9f1239", "#ea580c", "#fff1f2"],
];

function sampleVisual(index: number) {
  const [start, end, paper] = SAMPLE_COLORS[index % SAMPLE_COLORS.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${start}" offset="0"/>
          <stop stop-color="${end}" offset="1"/>
        </linearGradient>
        <radialGradient id="glow" cx="62%" cy="24%" r="56%">
          <stop stop-color="${paper}" stop-opacity=".92" offset="0"/>
          <stop stop-color="${paper}" stop-opacity="0" offset="1"/>
        </radialGradient>
      </defs>
      <rect width="800" height="1200" fill="url(#bg)"/>
      <circle cx="560" cy="270" r="390" fill="url(#glow)"/>
      <path d="M122 940 C250 718 342 670 466 780 C562 866 626 840 712 696 L712 1200 L122 1200 Z" fill="${paper}" opacity=".86"/>
      <path d="M150 238 C250 164 374 154 496 220 C416 260 318 350 236 472 C178 398 144 318 150 238 Z" fill="${paper}" opacity=".54"/>
      <circle cx="284" cy="468" r="88" fill="${paper}" opacity=".72"/>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function sampleImages(data: DemoData) {
  const fromRuns = data.runs.flatMap((run) => run.images);
  const fromProjects = data.projects.flatMap((project) => project.images);
  const unique = new Map<string, DemoImage>();
  [...fromRuns, ...fromProjects, ...data.images].forEach((image) => {
    if (!unique.has(image.id)) unique.set(image.id, image);
  });
  return [...unique.values()].slice(0, 8).map((image, index) => {
    const visual = sampleVisual(index);
    return {
      ...image,
      src: visual,
      full: visual,
    };
  });
}

export function ImageStatePage({ data }: { data: DemoData }) {
  const images = useMemo(() => sampleImages(data), [data]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(images.slice(0, 2).map((image) => image.id)));
  const [activeImage, setActiveImage] = useState<DemoImage | null>(images[0] ?? null);
  const [lightboxImage, setLightboxImage] = useState<DemoImage | null>(null);

  function toggleSelected(imageId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Demo"
        title="图片展示状态检查"
        subtitle="小缩略图、中等缩略图和大图预览统一为纵向 2:3 缩略图加原图浏览。"
      />
      <div className={s.imageStateGrid}>
        <section className={s.imageStateSurface}>
          <div className={s.tabPanelHeader}>
            <div>
              <strong>小缩略图</strong>
              <span>卡片内预览 / 队列行</span>
            </div>
          </div>
          <div className={s.imageStateSmallRow}>
            {images.slice(0, 6).map((image, index) => (
              <ImageThumbSmall image={image} key={image.id} priority={index === 0} />
            ))}
          </div>
        </section>

        <section className={s.imageStateSurface}>
          <div className={s.tabPanelHeader}>
            <div>
              <strong>中等缩略图</strong>
              <span>结果列表 / 审核操作</span>
            </div>
          </div>
          <div className={s.imageStateMediumGrid}>
            {images.slice(0, 6).map((image, index) => (
              <ImageThumbMedium
                actionSlot={(
                  <>
                    <button className={s.resultThumbAction} data-tone="keep" type="button" aria-label="保留">
                      <Check className="size-3.5" />
                    </button>
                    <button className={s.resultThumbAction} data-tone="star" type="button" aria-label="精选">
                      <Star className="size-3.5" />
                    </button>
                    <button className={s.resultThumbAction} data-tone="trash" type="button" aria-label="删除">
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
                image={image}
                key={image.id}
                onOpen={() => {
                  setActiveImage(image);
                  setLightboxImage(image);
                }}
                onSelect={() => toggleSelected(image.id)}
                priority={index === 0}
                selectable
                selected={selectedIds.has(image.id)}
                showStatus
              />
            ))}
          </div>
        </section>

        <section className={s.imageStateSurface}>
          <div className={s.tabPanelHeader}>
            <div>
              <strong>大图预览</strong>
              <span>原图浏览 / contain</span>
            </div>
          </div>
          <div className={s.imageStatePreview}>
            {activeImage ? (
              <ImagePreviewFrame
                image={activeImage}
                onOpen={() => setLightboxImage(activeImage)}
                priority
              />
            ) : null}
          </div>
          <div className={s.toolbar}>
            <Button icon={Eye} onClick={() => setLightboxImage(activeImage ?? images[0] ?? null)}>打开预览</Button>
          </div>
        </section>
      </div>
      {lightboxImage ? (
        <ImagePreviewLarge
          actions={(
            <>
              <Button icon={Check}>保留</Button>
              <Button tone="pink" icon={Star}>精选</Button>
              <Button tone="danger" icon={Trash2}>删除</Button>
            </>
          )}
          image={lightboxImage}
          meta="原图浏览"
          onClose={() => setLightboxImage(null)}
        />
      ) : null}
    </div>
  );
}
