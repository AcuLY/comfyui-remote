import { switchBindingVariant } from "@/lib/actions";
import { prisma } from "@/lib/prisma";

export type SwitchVariantUpdate = {
  sectionId: string;
  bindingId: string;
  newVariantId: string;
};

export type SwitchVariantResult = SwitchVariantUpdate & {
  ok: boolean;
  result?: Awaited<ReturnType<typeof switchBindingVariant>>;
  error?: string;
};

export type SyncPresetVariantsInput = {
  sourceProjectId: string;
  sourcePresetName: string;
  targetPresetName: string;
  matchSectionsBy?: "name";
  matchVariantsBy?: "name";
  dryRun?: boolean;
};

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function isSwitchVariantUpdate(value: unknown): value is SwitchVariantUpdate {
  if (!value || typeof value !== "object") return false;
  const update = value as Record<string, unknown>;
  return (
    typeof update.sectionId === "string" &&
    typeof update.bindingId === "string" &&
    typeof update.newVariantId === "string" &&
    update.sectionId.trim().length > 0 &&
    update.bindingId.trim().length > 0 &&
    update.newVariantId.trim().length > 0
  );
}

export function parseSwitchVariantUpdates(body: unknown): SwitchVariantUpdate[] {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid JSON body");
  }

  const updates = (body as Record<string, unknown>).updates;
  if (!Array.isArray(updates)) {
    throw new Error("updates must be an array");
  }

  return updates.map((update, index) => {
    if (!isSwitchVariantUpdate(update)) {
      throw new Error(`updates[${index}] must include sectionId, bindingId, and newVariantId`);
    }
    return {
      sectionId: update.sectionId.trim(),
      bindingId: update.bindingId.trim(),
      newVariantId: update.newVariantId.trim(),
    };
  });
}

export async function switchProjectVariants(
  projectId: string,
  updates: SwitchVariantUpdate[],
) {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("projectId is required");
  }

  const sectionIds = [...new Set(updates.map((update) => update.sectionId))];
  const sections = sectionIds.length > 0
    ? await prisma.projectSection.findMany({
        where: { projectId: normalizedProjectId, id: { in: sectionIds } },
        select: { id: true },
      })
    : [];
  const sectionIdSet = new Set(sections.map((section) => section.id));

  const results: SwitchVariantResult[] = [];
  for (const update of updates) {
    if (!sectionIdSet.has(update.sectionId)) {
      results.push({ ...update, ok: false, error: "Section not found in project" });
      continue;
    }

    try {
      const result = await switchBindingVariant(update.sectionId, update.bindingId, update.newVariantId);
      if (!result) {
        results.push({ ...update, ok: false, error: "Binding or variant not found" });
      } else {
        results.push({ ...update, ok: true, result });
      }
    } catch (error) {
      results.push({
        ...update,
        ok: false,
        error: error instanceof Error ? error.message : "Failed to switch variant",
      });
    }
  }

  return {
    total: results.length,
    successCount: results.filter((result) => result.ok).length,
    failureCount: results.filter((result) => !result.ok).length,
    results,
  };
}

function parseSyncInput(body: unknown): SyncPresetVariantsInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid JSON body");
  }

  const input = body as Record<string, unknown>;
  const sourceProjectId = input.sourceProjectId;
  const sourcePresetName = input.sourcePresetName;
  const targetPresetName = input.targetPresetName;
  const matchSectionsBy = input.matchSectionsBy ?? "name";
  const matchVariantsBy = input.matchVariantsBy ?? "name";

  if (typeof sourceProjectId !== "string" || !sourceProjectId.trim()) {
    throw new Error("sourceProjectId is required");
  }
  if (typeof sourcePresetName !== "string" || !sourcePresetName.trim()) {
    throw new Error("sourcePresetName is required");
  }
  if (typeof targetPresetName !== "string" || !targetPresetName.trim()) {
    throw new Error("targetPresetName is required");
  }
  if (matchSectionsBy !== "name") {
    throw new Error('Only matchSectionsBy: "name" is supported');
  }
  if (matchVariantsBy !== "name") {
    throw new Error('Only matchVariantsBy: "name" is supported');
  }

  return {
    sourceProjectId: sourceProjectId.trim(),
    sourcePresetName: sourcePresetName.trim(),
    targetPresetName: targetPresetName.trim(),
    matchSectionsBy,
    matchVariantsBy,
    dryRun: input.dryRun !== false,
  };
}

async function findPresetByNameOrSlug(nameOrSlug: string) {
  return prisma.preset.findFirst({
    where: {
      isActive: true,
      OR: [{ name: nameOrSlug }, { slug: nameOrSlug }],
    },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

async function getProjectSectionsForSync(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      sections: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          promptBlocks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              type: true,
              sourceId: true,
              variantId: true,
              bindingId: true,
              groupBindingId: true,
              categoryId: true,
              label: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
}

export async function syncPresetVariants(targetProjectId: string, body: unknown) {
  const input = parseSyncInput(body);
  const normalizedTargetProjectId = targetProjectId.trim();
  if (!normalizedTargetProjectId) {
    throw new Error("targetProjectId is required");
  }

  const [sourcePreset, targetPreset, sourceProject, targetProject] = await Promise.all([
    findPresetByNameOrSlug(input.sourcePresetName),
    findPresetByNameOrSlug(input.targetPresetName),
    getProjectSectionsForSync(input.sourceProjectId),
    getProjectSectionsForSync(normalizedTargetProjectId),
  ]);

  if (!sourcePreset) throw new Error("SOURCE_PRESET_NOT_FOUND");
  if (!targetPreset) throw new Error("TARGET_PRESET_NOT_FOUND");
  if (!sourceProject) throw new Error("SOURCE_PROJECT_NOT_FOUND");
  if (!targetProject) throw new Error("TARGET_PROJECT_NOT_FOUND");

  const sourceSectionsByName = new Map(
    sourceProject.sections
      .filter((section) => normalizeKey(section.name))
      .map((section) => [normalizeKey(section.name), section]),
  );
  const sourceVariantsById = new Map(sourcePreset.variants.map((variant) => [variant.id, variant]));
  const targetVariantsByName = new Map(
    targetPreset.variants.map((variant) => [normalizeKey(variant.name), variant]),
  );

  const plan = [];
  const updates: SwitchVariantUpdate[] = [];

  for (const targetSection of targetProject.sections) {
    const sectionKey = normalizeKey(targetSection.name);
    const sourceSection = sectionKey ? sourceSectionsByName.get(sectionKey) : undefined;
    if (!sourceSection) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        action: "skip",
        reason: "No matching source section",
      });
      continue;
    }

    const sourceBlock = sourceSection.promptBlocks.find(
      (block) => block.type === "preset" && block.sourceId === sourcePreset.id && block.variantId,
    );
    if (!sourceBlock?.variantId) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        action: "skip",
        reason: "Source preset block not found in source section",
      });
      continue;
    }

    const sourceVariant = sourceVariantsById.get(sourceBlock.variantId);
    if (!sourceVariant) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        action: "skip",
        reason: "Source variant is inactive or missing",
      });
      continue;
    }

    const targetVariant = targetVariantsByName.get(normalizeKey(sourceVariant.name));
    if (!targetVariant) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        sourceVariantId: sourceVariant.id,
        sourceVariantName: sourceVariant.name,
        action: "skip",
        reason: "No target variant with the same name",
      });
      continue;
    }

    const targetBlock = targetSection.promptBlocks.find(
      (block) => block.type === "preset" && block.sourceId === targetPreset.id && block.bindingId,
    );
    if (!targetBlock?.bindingId) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        sourceVariantId: sourceVariant.id,
        sourceVariantName: sourceVariant.name,
        targetVariantId: targetVariant.id,
        targetVariantName: targetVariant.name,
        action: "skip",
        reason: "Target preset block not found in target section",
      });
      continue;
    }

    if (targetBlock.variantId === targetVariant.id) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        bindingId: targetBlock.bindingId,
        currentVariantId: targetBlock.variantId,
        targetVariantId: targetVariant.id,
        targetVariantName: targetVariant.name,
        action: "skip",
        reason: "Target variant already selected",
      });
      continue;
    }

    const update = {
      sectionId: targetSection.id,
      bindingId: targetBlock.bindingId,
      newVariantId: targetVariant.id,
    };
    updates.push(update);
    plan.push({
      ...update,
      sectionName: targetSection.name,
      sourceSectionId: sourceSection.id,
      sourceVariantId: sourceVariant.id,
      sourceVariantName: sourceVariant.name,
      currentVariantId: targetBlock.variantId,
      targetVariantName: targetVariant.name,
      action: "switch",
    });
  }

  if (input.dryRun) {
    return {
      dryRun: true,
      sourceProject: { id: sourceProject.id, title: sourceProject.title },
      targetProject: { id: targetProject.id, title: targetProject.title },
      sourcePreset: { id: sourcePreset.id, name: sourcePreset.name },
      targetPreset: { id: targetPreset.id, name: targetPreset.name },
      plannedUpdateCount: updates.length,
      plan,
    };
  }

  const execution = await switchProjectVariants(normalizedTargetProjectId, updates);
  return {
    dryRun: false,
    sourceProject: { id: sourceProject.id, title: sourceProject.title },
    targetProject: { id: targetProject.id, title: targetProject.title },
    sourcePreset: { id: sourcePreset.id, name: sourcePreset.name },
    targetPreset: { id: targetPreset.id, name: targetPreset.name },
    plannedUpdateCount: updates.length,
    plan,
    execution,
  };
}
