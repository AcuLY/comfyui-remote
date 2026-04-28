import { Prisma } from "@/generated/prisma";
import type { LoraEntry } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// JSON 辅助函数
// ---------------------------------------------------------------------------

export function toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === null) return Prisma.DbNull;
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// LoRA 排序辅助
// ---------------------------------------------------------------------------

type SectionLoraJsonEntry = Record<string, unknown>;

export function sortSectionLoraEntriesByCategoryOrder(
  entries: SectionLoraJsonEntry[],
  orderKey: "lora1Order" | "lora2Order",
  categoryOrderByName: Map<string, { lora1Order: number; lora2Order: number }>,
) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const getOrder = (entry: SectionLoraJsonEntry) => {
        if (entry.source !== "preset" || typeof entry.sourceLabel !== "string") return 999;
        return categoryOrderByName.get(entry.sourceLabel)?.[orderKey] ?? 999;
      };
      return getOrder(a.entry) - getOrder(b.entry) || a.index - b.index;
    })
    .map(({ entry }) => entry);
}

// ---------------------------------------------------------------------------
// ID 生成辅助
// ---------------------------------------------------------------------------

export function createBindingId() {
  return `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createLoraEntryId() {
  return `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Preset LoRA entry 构造
// ---------------------------------------------------------------------------

type ConcreteGroupMember = {
  presetId: string;
  variantId: string;
  categoryId: string;
  label: string;
  positive: string;
  negative: string | null;
  presetName: string;
  categoryName: string;
  categoryColor?: string;
  lora1: Array<{ path: string; weight: number; enabled: boolean }>;
  lora2: Array<{ path: string; weight: number; enabled: boolean }>;
};

export function makePresetLoraEntry(
  binding: { path: string; weight: number; enabled: boolean },
  member: ConcreteGroupMember,
  bindingId: string,
  groupBindingId: string,
): LoraEntry {
  return {
    id: createLoraEntryId(),
    path: binding.path,
    weight: binding.weight,
    enabled: binding.enabled,
    source: "preset",
    sourceLabel: member.categoryName,
    sourceColor: member.categoryColor,
    sourceName: member.presetName,
    bindingId,
    groupBindingId,
  };
}

// Re-export ConcreteGroupMember type for use in preset-group.ts
export type { ConcreteGroupMember };
