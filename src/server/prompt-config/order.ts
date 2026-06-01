import type { LoraBinding, ResolvedLoraEntry, ResolvedPromptBlock } from "./types";

const DEFAULT_ORDER = 999;

export function normalizeOrder(value: number | null | undefined, fallback = DEFAULT_ORDER) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function appendPromptPart(parts: string[], value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) parts.push(trimmed);
}

export function joinPromptParts(parts: Array<string | null | undefined>, separator = ", ") {
  const filtered: string[] = [];
  for (const part of parts) appendPromptPart(filtered, part);
  return filtered.join(separator);
}

export function sortBySortOrder<T extends { sortOrder?: number | null }>(rows: readonly T[]) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) =>
      normalizeOrder(a.row.sortOrder, 0) - normalizeOrder(b.row.sortOrder, 0) ||
      a.index - b.index,
    )
    .map(({ row }) => row);
}

export function dedupeLoraBindingsByPath(entries: readonly LoraBinding[]) {
  const seen = new Set<string>();
  const deduped: LoraBinding[] = [];

  for (const entry of entries) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    deduped.push(entry);
  }

  return deduped;
}

export function dedupeLoraEntriesByPath(entries: readonly ResolvedLoraEntry[]) {
  const seen = new Set<string>();
  const deduped: ResolvedLoraEntry[] = [];

  for (const entry of entries) {
    const ownerKey = entry.bindingId ?? entry.detachedBindingId ?? entry.id;
    const key = `${ownerKey}:${entry.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

export type PromptBlockSortInput = {
  block: ResolvedPromptBlock;
  index: number;
  rowSortOrder?: number | null;
  categoryOrder?: number | null;
  bindingSortOrder?: number | null;
};

export function sortResolvedPromptBlocks(items: readonly PromptBlockSortInput[]) {
  return [...items]
    .sort((a, b) => {
      const aHasRowOrder = a.rowSortOrder !== null && a.rowSortOrder !== undefined;
      const bHasRowOrder = b.rowSortOrder !== null && b.rowSortOrder !== undefined;

      if (aHasRowOrder || bHasRowOrder) {
        if (aHasRowOrder !== bHasRowOrder) return aHasRowOrder ? -1 : 1;
        return normalizeOrder(a.rowSortOrder, 0) - normalizeOrder(b.rowSortOrder, 0) || a.index - b.index;
      }

      return normalizeOrder(a.categoryOrder) - normalizeOrder(b.categoryOrder) ||
        normalizeOrder(a.bindingSortOrder, 0) - normalizeOrder(b.bindingSortOrder, 0) ||
        a.index - b.index;
    })
    .map((item) => item.block);
}

export type LoraSortInput = {
  entry: ResolvedLoraEntry;
  index: number;
  order: number | null | undefined;
  secondaryOrder?: number | null;
};

export function sortResolvedLoras(items: readonly LoraSortInput[]) {
  return [...items]
    .sort((a, b) =>
      normalizeOrder(a.order) - normalizeOrder(b.order) ||
      normalizeOrder(a.secondaryOrder, 0) - normalizeOrder(b.secondaryOrder, 0) ||
      a.index - b.index,
    )
    .map((item) => item.entry);
}
