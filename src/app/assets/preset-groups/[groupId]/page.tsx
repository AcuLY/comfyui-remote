import { notFound } from "next/navigation";
import { buildFolderScopedItemOrder, findNeighborItems } from "@/lib/folder-navigation";
import { getPresetGroupEditData } from "@/lib/server-data";
import { PresetGroupEditClient } from "./preset-group-edit-client";

export const dynamic = "force-dynamic";

export default async function PresetGroupEditPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const data = await getPresetGroupEditData(groupId);

  if (!data) {
    notFound();
  }

  const { categories, category, group, groups } = data;
  const orderedGroups = buildFolderScopedItemOrder(category.folders, category.groups);
  const {
    previous: previousGroup,
    next: nextGroup,
    index: groupPosition,
    total: totalGroups,
  } = findNeighborItems(orderedGroups, groupId);

  return (
    <PresetGroupEditClient
      key={group.id}
      categories={categories}
      categoryId={category.id}
      group={group}
      groups={groups}
      previousGroup={previousGroup}
      nextGroup={nextGroup}
      groupPosition={groupPosition}
      totalGroups={totalGroups}
    />
  );
}
