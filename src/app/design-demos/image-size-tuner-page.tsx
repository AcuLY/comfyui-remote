"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { Check, Eye, ImageIcon, RotateCcw, Star, Trash2 } from "lucide-react";

import type { DemoImage } from "./design-demo-data";
import { Button, ImagePreviewLarge, ImageThumbMedium, ImageThumbSmall, PageHeader } from "./design-demo-ui";
import s from "./design-demo-styles";

type TunerStyle = CSSProperties & {
  "--demo-tuner-small-width"?: string;
  "--demo-tuner-medium-width"?: string;
};

type DeviceSizes = {
  small: number;
  medium: number;
};

const DESKTOP_DEFAULTS: DeviceSizes = { small: 80, medium: 160 };
const MOBILE_DEFAULTS: DeviceSizes = { small: 80, medium: 160 };

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
    id: "tuner-portrait",
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
    id: "tuner-landscape",
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

function clampSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatSize(width: number) {
  return `${width} x ${Math.round(width * 1.5)}`;
}

function SizeControl({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className={s.imageSizeTunerControl}>
      <span>
        <strong>{label}</strong>
        <code>{formatSize(value)}</code>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(clampSize(Number(event.target.value), min, max))}
        type="range"
        value={value}
      />
      <input
        className={s.input}
        max={max}
        min={min}
        onChange={(event) => onChange(clampSize(Number(event.target.value), min, max))}
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

function DevicePreview({
  label,
  onOpen,
  sizes,
  viewportLabel,
}: {
  label: string;
  onOpen: (image: DemoImage) => void;
  sizes: DeviceSizes;
  viewportLabel: string;
}) {
  const style: TunerStyle = {
    "--demo-tuner-small-width": `${sizes.small}px`,
    "--demo-tuner-medium-width": `${sizes.medium}px`,
  };

  return (
    <section className={s.imageSizeTunerDevice} style={style}>
      <div className={s.imageSizeTunerDeviceHeader}>
        <div>
          <strong>{label}</strong>
          <span>{viewportLabel}</span>
        </div>
        <div className={s.imageSizeTunerValues}>
          <code>小图 {formatSize(sizes.small)}</code>
          <code>中图 {formatSize(sizes.medium)}</code>
          <code>大图 lightbox 自适应</code>
        </div>
      </div>

      <div className={s.imageSizeTunerStage} aria-label={`${label}图片组件尺寸预览`}>
        <article className={s.imageSizeTunerCard}>
          <div className={s.imageSizeTunerCardHeader}>
            <strong>卡片内缩略小图</strong>
            <span>{formatSize(sizes.small)}px · 2:3 cover</span>
          </div>
          <div className={s.imageSizeTunerSmallPreview}>
            <ImageThumbSmall image={sampleImages[0]} priority />
          </div>
        </article>

        <article className={s.imageSizeTunerCard}>
          <div className={s.imageSizeTunerCardHeader}>
            <strong>结果列表中等缩略图</strong>
            <span>{formatSize(sizes.medium)}px · 2:3 cover</span>
          </div>
          <div className={s.imageSizeTunerMediumPreview}>
            <ImageThumbMedium
              actionSlot={<ThumbActionSlot />}
              image={sampleImages[1]}
              onOpen={() => onOpen(sampleImages[1])}
              onSelect={() => undefined}
              selectable
              selected
              tags={["p站", "预览"]}
            />
          </div>
        </article>

        {[sampleImages[2], sampleImages[3]].map((image) => (
          <article className={s.imageSizeTunerCard} key={`${label}-${image.id}`}>
            <div className={s.imageSizeTunerCardHeader}>
              <strong>{image.label}</strong>
              <span>{image.width} x {image.height}px · 点击中图打开大图</span>
            </div>
            <div className={s.imageSizeTunerMediumPreview}>
              <ImageThumbMedium
                actionSlot={<ThumbActionSlot />}
                image={image}
                onOpen={() => onOpen(image)}
                onSelect={() => undefined}
                selectable
                tags={image.id === "tuner-portrait" ? ["竖图"] : ["横图"]}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ImageSizeTunerPage() {
  const [desktopSizes, setDesktopSizes] = useState<DeviceSizes>(DESKTOP_DEFAULTS);
  const [mobileSizes, setMobileSizes] = useState<DeviceSizes>(MOBILE_DEFAULTS);
  const [previewImage, setPreviewImage] = useState<DemoImage | null>(null);
  const previewImages = [sampleImages[1], sampleImages[2], sampleImages[3]];
  const activePreviewIndex = previewImage ? previewImages.findIndex((image) => image.id === previewImage.id) : -1;

  function updateDesktopSize(key: keyof DeviceSizes, value: number) {
    setDesktopSizes((current) => ({ ...current, [key]: value }));
  }

  function updateMobileSize(key: keyof DeviceSizes, value: number) {
    setMobileSizes((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="临时页面"
        title="图片尺寸调节器"
        subtitle="桌面端和移动端分别校准小图、中图尺寸；确认后会移除本页并写回正式组件样式。"
        actions={(
          <Button tone="subtle" icon={RotateCcw} onClick={() => {
            setDesktopSizes(DESKTOP_DEFAULTS);
            setMobileSizes(MOBILE_DEFAULTS);
          }}>
            重置
          </Button>
        )}
      />

      <section className={s.imageSizeTunerPanel}>
        <div className={s.imageSizeTunerControlGroup}>
          <div className={s.imageSizeTunerControlHeader}>
            <strong>桌面端</strong>
            <span>用于常规桌面布局里的项目列表、结果列表和审核网格。</span>
          </div>
          <div className={s.imageSizeTunerControls}>
            <SizeControl label="桌面小图" min={48} max={128} value={desktopSizes.small} onChange={(value) => updateDesktopSize("small", value)} />
            <SizeControl label="桌面中图" min={112} max={240} value={desktopSizes.medium} onChange={(value) => updateDesktopSize("medium", value)} />
          </div>
        </div>

        <div className={s.imageSizeTunerControlGroup}>
          <div className={s.imageSizeTunerControlHeader}>
            <strong>移动端</strong>
            <span>用于窄屏下的项目卡片、运行结果和审核网格。</span>
          </div>
          <div className={s.imageSizeTunerControls}>
            <SizeControl label="移动小图" min={44} max={112} value={mobileSizes.small} onChange={(value) => updateMobileSize("small", value)} />
            <SizeControl label="移动中图" min={96} max={220} value={mobileSizes.medium} onChange={(value) => updateMobileSize("medium", value)} />
          </div>
        </div>
      </section>

      <div className={s.imageSizeTunerDeviceGrid}>
        <DevicePreview
          label="桌面端预览"
          onOpen={setPreviewImage}
          sizes={desktopSizes}
          viewportLabel="模拟宽屏内容区"
        />
        <div className={s.imageSizeTunerMobileShell}>
          <DevicePreview
            label="移动端预览"
            onOpen={setPreviewImage}
            sizes={mobileSizes}
            viewportLabel="模拟 390px 内容宽度"
          />
        </div>
      </div>

      {previewImage ? (
        <ImagePreviewLarge
          actions={<LargePreviewActions />}
          image={previewImage}
          meta={`${previewImage.width} x ${previewImage.height}px`}
          onNext={activePreviewIndex >= 0 ? () => setPreviewImage(previewImages[(activePreviewIndex + 1) % previewImages.length]) : undefined}
          onPrevious={activePreviewIndex >= 0 ? () => setPreviewImage(previewImages[(activePreviewIndex + previewImages.length - 1) % previewImages.length]) : undefined}
          onClose={() => setPreviewImage(null)}
          title={previewImage.label}
        />
      ) : null}
    </div>
  );
}
