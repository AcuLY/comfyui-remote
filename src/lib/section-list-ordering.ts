type GroupedDragOrderInput<T extends string> = {
  visibleIds: readonly T[];
  selectedIds: Iterable<T>;
  activeId: T;
  overId: T;
};

type MergeVisibleOrderInput<T extends string> = {
  allIds: readonly T[];
  visibleIds: readonly T[];
};

export function buildGroupedDragOrder<T extends string>({
  visibleIds,
  selectedIds,
  activeId,
  overId,
}: GroupedDragOrderInput<T>): T[] {
  if (activeId === overId) return [...visibleIds];

  const activeIndex = visibleIds.indexOf(activeId);
  const overIndex = visibleIds.indexOf(overId);
  if (activeIndex === -1 || overIndex === -1) return [...visibleIds];

  const selectedSet = new Set(selectedIds);
  const movingIds = selectedSet.has(activeId)
    ? visibleIds.filter((id) => selectedSet.has(id))
    : [activeId];
  const movingSet = new Set(movingIds);

  if (movingSet.has(overId)) return [...visibleIds];

  const remainingIds = visibleIds.filter((id) => !movingSet.has(id));
  const remainingOverIndex = remainingIds.indexOf(overId);
  if (remainingOverIndex === -1) return [...visibleIds];

  const insertIndex = activeIndex < overIndex ? remainingOverIndex + 1 : remainingOverIndex;
  return [
    ...remainingIds.slice(0, insertIndex),
    ...movingIds,
    ...remainingIds.slice(insertIndex),
  ];
}

export function mergeVisibleOrderIntoAllIds<T extends string>({
  allIds,
  visibleIds,
}: MergeVisibleOrderInput<T>): T[] {
  const visibleIdSet = new Set(visibleIds);
  const nextVisibleIds = [...visibleIds];

  return allIds.map((id) => (visibleIdSet.has(id) ? nextVisibleIds.shift()! : id));
}
