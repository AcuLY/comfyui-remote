import { prisma } from "@/lib/prisma";
import {
  loadReachablePresetVariantGraph,
  resolvePresetVariantContentFromRows,
} from "@/server/prompt-config/preset-resolver";
import { recordSectionChange } from "@/server/services/section-change-history-service";

type LoraStage = "lora1" | "lora2";

function isLoraStage(value: string): value is LoraStage {
  return value === "lora1" || value === "lora2";
}

function readSuppressed(metadata: unknown) {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    (metadata as { suppressed?: unknown }).suppressed === true
  );
}

async function resolveBindingVariantLoras(binding: {
  id: string;
  presetId: string;
  variantId: string | null;
  preset: {
    variants: Array<{
      id: string;
      sortOrder: number;
      isActive: boolean;
    }>;
  };
}) {
  const variantId = binding.variantId ??
    binding.preset.variants
      .filter((variant) => variant.isActive !== false)
      .sort((left, right) => left.sortOrder - right.sortOrder)[0]?.id ??
    null;
  if (!variantId) return null;

  const { variants, variantLinks } = await loadReachablePresetVariantGraph([variantId], prisma);
  return {
    variantId,
    resolved: resolvePresetVariantContentFromRows(variantId, { variants, variantLinks }),
  };
}

async function detachNormalizedSectionLorasFromPresetBinding(
  sectionId: string,
  bindingKey: string,
  title: string,
) {
  const binding = await prisma.sectionPresetBinding.findUnique({
    where: {
      projectSectionId_bindingKey: {
        projectSectionId: sectionId,
        bindingKey,
      },
    },
    include: {
      preset: {
        select: {
          variants: {
            where: { isActive: true },
            select: { id: true, sortOrder: true, isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      manualLoraEntries: {
        orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!binding) return false;
  const presetId = binding.presetId;
  if (!presetId || !binding.preset) return false;

  const before = binding.manualLoraEntries;
  const represented = new Set<string>();
  for (const row of binding.manualLoraEntries) {
    if (!isLoraStage(row.stage)) continue;
    const path = row.detachedFromPath ?? row.path;
    represented.add(`${row.stage}:${path}`);
  }

  const resolved = await resolveBindingVariantLoras({
    id: binding.id,
    presetId,
    variantId: binding.variantId,
    preset: binding.preset,
  });
  const rowsToCreate: Array<{
    projectSectionId: string;
    sectionBindingId: null;
    stage: LoraStage;
    path: string;
    weight: number;
    enabled: boolean;
    detachedFromBindingKey: string;
    detachedFromPresetId: string;
    detachedFromVariantId: string | null;
    detachedFromPath: string;
    metadata?: { suppressed: true };
    sortOrder: number;
  }> = [];

  if (resolved) {
    for (const stage of ["lora1", "lora2"] as const) {
      resolved.resolved[stage].forEach((entry, index) => {
        const key = `${stage}:${entry.path}`;
        if (represented.has(key)) return;
        represented.add(key);
        rowsToCreate.push({
          projectSectionId: sectionId,
          sectionBindingId: null,
          stage,
          path: entry.path,
          weight: entry.weight,
          enabled: entry.enabled,
          detachedFromBindingKey: binding.bindingKey,
          detachedFromPresetId: presetId,
          detachedFromVariantId: resolved.variantId,
          detachedFromPath: entry.path,
          sortOrder: index,
        });
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of binding.manualLoraEntries) {
      await tx.sectionManualLoraEntry.update({
        where: { id: row.id },
        data: {
          sectionBindingId: null,
          detachedFromBindingKey: row.detachedFromBindingKey ?? binding.bindingKey,
          detachedFromPresetId: row.detachedFromPresetId ?? presetId,
          detachedFromVariantId: row.detachedFromVariantId ?? resolved?.variantId ?? binding.variantId,
          detachedFromPath: row.detachedFromPath ?? row.path,
          metadata: readSuppressed(row.metadata) ? { suppressed: true } : row.metadata ?? undefined,
        },
      });
    }

    if (rowsToCreate.length > 0) {
      await tx.sectionManualLoraEntry.createMany({ data: rowsToCreate });
    }
  });

  const after = await prisma.sectionManualLoraEntry.findMany({
    where: {
      projectSectionId: sectionId,
      detachedFromBindingKey: binding.bindingKey,
    },
    orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
  });
  await recordSectionChange({
    sectionId,
    dimension: "lora",
    title,
    before,
    after,
  });

  return true;
}

export async function detachSectionLorasFromPresetBinding(
  sectionId: string,
  bindingId: string,
  title = "Detach preset LoRA after prompt customization",
) {
  const handled = await detachNormalizedSectionLorasFromPresetBinding(sectionId, bindingId, title);
  if (handled) return;
}
