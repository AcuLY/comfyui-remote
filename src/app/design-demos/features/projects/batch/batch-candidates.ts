import { Boxes, Wand2 } from "lucide-react";

import { batchImportFromGroup, batchImportFromPreset, batchItemKey, type DemoCategory } from "../../../data";

export function getBatchCandidateRows({
  category,
  currentFolderId,
  query,
}: {
  category: DemoCategory | undefined;
  currentFolderId: string | null;
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const candidateRows = category ? (
    category.type === "group"
      ? category.groups
        .filter((group) => normalizedQuery ? group.name.toLowerCase().includes(normalizedQuery) : (group.folderId ?? null) === currentFolderId)
        .map((group) => ({
          key: batchItemKey("group", group.id),
          icon: Boxes,
          title: group.name,
          meta: `${group.memberCount} members`,
          description: group.members.slice(0, 4).join(" / ") || "待配置成员",
          item: batchImportFromGroup(category, group),
        }))
      : category.presets
        .filter((preset) => normalizedQuery ? preset.name.toLowerCase().includes(normalizedQuery) : (preset.folderId ?? null) === currentFolderId)
        .flatMap((preset) => {
          const variants = preset.variants.length ? preset.variants : [undefined];
          return variants.map((variant) => ({
            key: batchItemKey("preset", preset.id, variant?.id),
            icon: Wand2,
            title: variant?.name ? `${preset.name} / ${variant.name}` : preset.name,
            meta: `${preset.variantCount} variants`,
            description: preset.notes || variant?.prompt || "暂无备注",
            item: batchImportFromPreset(category, preset, variant),
          }));
        })
  ) : [];
  return candidateRows;
}
