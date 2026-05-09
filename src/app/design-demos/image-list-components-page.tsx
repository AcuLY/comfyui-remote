"use client";

import { useMemo, useState } from "react";
import { Archive, Check, CheckSquare, Eye, Square, Star, Trash2, X } from "lucide-react";

import type { DemoData, DemoImage } from "./design-demo-data";
import { Button, ImageListMedium, ImageListSmall, ImagePreviewLarge, ImageThumbMedium, PageHeader } from "./design-demo-ui";
import s from "./design-demo-styles";

function svgImageDataUri(label: string, hue: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 78% 54%)"/>
          <stop offset="0.56" stop-color="hsl(${(hue + 48) % 360} 76% 48%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 136) % 360} 70% 42%)"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1800" fill="url(#bg)"/>
      <circle cx="340" cy="420" r="170" fill="rgba(255,255,255,0.22)"/>
      <path d="M0 1340 C260 1130 420 1230 610 1010 C820 770 980 880 1200 690 L1200 1800 L0 1800 Z" fill="rgba(255,255,255,0.26)"/>
      <path d="M0 1490 C280 1250 500 1360 720 1120 C910 910 1040 990 1200 830 L1200 1800 L0 1800 Z" fill="rgba(3,8,18,0.22)"/>
      <text x="80" y="1640" fill="white" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function fallbackImages(): DemoImage[] {
  return Array.from({ length: 14 }, (_, index) => {
    const src = svgImageDataUri(`Image ${index + 1}`, (index * 34 + 160) % 360);
    return {
      id: `list-demo-${index}`,
      src,
      full: src,
      label: `Image ${index + 1}`,
      status: index % 5 === 0 ? "trashed" : index % 3 === 0 ? "kept" : "pending",
      featured: index % 4 === 0,
      featured2: index % 6 === 0,
      cover: index === 1,
      width: 1200,
      height: 1800,
    };
  });
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

export function ImageListComponentsPage({ data }: { data: DemoData }) {
  const images = useMemo(() => {
    const fromData = data.projects.flatMap((project) => project.sections.flatMap((section) => section.images));
    return fromData.length >= 8 ? fromData.slice(0, 16) : fallbackImages();
  }, [data.projects]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewImage = previewIndex === null ? null : images[previewIndex] ?? null;
  const selectedCount = images.filter((image) => selectedIds.has(image.id)).length;
  const pendingIds = images.filter((image) => image.status === "pending").map((image) => image.id);
  const allSelected = images.length > 0 && selectedCount === images.length;
  const pendingOnlySelected = pendingIds.length > 0 && selectedCount === pendingIds.length && pendingIds.every((id) => selectedIds.has(id));
  const hasSelection = selectedCount > 0;
  const actionTargetCount = hasSelection ? selectedCount : images.length;

  function toggleImage(imageId: string) {
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
        eyebrow="临时页面"
        title="图片列表组件检查"
        subtitle="统一小图列表和中图列表的布局、溢出、选择与操作区。"
      />

      <section className={s.imageListDemoSurface}>
        <div className={s.imageListDemoHeader}>
          <strong>小图列表</strong>
          <span>固定一行 · 限制宽度 · 横向滚动</span>
        </div>
        <ImageListSmall images={images} limit={12} maxWidth={420} />
      </section>

      <section className={s.imageListDemoSurface}>
        <div className={s.imageListDemoHeader}>
          <strong>中图列表</strong>
          <span>flex-start · 固定 gap · 纵向折叠渐变 · 右侧操作区</span>
        </div>
        <ImageListMedium
          maxHeight={388}
          summary={hasSelection ? `已选 ${selectedCount} 张` : "未选择图片"}
          selectPanel={(
            <>
              <Button icon={CheckSquare} pressed={allSelected} onClick={() => setSelectedIds(allSelected ? new Set() : new Set(images.map((image) => image.id)))}>
                {allSelected ? "取消全选" : "全选"}
              </Button>
              <Button icon={Square} pressed={pendingOnlySelected} onClick={() => setSelectedIds(new Set(pendingIds))}>
                待审
              </Button>
              <Button tone="subtle" icon={X} onClick={() => setSelectedIds(new Set())} disabled={selectedCount === 0}>
                清空
              </Button>
            </>
          )}
          actionPanel={(
            <>
              <Button icon={Check} feedback={{ title: "已加入保留队列", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "保留" : "全部保留"}</Button>
              <Button tone="pink" icon={Star} disabled={selectedCount === 0}>精选</Button>
              <Button tone="pink" icon={Eye} disabled={selectedCount === 0}>预览</Button>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "已加入删除队列", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "删除" : "全部删除"}</Button>
              <Button tone="subtle" icon={Archive}>撤销</Button>
            </>
          )}
        >
          {images.map((image, index) => (
            <ImageThumbMedium
              actionSlot={<ThumbActionSlot />}
              image={image}
              key={`${image.id}-${index}`}
              onOpen={() => setPreviewIndex(index)}
              onSelect={() => toggleImage(image.id)}
              selectable
              selected={selectedIds.has(image.id)}
              showStatus={image.status !== "pending"}
            />
          ))}
        </ImageListMedium>
      </section>

      <section className={s.imageListDemoSurface}>
        <div className={s.imageListDemoHeader}>
          <strong>无右侧操作区</strong>
          <span>只保留中图流式列表和折叠效果</span>
        </div>
        <ImageListMedium maxHeight={240}>
          {images.slice(0, 10).map((image, index) => (
            <ImageThumbMedium
              image={image}
              key={`${image.id}-simple-${index}`}
              onOpen={() => setPreviewIndex(index)}
              showStatus={false}
              tags={[]}
            />
          ))}
        </ImageListMedium>
      </section>

      {previewImage ? (
        <ImagePreviewLarge
          actions={(
            <>
              <Button icon={Check}>保留</Button>
              <Button tone="pink" icon={Star}>精选</Button>
              <Button tone="pink" icon={Eye}>预览</Button>
              <Button tone="danger" icon={Trash2}>删除</Button>
            </>
          )}
          image={previewImage}
          meta={`${previewIndex! + 1} / ${images.length}`}
          onClose={() => setPreviewIndex(null)}
          onNext={() => setPreviewIndex((current) => (current === null ? 0 : (current + 1) % images.length))}
          onPrevious={() => setPreviewIndex((current) => (current === null ? 0 : (current + images.length - 1) % images.length))}
        />
      ) : null}
    </div>
  );
}
