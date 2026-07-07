"use server";

import { revalidatePath } from "next/cache";
import type { SectionLoraConfig } from "@/lib/lora-types";
import { saveSectionLoraConfig } from "@/server/services/section-lora-service";

export async function saveSectionLoraConfigAction(
  projectId: string,
  sectionId: string,
  config: SectionLoraConfig,
) {
  await saveSectionLoraConfig(sectionId, config);
  revalidatePath(`/projects/${projectId}/sections/${sectionId}`);
}
