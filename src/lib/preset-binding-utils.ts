import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  parseSectionLoraConfig,
  serializeSectionLoraConfig,
  type LoraEntry,
  type SectionLoraConfig,
} from "@/lib/lora-types";
import { recordSectionChange } from "@/server/services/section-change-history-service";

type SectionLoraJsonEntry = Record<string, unknown>;

export function detachLoraEntryFromPreset(entry: LoraEntry): LoraEntry {
  if (!entry.bindingId && !entry.groupBindingId && entry.source !== "preset") return entry;

  return {
    ...entry,
    source: "manual",
    sourceLabel: undefined,
    sourceColor: undefined,
    sourceName: undefined,
    detachedBindingId: entry.detachedBindingId ?? entry.bindingId,
    detachedGroupBindingId: entry.detachedGroupBindingId ?? entry.groupBindingId,
    detachedPresetPath: entry.detachedPresetPath ?? entry.path,
    bindingId: undefined,
    groupBindingId: undefined,
  };
}

export function detachSectionLoraConfigByBinding(
  config: SectionLoraConfig,
  bindingId: string,
): { config: SectionLoraConfig; changed: boolean } {
  let changed = false;
  const detachEntry = (entry: LoraEntry): LoraEntry => {
    if (entry.bindingId !== bindingId) return entry;
    changed = true;
    return detachLoraEntryFromPreset(entry);
  };

  return {
    config: {
      lora1: config.lora1.map(detachEntry),
      lora2: config.lora2.map(detachEntry),
    },
    changed,
  };
}

export function detachAllPresetLoraEntries(config: SectionLoraConfig): SectionLoraConfig {
  return {
    lora1: config.lora1.map(detachLoraEntryFromPreset),
    lora2: config.lora2.map(detachLoraEntryFromPreset),
  };
}

export function getDetachedPresetPaths(
  entries: SectionLoraJsonEntry[] | undefined,
  bindingId: string | null,
) {
  const paths = new Set<string>();
  if (!bindingId || !Array.isArray(entries)) return paths;

  for (const entry of entries) {
    if (entry.detachedBindingId !== bindingId) continue;
    const originalPath = typeof entry.detachedPresetPath === "string" ? entry.detachedPresetPath : null;
    const currentPath = typeof entry.path === "string" ? entry.path : null;
    const path = originalPath ?? currentPath;
    if (path) paths.add(path);
  }

  return paths;
}

export function getDetachedGroupPresetPaths(
  entries: SectionLoraJsonEntry[] | undefined,
  groupBindingId: string | null,
) {
  const paths = new Set<string>();
  if (!groupBindingId || !Array.isArray(entries)) return paths;

  for (const entry of entries) {
    if (entry.detachedGroupBindingId !== groupBindingId) continue;
    const originalPath = typeof entry.detachedPresetPath === "string" ? entry.detachedPresetPath : null;
    const currentPath = typeof entry.path === "string" ? entry.path : null;
    const path = originalPath ?? currentPath;
    if (path) paths.add(path);
  }

  return paths;
}

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
