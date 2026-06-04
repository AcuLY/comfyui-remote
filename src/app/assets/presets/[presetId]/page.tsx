import { notFound } from "next/navigation";
import { buildFolderScopedItemOrder, findNeighborItems } from "@/lib/folder-navigation";
import { getPresetCategoriesWithPresets } from "@/lib/server-data";
import { PresetEditClient } from "./preset-edit-client";

export const dynamic = "force-dynamic";

export default async function PresetEditPage({
  params,
}: {
  params: Promise<{ presetId: string }>;
}) {
  const { presetId } = await params;
  const categories = await getPresetCategoriesWithPresets();
  const category = categories.find((item) => item.presets.some((preset) => preset.id === presetId));
  const preset = category?.presets.find((item) => item.id === presetId) ?? null;

  if (!category || !preset) {
    notFound();
  }

  const orderedPresets = buildFolderScopedItemOrder(category.folders, category.presets);
  const {
    previous: previousPreset,
    next: nextPreset,
    index: presetPosition,
    total: totalPresets,
  } = findNeighborItems(orderedPresets, presetId);

  return (
    <PresetEditClient
      key={preset.id}
      categories={categories}
      category={category}
      preset={preset}
      previousPreset={previousPreset}
      nextPreset={nextPreset}
      presetPosition={presetPosition}
      totalPresets={totalPresets}
    />
  );
}
