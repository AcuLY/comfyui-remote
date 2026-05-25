import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { parseSectionLoraConfig, serializeSectionLoraConfig } from "@/lib/lora-types";
import { detachSectionLoraConfigByBinding } from "@/lib/preset-binding-utils";
import { recordSectionChange } from "@/server/services/section-change-history-service";

export async function detachSectionLorasFromPresetBinding(
  sectionId: string,
  bindingId: string,
  title = "Detach preset LoRA after prompt customization",
) {
  const section = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { loraConfig: true },
  });
  if (!section?.loraConfig) return;

  const before = section.loraConfig;
  const current = parseSectionLoraConfig(section.loraConfig);
  const { config, changed } = detachSectionLoraConfigByBinding(current, bindingId);
  if (!changed) return;

  const next = serializeSectionLoraConfig(config);
  await prisma.projectSection.update({
    where: { id: sectionId },
    data: { loraConfig: next as Prisma.InputJsonValue },
  });
  await recordSectionChange({
    sectionId,
    dimension: "lora",
    title,
    before,
    after: next,
  });
}
