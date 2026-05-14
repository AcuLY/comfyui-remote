import type { DemoCategory, DemoPreset, DemoPresetFolder, DemoPresetGroup, DemoProject } from "./types";

export type PresetLibraryItemKind = "preset" | "group";

export type PresetLibraryItem = {
  id: string;
  kind: PresetLibraryItemKind;
  name: string;
  slug: string;
  folderId: string | null;
  href: string;
  meta: string;
  description: string;
};

export type BatchImportItem = {
  key: string;
  kind: PresetLibraryItemKind;
  id: string;
  name: string;
  categoryId: string;
  folderId: string | null;
  variantId: string | null;
  variants: Array<{ id: string; name: string }>;
  sourceLabel: string;
  meta: string;
};

export function categoryTypeLabel(category: DemoCategory | null) {
  return category?.type === "group" ? "预设组" : "预设";
}

export function categoryItemCount(category: DemoCategory) {
  return category.type === "group" ? category.groupCount : category.presetCount;
}

export function categoryColorValue(color: string | null) {
  if (!color) return "hsl(158 100% 43%)";
  if (/^\d+(\s|$)/.test(color)) return `hsl(${color})`;
  return color;
}

export function categoryHueValue(color: string | null) {
  if (!color) return 158;
  const match = color.match(/^(\d+)/);
  return match ? Number(match[1]) : 190;
}

export function categorySlotPreview(category: DemoCategory | null, categories: DemoCategory[]) {
  const presetCategories = categories.filter((item) => item.type !== "group");
  if (category?.type !== "group") return [];
  const slotCount = Math.max(2, Math.min(4, category.groupCount || 2));
  return Array.from({ length: slotCount }, (_, index) => {
    const source = presetCategories[index % Math.max(presetCategories.length, 1)];
    return {
      id: `${category.id}-slot-${index}`,
      label: index === 0 ? "主体" : index === 1 ? "风格" : index === 2 ? "光照" : "补充",
      categoryName: source?.name ?? "选择预设分类",
    };
  });
}

export function presetFolderChildren(category: DemoCategory, parentId: string | null) {
  return category.folders
    .filter((folder) => (folder.parentId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function presetFolderBreadcrumb(category: DemoCategory, folderId: string | null) {
  const path: DemoPresetFolder[] = [];
  let currentId = folderId;

  while (currentId) {
    const folder = category.folders.find((item) => item.id === currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId;
  }

  return path;
}

export function presetLibraryItems(category: DemoCategory): PresetLibraryItem[] {
  if (category.type === "group") {
    return category.groups.map((group) => ({
      id: group.id,
      kind: "group",
      name: group.name,
      slug: group.slug,
      folderId: group.folderId,
      href: `/preset-groups/${group.id}`,
      meta: `${group.memberCount} members`,
      description: group.members.slice(0, 4).join(" / ") || "尚未添加成员",
    }));
  }

  return category.presets.map((preset) => ({
    id: preset.id,
    kind: "preset",
    name: preset.name,
    slug: preset.slug,
    folderId: preset.folderId,
    href: `/presets/${preset.id}`,
    meta: `${preset.variantCount} variants`,
    description: preset.notes || preset.variants[0]?.prompt || "没有备注",
  }));
}

export function batchItemKey(kind: PresetLibraryItemKind, id: string, variantId?: string | null) {
  return `${kind}:${id}:${variantId ?? "default"}`;
}

export function batchImportFromPreset(category: DemoCategory, preset: DemoPreset, variant = preset.variants[0]): BatchImportItem {
  return {
    key: batchItemKey("preset", preset.id, variant?.id),
    kind: "preset",
    id: preset.id,
    name: preset.name,
    categoryId: category.id,
    folderId: preset.folderId,
    variantId: variant?.id ?? null,
    variants: preset.variants.map((item) => ({ id: item.id, name: item.name })),
    sourceLabel: category.name,
    meta: variant?.name ? `${variant.name} · ${preset.variantCount} variants` : `${preset.variantCount} variants`,
  };
}

export function batchImportFromGroup(category: DemoCategory, group: DemoPresetGroup): BatchImportItem {
  return {
    key: batchItemKey("group", group.id),
    kind: "group",
    id: group.id,
    name: group.name,
    categoryId: category.id,
    folderId: group.folderId,
    variantId: null,
    variants: [],
    sourceLabel: category.name,
    meta: `${group.memberCount} members · ${group.members.slice(0, 3).join(" / ") || "待配置"}`,
  };
}

export function projectBatchBindings(project: DemoProject, categories: DemoCategory[]) {
  const presets = categories.flatMap((category) => category.presets.map((preset) => ({ category, preset })));
  const matched = project.presetNames
    .map((name) => presets.find((item) => item.preset.name === name || item.preset.slug === name))
    .filter(Boolean) as Array<{ category: DemoCategory; preset: DemoPreset }>;
  const source = matched.length > 0 ? matched : presets.slice(0, 3);

  return source.slice(0, 4).map(({ category, preset }) => ({
    id: preset.id,
    name: preset.name,
    categoryName: category.name,
    variants: preset.variants.map((variant) => ({ id: variant.id, name: variant.name })),
  }));
}

export function presetFolderItemCount(category: DemoCategory, folderId: string | null) {
  const childCount = presetFolderChildren(category, folderId).length;
  const itemCount = presetLibraryItems(category).filter((item) => (item.folderId ?? null) === folderId).length;
  return childCount + itemCount;
}

export function presetFolderOptions(category: DemoCategory) {
  const options: Array<{ id: string | null; name: string; depth: number; count: number }> = [
    { id: null, name: "根目录", depth: 0, count: presetFolderItemCount(category, null) },
  ];

  function visit(parentId: string | null, depth: number) {
    for (const folder of presetFolderChildren(category, parentId)) {
      options.push({
        id: folder.id,
        name: folder.name,
        depth,
        count: presetFolderItemCount(category, folder.id),
      });
      visit(folder.id, depth + 1);
    }
  }

  visit(null, 1);
  return options;
}
