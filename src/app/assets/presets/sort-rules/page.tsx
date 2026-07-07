import { listPresetSortRuleCategories } from "@/lib/server-data";
import { SortRulesEditor } from "./sort-rules-editor";

export default async function SortRulesPage() {
  const categories = await listPresetSortRuleCategories();

  return <SortRulesEditor categories={categories} />;
}
