import { getPresetCategoriesWithPresets } from "@/lib/server-data";
import { PromptManager } from "./prompt-manager";

export default async function PromptsPage() {
  const categories = await getPresetCategoriesWithPresets();

  return <PromptManager initialCategories={categories} />;
}
