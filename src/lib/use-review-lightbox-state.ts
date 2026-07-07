"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getNextImageIdAfterCurrentLeavesSequence } from "./review-lightbox-state";

type ReviewLightboxImage = {
  id: string;
};

export function useReviewLightboxState<T extends ReviewLightboxImage>(
  images: readonly T[],
) {
  const [lightboxImageId, setLightboxImageId] = useState<string | null>(null);
  const previousImagesRef = useRef<readonly T[]>([]);

  const lightboxIndex = lightboxImageId
    ? images.findIndex((image) => image.id === lightboxImageId)
    : -1;
  const lightboxImage = lightboxIndex >= 0 ? images[lightboxIndex] ?? null : null;

  const openLightbox = useCallback((imageId: string) => {
    setLightboxImageId(imageId);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxImageId(null);
  }, []);

  const goLightboxPrev = useCallback(() => {
    if (images.length === 0 || lightboxIndex < 0) return;
    const nextIndex = lightboxIndex > 0 ? lightboxIndex - 1 : images.length - 1;
    setLightboxImageId(images[nextIndex]?.id ?? null);
  }, [images, lightboxIndex]);

  const goLightboxNext = useCallback(() => {
    if (images.length === 0 || lightboxIndex < 0) return;
    const nextIndex = lightboxIndex < images.length - 1 ? lightboxIndex + 1 : 0;
    setLightboxImageId(images[nextIndex]?.id ?? null);
  }, [images, lightboxIndex]);

  useEffect(() => {
    if (!lightboxImageId) return;
    if (images.some((image) => image.id === lightboxImageId)) return;

    const nextImageId = getNextImageIdAfterCurrentLeavesSequence(
      previousImagesRef.current,
      lightboxImageId,
    );
    if (nextImageId && images.some((image) => image.id === nextImageId)) {
      setLightboxImageId(nextImageId);
      return;
    }
    setLightboxImageId(images[0]?.id ?? null);
  }, [images, lightboxImageId]);

  useEffect(() => {
    previousImagesRef.current = images;
  }, [images]);

  return {
    lightboxImageId,
    setLightboxImageId,
    lightboxIndex,
    lightboxImage,
    openLightbox,
    closeLightbox,
    goLightboxPrev,
    goLightboxNext,
  };
}
