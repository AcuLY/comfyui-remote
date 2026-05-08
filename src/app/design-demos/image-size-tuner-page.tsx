"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { Check, Eye, Star, Trash2 } from "lucide-react";

import type { DemoImage } from "./design-demo-data";
import { Button, ImagePreviewFrame, ImageThumbMedium, ImageThumbSmall, ImagePreviewLarge, PageHeader } from "./design-demo-ui";
import s from "./design-demo-styles";

type TunerStyle = CSSProperties & {
  "--demo-tuner-small-width"?: string;
  "--demo-tuner-medium-width"?: string;
  "--demo-tuner-large-width"?: string;
  "--demo-tuner-large-height"?: string;
};

function svgImageDataUri(label: string, hue: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 78% 54%)"/>
          <stop offset="0.56" stop-color="hsl(${(hue + 48) % 360} 76% 48%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 136) % 360} 70% 42%)"/>
        </linearGradient>
        <pattern id="grid" width="90" height="90" patternUnits="userSpaceOnUse">
          <path d="M 90 0 L 0 0 0 90" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="3"/>
        </pattern>
      </defs>
      <rect width="1200" height="1800" fill="url(#bg)"/>
      <rect width="1200" height="1800" fill="url(#grid)" opacity="0.58"/>
      <circle cx="320" cy="420" r="180" fill="rgba(255,255,255,0.22)"/>
      <path d="M0 1340 C260 1130 420 1230 610 1010 C820 770 980 880 1200 690 L1200 1800 L0 1800 Z" fill="rgba(255,255,255,0.26)"/>
      <path d="M0 1490 C280 1250 500 1360 720 1120 C910 910 1040 990 1200 830 L1200 1800 L0 1800 Z" fill="rgba(3,8,18,0.22)"/>
      <text x="80" y="1640" fill="white" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const sampleImages: DemoImage[] = [
  {
    id: "tuner-small",
    src: svgImageDataUri("Small", 176),
    full: svgImageDataUri("Small", 176),
    label: "卡片缩略图",
    status: "kept",
    featured: false,
    featured2: false,
    cover: true,
    width: 1200,
    height: 1800,
  },
  {
    id: "tuner-medium",
    src: svgImageDataUri("Medium", 330),
    full: svgImageDataUri("Medium", 330),
    label: "结果列表图",
    status: "pending",
    featured: true,
    featured2: true,
    cover: false,
    width: 1200,
    height: 1800,
  },
  {
    id: "tuner-large",
    src: svgImageDataUri("Large", 218),
    full: svgImageDataUri("Large", 218),
    label: "放大浏览图",
    status: "kept",
    featured: true,
    featured2: false,
    cover: false,
    width: 1200,
    height: 1800,
  },
];

function clampSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function SizeControl({
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className={s.imageSizeTunerControl}>
      <span>
        <strong>{label}</strong>
        <code>{value}px</code>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(clampSize(Number(event.target.value), min, max))}
        step={step}
        type="range"
        value={value}
      />
      <input
        className={s.input}
        max={max}
        min={min}
        onChange={(event) => onChange(clampSize(Number(event.target.value), min, max))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function ThumbActionSlot() {
  return (
    <>
      <button className={s.iconMiniButton} type="button" aria-label="保留">
        <Check className={s.icon} />
      </button>
      <button className={s.iconMiniButton} type="button" aria-label="精选">
        <Star className={s.icon} />
      </button>
      <button className={s.iconMiniButton} type="button" aria-label="预览">
        <Eye className={s.icon} />
      </button>
      <button className={s.iconMiniButton} type="button" aria-label="删除">
        <Trash2 className={s.icon} />
      </button>
    </>
  );
}

export function ImageSizeTunerPage() {
  const [smallWidth, setSmallWidth] = useState(64);
  const [mediumWidth, setMediumWidth] = useState(152);
  const [largeWidth, setLargeWidth] = useState(720);
  const [largeHeight, setLargeHeight] = useState(520);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const smallHeight = Math.round(smallWidth * 1.5);
  const mediumHeight = Math.round(mediumWidth * 1.5);
  const tunerStyle: TunerStyle = {
    "--demo-tuner-small-width": `${smallWidth}px`,
    "--demo-tuner-medium-width": `${mediumWidth}px`,
    "--demo-tuner-large-width": `${largeWidth}px`,
    "--demo-tuner-large-height": `${largeHeight}px`,
  };

  return (
    <div className={s.page} style={tunerStyle}>
      <PageHeader
        eyebrow="临时页面"
        title="图片尺寸调节器"
        subtitle="用于校准统一图片组件的固定像素尺寸，确认后会移除本页并写回正式组件样式。"
        actions={(
          <div className={s.imageSizeTunerValues}>
            <code>小图 {smallWidth}x{smallHeight}</code>
            <code>中图 {mediumWidth}x{mediumHeight}</code>
            <code>大图 {largeWidth}x{largeHeight}</code>
          </div>
        )}
      />

      <section className={s.imageSizeTunerPanel}>
        <div className={s.imageSizeTunerControls}>
          <SizeControl label="小缩略图宽度" min={42} max={120} value={smallWidth} onChange={setSmallWidth} />
          <SizeControl label="中等缩略图宽度" min={96} max={260} value={mediumWidth} onChange={setMediumWidth} />
          <SizeControl label="大图框宽度" min={360} max={1120} value={largeWidth} onChange={setLargeWidth} step={4} />
          <SizeControl label="大图框高度" min={260} max={820} value={largeHeight} onChange={setLargeHeight} step={4} />
        </div>
      </section>

      <section className={s.imageSizeTunerStage} aria-label="图片组件尺寸预览">
        <article className={s.imageSizeTunerCard}>
          <div className={s.imageSizeTunerCardHeader}>
            <strong>卡片内缩略小图</strong>
            <span>{smallWidth} x {smallHeight}px · 2:3 cover</span>
          </div>
          <div className={s.imageSizeTunerSmallPreview}>
            <ImageThumbSmall image={sampleImages[0]} priority />
          </div>
        </article>

        <article className={s.imageSizeTunerCard}>
          <div className={s.imageSizeTunerCardHeader}>
            <strong>结果列表中等缩略图</strong>
            <span>{mediumWidth} x {mediumHeight}px · 2:3 cover</span>
          </div>
          <div className={s.imageSizeTunerMediumPreview}>
            <ImageThumbMedium
              actionSlot={<ThumbActionSlot />}
              image={sampleImages[1]}
              onOpen={() => setIsPreviewOpen(true)}
              onSelect={() => undefined}
              selectable
              selected
              tags={["p站", "预览"]}
            />
          </div>
        </article>

        <article className={s.imageSizeTunerCard}>
          <div className={s.imageSizeTunerCardHeader}>
            <strong>放大浏览大图</strong>
            <span>{largeWidth} x {largeHeight}px · contain</span>
          </div>
          <div className={s.imageSizeTunerLargePreview}>
            <ImagePreviewFrame image={sampleImages[2]} onOpen={() => setIsPreviewOpen(true)} priority />
          </div>
          <div className={s.toolbar}>
            <Button tone="subtle" onClick={() => setIsPreviewOpen(true)}>
              打开放大层
            </Button>
          </div>
        </article>
      </section>

      {isPreviewOpen ? (
        <ImagePreviewLarge
          image={sampleImages[2]}
          meta={`${largeWidth} x ${largeHeight}px`}
          onClose={() => setIsPreviewOpen(false)}
          title="放大浏览图"
        />
      ) : null}
    </div>
  );
}
