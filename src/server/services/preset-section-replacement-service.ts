import { revalidatePath } from "next/cache";
import { ordinaryPresetCategoryTypeWhere } from "@/lib/actions/preset-resource-scope";
import { prisma } from "@/lib/prisma";
import {
  planPresetSectionReplacements,
  type PresetReplacementBinding,
  type PresetReplacementPlan,
  type PresetReplacementPreset,
  type PresetSectionReplacementRule,
} from "./preset-section-replacement-core";

export type PresetReplacementTargetType = "project" | "template";

export type PresetSectionReplacementRequest = {
  dryRun: boolean;
  rules: PresetSectionReplacementRule[];
};

type ReplacementTarget = {
  id: string;
  name: string;
  bindings: PresetReplacementBinding[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parsePresetSectionReplacementRequest(body: unknown): PresetSectionReplacementRequest {
  if (!isRecord(body)) throw new Error("Invalid JSON body");
  const rawRules = body.rules;
  if (!Array.isArray(rawRules)) throw new Error("rules must be an array");

  const rules = rawRules.map((item, index) => {
    if (!isRecord(item)) throw new Error(`rules[${index}] must be an object`);
    const fromPresetId = readString(item.fromPresetId);
    const toPresetId = readString(item.toPresetId);
    const toVariantId = readString(item.toVariantId);
    return {
      fromPresetId,
      toPresetId,
      ...(toVariantId ? { toVariantId } : {}),
    };
  });

  return {
    dryRun: body.dryRun !== false,
    rules,
  };
}

function collectPresetIds(rules: readonly PresetSectionReplacementRule[]) {
  return [...new Set(rules.flatMap((rule) => [rule.fromPresetId, rule.toPresetId].map(readString)).filter(Boolean))];
}

async function loadReplacementPresets(rules: readonly PresetSectionReplacementRule[]): Promise<PresetReplacementPreset[]> {
  const presetIds = collectPresetIds(rules);
  if (presetIds.length === 0) return [];

  const presets = await prisma.preset.findMany({
    where: {
      id: { in: presetIds },
      category: { type: ordinaryPresetCategoryTypeWhere() },
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
      isActive: true,
      variants: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          isActive: true,
          sortOrder: true,
        },
      },
    },
  });

  return presets;
}

function sectionName(name: string | null, sortOrder: number, prefix: string) {
  return name?.trim() || `${prefix} ${sortOrder + 1}`;
}

async function loadProjectTarget(projectId: string): Promise<ReplacementTarget> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      sections: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          presetBindingRows: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              bindingKey: true,
              categoryId: true,
              presetId: true,
              variantId: true,
              presetGroupId: true,
              groupBindingKey: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  return {
    id: project.id,
    name: project.title,
    bindings: project.sections.flatMap((section) =>
      section.presetBindingRows.map((binding) => ({
        ...binding,
        ownerId: section.id,
        ownerName: sectionName(section.name, section.sortOrder, "小节"),
        ownerSortOrder: section.sortOrder,
      })),
    ),
  };
}

async function loadTemplateTarget(templateId: string): Promise<ReplacementTarget> {
  const template = await prisma.projectTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      sections: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          presetBindingRows: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              bindingKey: true,
              categoryId: true,
              presetId: true,
              variantId: true,
              presetGroupId: true,
              groupBindingKey: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  return {
    id: template.id,
    name: template.name,
    bindings: template.sections.flatMap((section) =>
      section.presetBindingRows.map((binding) => ({
        ...binding,
        ownerId: section.id,
        ownerName: sectionName(section.name, section.sortOrder, "模板小节"),
        ownerSortOrder: section.sortOrder,
      })),
    ),
  };
}

async function loadReplacementTarget(targetType: PresetReplacementTargetType, targetId: string) {
  return targetType === "project"
    ? loadProjectTarget(targetId)
    : loadTemplateTarget(targetId);
}

function flattenUpdates(plan: PresetReplacementPlan) {
  return plan.rules.flatMap((rule) => rule.updates);
}

async function applyReplacementPlan(targetType: PresetReplacementTargetType, plan: PresetReplacementPlan) {
  const updates = flattenUpdates(plan);
  if (updates.length === 0) {
    return { plannedUpdateCount: 0, updatedCount: 0 };
  }

  const counts = await prisma.$transaction(async (tx) => {
    let updatedCount = 0;
    for (const update of updates) {
      const result = targetType === "project"
        ? await tx.sectionPresetBinding.updateMany({
            where: { id: update.bindingRowId, presetId: update.fromPresetId },
            data: { presetId: update.toPresetId, variantId: update.toVariantId },
          })
        : await tx.templateSectionPresetBinding.updateMany({
            where: { id: update.bindingRowId, presetId: update.fromPresetId },
            data: { presetId: update.toPresetId, variantId: update.toVariantId },
          });
      updatedCount += result.count;
    }
    return { updatedCount };
  });

  return {
    plannedUpdateCount: updates.length,
    updatedCount: counts.updatedCount,
  };
}

function revalidateReplacementTarget(targetType: PresetReplacementTargetType, targetId: string) {
  if (targetType === "project") {
    revalidatePath("/projects");
    revalidatePath(`/projects/${targetId}`);
    return;
  }

  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${targetId}/edit`);
}

export async function replacePresetSectionBindings(input: {
  targetType: PresetReplacementTargetType;
  targetId: string;
  rules: PresetSectionReplacementRule[];
  dryRun: boolean;
}) {
  const targetId = input.targetId.trim();
  if (!targetId) throw new Error("targetId is required");

  const [presets, target] = await Promise.all([
    loadReplacementPresets(input.rules),
    loadReplacementTarget(input.targetType, targetId),
  ]);
  const initialDryRun = planPresetSectionReplacements({
    presets,
    bindings: target.bindings,
    rules: input.rules,
  });

  if (input.dryRun) {
    return {
      dryRun: true,
      targetType: input.targetType,
      target: { id: target.id, name: target.name },
      initialDryRun,
    };
  }

  if (initialDryRun.hasBlockers) {
    throw new Error("替换规则存在阻塞，无法 Apply");
  }

  const apply = await applyReplacementPlan(input.targetType, initialDryRun);
  revalidateReplacementTarget(input.targetType, targetId);

  const verificationTarget = await loadReplacementTarget(input.targetType, targetId);
  const verification = planPresetSectionReplacements({
    presets,
    bindings: verificationTarget.bindings,
    rules: input.rules,
  });

  return {
    dryRun: false,
    targetType: input.targetType,
    target: { id: target.id, name: target.name },
    initialDryRun,
    apply,
    verification,
  };
}
