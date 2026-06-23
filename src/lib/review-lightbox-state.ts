export type OptimisticReviewAction = "keep" | "trash";
export type OptimisticReviewState = ReadonlyMap<string, OptimisticReviewAction>;
export const LIGHTBOX_PRELOAD_AHEAD = 4;

export function reconcileReviewImagesWithOptimisticReviews<T extends { id: string; status: string }>(
  images: T[],
  optimisticReviews: OptimisticReviewState,
): T[] {
  if (optimisticReviews.size === 0) {
    return images;
  }

  return images.flatMap((image) => {
    const optimisticAction = optimisticReviews.get(image.id);
    if (optimisticAction === "trash") {
      return [];
    }
    if (optimisticAction === "keep") {
      return [{ ...image, status: "kept" } as T];
    }
    return [image];
  });
}

export function getLightboxPreloadCandidates<T extends { full: string }>(
  images: T[],
  currentIndex: number,
  limit = LIGHTBOX_PRELOAD_AHEAD,
): T[] {
  if (images.length <= 1 || currentIndex < 0 || currentIndex >= images.length || limit <= 0) {
    return [];
  }

  const candidates: T[] = [];
  for (let offset = 1; offset < images.length && candidates.length < limit; offset += 1) {
    const image = images[(currentIndex + offset) % images.length];
    if (image?.full) {
      candidates.push(image);
    }
  }

  return candidates;
}

export function getNextPendingImageIndex<T extends { status: string }>(
  images: T[],
  currentIndex: number,
): number | null {
  if (images.length <= 1 || currentIndex < 0 || currentIndex >= images.length) {
    return null;
  }

  for (let offset = 1; offset < images.length; offset += 1) {
    const index = (currentIndex + offset) % images.length;
    if (images[index]?.status === "pending") {
      return index;
    }
  }

  return null;
}
