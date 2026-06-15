"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, ImageIcon, Square, Star, Trash2, Undo2, X } from "lucide-react";

import type { DemoImage } from "@/app/design-demos/data";
import s from "../image/image.module.css";
import { Button } from "../../primitives/button";
import { ImageListMedium } from "../image-list-medium";
import { ImagePreviewLarge } from "../image-preview-large";
import { ImageThumbMedium } from "../image-thumb-medium";

export function ReviewImageBoard({ images: initialImages, onImagesChange }: { images: DemoImage[]; onImagesChange?: (images: DemoImage[]) => void }) {
  const [images, setImages] = useState(initialImages);
  const [undoStack, setUndoStack] = useState<DemoImage[][]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const activeImage = activeIndex === null ? null : images[activeIndex] ?? null;
  const pendingIds = images.filter((image) => image.status === "pending").map((image) => image.id);
  const visibleIds = new Set(images.map((image) => image.id));
  const selectedVisibleIds = new Set([...selectedIds].filter((id) => visibleIds.has(id)));
  const selectedCount = selectedVisibleIds.size;
  const portalTarget = activeImage && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>("[data-app-shell]") ?? document.body
    : null;

  // Sync when external images prop changes
  useEffect(() => { setImages(initialImages); }, [initialImages]);

  function mutateImages(updater: (imgs: DemoImage[]) => DemoImage[]) {
    setUndoStack((prev) => [...prev.slice(-9), images]);
    const next = updater(images);
    setImages(next);
    onImagesChange?.(next);
  }

  function markStatus(targetIds: string[], status: "kept" | "trashed") {
    mutateImages((imgs) => imgs.map((img) => targetIds.includes(img.id) ? { ...img, status } : img));
    setSelectedIds(new Set());
  }

  function markFeatured(targetIds: string[]) {
    mutateImages((imgs) => imgs.map((img) => targetIds.includes(img.id) ? { ...img, featured: !img.featured } : img));
    setSelectedIds(new Set());
  }

  function markFeatured2(targetIds: string[]) {
    mutateImages((imgs) => imgs.map((img) => targetIds.includes(img.id) ? { ...img, featured2: !img.featured2 } : img));
    setSelectedIds(new Set());
  }

  function markCover(targetId: string) {
    mutateImages((imgs) => imgs.map((img) => ({ ...img, cover: img.id === targetId })));
    setSelectedIds(new Set());
  }

  function undoLast() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setImages(prev);
    onImagesChange?.(prev);
  }

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
        actionPanel={(
          <>
            <Button
              tone={hasSelection ? "subtle" : "default"}
              icon={hasSelection ? X : Square}
              onClick={() => setSelectedIds(hasSelection ? new Set() : new Set(pendingIds))}
              disabled={!hasSelection && pendingIds.length === 0}
            >
              {hasSelection ? "取消" : "待审"}
            </Button>
            <Button tone="primary" icon={Check} className={s.reviewActionKeep} onClick={() => markStatus(hasSelection ? [...selectedVisibleIds] : images.map((i) => i.id), "kept")} feedback={{ title: "已保留", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "保留" : "全部保留"}</Button>
            <Button tone="pink" icon={Star} className={s.reviewActionFeatured} disabled={selectedCount === 0} onClick={() => markFeatured([...selectedVisibleIds])} feedback={{ title: "已标记 p站", detail: `${selectedCount} 张图片` }}>p站</Button>
            <Button tone="pink" icon={Eye} className={s.reviewActionFeatured} disabled={selectedCount === 0} onClick={() => markFeatured2([...selectedVisibleIds])} feedback={{ title: "已标记预览", detail: `${selectedCount} 张图片` }}>预览</Button>
            <Button tone="subtle" icon={ImageIcon} className={s.reviewActionCover} disabled={selectedCount !== 1} onClick={() => { if (selectedCount === 1) markCover([...selectedVisibleIds][0]); }} feedback={{ title: "已设为封面", detail: "1 张图片" }}>封面</Button>
            <Button tone="danger" icon={Trash2} className={s.reviewActionDelete} onClick={() => markStatus(hasSelection ? [...selectedVisibleIds] : images.map((i) => i.id), "trashed")} feedback={{ tone: "warning", title: "已删除", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "删除" : "全部删除"}</Button>
            <Button tone="subtle" icon={Undo2} className={s.reviewActionUndo} disabled={undoStack.length === 0} onClick={undoLast} feedback={{ tone: "info", title: "已撤销" }}>撤销</Button>
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
              <Button icon={Check} onClick={() => markStatus([activeImage.id], "kept")} feedback={{ title: "图片已保留", detail: activeImage.label }}>
                保留
              </Button>
              <Button tone="pink" icon={Star} onClick={() => markFeatured([activeImage.id])} feedback={{ title: "图片已标记精选", detail: activeImage.label }}>
                精选
              </Button>
              <Button tone="pink" icon={Eye} onClick={() => markFeatured2([activeImage.id])} feedback={{ title: "图片已标记预览", detail: activeImage.label }}>
                预览
              </Button>
              <Button tone="danger" icon={Trash2} onClick={() => markStatus([activeImage.id], "trashed")} feedback={{ tone: "warning", title: "图片已删除", detail: activeImage.label }}>
                删除
              </Button>
              <Button tone="subtle" icon={Undo2} onClick={undoLast} disabled={undoStack.length === 0} feedback={{ tone: "info", title: "已撤销" }}>撤销</Button>
            </>
          )}
        />,
        portalTarget,
      ) : null}
    </>
  );
}
