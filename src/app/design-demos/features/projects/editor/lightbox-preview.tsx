"use client";

import { Check, Star, Trash2 } from "lucide-react";

import s from "./lightbox-preview.editor.module.css";
import { ImagePreviewLarge } from "@/components/design-demo-ui/media/image-preview-large";
import type { SectionEditorModel } from "./use-section-editor-state";

export function LightboxPreview({ editor }: { editor: SectionEditorModel }) {
  const { lightboxImage, lightboxImageIndex, filteredImages } = editor;
  if (!lightboxImage) return null;

  return (
    <ImagePreviewLarge
      actions={
        <>
          <button
            type="button"
            className={s.btnGhost}
            onClick={() =>
              editor.markStatus(
                lightboxImage.id,
                lightboxImage.status === "kept" ? "pending" : "kept",
              )
            }
            aria-label="保留"
            title="保留"
          >
            <Check className={s.iconMd} />
            保留
          </button>
          <button
            type="button"
            className={s.btnGhost}
            onClick={() =>
              editor.markStatus(
                lightboxImage.id,
                lightboxImage.status === "trashed" ? "pending" : "trashed",
              )
            }
            aria-label="删除"
            title="删除"
          >
            <Trash2 className={s.iconMd} />
            删除
          </button>
          <button
            type="button"
            className={s.btnGhost}
            onClick={() => editor.toggleFeatured(lightboxImage.id)}
            aria-label="精选"
            title="精选"
          >
            <Star className={s.iconMd} />
            精选
          </button>
        </>
      }
      image={lightboxImage}
      meta={lightboxImageIndex >= 0 ? `${lightboxImageIndex + 1} / ${filteredImages.length}` : undefined}
      onNext={
        lightboxImageIndex >= 0
          ? () =>
              editor.setLightboxImageId(
                filteredImages[(lightboxImageIndex + 1) % filteredImages.length]?.id ?? null,
              )
          : undefined
      }
      onPrevious={
        lightboxImageIndex >= 0
          ? () =>
              editor.setLightboxImageId(
                filteredImages[
                  (lightboxImageIndex + filteredImages.length - 1) % filteredImages.length
                ]?.id ?? null,
              )
          : undefined
      }
      onClose={() => editor.setLightboxImageId(null)}
      title={`#${lightboxImage.label}`}
    />
  );
}
