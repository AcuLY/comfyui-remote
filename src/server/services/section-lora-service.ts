import { prisma } from "@/lib/prisma";
import { shouldPersistLoraBindingLink, type SectionLoraConfig } from "@/lib/lora-types";
import { resolveSectionConfig } from "@/server/prompt-config/section-resolver";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { recordSectionChange } from "@/server/services/section-change-history-service";

const LORA_STAGES = ["lora1", "lora2"] as const;

export async function saveSectionLoraConfig(sectionId: string, config: SectionLoraConfig) {
  const section = await prisma.projectSection.findFirst({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
    select: { id: true },
  });
  if (!section) throw new Error("PROJECT_SECTION_NOT_FOUND");

  const [before, bindings] = await Promise.all([
    resolveSectionConfig(sectionId),
    prisma.sectionPresetBinding.findMany({
      where: { projectSectionId: sectionId },
      select: { id: true, bindingKey: true, presetId: true, variantId: true },
    }),
  ]);
  const bindingByKey = new Map(bindings.map((binding) => [binding.bindingKey, binding]));
  const manualRows = LORA_STAGES.flatMap((stage) =>
    config[stage].flatMap((entry, index) => {
      const cleanPresetEntry =
        entry.source === "preset" &&
        !entry.detachedBindingId &&
        !entry.detachedPresetPath &&
        entry.suppressed !== true;
      if (cleanPresetEntry) return [];

      const bindingKey = entry.detachedBindingId ?? entry.bindingId ?? null;
      const binding = bindingKey ? bindingByKey.get(bindingKey) ?? null : null;
      const shouldLinkBinding = shouldPersistLoraBindingLink(entry);
      return [{
        projectSectionId: sectionId,
        sectionBindingId: shouldLinkBinding ? binding?.id ?? null : null,
        stage,
        path: entry.path,
        weight: Math.round(entry.weight * 100) / 100,
        enabled: entry.suppressed === true ? false : entry.enabled,
        detachedFromBindingKey: entry.detachedBindingId ?? (entry.source === "preset" ? entry.bindingId ?? null : null),
        detachedFromPresetId: binding?.presetId ?? null,
        detachedFromVariantId: binding?.variantId ?? null,
        detachedFromPath: entry.detachedPresetPath ?? (entry.source === "preset" ? entry.path : null),
        metadata: entry.suppressed === true ? { suppressed: true } : undefined,
        sortOrder: index,
      }];
    }),
  );

  await prisma.$transaction(async (tx) => {
    await tx.sectionManualLoraEntry.deleteMany({
      where: { projectSectionId: sectionId },
    });
    if (manualRows.length > 0) {
      await tx.sectionManualLoraEntry.createMany({ data: manualRows });
    }
  });
  await recordSectionChange({
    sectionId,
    dimension: "lora",
    title: "更新 LoRA 配置",
    before: before?.loraConfig ?? null,
    after: config,
  });
}
