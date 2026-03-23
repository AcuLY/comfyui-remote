import pathMaps from "../../config/path-maps.json";

export type LoraCategory = keyof typeof pathMaps.loraCategories;

export function getLoraCategories() {
  return Object.keys(pathMaps.loraCategories) as LoraCategory[];
}

export function resolveLoraRelativeDir(category: string) {
  return pathMaps.loraCategories[category as LoraCategory] ?? null;
}
