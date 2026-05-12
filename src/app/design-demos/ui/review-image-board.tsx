"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CheckSquare, Eye, ImageIcon, Square, Star, Trash2, Undo2, X } from "lucide-react";

import type { DemoImage } from "../design-demo-data";
import s from "./ui.module.css";
import { Button } from "./button";
import { ImageListMedium } from "./image-list-medium";
import { ImagePreviewLarge } from "./image-preview-large";
import { ImageThumbMedium } from "./image-thumb-medium";

export function ReviewImageBoard({ images }: { images: DemoImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const activeImage = activeIndex === null ? null : images[activeIndex] ?? null;
  const pendingIds = images.filter((image) => image.status === "pending").map((image) => image.id);
  const visibleIds = new Set(images.map((image) => image.id));
  const selectedVisibleIds = new Set([...selectedIds].filter((id) => visibleIds.has(id)));
  const selectedCount = selectedVisibleIds.size;
  const allSelected = images.length > 0 && selectedCount === images.length;
  const pendingOnlySelected = !allSelected && pendingIds.length > 0 && selectedCount === pendingIds.length && pendingIds.every((id) => selectedVisibleIds.has(id));
  const portalTarget = activeImage && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>("[data-design-demo-shell]") ?? document.body
    : null;

  useEffect(() => {
    if (activeIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current === null ? 0 : (current + images.length - 1) % images.length));
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current === null ? 0 : (current + 1) % images.length));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length]);

  function toggleImage(imageId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  if (images.length === 0) return <div className={s.empty}>当前筛选下没有图片</div>;

  const hasSelection = selectedCount > 0;
  const actionTargetCount = hasSelection ? selectedCount : images.length;

  return (
    <>
      <ImageListMedium
        className={s.reviewControlStrip}
        images={images}
        maxHeight={520}
        showCounts
        summary={hasSelection ? `已选 ${selectedCount} 张` : "未选择图片"}
        selectPanel={(
          <>
            <Button icon={CheckSquare} pressed={allSelected} onClick={() => setSelectedIds(allSelected ? new Set() : new Set(images.map((image) => image.id)))}>
              {allSelected ? "取消全选" : "全选"}
            </Button>
            <Button icon={Square} pressed={pendingOnlySelected} onClick={() => setSelectedIds(new Set(pendingIds))}>
              待审
            </Button>
            <Button tone="subtle" icon={X} onClick={() => setSelectedIds(new Set())} disabled={selectedCount === 0}>取消选择</Button>
          </>
        )}
        actionPanel={(
          <>
            <Button tone="primary" icon={Check} className={s.reviewActionKeep} feedback={{ title: "已加入保留队列", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "保留" : "全部保留"}</Button>
            <Button tone="pink" icon={Star} className={s.reviewActionFeatured} disabled={selectedCount === 0} feedback={{ title: "已加入 p站 标记队列", detail: `${selectedCount} 张图片` }}>p站</Button>
            <Button tone="pink" icon={Eye} className={s.reviewActionFeatured} disabled={selectedCount === 0} feedback={{ title: "已加入预览标记队列", detail: `${selectedCount} 张图片` }}>预览</Button>
            <Button tone="subtle" icon={ImageIcon} className={s.reviewActionCover} disabled={selectedCount !== 1} feedback={{ title: "已设为封面", detail: "1 张图片" }}>封面</Button>
            <Button tone="danger" icon={Trash2} className={s.reviewActionDelete} feedback={{ tone: "warning", title: "已加入删除队列", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "删除" : "全部删除"}</Button>
            <Button tone="subtle" icon={Undo2} className={s.reviewActionUndo} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销</Button>
          </>
        )}
      >
        {images.map((image, index) => {
          const selected = selectedIds.has(image.id);
          const hasStatusOverlay = image.status === "kept" || image.status === "trashed";
          return (
            <ImageThumbMedium
              image={image}
              key={`${image.id}-${index}`}
              onOpen={() => setActiveIndex(index)}
              onSelect={() => toggleImage(image.id)}
              selectable
              selected={selected}
              showStatus={hasStatusOverlay}
            />
          );
        })}
      </ImageListMedium>

      {activeImage && portalTarget ? createPortal(
        <ImagePreviewLarge
          image={activeImage}
          meta={`${activeIndex! + 1} / ${images.length} · ${activeImage.status}`}
          onClose={() => setActiveIndex(null)}
          onNext={() => setActiveIndex((current) => (current === null ? 0 : (current + 1) % images.length))}
          onPrevious={() => setActiveIndex((current) => (current === null ? 0 : (current + images.length - 1) % images.length))}
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
              <Button tone="subtle" icon={Undo2} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销</Button>
            </>
          )}
        />,
        portalTarget,
      ) : null}
    </>
  );
}
