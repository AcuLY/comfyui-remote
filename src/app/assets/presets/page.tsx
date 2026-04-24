import { getPresetCategoriesWithPresets } from "@/lib/server-data";
import { PresetManager } from "./preset-manager";

export default async function PresetsPage() {
  const categories = await getPresetCategoriesWithPresets();

  return <PresetManager initialCategories={categories} />;
}
