"use client";

import { useState } from "react";
import { Check, Eye, ImageIcon, Star, Trash2 } from "lucide-react";

import type { DemoImage } from "./design-demo-data";
import { Button, ImagePreviewFrame, ImagePreviewLarge, ImageThumbMedium, ImageThumbSmall, PageHeader } from "./design-demo-ui";
import s from "./design-demo-styles";

function svgImageDataUri(label: string, hue: number, width: number, height: number) {
  const horizonY = Math.round(height * 0.72);
  const labelY = Math.round(height * 0.88);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
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
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect width="${width}" height="${height}" fill="url(#grid)" opacity="0.58"/>
      <circle cx="${Math.round(width * 0.27)}" cy="${Math.round(height * 0.24)}" r="${Math.round(Math.min(width, height) * 0.14)}" fill="rgba(255,255,255,0.22)"/>
      <path d="M0 ${horizonY} C${Math.round(width * 0.22)} ${Math.round(height * 0.58)} ${Math.round(width * 0.38)} ${Math.round(height * 0.68)} ${Math.round(width * 0.52)} ${Math.round(height * 0.54)} C${Math.round(width * 0.7)} ${Math.round(height * 0.39)} ${Math.round(width * 0.84)} ${Math.round(height * 0.49)} ${width} ${Math.round(height * 0.36)} L${width} ${height} L0 ${height} Z" fill="rgba(255,255,255,0.26)"/>
      <path d="M0 ${Math.round(height * 0.82)} C${Math.round(width * 0.25)} ${Math.round(height * 0.66)} ${Math.round(width * 0.42)} ${Math.round(height * 0.78)} ${Math.round(width * 0.62)} ${Math.round(height * 0.62)} C${Math.round(width * 0.8)} ${Math.round(height * 0.48)} ${Math.round(width * 0.9)} ${Math.round(height * 0.58)} ${width} ${Math.round(height * 0.46)} L${width} ${height} L0 ${height} Z" fill="rgba(3,8,18,0.22)"/>
      <text x="${Math.round(width * 0.07)}" y="${labelY}" fill="white" font-family="Inter, Arial, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.1)}" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const sampleImages: DemoImage[] = [
  {
    id: "tuner-small",
    src: svgImageDataUri("Small", 176, 1200, 1800),
    full: svgImageDataUri("Small", 176, 1200, 1800),
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
    src: svgImageDataUri("Medium", 330, 1200, 1800),
    full: svgImageDataUri("Medium", 330, 1200, 1800),
    label: "结果列表图",
    status: "pending",
    featured: true,
    featured2: true,
    cover: false,
    width: 1200,
    height: 1800,
  },
  {
    id: "tuner-large-portrait",
    src: svgImageDataUri("Portrait", 218, 1200, 1800),
    full: svgImageDataUri("Portrait", 218, 1200, 1800),
    label: "竖图示例",
    status: "kept",
    featured: true,
    featured2: false,
    cover: false,
    width: 1200,
    height: 1800,
  },
  {
    id: "tuner-large-landscape",
    src: svgImageDataUri("Landscape", 34, 1800, 1200),
    full: svgImageDataUri("Landscape", 34, 1800, 1200),
    label: "横图示例",
    status: "pending",
    featured: false,
    featured2: true,
    cover: false,
    width: 1800,
    height: 1200,
  },
];

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

function LargePreviewActions() {
  return (
    <>
      <Button icon={Check}>保留</Button>
      <Button tone="pink" icon={Star}>精选</Button>
      <Button tone="pink" icon={Eye}>预览</Button>
      <Button tone="subtle" icon={ImageIcon}>封面</Button>
      <Button tone="danger" icon={Trash2}>删除</Button>
    </>
  );
}

export function ImageSizeTunerPage() {
  const [previewImage, setPreviewImage] = useState<DemoImage | null>(null);
  const portraitImage = sampleImages[2];
  const landscapeImage = sampleImages[3];

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="临时页面"
        title="图片尺寸检查"
        subtitle="小图和中图已固定为 2:3；大图按窗口自适应，预览框底部保留操作按钮空间。"
        actions={(
          <div className={s.imageSizeTunerValues}>
            <code>小图 80x120</code>
            <code>中图 160x240</code>
            <code>大图 自适应外框</code>
          </div>
        )}
      />

      <section className={s.imageSizeTunerStage} aria-label="图片组件尺寸预览">
        <article className={s.imageSizeTunerCard}>
          <div className={s.imageSizeTunerCardHeader}>
            <strong>卡片内缩略小图</strong>
            <span>80 x 120px · 2:3 cover</span>
          </div>
          <div className={s.imageSizeTunerSmallPreview}>
            <ImageThumbSmall image={sampleImages[0]} priority />
          </div>
        </article>

        <article className={s.imageSizeTunerCard}>
          <div className={s.imageSizeTunerCardHeader}>
            <strong>结果列表中等缩略图</strong>
            <span>160 x 240px · 2:3 cover</span>
          </div>
          <div className={s.imageSizeTunerMediumPreview}>
            <ImageThumbMedium
              actionSlot={<ThumbActionSlot />}
              image={sampleImages[1]}
              onOpen={() => setPreviewImage(sampleImages[1])}
              onSelect={() => undefined}
              selectable
              selected
              tags={["p站", "预览"]}
            />
          </div>
        </article>

        {[portraitImage, landscapeImage].map((image) => (
          <article className={s.imageSizeTunerCard} key={image.id}>
            <div className={s.imageSizeTunerCardHeader}>
              <strong>{image.label}</strong>
              <span>{image.width} x {image.height}px · contain + wheel zoom + drag</span>
            </div>
            <div className={s.imageSizeTunerLargePreview}>
              <ImagePreviewFrame image={image} interactive priority={image.id === portraitImage.id} />
            </div>
            <div className={s.toolbar}>
              <Button tone="subtle" onClick={() => setPreviewImage(image)}>
                打开放大层
              </Button>
            </div>
          </article>
        ))}
      </section>

      {previewImage ? (
        <ImagePreviewLarge
          actions={<LargePreviewActions />}
          image={previewImage}
          meta={`${previewImage.width} x ${previewImage.height}px`}
          onClose={() => setPreviewImage(null)}
          title={previewImage.label}
        />
      ) : null}
    </div>
  );
}
