import { getPresetCategoriesWithPresets, getPresetGroups } from "@/lib/server-data";
import { PromptManager } from "./prompt-manager";

export default async function PromptsPage() {
  const [categories, groups] = await Promise.all([
    getPresetCategoriesWithPresets(),
    getPresetGroups(),
  ]);

  return <PromptManager initialCategories={categories} initialGroups={groups} />;
}
