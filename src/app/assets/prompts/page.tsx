import { getPromptCategoriesWithPresets } from "@/lib/server-data";
import { PromptManager } from "./prompt-manager";

export default async function PromptsPage() {
  const categories = await getPromptCategoriesWithPresets();

  return <PromptManager initialCategories={categories} />;
}
