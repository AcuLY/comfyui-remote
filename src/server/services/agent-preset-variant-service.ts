import { switchBindingVariant } from "@/lib/actions/prompt-block";
import { ordinaryPresetCategoryTypeWhere } from "@/lib/preset-resource-scope";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  buildGenerationPresetWhere,
  buildGenerationProjectWhere,
} from "@/server/repositories/generation-resource-boundary";
import { toPrismaJson } from "@/server/services/change-history-utils";

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
  sourcePresetId: string | null;
  sourcePresetName: string | null;
  targetPresetId: string | null;
  targetPresetName: string | null;
  matchSectionsBy?: "name";
  matchVariantsBy?: "name";
  dryRun?: boolean;
};

const DATABASE_QUERY_BATCH_SIZE = 250;
const SYNC_VARIANT_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
};
const ROLE_CATEGORY_NAMES = ["\u89d2\u8272"] as const;
const ROLE_CATEGORY_SLUGS = ["character", "characters", "role", "roles"] as const;

type SyncVariantBinding = {
  id: string;
  projectSectionId: string;
  bindingKey: string;
  variantId: string | null;
  preset: {
    name: string;
    variants: Array<{ id: string; name: string }>;
  } | null;
};
type ResolvedSyncVariantBinding = SyncVariantBinding & {
  preset: NonNullable<SyncVariantBinding["preset"]>;
};
type ProjectSectionBindingScope =
  | { kind: "role" }
  | { kind: "preset"; presetIds: readonly string[] };

function chunkArray<T>(items: readonly T[], size = DATABASE_QUERY_BATCH_SIZE) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function optionalStringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRoleCategory(category: { name: string; slug: string }) {
  const normalizedName = normalizeKey(category.name);
  const normalizedSlug = normalizeKey(category.slug);
  return (
    ROLE_CATEGORY_NAMES.some((name) => normalizedName === name) ||
    ROLE_CATEGORY_SLUGS.some((slug) => normalizedSlug === slug)
  );
}

export function buildRoleCategoryWhere(): Prisma.PresetCategoryWhereInput {
  return {
    OR: [
      { name: { in: [...ROLE_CATEGORY_NAMES] } },
      { slug: { in: [...ROLE_CATEGORY_SLUGS] } },
    ],
  };
}

function buildSectionBindingScopeWhere(scope: ProjectSectionBindingScope): Prisma.SectionPresetBindingWhereInput {
  if (scope.kind === "role") {
    return {
      presetId: { not: null },
      category: buildRoleCategoryWhere(),
    };
  }

  return {
    presetId: { in: [...new Set(scope.presetIds)] },
  };
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
  const sectionIdSet = new Set<string>();
  for (const sectionIdChunk of chunkArray(sectionIds)) {
    const sections = await prisma.projectSection.findMany({
        where: {
          projectId: normalizedProjectId,
          id: { in: sectionIdChunk },
          project: buildGenerationProjectWhere({ id: normalizedProjectId }),
        },
        select: { id: true },
      });
    for (const section of sections) {
      sectionIdSet.add(section.id);
    }
  }

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

async function applySyncVariantUpdates(
  projectId: string,
  updates: SwitchVariantUpdate[],
) {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("projectId is required");
  }

  const sectionIds = [...new Set(updates.map((update) => update.sectionId))];
  const sectionIdSet = new Set<string>();
  for (const sectionIdChunk of chunkArray(sectionIds)) {
    const sections = await prisma.projectSection.findMany({
      where: {
        projectId: normalizedProjectId,
        id: { in: sectionIdChunk },
        project: buildGenerationProjectWhere({ id: normalizedProjectId }),
      },
      select: { id: true },
    });
    for (const section of sections) {
      sectionIdSet.add(section.id);
    }
  }

  const validUpdates = updates.filter((update) => sectionIdSet.has(update.sectionId));
  const bindingKeys = [...new Set(validUpdates.map((update) => update.bindingId))];
  const bindingByKey = new Map<string, SyncVariantBinding>();

  if (bindingKeys.length > 0) {
    for (const sectionIdChunk of chunkArray([...new Set(validUpdates.map((update) => update.sectionId))])) {
      const bindings = await prisma.sectionPresetBinding.findMany({
        where: {
          projectSectionId: { in: sectionIdChunk },
          bindingKey: { in: bindingKeys },
        },
        include: {
          preset: {
            select: {
              id: true,
              name: true,
              variants: {
                where: { isActive: true },
                select: { id: true, name: true, sortOrder: true, isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });
      for (const binding of bindings) {
        bindingByKey.set(`${binding.projectSectionId}\0${binding.bindingKey}`, binding);
      }
    }
  }

  const results: SwitchVariantResult[] = [];
  const changes: Array<{
    update: SwitchVariantUpdate;
    binding: ResolvedSyncVariantBinding;
    variant: { id: string; name: string };
  }> = [];

  for (const update of updates) {
    if (!sectionIdSet.has(update.sectionId)) {
      results.push({ ...update, ok: false, error: "Section not found in project" });
      continue;
    }

    const binding = bindingByKey.get(`${update.sectionId}\0${update.bindingId}`);
    if (!binding?.preset) {
      results.push({ ...update, ok: false, error: "Binding or variant not found" });
      continue;
    }

    const variant = binding.preset.variants.find((item) => item.id === update.newVariantId);
    if (!variant) {
      results.push({ ...update, ok: false, error: "Binding or variant not found" });
      continue;
    }

    changes.push({ update, binding: { ...binding, preset: binding.preset }, variant });
    results.push({ ...update, ok: true });
  }

  if (changes.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const before = {
          id: change.binding.id,
          bindingKey: change.binding.bindingKey,
          variantId: change.binding.variantId,
        };
        const updatedBinding = await tx.sectionPresetBinding.update({
          where: { id: change.binding.id },
          data: { variantId: change.update.newVariantId },
          select: { id: true, bindingKey: true, variantId: true },
        });
        const after = {
          id: updatedBinding.id,
          bindingKey: updatedBinding.bindingKey,
          variantId: updatedBinding.variantId,
        };

        await tx.sectionChangeLog.create({
          data: {
            projectSectionId: change.update.sectionId,
            dimension: "prompt",
            title: `切换预设变体：${change.binding.preset.name} / ${change.variant.name}`,
            before: toPrismaJson(before),
            after: toPrismaJson(after),
          },
        });
      }
    }, SYNC_VARIANT_TRANSACTION_OPTIONS);
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
  const sourcePresetId = optionalStringField(input, "sourcePresetId");
  const sourcePresetName = optionalStringField(input, "sourcePresetName");
  const targetPresetId = optionalStringField(input, "targetPresetId");
  const targetPresetName = optionalStringField(input, "targetPresetName");
  const matchSectionsBy = input.matchSectionsBy ?? "name";
  const matchVariantsBy = input.matchVariantsBy ?? "name";

  if (typeof sourceProjectId !== "string" || !sourceProjectId.trim()) {
    throw new Error("sourceProjectId is required");
  }
  const hasSourcePresetReference = Boolean(sourcePresetId || sourcePresetName);
  const hasTargetPresetReference = Boolean(targetPresetId || targetPresetName);
  if (hasSourcePresetReference !== hasTargetPresetReference) {
    throw new Error("source and target preset references must be provided together");
  }
  if (matchSectionsBy !== "name") {
    throw new Error('Only matchSectionsBy: "name" is supported');
  }
  if (matchVariantsBy !== "name") {
    throw new Error('Only matchVariantsBy: "name" is supported');
  }

  return {
    sourceProjectId: sourceProjectId.trim(),
    sourcePresetId,
    sourcePresetName,
    targetPresetId,
    targetPresetName,
    matchSectionsBy,
    matchVariantsBy,
    dryRun: input.dryRun !== false,
  };
}

async function findPresetByReference(
  reference: { presetId: string | null; nameOrSlug: string | null },
  errorPrefix: "SOURCE" | "TARGET",
) {
  if (reference.presetId) {
    return prisma.preset.findFirst({
      where: buildGenerationPresetWhere({
        id: reference.presetId,
        isActive: true,
        category: { type: ordinaryPresetCategoryTypeWhere() },
      }),
      include: {
        category: { select: { name: true, slug: true } },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  const normalizedInput = reference.nameOrSlug?.trim() ?? "";
  if (!normalizedInput) return null;

  const exactPreset = await prisma.preset.findFirst({
    where: buildGenerationPresetWhere({
      isActive: true,
      category: { type: ordinaryPresetCategoryTypeWhere() },
      OR: [{ name: normalizedInput }, { slug: normalizedInput }],
    }),
    include: {
      category: { select: { name: true, slug: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (exactPreset) return exactPreset;

  const partialMatches = await prisma.preset.findMany({
    where: buildGenerationPresetWhere({
      isActive: true,
      category: { type: ordinaryPresetCategoryTypeWhere() },
      OR: [{ name: { contains: normalizedInput } }, { slug: { contains: normalizedInput } }],
    }),
    include: {
      category: { select: { name: true, slug: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const roleMatches = partialMatches.filter((preset) => isRoleCategory(preset.category));
  const usableMatches = roleMatches.length > 0 ? roleMatches : partialMatches;
  if (usableMatches.length > 1) {
    throw new Error(`${errorPrefix}_PRESET_AMBIGUOUS`);
  }
  return usableMatches[0] ?? null;
}

async function getProjectSectionsForSync(
  projectId: string,
  bindingScope: ProjectSectionBindingScope,
) {
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: {
      id: true,
      title: true,
    },
  });
  if (!project) return null;

  const sections = [];
  for (let skip = 0; ; skip += DATABASE_QUERY_BATCH_SIZE) {
    const page = await prisma.projectSection.findMany({
      where: {
        projectId,
        enabled: true,
        project: buildGenerationProjectWhere({ id: projectId }),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      skip,
      take: DATABASE_QUERY_BATCH_SIZE,
      select: {
        id: true,
        name: true,
        sortOrder: true,
        presetBindingRows: {
          where: buildSectionBindingScopeWhere(bindingScope),
          orderBy: { sortOrder: "asc" },
          select: {
            bindingKey: true,
            presetId: true,
            variantId: true,
            sortOrder: true,
            category: { select: { name: true, slug: true } },
            preset: {
              select: {
                id: true,
                name: true,
                variants: {
                  where: { isActive: true },
                  orderBy: { sortOrder: "asc" },
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
      },
    });
    sections.push(...page);
    if (page.length < DATABASE_QUERY_BATCH_SIZE) break;
  }

  return { ...project, sections };
}

type SyncProject = NonNullable<Awaited<ReturnType<typeof getProjectSectionsForSync>>>;
type SyncSection = SyncProject["sections"][number];

function hasExplicitPresetReference(input: SyncPresetVariantsInput) {
  return Boolean(input.sourcePresetId || input.sourcePresetName || input.targetPresetId || input.targetPresetName);
}

function pickSectionRoleBinding(section: SyncSection, requireVariant: boolean) {
  return section.presetBindingRows.find((binding) => {
    if (!binding.presetId || !binding.preset) return false;
    if (requireVariant && !binding.variantId) return false;
    return isRoleCategory(binding.category);
  }) ?? null;
}

function buildRoleBindingSyncPlan(sourceProject: SyncProject, targetProject: SyncProject) {
  const sourceSectionsByName = new Map(
    sourceProject.sections
      .filter((section) => normalizeKey(section.name))
      .map((section) => [normalizeKey(section.name), section]),
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

    const sourceBinding = pickSectionRoleBinding(sourceSection, true);
    if (!sourceBinding?.variantId || !sourceBinding.preset) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        action: "skip",
        reason: "Source role preset block not found in source section",
      });
      continue;
    }

    const sourceVariant = sourceBinding.preset.variants.find((variant) => variant.id === sourceBinding.variantId);
    if (!sourceVariant) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        sourcePresetId: sourceBinding.presetId,
        action: "skip",
        reason: "Source role variant is inactive or missing",
      });
      continue;
    }

    const targetBinding = pickSectionRoleBinding(targetSection, false);
    if (!targetBinding?.bindingKey || !targetBinding.preset) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        sourcePresetId: sourceBinding.presetId,
        sourcePresetName: sourceBinding.preset.name,
        sourceVariantId: sourceVariant.id,
        sourceVariantName: sourceVariant.name,
        action: "skip",
        reason: "Target role preset block not found in target section",
      });
      continue;
    }

    const targetVariantsByName = new Map(
      targetBinding.preset.variants.map((variant) => [normalizeKey(variant.name), variant]),
    );
    const targetVariant = targetVariantsByName.get(normalizeKey(sourceVariant.name));
    if (!targetVariant) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        sourcePresetId: sourceBinding.presetId,
        sourcePresetName: sourceBinding.preset.name,
        sourceVariantId: sourceVariant.id,
        sourceVariantName: sourceVariant.name,
        targetPresetId: targetBinding.presetId,
        targetPresetName: targetBinding.preset.name,
        action: "skip",
        reason: "No target role variant with the same name",
      });
      continue;
    }

    if (targetBinding.variantId === targetVariant.id) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        bindingId: targetBinding.bindingKey,
        sourcePresetId: sourceBinding.presetId,
        sourcePresetName: sourceBinding.preset.name,
        sourceVariantId: sourceVariant.id,
        sourceVariantName: sourceVariant.name,
        currentVariantId: targetBinding.variantId,
        targetPresetId: targetBinding.presetId,
        targetPresetName: targetBinding.preset.name,
        targetVariantId: targetVariant.id,
        targetVariantName: targetVariant.name,
        action: "skip",
        reason: "Target variant already selected",
      });
      continue;
    }

    const update = {
      sectionId: targetSection.id,
      bindingId: targetBinding.bindingKey,
      newVariantId: targetVariant.id,
    };
    updates.push(update);
    plan.push({
      ...update,
      sectionName: targetSection.name,
      sourceSectionId: sourceSection.id,
      sourcePresetId: sourceBinding.presetId,
      sourcePresetName: sourceBinding.preset.name,
      sourceVariantId: sourceVariant.id,
      sourceVariantName: sourceVariant.name,
      currentVariantId: targetBinding.variantId,
      targetPresetId: targetBinding.presetId,
      targetPresetName: targetBinding.preset.name,
      targetVariantName: targetVariant.name,
      action: "switch",
    });
  }

  return { plan, updates };
}

export async function syncPresetVariants(targetProjectId: string, body: unknown) {
  const input = parseSyncInput(body);
  const normalizedTargetProjectId = targetProjectId.trim();
  if (!normalizedTargetProjectId) {
    throw new Error("targetProjectId is required");
  }

  const explicitPresetMode = hasExplicitPresetReference(input);
  const [sourcePreset, targetPreset] = explicitPresetMode
    ? await Promise.all([
      findPresetByReference({ presetId: input.sourcePresetId, nameOrSlug: input.sourcePresetName }, "SOURCE"),
      findPresetByReference({ presetId: input.targetPresetId, nameOrSlug: input.targetPresetName }, "TARGET"),
    ])
    : [null, null];

  if (explicitPresetMode && !sourcePreset) throw new Error("SOURCE_PRESET_NOT_FOUND");
  if (explicitPresetMode && !targetPreset) throw new Error("TARGET_PRESET_NOT_FOUND");

  const sourceBindingScope: ProjectSectionBindingScope = explicitPresetMode && sourcePreset
    ? { kind: "preset", presetIds: [sourcePreset.id] }
    : { kind: "role" };
  const targetBindingScope: ProjectSectionBindingScope = explicitPresetMode && targetPreset
    ? { kind: "preset", presetIds: [targetPreset.id] }
    : { kind: "role" };
  const [sourceProject, targetProject] = await Promise.all([
    getProjectSectionsForSync(input.sourceProjectId, sourceBindingScope),
    getProjectSectionsForSync(normalizedTargetProjectId, targetBindingScope),
  ]);

  if (!sourceProject) throw new Error("SOURCE_PROJECT_NOT_FOUND");
  if (!targetProject) throw new Error("TARGET_PROJECT_NOT_FOUND");

  if (!explicitPresetMode) {
    const { plan, updates } = buildRoleBindingSyncPlan(sourceProject, targetProject);
    if (input.dryRun) {
      return {
        dryRun: true,
        sourceProject: { id: sourceProject.id, title: sourceProject.title },
        targetProject: { id: targetProject.id, title: targetProject.title },
        sourcePreset: null,
        targetPreset: null,
        plannedUpdateCount: updates.length,
        plan,
      };
    }

    const execution = await applySyncVariantUpdates(normalizedTargetProjectId, updates);
    return {
      dryRun: false,
      sourceProject: { id: sourceProject.id, title: sourceProject.title },
      targetProject: { id: targetProject.id, title: targetProject.title },
      sourcePreset: null,
      targetPreset: null,
      plannedUpdateCount: updates.length,
      plan,
      execution,
    };
  }

  if (!sourcePreset || !targetPreset) {
    throw new Error("PRESET_REFERENCE_NOT_FOUND");
  }

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

    const sourceBinding = sourceSection.presetBindingRows.find(
      (binding) => binding.presetId === sourcePreset.id && binding.variantId,
    );
    if (!sourceBinding?.variantId) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        action: "skip",
        reason: "Source preset block not found in source section",
      });
      continue;
    }

    const sourceVariant = sourceVariantsById.get(sourceBinding.variantId);
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

    const targetBinding = targetSection.presetBindingRows.find(
      (binding) => binding.presetId === targetPreset.id && binding.bindingKey,
    );
    if (!targetBinding?.bindingKey) {
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

    if (targetBinding.variantId === targetVariant.id) {
      plan.push({
        sectionId: targetSection.id,
        sectionName: targetSection.name,
        sourceSectionId: sourceSection.id,
        bindingId: targetBinding.bindingKey,
        currentVariantId: targetBinding.variantId,
        targetVariantId: targetVariant.id,
        targetVariantName: targetVariant.name,
        action: "skip",
        reason: "Target variant already selected",
      });
      continue;
    }

    const update = {
      sectionId: targetSection.id,
      bindingId: targetBinding.bindingKey,
      newVariantId: targetVariant.id,
    };
    updates.push(update);
    plan.push({
      ...update,
      sectionName: targetSection.name,
      sourceSectionId: sourceSection.id,
      sourceVariantId: sourceVariant.id,
      sourceVariantName: sourceVariant.name,
      currentVariantId: targetBinding.variantId,
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

  const execution = await applySyncVariantUpdates(normalizedTargetProjectId, updates);
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
