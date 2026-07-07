"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReviewImage } from "@/lib/types";

type UseQueueReviewSelectionOptions = {
  reviewImages: ReviewImage[];
  pendingImages: ReviewImage[];
};

export function useQueueReviewSelection({
  reviewImages,
  pendingImages,
}: UseQueueReviewSelectionOptions) {
  const [selectedState, setSelected] = useState<Set<string>>(new Set());

  const reviewImageIds = useMemo(
    () => new Set(reviewImages.map((image) => image.id)),
    [reviewImages],
  );
  const selected = useMemo(
    () => new Set([...selectedState].filter((id) => reviewImageIds.has(id))),
    [reviewImageIds, selectedState],
  );
  const selectedIds = useMemo(() => [...selected], [selected]);
  const selectedCount = selected.size;
  const allSelected = selected.size === reviewImages.length;
  const remainingPendingIds = useMemo(
    () =>
      pendingImages
        .filter((img) => !selected.has(img.id))
        .map((img) => img.id),
    [pendingImages, selected],
  );

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === reviewImages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reviewImages.map((img) => img.id)));
    }
  }, [reviewImages, selected.size]);

  const selectPending = useCallback(() => {
    setSelected(new Set(pendingImages.map((img) => img.id)));
  }, [pendingImages]);

  const removeSelectedIds = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const addSelectedIds = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  return {
    selected,
    selectedIds,
    selectedCount,
    allSelected,
    remainingPendingIds,
    isSelected,
    toggleSelect,
    selectAll,
    selectPending,
    removeSelectedIds,
    addSelectedIds,
  };
}
