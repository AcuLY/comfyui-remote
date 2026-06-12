export type TrashUndoEntry<TImage extends { id: string }> = {
  items: Array<{
    image: TImage;
    index: number;
  }>;
};

export function buildTrashUndoEntry<TImage extends { id: string }>(
  images: readonly TImage[],
  imageIds: readonly string[],
): TrashUndoEntry<TImage> | null {
  const idSet = new Set(imageIds.filter(Boolean));
  if (idSet.size === 0) return null;

  const items = images.flatMap((image, index) =>
    idSet.has(image.id) ? [{ image, index }] : [],
  );

  return items.length > 0 ? { items } : null;
}

export function restoreTrashUndoEntry<TImage extends { id: string; status: string }>(
  images: readonly TImage[],
  entry: TrashUndoEntry<TImage>,
): TImage[] {
  const next = [...images];

  for (const item of [...entry.items].sort((a, b) => a.index - b.index)) {
    const restoredImage = { ...item.image, status: "pending" };
    const existingIndex = next.findIndex((image) => image.id === item.image.id);
    if (existingIndex >= 0) {
      next[existingIndex] = restoredImage;
      continue;
    }
    next.splice(Math.min(item.index, next.length), 0, restoredImage);
  }

  return next;
}
