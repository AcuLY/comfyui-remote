import type { ReviewImage } from "@/lib/types";

export type OptimisticReviewAction = "keep" | "trash";
export type OptimisticReviewState = ReadonlyMap<string, OptimisticReviewAction>;
export const LIGHTBOX_PRELOAD_AHEAD = 2;

export function reconcileReviewImagesWithOptimisticReviews(
  images: ReviewImage[],
  optimisticReviews: OptimisticReviewState,
): ReviewImage[] {
  if (optimisticReviews.size === 0) {
    return images;
  }

  return images.flatMap((image) => {
    const optimisticAction = optimisticReviews.get(image.id);
    if (optimisticAction === "trash") {
      return [];
    }
    if (optimisticAction === "keep") {
      return [{ ...image, status: "kept" }];
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
