import { prisma } from "@/lib/prisma";
import { SortRulesEditor } from "./sort-rules-editor";

export default async function SortRulesPage() {
  const categories = await prisma.presetCategory.findMany({
    select: {
      id: true,
      name: true,
      color: true,
      positivePromptOrder: true,
      negativePromptOrder: true,
      lora1Order: true,
      lora2Order: true,
    },
  });

  return <SortRulesEditor categories={categories} />;
}
