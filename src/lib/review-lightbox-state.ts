export type OptimisticReviewAction = "keep" | "trash";
export type OptimisticReviewState = ReadonlyMap<string, OptimisticReviewAction>;
export const LIGHTBOX_PRELOAD_AHEAD = 4;

const sharedOptimisticReviewState = new Map<string, OptimisticReviewAction>();

export function getSharedOptimisticReviewState(): OptimisticReviewState {
  return sharedOptimisticReviewState;
}

export function setSharedOptimisticReviewAction(
  imageId: string,
  action: OptimisticReviewAction,
) {
  sharedOptimisticReviewState.set(imageId, action);
}

export function clearSharedOptimisticReviewAction(imageId: string) {
  sharedOptimisticReviewState.delete(imageId);
}

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

export function getNextPendingSectionId<T extends { sectionId: string; status: string }>(
  images: T[],
  currentSectionId: string | null | undefined,
  orderedSectionIds?: string[],
): string | null {
  if (!currentSectionId) return null;

  const seenSectionIds = new Set<string>();
  const sectionIds: string[] = [];

  for (const sectionId of orderedSectionIds ?? []) {
    if (sectionId && !seenSectionIds.has(sectionId)) {
      seenSectionIds.add(sectionId);
      sectionIds.push(sectionId);
    }
  }

  const pendingSectionIds = new Set<string>();
  for (const image of images) {
    if (!seenSectionIds.has(image.sectionId)) {
      seenSectionIds.add(image.sectionId);
      sectionIds.push(image.sectionId);
    }
    if (image.status === "pending" && image.sectionId !== currentSectionId) {
      pendingSectionIds.add(image.sectionId);
    }
  }

  if (sectionIds.length <= 1 || pendingSectionIds.size === 0) return null;

  const currentIndex = sectionIds.indexOf(currentSectionId);
  if (currentIndex < 0) return null;

  for (let offset = 1; offset < sectionIds.length; offset += 1) {
    const sectionId = sectionIds[(currentIndex + offset) % sectionIds.length];
    if (pendingSectionIds.has(sectionId)) {
      return sectionId;
    }
  }

  return null;
}
